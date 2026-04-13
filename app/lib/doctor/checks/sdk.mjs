// app/lib/doctor/checks/sdk.mjs

/**
 * Resolve the URL the doctor should self-check against. Only trusted
 * server-side env vars are consulted — never request-supplied values like
 * `?host=` or the `Host` header — because this URL is used to `fetch()`
 * `/api/setup/ping` with `DASHCLAW_API_KEY` attached. An attacker-controlled
 * host would exfiltrate the key (CodeQL js/request-forgery, alerts #53/#54).
 */
function resolveSelfUrl(env) {
  if (env.NEXTAUTH_URL) return env.NEXTAUTH_URL.replace(/\/+$/, '');
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return `http://localhost:${env.PORT || 3000}`;
}

/**
 * @param {{ env?: object }} options
 */
export async function runChecks({ env = process.env } = {}) {
  const checks = [];

  const baseUrl = resolveSelfUrl(env);
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
