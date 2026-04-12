// app/api/doctor/route.js
import { NextResponse } from 'next/server';
import { runDoctor } from '@/lib/doctor/engine.mjs';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const url = request.nextUrl || new URL(request.url);
    const categoryParam = url.searchParams.get('category');
    const includeFixes = url.searchParams.get('include_fixes') !== 'false';
    const host = url.searchParams.get('host') || request.headers.get('host') || '';

    const categories = categoryParam
      ? categoryParam.split(',').map((c) => c.trim()).filter(Boolean)
      : null;

    const result = await runDoctor({ categories, includeFixes, host });

    return NextResponse.json(result, {
      status: result.status === 'unhealthy' ? 503 : 200,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
