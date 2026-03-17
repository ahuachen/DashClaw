import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { findActiveKeyByHash } from '../../../lib/repositories/apiKeys.repository.js';

export const dynamic = 'force-dynamic';

async function hashKey(key) {
  const data = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  const maxLen = Math.max(aBuf.length, bBuf.length);
  let result = aBuf.length ^ bBuf.length;
  for (let i = 0; i < maxLen; i++) {
    result |= (aBuf[i] || 0) ^ (bBuf[i] || 0);
  }
  return result === 0;
}

export async function POST(request) {
  const start = Date.now();

  if (process.env.DASHCLAW_MODE === 'demo') {
    return NextResponse.json(
      { ok: false, message: 'Live ping is not available in demo mode.' },
      { status: 403 }
    );
  }

  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: 'API key did not match.' },
      { status: 401 }
    );
  }

  // Fast path: check against environment variable
  const expectedKey = process.env.DASHCLAW_API_KEY;
  if (expectedKey && timingSafeEqual(apiKey, expectedKey)) {
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - start,
      message: 'Instance is accepting authenticated requests.',
    });
  }

  // Slow path: check against workspace API keys in database
  try {
    const sql = getSql();
    const keyHash = await hashKey(apiKey);
    const rows = await findActiveKeyByHash(sql, keyHash);
    if (rows.length > 0) {
      return NextResponse.json({
        ok: true,
        latencyMs: Date.now() - start,
        message: 'Instance is accepting authenticated requests.',
      });
    }
  } catch {
    // DB unavailable — fall through to rejection
  }

  return NextResponse.json(
    { ok: false, message: 'API key did not match.' },
    { status: 401 }
  );
}
