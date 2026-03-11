import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { checkCoreTables } from '../../../lib/schemaCheck.js';

export const dynamic = 'force-dynamic';

// Check if the dashboard is properly configured
export async function GET() {
  try {
    const sql = getSql();
    const { ok, missing } = await checkCoreTables(sql);

    if (!ok) {
      return NextResponse.json({
        configured: false,
        reason: 'no_tables',
        message: `Missing ${missing.length} core table(s). Run migrations.`,
        missing_tables: missing.length,
      });
    }

    return NextResponse.json({
      configured: true,
      message: 'Dashboard is configured'
    });

  } catch (error) {
    console.error('Setup status error:', error);
    return NextResponse.json({
      configured: false,
      reason: 'connection_error',
      message: 'Unable to connect to database'
    });
  }
}
