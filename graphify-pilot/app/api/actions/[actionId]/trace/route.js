export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql as getDbSql } from '../../../../lib/db.js';
import { getOrgId } from '../../../../lib/org.js';
import { getActionTraceData } from '../../../../lib/repositories/actions.repository.js';

let _sql;
function getSql() {
  if (_sql) return _sql;
  _sql = getDbSql();
  return _sql;
}

export async function GET(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { actionId } = await params;

    const traceData = await getActionTraceData(sql, orgId, actionId);

    if (!traceData) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    const { action, assumptions, loops, relatedActions, subActions, parentChain } = traceData;

    // Compute summaries
    const assumptionSummary = {
      total: assumptions.length,
      validated: assumptions.filter(a => a.validated === 1).length,
      invalidated: assumptions.filter(a => a.invalidated === 1).length,
      unvalidated: assumptions.filter(a => a.validated === 0 && a.invalidated === 0).length,
      items: assumptions
    };

    const loopSummary = {
      total: loops.length,
      open: loops.filter(l => l.status === 'open').length,
      resolved: loops.filter(l => l.status === 'resolved').length,
      cancelled: loops.filter(l => l.status === 'cancelled').length,
      items: loops
    };

    // Build root cause indicators
    const rootCauseIndicators = [];

    if (assumptionSummary.invalidated > 0) {
      rootCauseIndicators.push({
        type: 'invalidated_assumptions',
        severity: 'high',
        count: assumptionSummary.invalidated,
        detail: assumptions
          .filter(a => a.invalidated === 1)
          .map(a => ({ assumption_id: a.assumption_id, assumption: a.assumption, reason: a.invalidated_reason }))
      });
    }

    if (loopSummary.open > 0) {
      rootCauseIndicators.push({
        type: 'unresolved_loops',
        severity: 'medium',
        count: loopSummary.open,
        detail: loops
          .filter(l => l.status === 'open')
          .map(l => ({ loop_id: l.loop_id, description: l.description, priority: l.priority }))
      });
    }

    // Check for parent failures
    const failedParents = parentChain.filter(p => p.status === 'failed');
    if (failedParents.length > 0) {
      rootCauseIndicators.push({
        type: 'parent_failures',
        severity: 'high',
        count: failedParents.length,
        detail: failedParents.map(p => ({ action_id: p.action_id, goal: p.declared_goal, error: p.error_message }))
      });
    }

    // Check for related failures (same systems, same timeframe)
    const relatedFailures = relatedActions.filter(r => r.status === 'failed');
    if (relatedFailures.length > 0) {
      rootCauseIndicators.push({
        type: 'related_failures',
        severity: 'medium',
        count: relatedFailures.length,
        detail: relatedFailures.map(r => ({ action_id: r.action_id, goal: r.declared_goal, error: r.error_message }))
      });
    }

    return NextResponse.json({
      action,
      trace: {
        assumptions: assumptionSummary,
        loops: loopSummary,
        parent_chain: parentChain,
        sub_actions: subActions,
        related_actions: relatedActions,
        root_cause_indicators: rootCauseIndicators
      }
    });
  } catch (error) {
    console.error('Trace API error:', error);
    return NextResponse.json({ error: 'An error occurred while building the trace' }, { status: 500 });
  }
}
