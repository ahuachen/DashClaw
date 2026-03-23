export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getOrgId } from '../../lib/org';
import { validateGuardInput } from '../../lib/validate';
import { evaluateGuard } from '../../lib/guard';
import { getSql } from '../../lib/db.js';
import { apiErrorResponse } from '../../lib/apiErrors.js';
import { scanForPromptInjection } from '../../lib/promptInjection.js';

/**
 * POST /api/guard — Evaluate guard policies for a proposed action.
 * Returns allow/warn/block/require_approval.
 *
 * Body: { action_type, risk_score?, agent_id?, systems_touched?, reversible?, declared_goal? }
 * Query: ?include_signals=true (optional, adds live signal warnings)
 */
export async function POST(request) {
  try {
    const orgId = getOrgId(request);
    const body = await request.json();
    const { valid, data, errors } = validateGuardInput(body);

    if (!valid) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // SECURITY: Block prompt injection patterns in declared_goal (per D-04)
    const goalText = data.declared_goal || '';
    if (goalText) {
      const injectionScan = scanForPromptInjection(goalText);
      if (injectionScan.recommendation === 'block') {
        return NextResponse.json({
          error: 'Input rejected: prompt injection pattern detected',
          risk_level: injectionScan.risk_level,
          categories: injectionScan.categories,
        }, { status: 400 });
      }
    }

    const sql = getSql();
    const includeSignals = request.nextUrl.searchParams.get('include_signals') === 'true';

    let computeSignalsFn = null;
    if (includeSignals) {
      const { computeSignals } = await import('../../lib/signals');
      computeSignalsFn = computeSignals;
    }

    const result = await evaluateGuard(orgId, data, sql, {
      includeSignals,
      computeSignals: computeSignalsFn,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    return apiErrorResponse(err, 'GUARD POST');
  }
}

/**
 * GET /api/guard — List recent guard decisions.
 *
 * Query: ?agent_id=X&decision=block&limit=20&offset=0
 */
export async function GET(request) {
  try {
    const orgId = getOrgId(request);
    const sql = getSql();
    const { searchParams } = request.nextUrl;

    const agentId = searchParams.get('agent_id');
    const decision = searchParams.get('decision');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 1000);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const conditions = ['org_id = $1'];
    const params = [orgId];

    if (agentId) {
      conditions.push(`agent_id = $${params.push(agentId)}`);
    }
    if (decision) {
      conditions.push(`decision = $${params.push(decision)}`);
    }

    const where = conditions.join(' AND ');
    const query = `
      SELECT id, org_id, agent_id, action_type, risk_score, decision, reason, created_at 
      FROM guard_decisions 
      WHERE ${where} 
      ORDER BY created_at DESC 
      LIMIT $${params.push(limit)} 
      OFFSET $${params.push(offset)}
    `;

    const countQuery = `SELECT COUNT(*) as total FROM guard_decisions WHERE ${where}`;
    const countParams = params.slice(0, conditions.length);

    const [decisions, countResult, statsRows] = await Promise.all([
      sql.query(query, params),
      sql.query(countQuery, countParams),
      sql`
        SELECT
          COUNT(*) as total_24h,
          COUNT(*) FILTER (WHERE decision = 'block') as blocks_24h,
          COUNT(*) FILTER (WHERE decision = 'warn') as warns_24h,
          COUNT(*) FILTER (WHERE decision = 'require_approval') as approvals_24h
        FROM guard_decisions
        WHERE org_id = ${orgId}
          AND created_at::timestamptz > NOW() - INTERVAL '24 hours'
      `,
    ]);

    return NextResponse.json({
      decisions,
      total: parseInt(countResult[0]?.total || '0', 10),
      stats: statsRows[0] || {},
      limit,
      offset,
    });
  } catch (err) {
    return apiErrorResponse(err, 'GUARD GET');
  }
}
