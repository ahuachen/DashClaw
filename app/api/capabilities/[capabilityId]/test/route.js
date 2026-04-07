export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSql } from '../../../../lib/db.js';
import { getOrgId } from '../../../../lib/org.js';
import { apiErrorResponse } from '../../../../lib/apiErrors.js';
import {
  executeCapabilityInvocation,
  prepareCapabilityInvocation,
} from '../../../../lib/capability-runtime.js';
import { updateCapability } from '../../../../lib/repositories/capabilities.repository.js';
import { createActionRecord } from '../../../../lib/repositories/actions.repository.js';

function mapPreparationError(capabilityId, err) {
  if (err.message === `Capability not found: ${capabilityId}`) {
    return NextResponse.json({ success: false, error: 'capability_not_found' }, { status: 404 });
  }

  if (err.message === `Capability ${capabilityId} is not an http_api type`) {
    return NextResponse.json(
      { success: false, error: 'not_invocable', message: 'Capability is not invocable via HTTP' },
      { status: 400 },
    );
  }

  if (err.code === 'auth_not_configured' || err.code === 'endpoint_not_configured' || err.code === 'capability_contract_invalid') {
    return NextResponse.json(
      { success: false, error: err.code, message: err.message },
      { status: 400 },
    );
  }

  return null;
}

function mapExecutionStatus(errorCode) {
  if (errorCode === 'capability_input_invalid') return 400;
  if (errorCode === 'capability_timeout') return 504;
  return 502;
}

export async function POST(request, { params }) {
  try {
    const { capabilityId } = await params;
    const sql = getSql();
    const orgId = getOrgId(request);
    const body = await request.json();

    let prepared;
    try {
      prepared = await prepareCapabilityInvocation(sql, orgId, capabilityId);
    } catch (err) {
      const response = mapPreparationError(capabilityId, err);
      if (response) return response;
      throw err;
    }

    const { capability } = prepared;
    const actionId = `act_${crypto.randomUUID()}`;
    const timestampStart = new Date().toISOString();
    const agentId = body.agent_id || 'anonymous';

    await createActionRecord(sql, {
      orgId,
      action_id: actionId,
      data: {
        agent_id: agentId,
        action_type: 'capability_test',
        declared_goal: body.declared_goal || `Test capability: ${capability.name}`,
        systems_touched: [`capability:${capability.slug}`],
        reversible: true,
        risk_score: 5,
        confidence: 100,
        input_summary: JSON.stringify(body).slice(0, 500),
        trigger: 'capability:test',
      },
      actionStatus: 'running',
      costEstimate: 0,
      signature: null,
      verified: false,
      timestamp_start: timestampStart,
    });

    const result = await executeCapabilityInvocation({
      endpoint: prepared.endpoint,
      authHeaders: prepared.authHeaders,
      schema: prepared.schema,
      body,
    });

    const nextHealthStatus = result.success ? 'healthy' : 'failing';
    const nextCertificationStatus = result.success ? 'certified' : 'failed';
    const timestampEnd = new Date().toISOString();
    const outputSummary = result.success
      ? JSON.stringify(result.data).slice(0, 500)
      : result.message || result.error;

    await sql`
      UPDATE action_records
      SET status = ${result.success ? 'completed' : 'failed'},
          output_summary = ${outputSummary},
          error_message = ${result.success ? null : result.message || result.error},
          timestamp_end = ${timestampEnd},
          duration_ms = ${result.elapsed_ms || 0}
      WHERE action_id = ${actionId} AND org_id = ${orgId}
    `;

    await updateCapability(sql, orgId, capabilityId, { health_status: nextHealthStatus });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          tested: true,
          capability_id: capabilityId,
          test_action_id: actionId,
          error: result.error,
          message: result.message,
          elapsed_ms: result.elapsed_ms,
          health_status: nextHealthStatus,
          certification_status: nextCertificationStatus,
        },
        { status: mapExecutionStatus(result.error) },
      );
    }

    return NextResponse.json({
      success: true,
      tested: true,
      capability_id: capabilityId,
      test_action_id: actionId,
      result: result.data,
      elapsed_ms: result.elapsed_ms,
      health_status: nextHealthStatus,
      certification_status: nextCertificationStatus,
    });
  } catch (error) {
    return apiErrorResponse(error, 'CAPABILITY_TEST');
  }
}
