// app/api/doctor/fix/route.js
import { NextResponse } from 'next/server';
import { applyFix, runDoctor } from '@/lib/doctor/engine.mjs';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'Missing required field: action' },
        { status: 400 },
      );
    }

    // API endpoint never allows local-only fixes (env file writes)
    const result = await applyFix(action, params, { allowLocal: false });
    const recheck = await runDoctor({ includeFixes: true });

    return NextResponse.json({ ...result, recheck });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
