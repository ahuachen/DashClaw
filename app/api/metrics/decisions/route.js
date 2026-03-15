export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';

export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);

    // 1. Current 24h metrics
    // We map 'pending_approval' to 'approval' and 'cancelled' to 'cancelled'.
    // 'blocked' is not an action_record status (it's a guard outcome), 
    // so we use 'cancelled' as the action-native equivalent for throughput.
    const currentResults = await sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status='completed')::int as completed,
        COUNT(*) FILTER (WHERE status='failed')::int as failed,
        COUNT(*) FILTER (WHERE status='cancelled')::int as cancelled,
        COUNT(*) FILTER (WHERE status='pending_approval')::int as approval
      FROM action_records
      WHERE org_id = ${orgId}
        AND created_at > NOW() - INTERVAL '24 hours';
    `;

    const current = currentResults[0] || {
      total: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      approval: 0
    };

    // 2. Previous 24h (24h to 48h ago) for comparison
    const previousResults = await sql`
      SELECT COUNT(*)::int as total
      FROM action_records
      WHERE org_id = ${orgId}
        AND created_at <= NOW() - INTERVAL '24 hours'
        AND created_at > NOW() - INTERVAL '48 hours';
    `;

    const previousTotal = previousResults[0]?.total || 0;

    // 3. Calculate change percent
    let change_percent = 0;
    if (previousTotal > 0) {
      change_percent = Math.round(((current.total - previousTotal) / previousTotal) * 100);
    } else if (current.total > 0) {
      change_percent = 100; // From 0 to something is 100% increase
    }

    return NextResponse.json({
      ...current,
      change_percent,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Metrics Decisions API GET error:', error);
    return NextResponse.json(
      { 
        error: 'An error occurred while fetching decision metrics',
        total: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        approval: 0,
        change_percent: 0
      },
      { status: 500 }
    );
  }
}
