export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { getGuardDecisionEvidence, getActionRecordEvidence } from '../../../lib/repositories/compliance.repository.js';

/**
 * GET /api/compliance/evidence?framework=soc2&window=30d — Pull live enforcement evidence
 */
export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const window = searchParams.get('window') || '30d';
    const windowDays = parseInt(window) || 30;

    const guardEvidence = await getGuardDecisionEvidence(sql, orgId, windowDays);
    const actionEvidence = await getActionRecordEvidence(sql, orgId, windowDays);

    // Aggregate evidence by decision type
    const blocked = guardEvidence.filter(e => e.decision === 'block');
    const totalDecisions = guardEvidence.reduce((sum, e) => sum + Number(e.count), 0);
    const totalBlocked = blocked.reduce((sum, e) => sum + Number(e.count), 0);
    const approvals = guardEvidence.filter(e => e.decision === 'require_approval' || e.decision === 'warn');
    const totalApprovals = approvals.reduce((sum, e) => sum + Number(e.count), 0);

    return NextResponse.json({
      window,
      window_days: windowDays,
      evidence: {
        guard_decisions_total: totalDecisions,
        guard_decisions_blocked: totalBlocked,
        approval_requests: totalApprovals,
        action_records_total: actionEvidence.reduce((sum, e) => sum + Number(e.count), 0),
        breakdown: guardEvidence,
        action_breakdown: actionEvidence,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[COMPLIANCE/EVIDENCE] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
