export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../../lib/db.js';
import { getOrgId, getOrgRole } from '../../../../lib/org.js';
import { getPairing, expirePairing, approvePairing } from '../../../../lib/repositories/pairings.repository.js';
import { upsertIdentity } from '../../../../lib/repositories/identities.repository.js';

export async function POST(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const role = getOrgRole(request);
    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { pairingId } = await params;

    const rows = await getPairing(sql, orgId, pairingId);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Pairing not found' }, { status: 404 });
    }

    const pairing = rows[0];
    const expired = pairing.expires_at ? new Date(pairing.expires_at).getTime() < Date.now() : false;
    if (expired) {
      await expirePairing(sql, orgId, pairingId);
      return NextResponse.json({ error: 'Pairing expired' }, { status: 410 });
    }

    if (pairing.status !== 'pending') {
      return NextResponse.json({ error: `Pairing is not pending (status=${pairing.status})` }, { status: 409 });
    }

    const identityRows = await upsertIdentity(sql, {
      orgId,
      agentId: pairing.agent_id,
      publicKey: pairing.public_key,
      algorithm: pairing.algorithm || 'RSASSA-PKCS1-v1_5',
    });

    await approvePairing(sql, orgId, pairingId);

    return NextResponse.json({ identity: identityRows[0] });
  } catch (error) {
    console.error('Pairing approve error:', error);
    return NextResponse.json({ error: 'Failed to approve pairing' }, { status: 500 });
  }
}
