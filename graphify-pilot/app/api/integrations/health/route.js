import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { getHealthForOrg } from '../../../lib/repositories/integration-health.repository.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const orgId = getOrgId(request);
    const sql = getSql();
    const health = await getHealthForOrg(sql, orgId);

    const healthMap = {};
    for (const row of health) {
      healthMap[row.provider] = {
        status: row.status,
        message: row.message,
        checked_at: row.checked_at,
      };
    }

    return NextResponse.json({ health: healthMap });
  } catch (err) {
    console.error('[integrations/health] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch health status' }, { status: 500 });
  }
}
