export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getCurrentPeriod } from '../../../lib/usage.js';

export async function GET(request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const sql = getSql();
    const period = getCurrentPeriod();

    const archived = await sql`
      INSERT INTO usage_meters (org_id, period, resource, count, updated_at)
      SELECT org_id, ${period}, resource, count, NOW()
      FROM usage_meters
      WHERE period = ${period}
        AND resource IN ('governed_actions', 'capability_invocations', 'workflow_executions', 'actions_per_month')
      ON CONFLICT (org_id, period, resource)
      DO UPDATE SET count = EXCLUDED.count, updated_at = NOW()
    `;

    const reset = await sql`
      DELETE FROM usage_meters
      WHERE period = ${period}
        AND resource IN ('governed_actions', 'capability_invocations', 'workflow_executions', 'actions_per_month')
    `;

    console.log(`[Cron] Meter reset for period ${period}: ${reset.count || 0} meters reset`);

    return NextResponse.json({
      success: true,
      period,
      meters_reset: reset.count || 0,
    });
  } catch (error) {
    console.error('[Cron] Meter reset failed:', error);
    return NextResponse.json({ error: 'Meter reset failed' }, { status: 500 });
  }
}
