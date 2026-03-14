export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql as getDbSql } from '../../lib/db.js';
import { validateAssumption } from '../../lib/validate.js';
import { getOrgId } from '../../lib/org.js';
import { scanSensitiveData } from '../../lib/security.js';
import crypto from 'crypto';

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

export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);

    const validated = searchParams.get('validated');
    const stale = searchParams.get('stale');
    const drift = searchParams.get('drift');
    const action_id = searchParams.get('action_id');
    const agent_id = searchParams.get('agent_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let paramIdx = 1;
    const conditions = [`a.org_id = $${paramIdx++}`];
    const params = [orgId];

    if (validated === 'true') {
      conditions.push(`a.validated = 1`);
    } else if (validated === 'false') {
      conditions.push(`a.validated = 0 AND a.invalidated = 0`);
    }
    if (stale === 'true') {
      // Unvalidated assumptions older than 7 days
      conditions.push(`a.validated = 0 AND a.invalidated = 0 AND a.created_at < NOW() - INTERVAL '7 days'`);
    }
    if (action_id) {
      conditions.push(`a.action_id = $${paramIdx++}`);
      params.push(action_id);
    }
    if (agent_id) {
      conditions.push(`ar.agent_id = $${paramIdx++}`);
      params.push(agent_id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT a.*, ar.agent_id, ar.agent_name, ar.declared_goal
      FROM assumptions a
      LEFT JOIN action_records ar ON a.action_id = ar.action_id AND ar.org_id = a.org_id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    params.push(limit, offset);

    const countQuery = `SELECT COUNT(*) as total FROM assumptions a ${where}`;
    const countParams = params.slice(0, -2);

    const [assumptions, countResult] = await Promise.all([
      sql.query(query, params),
      sql.query(countQuery, countParams)
    ]);

    // Drift scoring: calculate per-assumption risk score based on age and validation state
    if (drift === 'true') {
      const now = Date.now();
      let atRisk = 0;
      for (const asm of assumptions) {
        if (asm.validated === 1) {
          asm.drift_score = 0;
        } else if (asm.invalidated === 1) {
          asm.drift_score = null;
        } else {
          // Unvalidated: drift score increases with age (0-100 over 30 days)
          const createdAt = new Date(asm.created_at).getTime();
          const daysOld = (now - createdAt) / (1000 * 60 * 60 * 24);
          asm.drift_score = Math.min(100, Math.round((daysOld / 30) * 100));
          if (asm.drift_score >= 50) atRisk++;
        }
      }

      const total = parseInt(countResult[0]?.total || '0', 10);
      return NextResponse.json({
        assumptions,
        total,
        drift_summary: {
          total,
          at_risk: atRisk,
          validated: assumptions.filter(a => a.validated === 1).length,
          invalidated: assumptions.filter(a => a.invalidated === 1).length,
          unvalidated: assumptions.filter(a => a.validated === 0 && a.invalidated === 0).length
        },
        lastUpdated: new Date().toISOString()
      });
    }

    return NextResponse.json({
      assumptions,
      total: parseInt(countResult[0]?.total || '0', 10),
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Assumptions API GET error:', error);
    return NextResponse.json(
      { error: 'An error occurred while fetching assumptions', assumptions: [] },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const body = await request.json();

    const { valid, data, errors } = validateAssumption(body);
    if (!valid) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    // SECURITY: redact likely secrets before storing assumption fields.
    const dlpFindings = [];
    for (const k of ['assumption', 'basis', 'invalidated_reason']) {
      if (data[k] != null) data[k] = redactAny(data[k], dlpFindings);
    }

    // Verify parent action exists
    const action = await sql`SELECT action_id FROM action_records WHERE action_id = ${data.action_id} AND org_id = ${orgId}`;
    if (action.length === 0) {
      return NextResponse.json({ error: 'Parent action not found' }, { status: 404 });
    }

    const assumption_id = data.assumption_id || `asm_${crypto.randomUUID()}`;

    const result = await sql`
      INSERT INTO assumptions (
        org_id, assumption_id, action_id, assumption, basis,
        validated, invalidated, invalidated_reason
      ) VALUES (
        ${orgId},
        ${assumption_id},
        ${data.action_id},
        ${data.assumption},
        ${data.basis || null},
        ${data.validated ? 1 : 0},
        ${data.invalidated ? 1 : 0},
        ${data.invalidated_reason || null}
      )
      RETURNING *
    `;

    return NextResponse.json({
      assumption: result[0],
      assumption_id,
      security: {
        clean: dlpFindings.length === 0,
        findings_count: dlpFindings.length,
        critical_count: dlpFindings.filter(f => f.severity === 'critical').length,
        categories: [...new Set(dlpFindings.map(f => f.category))],
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Assumptions API POST error:', error);
    if (error.message?.includes('unique') || error.message?.includes('duplicate')) {
      return NextResponse.json({ error: 'Assumption with this assumption_id already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'An error occurred while creating the assumption' }, { status: 500 });
  }
}
