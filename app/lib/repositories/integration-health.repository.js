let _tableChecked = false;

async function ensureTable(sql) {
  if (_tableChecked) return;
  await sql`
    CREATE TABLE IF NOT EXISTS integration_health (
      id SERIAL PRIMARY KEY,
      org_id TEXT NOT NULL DEFAULT 'org_default',
      provider TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unknown',
      message TEXT DEFAULT '',
      checked_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (org_id, provider)
    )
  `;
  _tableChecked = true;
}

export async function upsertHealth(sql, orgId, provider, status, message) {
  await ensureTable(sql);
  await sql`
    INSERT INTO integration_health (org_id, provider, status, message, checked_at)
    VALUES (${orgId}, ${provider}, ${status}, ${message}, NOW())
    ON CONFLICT (org_id, provider) DO UPDATE
    SET status = EXCLUDED.status, message = EXCLUDED.message, checked_at = NOW()
  `;
}

export async function getHealthForOrg(sql, orgId) {
  await ensureTable(sql);
  return sql`
    SELECT provider, status, message, checked_at
    FROM integration_health
    WHERE org_id = ${orgId}
    ORDER BY provider
  `;
}
