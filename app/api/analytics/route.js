export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSql } from '../../lib/db.js';
import { getOrgId } from '../../lib/org.js';
import { apiErrorResponse } from '../../lib/apiErrors.js';
import { getAnalytics } from '../../lib/repositories/analytics.repository.js';

export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10), 1), 365);

    const data = await getAnalytics(sql, orgId, days);
    return NextResponse.json(data);
  } catch (error) {
    return apiErrorResponse(error, 'ANALYTICS');
  }
}
