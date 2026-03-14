export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql as getDbSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { scanSensitiveData } from '../../../lib/security.js';

function redactAny(value, findings) {
  if (typeof value === 'string') {
    const scan = scanSensitiveData(value);
    if (!scan.clean) findings.push(...scan.findings);
    return scan.redacted;
  }
  if (Array.isArray(value)) return value.map((v) => redactAny(v, findings));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactAny(v, findings);
    return out;
  }
  return value;
}

let _sql;
function getSql() {
  if (_sql) return _sql;
  _sql = getDbSql();
  return _sql;
}

export async function GET(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { assumptionId } = await params;

    const assumptions = await sql`
      SELECT a.*, ar.agent_id, ar.agent_name, ar.declared_goal, ar.action_type, ar.status as action_status
      FROM assumptions a
      LEFT JOIN action_records ar ON a.action_id = ar.action_id
      WHERE a.assumption_id = ${assumptionId} AND a.org_id = ${orgId}
    `;

    if (assumptions.length === 0) {
      return NextResponse.json({ error: 'Assumption not found' }, { status: 404 });
    }

    return NextResponse.json({ assumption: assumptions[0] });
  } catch (error) {
    console.error('Assumption detail GET error:', error);
    return NextResponse.json({ error: 'An error occurred while fetching the assumption' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { assumptionId } = await params;
    const body = await request.json();

    const { validated, invalidated_reason } = body;

    if (validated !== true && validated !== false) {
      return NextResponse.json(
        { error: 'validated is required and must be a boolean' },
        { status: 400 }
      );
    }

    // Invalidating requires a reason
    if (validated === false && (!invalidated_reason || typeof invalidated_reason !== 'string' || invalidated_reason.trim().length === 0)) {
      return NextResponse.json(
        { error: 'invalidated_reason is required when invalidating an assumption' },
        { status: 400 }
      );
    }

    if (invalidated_reason && invalidated_reason.length > 2000) {
      return NextResponse.json(
        { error: 'invalidated_reason exceeds max length of 2000' },
        { status: 400 }
      );
    }

    const existing = await sql`SELECT assumption_id, validated, invalidated FROM assumptions WHERE assumption_id = ${assumptionId} AND org_id = ${orgId}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Assumption not found' }, { status: 404 });
    }

    if (existing[0].invalidated === 1) {
      return NextResponse.json({ error: 'Assumption is already invalidated' }, { status: 409 });
    }

    const now = new Date().toISOString();

    if (validated === true) {
      // Validate the assumption
      const result = await sql`
        UPDATE assumptions
        SET validated = 1,
            validated_at = ${now}
        WHERE assumption_id = ${assumptionId} AND org_id = ${orgId}
        RETURNING *
      `;
      return NextResponse.json({ assumption: result[0] });
    } else {
      // Invalidate the assumption
      // SECURITY: redact likely secrets before storing invalidation reason.
      const dlpFindings = [];
      const safeReason = redactAny(invalidated_reason.trim(), dlpFindings);
      const result = await sql`
        UPDATE assumptions
        SET invalidated = 1,
            invalidated_reason = ${safeReason},
            invalidated_at = ${now}
        WHERE assumption_id = ${assumptionId} AND org_id = ${orgId}
        RETURNING *
      `;
      return NextResponse.json({
        assumption: result[0],
        security: {
          clean: dlpFindings.length === 0,
          findings_count: dlpFindings.length,
          critical_count: dlpFindings.filter(f => f.severity === 'critical').length,
          categories: [...new Set(dlpFindings.map(f => f.category))],
        },
      });
    }
  } catch (error) {
    console.error('Assumption detail PATCH error:', error);
    return NextResponse.json({ error: 'An error occurred while updating the assumption' }, { status: 500 });
  }
}
