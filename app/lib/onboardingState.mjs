export function createFallbackOnboardingStatus(overrides = {}) {
  return {
    onboarding_required: true,
    steps: {
      workspace_created: false,
      api_key_exists: false,
      first_action_sent: false,
      ...(overrides.steps || {}),
    },
    org_id: 'org_default',
    user_name: null,
    ...overrides,
  };
}

export function getViewerUserId(viewer) {
  return (
    viewer?.session?.userId ||
    viewer?.session?.id ||
    viewer?.session?.sub ||
    ''
  );
}

export async function getOnboardingStatusForUserId(userId, { sql, env = process.env } = {}) {
  if (env.NODE_ENV === 'development' && userId === 'dev_user') {
    return {
      onboarding_required: false,
      steps: {
        workspace_created: true,
        api_key_exists: true,
        first_action_sent: true,
      },
      org_id: 'org_default',
      user_name: 'Local Developer',
    };
  }

  if (!userId) {
    return createFallbackOnboardingStatus();
  }

  const users = await sql`
    SELECT id, org_id, role, name FROM users WHERE id = ${userId} LIMIT 1
  `;

  if (users.length === 0) {
    return createFallbackOnboardingStatus();
  }

  const user = users[0];
  const workspaceCreated = user.org_id !== 'org_default';

  let apiKeyExists = false;
  let firstActionSent = false;

  if (workspaceCreated) {
    const keys = await sql`
      SELECT COUNT(*) as cnt FROM api_keys
      WHERE org_id = ${user.org_id} AND revoked_at IS NULL
    `;
    apiKeyExists = parseInt(keys[0].cnt, 10) > 0;

    const actions = await sql`
      SELECT 1 FROM action_records WHERE org_id = ${user.org_id} LIMIT 1
    `;
    firstActionSent = actions.length > 0;
  }

  return {
    onboarding_required: !workspaceCreated || !apiKeyExists || !firstActionSent,
    steps: {
      workspace_created: workspaceCreated,
      api_key_exists: apiKeyExists,
      first_action_sent: firstActionSent,
    },
    org_id: workspaceCreated ? user.org_id : null,
    user_name: user.name || null,
  };
}
