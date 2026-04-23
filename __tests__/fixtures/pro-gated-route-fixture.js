/**
 * Test-only fixture route that consumes requireTier('pro').
 * Ships as scaffolding so requireTier has a callsite to exercise against
 * in unit tests. NO actual Pro feature ships from this file.
 *
 * Added by Plan 03-03 (MON-02).
 */
import { NextResponse } from 'next/server';
import { requireTier } from '../../app/lib/org.js';

export async function GET(request) {
  const tierBlock = await requireTier(request, 'pro');
  if (tierBlock) return tierBlock;
  return NextResponse.json({ ok: true });
}
