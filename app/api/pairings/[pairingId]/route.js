export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { getPairing, expirePairing } from '../../../lib/repositories/pairings.repository.js';

export async function GET(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { pairingId } = await params;

    const rows = await getPairing(sql, orgId, pairingId);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Pairing not found' }, { status: 404 });
    }

    const pairing = rows[0];
    const expired = pairing.expires_at ? new Date(pairing.expires_at).getTime() < Date.now() : false;

    if (expired && pairing.status === 'pending') {
      await expirePairing(sql, orgId, pairingId);
      pairing.status = 'expired';
    }

    // Strip public_key from response — non-admin callers don't need it
    const { public_key: _pk, ...safePairing } = pairing;
    return NextResponse.json({ pairing: safePairing });
  } catch (error) {
    console.error('Pairing fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch pairing' }, { status: 500 });
  }
}
