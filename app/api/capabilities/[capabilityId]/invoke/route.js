export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSql } from '../../../../lib/db.js';
import { getOrgId } from '../../../../lib/org.js';
import { apiErrorResponse } from '../../../../lib/apiErrors.js';
import { evaluateGuard } from '../../../../lib/guard.js';
import { getCapability } from '../../../../lib/repositories/capabilities.repository.js';
import {
  createActionRecord,
  createBlockedActionRecord,
} from '../../../../lib/repositories/actions.repository.js';
import { getSettings } from '../../../../lib/repositories/settings.repository.js';
import { scanSensitiveData } from '../../../../lib/security.js';
import { RISK_SCORE_MAP, resolveAuth, invokeCapability } from '../../../../lib/capability-invoke.js';
import { resolveEndpointUrl } from '../../../../lib/mapping.js';
import { checkQuotaFast, getOrgPlan, incrementMeter } from '../../../../lib/usage.js';

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
    const { capabilityId } = await params;
    const sql = getSql();
    const orgId = getOrgId(request);
    const body = await request.json();

    // 1. Load capability
    const capability = await getCapability(sql, orgId, capabilityId);
    if (!capability) {
      return NextResponse.json(
        { success: false, error: 'capability_not_found' },
        { status: 404 },
      );
    }

    if (capability.source_type !== 'http_api') {
      return NextResponse.json(
        { success: false, error: 'not_invocable', message: 'Capability is not invocable via HTTP' },
        { status: 400 },
      );
    }

    const schema = capability.invocation_schema || {};
    const action_id = `act_${crypto.randomUUID()}`;
    const timestamp_start = new Date().toISOString();

    // 2. Guard evaluation
    const riskScore = RISK_SCORE_MAP[capability.risk_level] || 50;
    const guardDecision = await evaluateGuard(
      orgId,
      {
        action_type: 'capability_invoke',
        risk_score: riskScore,
        agent_id: body.agent_id || null,
        systems_touched: [`capability:${capability.slug}`],
        reversible: true,
        declared_goal: body.declared_goal || `Invoke capability: ${capability.name}`,
      },
      sql,
    );

    // 3. DLP scan on input
    const dlpFindings = [];
    const inputSummary = redactAny(
      JSON.stringify(body).slice(0, 500),
      dlpFindings,
    );

    const actionData = {
      agent_id: body.agent_id || 'anonymous',
      action_type: 'capability_invoke',
      declared_goal: body.declared_goal || `Invoke capability: ${capability.name}`,
      systems_touched: [`capability:${capability.slug}`],
      reversible: true,
      risk_score: riskScore,
      confidence: 50,
      input_summary: inputSummary,
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

    // 5. Handle require_approval
    if (guardDecision.decision === 'require_approval' || capability.requires_approval) {
      await createActionRecord(sql, {
        orgId,
        action_id,
        data: { ...actionData, status: 'pending_approval' },
        actionStatus: 'pending_approval',
        costEstimate: 0,
        signature: null,
        verified: false,
        timestamp_start,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'pending_approval',
          action_id,
          message: `Invocation requires human approval. Poll /api/approvals/${action_id} for status.`,
        },
        { status: 202 },
      );
    }

    // Quota check
    const plan = await getOrgPlan(orgId, sql);
    const capQuota = await checkQuotaFast(orgId, 'capability_invocations', plan, sql);
    if (!capQuota.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'quota_exceeded',
          code: 'QUOTA_EXCEEDED',
          resource: 'capability_invocations',
          usage: capQuota.usage,
          limit: capQuota.limit,
          message: 'Monthly capability invocation limit exceeded. Upgrade your plan to continue.',
          upgrade_url: '/billing',
        },
        { status: 402 },
      );
    }

    // 6. Resolve auth and endpoint from org settings
    let orgSettings = {};
    try {
      const rows = await getSettings(sql, orgId);
      for (const row of rows) {
        orgSettings[row.key] = row.value;
      }
    } catch {
      // Settings table may not exist
    }

    let authHeaders;
    try {
      authHeaders = resolveAuth(schema.auth, orgSettings);
    } catch (err) {
      if (err.code === 'auth_not_configured') {
        return NextResponse.json(
          { success: false, error: 'auth_not_configured', message: err.message },
          { status: 400 },
        );
      }
      throw err;
    }

    let endpoint;
    try {
      endpoint = resolveEndpointUrl(schema.endpoint, orgSettings);
    } catch (err) {
      if (err.code === 'endpoint_not_configured') {
        return NextResponse.json(
          { success: false, error: 'endpoint_not_configured', message: err.message },
          { status: 400 },
        );
      }
      throw err;
    }

    // 7. Create running action record
    await createActionRecord(sql, {
      orgId,
      action_id,
      data: actionData,
      actionStatus: 'running',
      costEstimate: capability.pricing?.estimated_cost_usd || 0,
      signature: null,
      verified: false,
      timestamp_start,
    });

    // 8. Invoke the capability
    const result = await invokeCapability({
      endpoint,
      method: schema.method || 'POST',
      authHeaders,
      body,
      requestMapping: schema.request_mapping,
      responseMapping: schema.response_mapping,
      timeoutMs: schema.timeout_ms || 60000,
    });

    // 9. Update action outcome
    const timestamp_end = new Date().toISOString();
    const outputSummary = result.success
      ? JSON.stringify(result.data).slice(0, 500)
      : result.message || result.error;

    await sql`
      UPDATE action_records
      SET status = ${result.success ? 'completed' : 'failed'},
          output_summary = ${outputSummary},
          error_message = ${result.success ? null : result.message || result.error},
          timestamp_end = ${timestamp_end},
          duration_ms = ${result.elapsed_ms || 0}
      WHERE action_id = ${action_id} AND org_id = ${orgId}
    `;

    // 10. Return response
    if (!result.success) {
      const statusCode = result.error === 'capability_timeout' ? 504 : 502;
      return NextResponse.json(
        {
          success: false,
          action_id,
          error: result.error,
          message: result.message,
          elapsed_ms: result.elapsed_ms,
          governed: true,
        },
        { status: statusCode },
      );
    }

    // Meter increment (fire-and-forget)
    void Promise.all([
      incrementMeter(orgId, 'capability_invocations', sql),
      incrementMeter(orgId, 'governed_actions', sql),
    ]).catch((err) => console.warn('[API] Meter increment failed:', err.message));

    return NextResponse.json({
      success: true,
      action_id,
      result: result.data,
      elapsed_ms: result.elapsed_ms,
      governed: true,
      quota_warning: capQuota.warning || undefined,
      security: {
        clean: dlpFindings.length === 0,
        findings_count: dlpFindings.length,
        critical_count: dlpFindings.filter((f) => f.severity === 'critical').length,
        categories: [...new Set(dlpFindings.map((f) => f.category))],
      },
    });
  } catch (error) {
    return apiErrorResponse(error, 'CAPABILITY_INVOKE');
  }
}
