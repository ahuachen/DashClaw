// app/lib/doctor/checks/sdk.mjs

/**
 * @param {{ env?: object, host?: string }} options
 */
export async function runChecks({ env = process.env, host = '' } = {}) {
  const checks = [];

  const baseUrl = env.NEXTAUTH_URL || (host ? `https://${host}` : 'http://localhost:3000');
  let reachable = false;

  try {
    const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
    reachable = res.ok || res.status === 503; // 503 = degraded but reachable
  } catch {
    // Not reachable
  }

  checks.push({
    id: 'sdk_reachable',
    category: 'sdk',
    status: reachable ? 'pass' : 'warn',
    title: 'Instance Reachable',
    message: reachable
      ? `${baseUrl}/api/health responded`
      : `Cannot reach ${baseUrl}/api/health — instance may not be running`,
    fix: null,
  });

  // Only test auth if reachable and key is present
  if (reachable && env.DASHCLAW_API_KEY) {
    try {
      const res = await fetch(`${baseUrl}/api/setup/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.DASHCLAW_API_KEY },
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      checks.push({
        id: 'sdk_auth',
        category: 'sdk',
        status: data.ok ? 'pass' : 'fail',
        title: 'API Key Authentication',
        message: data.ok ? 'API key accepted' : `API key rejected: ${data.message || 'unknown error'}`,
        fix: null,
      });
    } catch {
      checks.push({
        id: 'sdk_auth',
        category: 'sdk',
        status: 'warn',
        title: 'API Key Authentication',
        message: 'Could not verify API key — ping request failed',
        fix: null,
      });
    }
  }

  return checks;
}
