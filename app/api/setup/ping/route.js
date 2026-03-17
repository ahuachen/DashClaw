import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const start = Date.now();

  if (process.env.DASHCLAW_MODE === 'demo') {
    return NextResponse.json(
      { ok: false, message: 'Live ping is not available in demo mode.' },
      { status: 403 }
    );
  }

  const expectedKey = process.env.DASHCLAW_API_KEY;
  if (!expectedKey) {
    return NextResponse.json(
      { ok: false, message: 'No API key configured on this instance.' },
      { status: 401 }
    );
  }

  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== expectedKey) {
    return NextResponse.json(
      { ok: false, message: 'API key did not match.' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    latencyMs: Date.now() - start,
    message: 'Instance is accepting authenticated requests.',
  });
}
