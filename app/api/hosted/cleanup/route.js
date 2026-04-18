import { NextResponse } from 'next/server';
import { isHostedMode } from '../../../lib/hosted/flag.js';
import { findExpiredWorkspaces, deleteHostedWorkspace } from '../../../lib/repositories/hosted-workspace.repository.js';
import { getSql } from '../../../lib/db.js';

function requireAdminOrCronSecret(request) {
  const role = request.headers.get('x-org-role');
  if (role === 'owner' || role === 'admin') return true;
  const secret = request.headers.get('x-cleanup-secret');
  return !!(secret && process.env.HOSTED_CLEANUP_SECRET && secret === process.env.HOSTED_CLEANUP_SECRET);
}

export async function POST(request) {
  if (!isHostedMode()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!requireAdminOrCronSecret(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const sql = getSql();
  const expired = await findExpiredWorkspaces(sql, { now: new Date(), limit: 100 });
  let deleted = 0;
  const errors = [];
  for (const orgId of expired) {
    try {
      const r = await deleteHostedWorkspace(sql, orgId);
      if (r.deleted) deleted += 1;
    } catch (err) {
      errors.push({ orgId, error: err.message });
    }
  }
  return NextResponse.json({ found: expired.length, deleted, errors });
}
