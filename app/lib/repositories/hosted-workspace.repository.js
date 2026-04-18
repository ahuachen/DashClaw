import crypto from 'node:crypto';

function generateId(prefix) {
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}

function generateApiKey() {
  const raw = crypto.randomBytes(16).toString('hex');
  const plaintext = `oc_live_${raw}`;
  const keyHash = crypto.createHash('sha256').update(plaintext).digest('hex');
  const keyPrefix = plaintext.slice(0, 8);
  return { plaintext, keyHash, keyPrefix };
}

export async function provisionHostedWorkspace(sql, { trialDays, trialActionCap, label = 'trial' }) {
  const orgId = generateId('org');
  const keyId = generateId('key');
  const slug = `trial-${orgId.slice(4, 12)}`;
  const key = generateApiKey();
  const expiresAt = new Date(Date.now() + trialDays * 86_400_000).toISOString();

  await sql`
    INSERT INTO organizations (id, name, slug, plan, hosted_mode, trial_ends_at, trial_action_cap, trial_actions_used)
    VALUES (${orgId}, ${'Trial workspace'}, ${slug}, ${'free'}, TRUE, ${expiresAt}, ${trialActionCap}, 0)
  `;
  try {
    await sql`
      INSERT INTO api_keys (id, org_id, key_hash, key_prefix, label, role, scope)
      VALUES (${keyId}, ${orgId}, ${key.keyHash}, ${key.keyPrefix}, ${label}, ${'admin'}, ${'trial'})
    `;
  } catch (err) {
    // Best-effort cleanup — prevents orphaned trial orgs when key insert fails.
    // If this also fails, the sweep job will collect it once trial_ends_at passes.
    await sql`DELETE FROM organizations WHERE id = ${orgId} AND hosted_mode = TRUE`.catch(() => {});
    throw err;
  }

  return {
    orgId,
    apiKey: key.plaintext,
    keyPrefix: key.keyPrefix,
    expiresAt,
  };
}

export async function getHostedWorkspace(sql, orgId) {
  const rows = await sql`
    SELECT id, name, hosted_mode, trial_ends_at, trial_action_cap, trial_actions_used
    FROM organizations
    WHERE id = ${orgId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    orgId: r.id,
    name: r.name,
    hostedMode: r.hosted_mode,
    trialEndsAt: r.trial_ends_at,
    trialActionCap: r.trial_action_cap,
    trialActionsUsed: r.trial_actions_used,
  };
}

export async function deleteHostedWorkspace(sql, orgId) {
  const existing = await sql`
    SELECT hosted_mode FROM organizations WHERE id = ${orgId} LIMIT 1
  `;
  if (existing.length === 0) return { deleted: false, reason: 'not_found' };
  if (!existing[0].hosted_mode) {
    throw new Error(`org ${orgId} is not a hosted trial workspace — refusing to delete`);
  }
  await sql`UPDATE api_keys SET revoked_at = NOW() WHERE org_id = ${orgId} AND revoked_at IS NULL`;
  await sql`DELETE FROM organizations WHERE id = ${orgId} AND hosted_mode = TRUE`;
  return { deleted: true };
}

export async function findExpiredWorkspaces(sql, { now = new Date(), limit = 100 } = {}) {
  const cutoff = now.toISOString();
  const rows = await sql`
    SELECT id FROM organizations
    WHERE hosted_mode = TRUE
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at < ${cutoff}
    LIMIT ${limit}
  `;
  return rows.map((r) => r.id);
}

export async function incrementTrialActionCount(sql, orgId) {
  await sql`
    UPDATE organizations
    SET trial_actions_used = trial_actions_used + 1
    WHERE id = ${orgId} AND hosted_mode = TRUE
  `;
}
