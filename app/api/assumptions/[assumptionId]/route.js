export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql as getDbSql } from '../../lib/db.js';
import { getOrgId } from '../../lib/org.js';
import { scanSensitiveData } from '../../lib/security.js';
import { getAssumption, updateAssumption } from '../../lib/repositories/assumptions.repository.js';

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

    const assumption = await getAssumption(sql, orgId, assumptionId);

    if (!assumption) {
      return NextResponse.json({ error: 'Assumption not found' }, { status: 404 });
    }

    return NextResponse.json({ assumption });
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

    const existing = await getAssumption(sql, orgId, assumptionId);
    if (!existing) {
      return NextResponse.json({ error: 'Assumption not found' }, { status: 404 });
    }

    if (existing.invalidated === 1) {
      return NextResponse.json({ error: 'Assumption is already invalidated' }, { status: 409 });
    }

    const now = new Date().toISOString();

    if (validated === true) {
      // Validate the assumption
      const result = await updateAssumption(sql, orgId, assumptionId, {
        validated: true,
        validated_at: now
      });
      return NextResponse.json({ assumption: result });
    } else {
      // Invalidate the assumption
      // SECURITY: redact likely secrets before storing invalidation reason.
      const dlpFindings = [];
      const safeReason = redactAny(invalidated_reason.trim(), dlpFindings);
      const result = await updateAssumption(sql, orgId, assumptionId, {
        invalidated: true,
        invalidated_reason: safeReason,
        invalidated_at: now
      });
      return NextResponse.json({
        assumption: result,
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
