import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId, getOrgRole, getUserId } from '../../../lib/org.js';
import { logActivity } from '../../../lib/audit.js';
import { EVENTS, publishOrgEvent } from '../../../lib/events.js';
import { scanSensitiveData } from '../../../lib/security.js';

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

/**
 * POST /api/actions/[actionId]/approve
 * Human-in-the-loop approval handler.
 * 
 * Body: { decision: 'allow' | 'deny', reasoning?: string }
 */
export async function POST(request, { params }) {
  try {
    const { actionId } = await params;
    const orgId = getOrgId(request);
    const role = getOrgRole(request);
    const userId = getUserId(request);

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required for approvals' }, { status: 403 });
    }

    const body = await request.json();
    const { decision, reasoning } = body;

    if (!['allow', 'deny'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision. Must be allow or deny.' }, { status: 400 });
    }

    const sql = getSql();

    // Verify action is in pending_approval state
    const action = await sql`
      SELECT status, agent_id FROM action_records 
      WHERE action_id = ${actionId} AND org_id = ${orgId}
      LIMIT 1
    `;

    if (action.length === 0) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    if (action[0].status !== 'pending_approval') {
      return NextResponse.json({ error: 'Action is not pending approval' }, { status: 400 });
    }

    // SECURITY: redact likely secrets before storing human reasoning.
    const dlpFindings = [];
    const safeReasoning = reasoning ? redactAny(reasoning, dlpFindings) : reasoning;

    const newStatus = decision === 'allow' ? 'running' : 'failed';
    const errorMessage = decision === 'deny' ? (safeReasoning || 'Denied by human operator') : null;

    const result = await sql`
      UPDATE action_records
      SET status = ${newStatus},
          error_message = ${errorMessage},
          reasoning = COALESCE(reasoning, '') || '

[HITL Decision: ' || ${decision.toUpperCase()} || ' by ' || ${userId} || ']' || 
                      CASE WHEN ${safeReasoning || ''} != '' THEN '
Reason: ' || ${safeReasoning} ELSE '' END
      WHERE action_id = ${actionId} AND org_id = ${orgId}
      RETURNING *
    `;

    logActivity({
      orgId, actorId: userId, action: `action.${decision}ed`,
      resourceType: 'action', resourceId: actionId,
      details: { decision, reasoning }, request,
    }, sql);

    // Emit event for real-time updates
    void publishOrgEvent(EVENTS.ACTION_UPDATED, {
      orgId, 
      action: result[0] 
    });

    return NextResponse.json({ 
      success: true, 
      action: result[0],
      security: {
        clean: dlpFindings.length === 0,
        findings_count: dlpFindings.length,
        critical_count: dlpFindings.filter(f => f.severity === 'critical').length,
        categories: [...new Set(dlpFindings.map(f => f.category))],
      },
    });

  } catch (error) {
    console.error('[APPROVAL] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
