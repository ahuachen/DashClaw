/**
 * GET /api/monetization/verified-integrations-count
 *
 * Public, unauthenticated endpoint (allowlisted in middleware.js PUBLIC_ROUTES).
 * Returns the live count of distinct orgs with ≥1 claude-code action_record
 * in the last 90 days, excluding internal orgs.
 *
 * Response shape (T-03-03-02 mitigation — aggregate only, no per-org data):
 *   { count: <int>, target: 50 }
 *   { count: null, target: 50, error: 'unavailable' }  ← on DB failure
 *
 * Used by:
 *   - /pricing commitment page (server-side render of live N/50 counter)
 *   - launch tweet + HN body (founder publicly cites the live URL)
 *
 * Added by Plan 03-03 (MON-01).
 */

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { countVerifiedIntegrations } from '../../../lib/repositories/monetization.repository.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = getSql();
    const count = await countVerifiedIntegrations(sql);
    return NextResponse.json({ count, target: 50 });
  } catch (e) {
    // Fail-graceful: counter is a public commitment signal, not critical infra.
    // DB failure must not break /pricing or the launch CTAs.
    return NextResponse.json(
      { count: null, target: 50, error: 'unavailable' },
      { status: 200 },
    );
  }
}
