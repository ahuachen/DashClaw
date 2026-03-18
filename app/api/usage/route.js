export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../lib/db.js';
import { getOrgId } from '../../lib/org.js';
import { getPlanLimits, getUsage } from '../../lib/usage.js';

// GET /api/usage - Returns limits and usage info
export async function GET(request) {
  try {
    const orgId = getOrgId(request);

    const sql = getSql();

    const rows = await sql`
      SELECT plan, stripe_customer_id, stripe_subscription_id,
             subscription_status, current_period_end, trial_ends_at
      FROM organizations WHERE id = ${orgId} LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const org = rows[0];
    const plan = org.plan || 'free';
    const limits = getPlanLimits(plan);
    const usage = await getUsage(orgId, sql);

    return NextResponse.json({
      plan,
      limits,
      usage,
      subscription: {
        status: org.subscription_status || 'active',
        current_period_end: org.current_period_end || null,
        trial_ends_at: org.trial_ends_at || null,
        has_stripe: !!org.stripe_customer_id,
      },
      stripe_configured: !!process.env.STRIPE_SECRET_KEY,
    });
  } catch (error) {
    console.error('Usage API GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch usage info' }, { status: 500 });
  }
}
