import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { checkAllIntegrations } from '../../../lib/integration-health.js';
import { upsertHealth, getActiveOrgIds } from '../../../lib/repositories/integration-health.repository.js';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token || Buffer.byteLength(token) !== Buffer.byteLength(secret) ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sql = getSql();

    const orgs = await getActiveOrgIds(sql);

    let totalChecked = 0;
    for (const org of orgs) {
      const results = await checkAllIntegrations(org.id, sql);
      for (const [provider, result] of Object.entries(results)) {
        if (result.status === 'not_configured') continue;
        await upsertHealth(sql, org.id, provider, result.status, result.message);
        totalChecked++;
      }
    }

    return NextResponse.json({ ok: true, orgs: orgs.length, checked: totalChecked });
  } catch (err) {
    console.error('[cron/integration-health] Error:', err);
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}
