export function getAuthConfig(env = process.env) {
  const githubId = env.GITHUB_ID || env.GITHUB_CLIENT_ID;
  const githubSecret = env.GITHUB_SECRET || env.GITHUB_CLIENT_SECRET;
  const googleId = env.GOOGLE_ID || env.GOOGLE_CLIENT_ID;
  const googleSecret = env.GOOGLE_SECRET || env.GOOGLE_CLIENT_SECRET;

  const hasGitHub = Boolean(githubId && githubSecret);
  const hasGoogle = Boolean(googleId && googleSecret);
  const hasOIDC = Boolean(env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET && env.OIDC_ISSUER_URL);
  const hasLocalPassword = Boolean(env.DASHCLAW_LOCAL_ADMIN_PASSWORD);

  const oauthProviders = [];
  if (hasGitHub) oauthProviders.push({ id: 'github', name: 'GitHub' });
  if (hasGoogle) oauthProviders.push({ id: 'google', name: 'Google' });
  if (hasOIDC) {
    oauthProviders.push({
      id: 'oidc',
      name: env.OIDC_DISPLAY_NAME || 'OIDC',
    });
  }

  return {
    hasGitHub,
    hasGoogle,
    hasOIDC,
    hasLocalPassword,
    hasAnyOAuth: oauthProviders.length > 0,
    hasAnySignInMethod: hasLocalPassword || oauthProviders.length > 0,
    oauthProviders,
  };
}

export function getMissingAuthMessage() {
  return 'No dashboard sign-in method is configured. Set DASHCLAW_LOCAL_ADMIN_PASSWORD for solo access, or configure GitHub, Google, or OIDC.';
}
