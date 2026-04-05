export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { apiErrorResponse } from '../../../lib/apiErrors.js';
import {
  getCapability,
  updateCapability,
} from '../../../lib/repositories/capabilities.repository.js';

export async function GET(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { capabilityId } = await params;

    const capability = await getCapability(sql, orgId, capabilityId);
    if (!capability) {
      return NextResponse.json({ error: 'Capability not found' }, { status: 404 });
    }
    return NextResponse.json({ capability });
  } catch (error) {
    return apiErrorResponse(error, 'CAPABILITY GET');
  }
}

export async function PATCH(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { capabilityId } = await params;
    const body = await request.json();

    try {
      const updated = await updateCapability(sql, orgId, capabilityId, body);
      if (!updated) {
        return NextResponse.json({ error: 'Capability not found' }, { status: 404 });
      }
      return NextResponse.json({ capability: updated });
    } catch (validationError) {
      if (
        validationError.message?.startsWith('risk_level') ||
        validationError.message?.startsWith('source_type')
      ) {
        return NextResponse.json({ error: validationError.message }, { status: 400 });
      }
      throw validationError;
    }
  } catch (error) {
    return apiErrorResponse(error, 'CAPABILITY PATCH');
  }
}
