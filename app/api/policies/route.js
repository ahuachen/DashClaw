export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getOrgId, getOrgRole } from '../../lib/org';
import { validatePolicy } from '../../lib/validate';
import { getSql } from '../../lib/db.js';
import { EVENTS, publishOrgEvent } from '../../lib/events.js';
import { deletePoliciesByIds } from '../../lib/repositories/guardrails.repository.js';

/**
 * GET /api/policies — List guard policies for the org.
 */
export async function GET(request) {
  try {
    const orgId = getOrgId(request);
    const sql = getSql();

    const policies = await sql`
      SELECT * FROM guard_policies
      WHERE org_id = ${orgId}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({ policies });
  } catch (err) {
    console.error('[POLICIES] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/policies — Create a new guard policy (admin only).
 * Body: { name, policy_type, rules (JSON string), active? }
 */
export async function POST(request) {
  try {
    const orgId = getOrgId(request);
    const role = getOrgRole(request);

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { valid, data, errors } = validatePolicy(body);

    if (!valid) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    const sql = getSql();
    const id = `gp_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const now = new Date().toISOString();
    const active = data.active != null ? data.active : 1;

    await sql`
      INSERT INTO guard_policies (id, org_id, name, policy_type, rules, active, created_by, created_at, updated_at)
      VALUES (${id}, ${orgId}, ${data.name}, ${data.policy_type}, ${data.rules}, ${active}, ${body.created_by || null}, ${now}, ${now})
    `;

    const rows = await sql`SELECT * FROM guard_policies WHERE id = ${id}`;

    void publishOrgEvent(EVENTS.POLICY_UPDATED, { orgId, policy: rows[0], change_type: 'created' });

    return NextResponse.json({ policy: rows[0], policy_id: id }, { status: 201 });
  } catch (err) {
    if (err.message?.includes('guard_policies_org_name_unique')) {
      return NextResponse.json({ error: 'A policy with that name already exists' }, { status: 409 });
    }
    console.error('[POLICIES] POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/policies — Update a policy (admin only).
 * Body: { id, name?, rules?, active? }
 */
export async function PATCH(request) {
  try {
    const orgId = getOrgId(request);
    const role = getOrgRole(request);

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: 'Policy id is required' }, { status: 400 });
    }

    const sql = getSql();
    const now = new Date().toISOString();

    // Build dynamic SET clause
    const sets = [];
    const params = [body.id, orgId];
    let idx = 3;

    if (body.name != null) {
      sets.push(`name = $${idx++}`);
      params.push(body.name);
    }
    if (body.rules != null) {
      // SECURITY: Validate rules through the same validation as POST
      // Fetch existing policy to get its policy_type for validation context
      const existing = await sql.query(
        'SELECT policy_type FROM guard_policies WHERE id = $1 AND org_id = $2',
        [body.id, orgId]
      );
      if (existing.length > 0) {
        const policyType = body.policy_type || existing[0].policy_type;
        const rulesStr = typeof body.rules === 'string' ? body.rules : JSON.stringify(body.rules);
        const { valid, errors } = validatePolicy({ name: body.name || 'temp', policy_type: policyType, rules: rulesStr });
        if (!valid) {
          return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
        }
      }
      sets.push(`rules = $${idx++}`);
      params.push(typeof body.rules === 'string' ? body.rules : JSON.stringify(body.rules));
    }
    if (body.active != null) {
      sets.push(`active = $${idx++}`);
      params.push(body.active ? 1 : 0);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    sets.push(`updated_at = $${idx++}`);
    params.push(now);

    const query = `UPDATE guard_policies SET ${sets.join(', ')} WHERE id = $1 AND org_id = $2 RETURNING *`;
    const rows = await sql.query(query, params);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    void publishOrgEvent(EVENTS.POLICY_UPDATED, { orgId, policy: rows[0], change_type: 'updated' });

    return NextResponse.json({ policy: rows[0] });
  } catch (err) {
    console.error('[POLICIES] PATCH error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/policies — Delete a policy (admin only).
 * Query: ?id=gp_xxx
 */
export async function DELETE(request) {
  try {
    const orgId = getOrgId(request);
    const role = getOrgRole(request);

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const policyId = request.nextUrl.searchParams.get('id');
    const policyIds = request.nextUrl.searchParams.get('ids');

    if (!policyId && !policyIds) {
      return NextResponse.json({ error: 'Policy id or ids is required' }, { status: 400 });
    }

    const sql = getSql();

    // Bulk delete: ?ids=gp_1,gp_2,gp_3
    if (policyIds) {
      const idList = policyIds.split(',').map(id => id.trim()).filter(Boolean);
      if (idList.length === 0) {
        return NextResponse.json({ error: 'No valid ids provided' }, { status: 400 });
      }
      const rows = await deletePoliciesByIds(sql, orgId, idList);
      for (const row of rows) {
        void publishOrgEvent(EVENTS.POLICY_UPDATED, { orgId, policy_id: row.id, change_type: 'deleted' });
      }
      return NextResponse.json({ deleted: rows.length, ids: rows.map(r => r.id) });
    }

    // Single delete: ?id=gp_xxx
    const rows = await deletePoliciesByIds(sql, orgId, [policyId]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    void publishOrgEvent(EVENTS.POLICY_UPDATED, { orgId, policy_id: policyId, change_type: 'deleted' });

    return NextResponse.json({ deleted: true, id: policyId });
  } catch (err) {
    console.error('[POLICIES] DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
