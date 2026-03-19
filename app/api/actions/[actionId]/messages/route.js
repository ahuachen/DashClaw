export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../../lib/db.js';
import { getOrgId } from '../../../../lib/org.js';
import { getActionTimeBounds } from '../../../../lib/repositories/actions.repository.js';
import { getMessagesByActionId, getMessagesInTimeWindow } from '../../../../lib/repositories/messagesContext.repository.js';

export async function GET(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { actionId } = await params;

    if (!actionId || (!actionId.startsWith('ar_') && !actionId.startsWith('act_'))) {
      return NextResponse.json({ error: 'Valid action_id required' }, { status: 400 });
    }

    // Strategy 1: Explicit matches (messages tagged with this action_id)
    const explicit = await getMessagesByActionId(sql, orgId, actionId);

    if (explicit.length > 0) {
      return NextResponse.json({
        messages: explicit.map(m => ({ ...m, match_type: 'explicit' })),
        correlation: 'explicit',
        total: explicit.length,
      });
    }

    // Strategy 2: Time-window correlation fallback
    const action = await getActionTimeBounds(sql, orgId, actionId);

    if (!action) {
      return NextResponse.json({ messages: [], correlation: 'none', total: 0 });
    }

    const windowStart = action.timestamp_start || new Date().toISOString();
    const windowEnd = action.timestamp_end || new Date().toISOString();

    const correlated = await getMessagesInTimeWindow(sql, orgId, action.agent_id, windowStart, windowEnd);

    return NextResponse.json({
      messages: correlated.map(m => ({ ...m, match_type: 'time_window' })),
      correlation: correlated.length > 0 ? 'time_window' : 'none',
      total: correlated.length,
    });
  } catch (error) {
    console.error('[ACTIONS/MESSAGES] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}
