// --- Read queries ---

export async function findActiveKeyByHash(sql, keyHash) {
  return sql`
    SELECT id FROM api_keys
    WHERE key_hash = ${keyHash} AND revoked_at IS NULL
    LIMIT 1
  `;
}
