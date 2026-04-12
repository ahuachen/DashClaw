// app/lib/doctor/checks/deployment.mjs

/**
 * @param {{ env?: object, host?: string }} options
 */
export async function runChecks({ env = process.env, host = '' } = {}) {
  const checks = [];

  // NEXTAUTH_URL
  const nextauthUrl = env.NEXTAUTH_URL;
  if (!nextauthUrl) {
    checks.push({
      id: 'deploy_nextauth_url',
      category: 'deployment',
      status: 'warn',
      title: 'NEXTAUTH_URL',
      message: 'Not set — OAuth callbacks may fail in production',
      fix: null,
    });
  } else if (host && !nextauthUrl.includes(host)) {
    checks.push({
      id: 'deploy_nextauth_url',
      category: 'deployment',
      status: 'warn',
      title: 'NEXTAUTH_URL',
      message: `Set to ${nextauthUrl} but current host is ${host} — possible mismatch`,
      fix: null,
    });
  } else {
    checks.push({
      id: 'deploy_nextauth_url',
      category: 'deployment',
      status: 'pass',
      title: 'NEXTAUTH_URL',
      message: `Set to ${nextauthUrl}`,
      fix: null,
    });
  }

  // CORS
  const allowedOrigin = env.ALLOWED_ORIGIN;
  if (!allowedOrigin) {
    checks.push({
      id: 'deploy_cors',
      category: 'deployment',
      status: 'warn',
      title: 'CORS (ALLOWED_ORIGIN)',
      message: 'Not set — cross-origin agent requests may be blocked',
      fix: null,
    });
  } else {
    checks.push({
      id: 'deploy_cors',
      category: 'deployment',
      status: 'pass',
      title: 'CORS (ALLOWED_ORIGIN)',
      message: `Set to ${allowedOrigin}`,
      fix: null,
    });
  }

  return checks;
}
