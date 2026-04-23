/**
 * Multi-tenant org helpers.
 * Reads org context injected by middleware via request headers.
 */

import { NextResponse } from 'next/server';
import { getSql } from './db.js';
import { getOrgPlan } from './usage.js';

export function getOrgId(request) {
  return request.headers.get('x-org-id') || 'org_default';
}

export function getOrgRole(request) {
  return request.headers.get('x-org-role') || 'member';
}

export function getUserId(request) {
  return request.headers.get('x-user-id') || '';
}

/**
 * Tier rank ladder. Unknown values (null, 'mystery-tier', undefined) default
 * to rank 0 via nullish coalescing at lookup time — this is the default-deny
 * posture that mitigates T-03-03-01 (fail-open on unknown plan values).
 *
 * Phase 3 ships with the single paid tier 'pro' (D-04). 'business' and
 * 'enterprise' are NOT in this ladder because D-04 explicitly rejected
 * multi-tier pricing for Phase 3 — they would need rank decisions beyond
 * this plan's scope.
 */
const TIER_RANK = { free: 0, pro: 1 };

/**
 * Middleware helper for Pro-tier routes. Composes on top of getOrgPlan()
 * (app/lib/usage.js) and organizations.plan (schema/schema.js).
 *
 * Phase 3 contract (MON-02, D-07):
 *   - Returns null when the org meets the minimum tier (caller proceeds).
 *   - Returns a NextResponse 403 with COMING_SOON body when the org is below
 *     the minimum tier. The response body is a public-commitment signal, NOT
 *     a paywall CTA — it must contain NO buy/upgrade/subscribe/pay language.
 *
 * Flip-to-paid path when MON-01 fires:
 *   UPDATE organizations SET plan='pro' WHERE id='org_<customer>';
 *   (zero code deploy — this helper picks up the new tier on next request.)
 *
 * @param {Request} request - middleware-injected org headers (see getOrgId)
 * @param {string} minTier - 'pro' (the only Phase 3 gate)
 * @returns {Promise<null | NextResponse>}
 */
export async function requireTier(request, minTier) {
  const orgId = getOrgId(request);
  const sql = getSql();
  const currentTier = await getOrgPlan(orgId, sql);

  const currentRank = TIER_RANK[currentTier] ?? 0;
  const requiredRank = TIER_RANK[minTier] ?? 0;

  if (currentRank >= requiredRank) return null;

  return NextResponse.json(
    {
      error: 'Coming soon',
      code: 'COMING_SOON',
      reason:
        'Pro features unlock when DashClaw hits 50 verified Claude Code integrations in the wild. See /pricing for progress.',
      current_tier: currentTier,
      required_tier: minTier,
    },
    { status: 403 },
  );
}
