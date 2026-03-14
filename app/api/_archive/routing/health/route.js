export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';

/**
 * GET /api/routing/health — Router health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'dashclaw-routing',
    timestamp: new Date().toISOString(),
  });
}
