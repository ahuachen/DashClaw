/**
 * Sequential workflow executor.
 * Iterates steps, manages rolling context, dispatches to type-specific handlers,
 * creates child action records for each step.
 */

import crypto from 'crypto';
import { resolveVars } from './template-vars.js';
import {
  handleKnowledgeSearch,
  handleCapabilityInvoke,
  handlePrompt,
} from './step-handlers.js';
import { createActionRecord } from './repositories/actions.repository.js';

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
  const stepResults = [];
  const start = Date.now();

  for (const step of steps) {
    const stepStart = Date.now();
    const stepActionId = `act_${crypto.randomUUID()}`;

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

    try {
      const output = await executeStep(sql, orgId, step, context, workflowContext);
      const stepElapsed = Date.now() - stepStart;

      // Update child action to completed
      await sql`
        UPDATE action_records
        SET status = 'completed',
            output_summary = ${JSON.stringify(output).slice(0, 500)},
            timestamp_end = ${new Date().toISOString()},
            duration_ms = ${stepElapsed}
        WHERE action_id = ${stepActionId} AND org_id = ${orgId}
      `;

      // Add to rolling context
      context.steps[step.id] = { output };

      stepResults.push({
        step_id: step.id,
        type: step.type,
        status: 'completed',
        elapsed_ms: stepElapsed,
      });
    } catch (err) {
      const stepElapsed = Date.now() - stepStart;

      // Update child action to failed
      await sql`
        UPDATE action_records
        SET status = 'failed',
            error_message = ${err.message.slice(0, 500)},
            timestamp_end = ${new Date().toISOString()},
            duration_ms = ${stepElapsed}
        WHERE action_id = ${stepActionId} AND org_id = ${orgId}
      `;

      stepResults.push({
        step_id: step.id,
        type: step.type,
        status: 'failed',
        error: err.message,
        elapsed_ms: stepElapsed,
      });

      // Stop on first failure
      return {
        success: false,
        steps: stepResults,
        error: `Step ${step.id} failed: ${err.message}`,
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
