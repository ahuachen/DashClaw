export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { convertPolicies } from '../../../lib/guardrails/converter.js';
import { mapPolicies, loadFramework, listFrameworks } from '../../../lib/compliance/mapper.js';
import { getActivePolicies } from '../../../lib/repositories/guardrails.repository.js';

/**
 * GET /api/compliance/map?framework=soc2 — Map policies to a framework
 */
export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const frameworkId = searchParams.get('framework');

    if (!frameworkId) {
      return NextResponse.json({
        error: 'framework query parameter is required',
        available: listFrameworks(),
      }, { status: 400 });
    }

    let framework;
    try {
      framework = loadFramework(frameworkId);
    } catch (err) {
      return NextResponse.json({ error: err.message, available: listFrameworks() }, { status: 404 });
    }

    const policies = await getActivePolicies(sql, orgId);
    const policyDoc = convertPolicies(policies, `org-${orgId}`);
    const complianceMap = mapPolicies(policyDoc, framework);

    return NextResponse.json(complianceMap);
  } catch (err) {
    console.error('[COMPLIANCE/MAP] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
