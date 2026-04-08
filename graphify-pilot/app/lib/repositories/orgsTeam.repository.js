export async function getTeamOrgAndMembers(sql, orgId) {
  const [orgRows, members] = await Promise.all([
    sql`SELECT id, name, slug, plan FROM organizations WHERE id = ${orgId}`,
    sql`
      SELECT id, email, name, image, role, created_at, last_login_at
      FROM users
      WHERE org_id = ${orgId}
      ORDER BY created_at ASC
    `,
  ]);

  const org = orgRows.length > 0 ? orgRows[0] : null;
  return {
    org,
    members,
  };
}
