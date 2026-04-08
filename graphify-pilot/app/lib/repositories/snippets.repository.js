export async function getSnippetById(sql, orgId, snippetId) {
  const rows = await sql`
    SELECT * FROM snippets WHERE id = ${snippetId} AND org_id = ${orgId}
  `;
  return rows[0] || null;
}
