export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { apiErrorResponse } from '../../../lib/apiErrors.js';

export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);

    const decision = searchParams.get('decision') || undefined;
    const agentId = searchParams.get('agent_id') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let paramIdx = 1;
    const conditions = [`gd.org_id = $${paramIdx++}`];
    const params = [orgId];

    if (decision) {
      conditions.push(`gd.decision = $${paramIdx++}`);
      params.push(decision);
    }
    if (agentId) {
      conditions.push(`gd.agent_id = $${paramIdx++}`);
      params.push(agentId);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const decisionsQuery = `
      SELECT gd.id, gd.decision, gd.risk_score, gd.agent_id, gd.action_type,
             gd.reason, gd.matched_policies, gd.context, gd.created_at
      FROM guard_decisions gd
      ${where}
      ORDER BY gd.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    params.push(limit, offset);

    const countQuery = `SELECT COUNT(*)::int AS total FROM guard_decisions gd ${where}`;
    const countParams = params.slice(0, -2);

    const statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE decision = 'block')::int AS blocks,
        COUNT(*) FILTER (WHERE decision = 'require_approval')::int AS approvals,
        COUNT(*) FILTER (WHERE decision = 'warn')::int AS warns
      FROM guard_decisions
      WHERE org_id = $1 AND created_at > NOW() - INTERVAL '7 days'
    `;

    const [decisions, countResult, statsResult] = await Promise.all([
      sql.query(decisionsQuery, params),
      sql.query(countQuery, countParams),
      sql.query(statsQuery, [orgId]),
    ]);

    const parsed = (decisions || []).map(d => {
      let matchedPolicies = [];
      try { matchedPolicies = JSON.parse(d.matched_policies || '[]'); } catch { /* skip */ }
      let context = {};
      try { context = JSON.parse(d.context || '{}'); } catch { /* skip */ }
      return {
        ...d,
        matched_policies: matchedPolicies,
        context: undefined,
        declared_goal: context.declared_goal || null,
        agent_name: context.agent_name || null,
      };
    });

    const stats = statsResult[0] || {};

    return NextResponse.json({
      decisions: parsed,
      total: parseInt(countResult[0]?.total || '0', 10),
      stats: {
        blocks: parseInt(stats.blocks || '0', 10),
        approvals: parseInt(stats.approvals || '0', 10),
        warns: parseInt(stats.warns || '0', 10),
      },
    });
  } catch (error) {
    return apiErrorResponse(error, 'GUARD DECISIONS GET');
  }
}
