export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getOrgId } from '../../../lib/org';
import { getSql } from '../../../lib/db.js';
import { apiErrorResponse } from '../../../lib/apiErrors.js';
import { generatePolicies } from '../../../lib/policy-generator.js';

const MAX_INPUT_LENGTH = 5000;

/**
 * POST /api/policies/generate
 *
 * Generate guard policies from natural language input.
 * Body: { input_text: string, dry_run?: boolean (default true) }
 *
 * dry_run=true: Returns preview of generated policies.
 * dry_run=false: Creates the policies in the database.
 */
export async function POST(request) {
  try {
    const orgId = getOrgId(request);
    const sql = getSql();
    const body = await request.json();

    const { input_text, dry_run = true } = body;

    if (!input_text || typeof input_text !== 'string' || input_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'input_text is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (input_text.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        { error: `input_text exceeds maximum length of ${MAX_INPUT_LENGTH} characters` },
        { status: 400 }
      );
    }

    const result = await generatePolicies(sql, orgId, input_text.trim());

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    if (dry_run) {
      return NextResponse.json({
        generated_policies: result.generated_policies,
        warnings: result.warnings,
        input_hash: result.input_hash,
      });
    }

    // dry_run=false — create the policies
    const createdPolicies = [];
    for (const policy of result.generated_policies) {
      const policyId = `gp_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      await sql`
        INSERT INTO guard_policies (id, org_id, name, policy_type, rules, active, created_at)
        VALUES (
          ${policyId},
          ${orgId},
          ${policy.name},
          ${policy.policy_type},
          ${JSON.stringify(policy.rules)},
          1,
          NOW()
        )
      `;
      createdPolicies.push(policyId);
    }

    return NextResponse.json({
      created_policies: createdPolicies,
      count: createdPolicies.length,
    });
  } catch (err) {
    return apiErrorResponse(err, 'POLICIES GENERATE');
  }
}
