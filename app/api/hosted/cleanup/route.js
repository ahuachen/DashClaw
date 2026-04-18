import { NextResponse } from 'next/server';
import { isHostedMode } from '../../../lib/hosted/flag.js';
import { findExpiredWorkspaces, deleteHostedWorkspace } from '../../../lib/repositories/hosted-workspace.repository.js';
import { getSql } from '../../../lib/db.js';

function requireAdminOrCronSecret(request) {
  const role = request.headers.get('x-org-role');
  if (role === 'owner' || role === 'admin') return true;

  // Path 1: explicit x-cleanup-secret header (used by GH Actions + manual curl)
  const xSecret = request.headers.get('x-cleanup-secret');
  if (xSecret && process.env.HOSTED_CLEANUP_SECRET && xSecret === process.env.HOSTED_CLEANUP_SECRET) {
    return true;
  }

  // Path 2: Authorization: Bearer <CRON_SECRET> (Vercel cron convention)
  const auth = request.headers.get('authorization');
  if (auth && process.env.CRON_SECRET) {
    const prefix = 'Bearer ';
    if (auth.startsWith(prefix) && auth.slice(prefix.length) === process.env.CRON_SECRET) {
      return true;
    }
  }

  return false;
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
