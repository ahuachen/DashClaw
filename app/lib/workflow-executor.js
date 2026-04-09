/**
 * Sequential workflow executor.
 * Iterates steps, manages rolling context, dispatches to type-specific handlers,
 * creates child action records for each step.
 */

import crypto from 'crypto';
import { resolveVars } from './template-vars.js';
import { evaluateCondition } from './workflow-condition.js';
import {
  handleKnowledgeSearch,
  handleCapabilityInvoke,
  handlePrompt,
} from './step-handlers.js';
import { createActionRecord } from './repositories/actions.repository.js';
import { calculateBackoffDelay, sleep } from './capability-invoke.js';

const STEP_RISK_SCORES = {
  knowledge_search: 10,
  capability_invoke: 20,
  prompt: 20,
};

async function executeStep(sql, orgId, step, context, workflowContext) {
  const resolvedConfig = resolveVars(step.config || {}, context);

  switch (step.type) {
    case 'knowledge_search':
      return handleKnowledgeSearch(sql, orgId, resolvedConfig);
    case 'capability_invoke':
      return handleCapabilityInvoke(sql, orgId, resolvedConfig);
    case 'prompt':
      return handlePrompt(sql, orgId, resolvedConfig, workflowContext);
    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

export async function executeWorkflow(
  sql,
  orgId,
  parentActionId,
  steps,
  variables,
  workflowContext,
) {
  const context = { variables: variables || {}, steps: {} };
  const persistStepResult = workflowContext.persistStepResult || null;
  const stepResults = [];
  const start = Date.now();

  for (const step of steps) {
    const stepStart = Date.now();
    const stepActionId = `act_${crypto.randomUUID()}`;

    // Condition evaluation — skip if falsy
    if (step.condition) {
      const { shouldRun } = evaluateCondition(step.condition, context);
      if (!shouldRun) {
        const stepIndex = steps.indexOf(step);

        await createActionRecord(sql, {
          orgId,
          action_id: stepActionId,
          data: {
            agent_id: workflowContext.agentId || 'anonymous',
            action_type: `workflow_step:${step.type}`,
            declared_goal: `Step: ${step.name || step.id}`,
            parent_action_id: parentActionId,
            risk_score: 0,
            confidence: 100,
            systems_touched: [`workflow_step:${step.type}`],
            reversible: true,
            input_summary: 'Condition not met',
          },
          actionStatus: 'skipped',
          costEstimate: 0,
          signature: null,
          verified: false,
          timestamp_start: new Date().toISOString(),
        });

        if (persistStepResult) {
          await persistStepResult({
            step_id: step.id,
            step_index: stepIndex,
            step_type: step.type,
            step_name: step.name || step.id,
            status: 'skipped',
            duration_ms: 0,
            finished_at: new Date().toISOString(),
          }).catch((err) => console.warn('[Executor] Step result write failed:', err.message));
        }

        stepResults.push({
          step_id: step.id,
          type: step.type,
          status: 'skipped',
          elapsed_ms: 0,
        });
        continue;
      }
    }

    // Create child action record
    await createActionRecord(sql, {
      orgId,
      action_id: stepActionId,
      data: {
        agent_id: workflowContext.agentId || 'anonymous',
        action_type: `workflow_step:${step.type}`,
        declared_goal: `Step: ${step.name || step.id}`,
        parent_action_id: parentActionId,
        risk_score: STEP_RISK_SCORES[step.type] || 20,
        confidence: 50,
        systems_touched: [`workflow_step:${step.type}`],
        reversible: true,
        input_summary: JSON.stringify(resolveVars(step.config || {}, context)).slice(0, 500),
      },
      actionStatus: 'running',
      costEstimate: 0,
      signature: null,
      verified: false,
      timestamp_start: new Date().toISOString(),
    });

    const stepIndex = steps.indexOf(step);

    if (persistStepResult) {
      await persistStepResult({
        step_id: step.id,
        step_index: stepIndex,
        step_type: step.type,
        step_name: step.name || step.id,
        status: 'running',
        input_json: resolveVars(step.config || {}, context),
        started_at: new Date().toISOString(),
      }).catch((err) => console.warn('[Executor] Step result write failed:', err.message));
    }

    const maxRetries = step.retry_policy?.max_retries || 0;
    const backoff = step.retry_policy?.backoff || 'none';
    const baseDelayMs = step.retry_policy?.base_delay_ms || 1000;
    const maxDelayMs = step.retry_policy?.max_delay_ms || 30000;
    let lastError = null;
    let succeeded = false;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const output = await executeStep(sql, orgId, step, context, workflowContext);
        const stepElapsed = Date.now() - stepStart;

        const retryPrefix = attempt > 0 ? `[retried: ${attempt + 1} attempts] ` : '';
        await sql`
          UPDATE action_records
          SET status = 'completed',
              output_summary = ${retryPrefix + JSON.stringify(output).slice(0, 500 - retryPrefix.length)},
              timestamp_end = ${new Date().toISOString()},
              duration_ms = ${stepElapsed}
          WHERE action_id = ${stepActionId} AND org_id = ${orgId}
        `;

        context.steps[step.id] = { output };

        if (persistStepResult) {
          await persistStepResult({
            step_id: step.id,
            step_index: stepIndex,
            step_type: step.type,
            step_name: step.name || step.id,
            status: 'completed',
            output_json: output,
            retry_count: attempt,
            duration_ms: stepElapsed,
            finished_at: new Date().toISOString(),
          }).catch((err) => console.warn('[Executor] Step result write failed:', err.message));
        }

        stepResults.push({
          step_id: step.id,
          type: step.type,
          status: 'completed',
          elapsed_ms: stepElapsed,
          ...(attempt > 0 ? { retry_metadata: { total_attempts: attempt + 1, retried: true } } : {}),
        });
        succeeded = true;
        break;
      } catch (err) {
        lastError = err;

        if (attempt < maxRetries) {
          const delay = calculateBackoffDelay(attempt, backoff, baseDelayMs, maxDelayMs);
          if (delay > 0) await sleep(delay);
          continue;
        }
      }
    }

    if (!succeeded) {
      const stepElapsed = Date.now() - stepStart;
      const retryPrefix = maxRetries > 0 ? `[retried: ${maxRetries + 1} attempts] ` : '';

      await sql`
        UPDATE action_records
        SET status = 'failed',
            error_message = ${retryPrefix + lastError.message.slice(0, 500 - retryPrefix.length)},
            timestamp_end = ${new Date().toISOString()},
            duration_ms = ${stepElapsed}
        WHERE action_id = ${stepActionId} AND org_id = ${orgId}
      `;

      stepResults.push({
        step_id: step.id,
        type: step.type,
        status: 'failed',
        error: lastError.message,
        elapsed_ms: stepElapsed,
        ...(maxRetries > 0 ? { retry_metadata: { total_attempts: maxRetries + 1, retried: true } } : {}),
      });

      if (persistStepResult) {
        await persistStepResult({
          step_id: step.id,
          step_index: stepIndex,
          step_type: step.type,
          step_name: step.name || step.id,
          status: 'failed',
          error_message: lastError.message,
          retry_count: maxRetries,
          duration_ms: stepElapsed,
          finished_at: new Date().toISOString(),
        }).catch((err) => console.warn('[Executor] Step result write failed:', err.message));
      }

      if (step.continue_on_failure) {
        continue;
      }

      return {
        success: false,
        steps: stepResults,
        error: `Step ${step.id} failed: ${lastError.message}`,
        total_elapsed_ms: Date.now() - start,
      };
    }
  }

  // All steps completed — return final step output as result
  const lastStepId = steps[steps.length - 1].id;
  const result = context.steps[lastStepId]?.output || {};

  return {
    success: true,
    steps: stepResults,
    result,
    total_elapsed_ms: Date.now() - start,
  };
}
