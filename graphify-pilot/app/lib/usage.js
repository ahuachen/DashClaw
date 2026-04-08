/**
 * Usage utilities — metering and quota checking.
 *
 * Usage meters provide a fast path for tracking activity:
 * - Warm path: reads 1 row from usage_meters (no expensive COUNTs)
 * - Cold start: seeds meters from live COUNTs once per billing period
 * - Increments/decrements are fire-and-forget after mutations
 */

/**
 * Returns the current UTC period as 'YYYY-MM'.
 */
export function getCurrentPeriod() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Returns limits object. In the open-source edition, all limits are Infinity.
 */
export function getPlanLimits() {
  return {
    actions_per_month: Infinity,
    agents: Infinity,
    members: Infinity,
    api_keys: Infinity,
  };
}

/**
 * Queries the org's current plan from the organizations table.
 */
export async function getOrgPlan(orgId, sql) {
  const rows = await sql`SELECT plan FROM organizations WHERE id = ${orgId} LIMIT 1`;
  return rows.length > 0 ? (rows[0].plan || 'free') : 'free';
}

/**
 * Atomically increment (or decrement) a usage meter.
 * Uses INSERT ... ON CONFLICT DO UPDATE for upsert semantics.
 * GREATEST(0, ...) prevents negative counters.
 *
 * @param {string} orgId
 * @param {string} resource - 'actions_per_month' | 'agents' | 'members' | 'api_keys'
 * @param {object} sql - Neon SQL driver
 * @param {number} [delta=1] - Amount to change (negative for decrements)
 */
export async function incrementMeter(orgId, resource, sql, delta = 1) {
  const period = (resource === 'members' || resource === 'api_keys')
    ? 'current'
    : getCurrentPeriod();
  const now = new Date().toISOString();

  await sql`
    INSERT INTO usage_meters (org_id, period, resource, count, updated_at)
    VALUES (${orgId}, ${period}, ${resource}, GREATEST(0, ${delta}), ${now})
    ON CONFLICT (org_id, period, resource)
    DO UPDATE SET
      count = GREATEST(0, usage_meters.count + ${delta}),
      updated_at = ${now}
  `;
}

/**
 * Seed meter rows from live COUNTs for any missing resources.
 * Uses GREATEST on upsert so concurrent seeds never under-count.
 *
 * @param {string} orgId
 * @param {string} period - 'YYYY-MM' for the current month
 * @param {Map<string, number>} existingMap - Already-loaded meter values (resource -> count)
 * @param {object} sql - Neon SQL driver
 */
async function seedMeters(orgId, period, existingMap, sql) {
  const periodStart = `${period}-01T00:00:00.000Z`;
  const now = new Date().toISOString();
  const missing = [];

  if (!existingMap.has('actions_per_month')) missing.push('actions_per_month');
  if (!existingMap.has('agents')) missing.push('agents');
  if (!existingMap.has('members')) missing.push('members');
  if (!existingMap.has('api_keys')) missing.push('api_keys');

  if (missing.length === 0) return existingMap;

  // Run live COUNTs only for missing resources
  const counts = {};
  const queries = [];

  if (missing.includes('actions_per_month')) {
    queries.push(
      sql`SELECT COUNT(*)::int AS count FROM action_records
          WHERE org_id = ${orgId} AND timestamp_start::timestamptz >= ${periodStart}::timestamptz`
        .then(r => { counts.actions_per_month = r[0]?.count || 0; })
    );
  }
  if (missing.includes('agents')) {
    queries.push(
      sql`SELECT COUNT(DISTINCT agent_id)::int AS count FROM action_records
          WHERE org_id = ${orgId} AND timestamp_start::timestamptz >= ${periodStart}::timestamptz`
        .then(r => { counts.agents = r[0]?.count || 0; })
    );
  }
  if (missing.includes('members')) {
    queries.push(
      sql`SELECT COUNT(*)::int AS count FROM users WHERE org_id = ${orgId}`
        .then(r => { counts.members = r[0]?.count || 0; })
    );
  }
  if (missing.includes('api_keys')) {
    queries.push(
      sql`SELECT COUNT(*)::int AS count FROM api_keys WHERE org_id = ${orgId} AND revoked_at IS NULL`
        .then(r => { counts.api_keys = r[0]?.count || 0; })
    );
  }

  await Promise.all(queries);

  // Upsert meter rows (GREATEST prevents concurrent seeds from under-counting)
  const upserts = [];
  for (const resource of missing) {
    const value = counts[resource] || 0;
    const p = (resource === 'members' || resource === 'api_keys') ? 'current' : period;
    upserts.push(
      sql`INSERT INTO usage_meters (org_id, period, resource, count, last_reconciled_at, updated_at)
          VALUES (${orgId}, ${p}, ${resource}, ${value}, ${now}, ${now})
          ON CONFLICT (org_id, period, resource)
          DO UPDATE SET
            count = GREATEST(usage_meters.count, ${value}),
            last_reconciled_at = ${now},
            updated_at = ${now}`
    );
    existingMap.set(resource, value);
  }

  await Promise.all(upserts);
  return existingMap;
}

/**
 * Returns current usage counts for an org from usage_meters.
 */
export async function getUsage(orgId, sql) {
  const period = getCurrentPeriod();

  // Read all meter rows for this org (monthly + current snapshot)
  const rows = await sql`
    SELECT resource, count FROM usage_meters
    WHERE org_id = ${orgId}
      AND (period = ${period} OR period = 'current')
  `;

  const meterMap = new Map();
  for (const row of rows) {
    meterMap.set(row.resource, row.count);
  }

  // Seed any missing resources from live COUNTs
  if (meterMap.size < 4) {
    await seedMeters(orgId, period, meterMap, sql);
  }

  return {
    actions_per_month: meterMap.get('actions_per_month') || 0,
    agents: meterMap.get('agents') || 0,
    members: meterMap.get('members') || 0,
    api_keys: meterMap.get('api_keys') || 0,
  };
}

/**
 * Fast quota check — always returns allowed in the open-source edition.
 *
 * @param {string} orgId
 * @param {string} resource
 * @param {string} plan
 * @param {object} sql
 * @returns {{ allowed: boolean, warning: boolean, usage: number, limit: number, percent: number, hardLimit: number }}
 */
export async function checkQuotaFast(orgId, resource, plan, sql) {
  return { allowed: true, warning: false, usage: 0, limit: Infinity, percent: 0, hardLimit: Infinity };
}

/**
 * Checks if a specific resource is within quota.
 */
export async function checkQuota(orgId, resource, plan, sql) {
  return checkQuotaFast(orgId, resource, plan, sql);
}
