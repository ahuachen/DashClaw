import { NextResponse } from 'next/server';
import { getSql } from '../../../../lib/db.js';
import { getOrgId, getOrgRole } from '../../../../lib/org.js';
import { checkAllIntegrations } from '../../../../lib/integration-health.js';
import { upsertHealth, getHealthForOrg } from '../../../../lib/repositories/integration-health.repository.js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/integrations/health/refresh — on-demand health check.
 *
 * Free-tier alternative to the /api/cron/integration-health Bearer endpoint.
 * Session-authed (middleware enforces), admin-only, runs the same check
 * pipeline for the caller's org, returns the updated health map.
 *
 * The cron endpoint is still the preferred scheduling path when Vercel Pro or
 * an external scheduler (GitHub Actions, cron-job.org) is available.
 */
export async function POST(request) {
  try {
    const role = getOrgRole(request);
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
    }

    const orgId = getOrgId(request);
    const sql = getSql();

    const results = await checkAllIntegrations(orgId, sql);
    let checked = 0;
    for (const [provider, result] of Object.entries(results)) {
      if (result.status === 'not_configured') continue;
      await upsertHealth(sql, orgId, provider, result.status, result.message);
      checked++;
    }

    // Return the fresh map the UI can swap in without re-fetching.
    const rows = await getHealthForOrg(sql, orgId);
    const healthMap = {};
    for (const row of rows) {
      healthMap[row.provider] = {
        status: row.status,
        message: row.message,
        checked_at: row.checked_at,
      };
    }

    return NextResponse.json({ checked, health: healthMap });
  } catch (err) {
    console.error('[integrations/health/refresh] POST error:', err);
    return NextResponse.json({ error: 'Health refresh failed' }, { status: 500 });
  }
}
