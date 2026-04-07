export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSql } from '../../../../../lib/db.js';
import { getOrgId } from '../../../../../lib/org.js';
import { apiErrorResponse } from '../../../../../lib/apiErrors.js';
import { evaluateGuard } from '../../../../../lib/guard.js';
import { getWorkflowTemplate } from '../../../../../lib/repositories/workflow-templates.repository.js';
import { getModelStrategy } from '../../../../../lib/repositories/model-strategies.repository.js';
import {
  createActionRecord,
  createBlockedActionRecord,
} from '../../../../../lib/repositories/actions.repository.js';
import { scanSensitiveData } from '../../../../../lib/security.js';
import { executeWorkflow } from '../../../../../lib/workflow-executor.js';
import { checkQuotaFast, getOrgPlan, incrementMeter } from '../../../../../lib/usage.js';

function redactAny(value, findings) {
  if (typeof value === 'string') {
    const scan = scanSensitiveData(value);
    if (!scan.clean) findings.push(...scan.findings);
    return scan.redacted;
  }
  if (Array.isArray(value)) return value.map((v) => redactAny(v, findings));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactAny(v, findings);
    return out;
  }
  return value;
}

export async function POST(request, { params }) {
  try {
    const { templateId } = await params;
    const sql = getSql();
    const orgId = getOrgId(request);
    const body = await request.json();

    // 1. Load workflow template
    const template = await getWorkflowTemplate(sql, orgId, templateId);
    if (!template) {
      return NextResponse.json(
        { success: false, error: 'workflow_not_found' },
        { status: 404 },
      );
    }

    const steps = template.steps || [];
    if (steps.length === 0) {
      return NextResponse.json(
        { success: false, error: 'workflow_has_no_steps' },
        { status: 400 },
      );
    }

    const action_id = `act_${crypto.randomUUID()}`;
    const timestamp_start = new Date().toISOString();
    const variables = body.variables || {};
    const agentId = body.agent_id || 'anonymous';

    // 2. Guard evaluation
    const guardDecision = await evaluateGuard(
      orgId,
      {
        action_type: 'workflow_execute',
        risk_score: 50,
        agent_id: agentId,
        systems_touched: [`workflow:${template.slug}`],
        reversible: true,
        declared_goal: body.declared_goal || `Execute workflow: ${template.name}`,
      },
      sql,
    );

    // 3. DLP scan
    const dlpFindings = [];
    const inputSummary = redactAny(
      JSON.stringify(variables).slice(0, 500),
      dlpFindings,
    );

    const actionData = {
      agent_id: agentId,
      action_type: 'workflow_execute',
      declared_goal: body.declared_goal || `Execute workflow: ${template.name}`,
      systems_touched: [`workflow:${template.slug}`],
      reversible: true,
      risk_score: 50,
      confidence: 50,
      input_summary: inputSummary,
      trigger: `workflow:${template.template_id}`,
    };

    // 4. Handle guard blocked
    if (guardDecision.decision === 'block') {
      await createBlockedActionRecord(sql, {
        orgId,
        action_id,
        data: actionData,
        guardDecision,
        signature: null,
        verified: false,
        timestamp_start,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'blocked_by_policy',
          guard_decision: {
            decision: guardDecision.decision,
            reasons: guardDecision.reasons || [],
            matched_policies: guardDecision.matched_policies || [],
          },
        },
        { status: 403 },
      );
    }

    // Quota check
    const plan = await getOrgPlan(orgId, sql);
    const wfQuota = await checkQuotaFast(orgId, 'workflow_executions', plan, sql);
    if (!wfQuota.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'quota_exceeded',
          code: 'QUOTA_EXCEEDED',
          resource: 'workflow_executions',
          usage: wfQuota.usage,
          limit: wfQuota.limit,
          message: 'Monthly workflow execution limit exceeded. Upgrade your plan to continue.',
          upgrade_url: '/billing',
        },
        { status: 402 },
      );
    }

    // 5. Resolve model strategy (snapshot at launch)
    let strategyConfig = null;
    if (template.model_strategy_id) {
      const strategy = await getModelStrategy(sql, orgId, template.model_strategy_id);
      if (strategy) {
        strategyConfig = strategy.config;
      }
    }

    // 6. Create parent action record
    await createActionRecord(sql, {
      orgId,
      action_id,
      data: actionData,
      actionStatus: 'running',
      costEstimate: 0,
      signature: null,
      verified: false,
      timestamp_start,
    });

    // 7. Execute workflow
    const result = await executeWorkflow(
      sql,
      orgId,
      action_id,
      steps,
      variables,
      { strategyConfig, agentId },
    );

    // 8. Update parent action outcome
    const timestamp_end = new Date().toISOString();
    const reasoning = JSON.stringify({
      template_id: template.template_id,
      template_name: template.name,
      steps: result.steps,
    });
    const outputSummary = result.success
      ? JSON.stringify(result.result).slice(0, 500)
      : result.error;

    await sql`
      UPDATE action_records
      SET status = ${result.success ? 'completed' : 'failed'},
          output_summary = ${outputSummary},
          error_message = ${result.success ? null : result.error},
          reasoning = ${reasoning},
          timestamp_end = ${timestamp_end},
          duration_ms = ${result.total_elapsed_ms || 0}
      WHERE action_id = ${action_id} AND org_id = ${orgId}
    `;

    // Meter increment (fire-and-forget)
    void Promise.all([
      incrementMeter(orgId, 'workflow_executions', sql),
      incrementMeter(orgId, 'governed_actions', sql),
    ]).catch((err) => console.warn('[API] Meter increment failed:', err.message));

    // 9. Return response
    const status = result.success ? 200 : 500;
    return NextResponse.json(
      {
        success: result.success,
        action_id,
        steps: result.steps,
        result: result.result || undefined,
        error: result.error || undefined,
        total_elapsed_ms: result.total_elapsed_ms,
        governed: true,
        quota_warning: wfQuota.warning || undefined,
        security: {
          clean: dlpFindings.length === 0,
          findings_count: dlpFindings.length,
          critical_count: dlpFindings.filter((f) => f.severity === 'critical').length,
          categories: [...new Set(dlpFindings.map((f) => f.category))],
        },
      },
      { status },
    );
  } catch (error) {
    return apiErrorResponse(error, 'WORKFLOW_EXECUTE');
  }
}
