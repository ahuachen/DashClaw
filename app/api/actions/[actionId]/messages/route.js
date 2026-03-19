export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../../lib/db.js';
import { getOrgId } from '../../../../lib/org.js';

export async function GET(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { actionId } = await params;

    if (!actionId || (!actionId.startsWith('ar_') && !actionId.startsWith('act_'))) {
      return NextResponse.json({ error: 'Valid action_id required' }, { status: 400 });
    }

    // Strategy 1: Explicit matches (messages tagged with this action_id)
    const explicit = await sql`
      SELECT id, from_agent_id, to_agent_id, message_type, subject, body,
             thread_id, urgent, created_at, action_id
      FROM agent_messages
      WHERE org_id = ${orgId} AND action_id = ${actionId}
      ORDER BY created_at ASC
    `;

    if (explicit.length > 0) {
      return NextResponse.json({
        messages: explicit.map(m => ({ ...m, match_type: 'explicit' })),
        correlation: 'explicit',
        total: explicit.length,
      });
    }

    // Strategy 2: Time-window correlation fallback
    const [action] = await sql`
      SELECT agent_id, timestamp_start, timestamp_end
      FROM action_records
      WHERE org_id = ${orgId} AND action_id = ${actionId}
      LIMIT 1
    `;

    if (!action) {
      return NextResponse.json({ messages: [], correlation: 'none', total: 0 });
    }

    const windowStart = action.timestamp_start || new Date().toISOString();
    const windowEnd = action.timestamp_end || new Date().toISOString();

    // Important: Both created_at and timestamp_start are stored as text,
    // so we cast to timestamptz for correct comparison
    const correlated = await sql`
      SELECT id, from_agent_id, to_agent_id, message_type, subject, body,
             thread_id, urgent, created_at, action_id
      FROM agent_messages
      WHERE org_id = ${orgId}
        AND (from_agent_id = ${action.agent_id} OR to_agent_id = ${action.agent_id})
        AND created_at::timestamptz >= (${windowStart}::timestamptz - interval '60 seconds')
        AND created_at::timestamptz <= (${windowEnd}::timestamptz + interval '60 seconds')
      ORDER BY created_at ASC
      LIMIT 50
    `;

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
