// app/lib/doctor/checks/hosted.mjs
// Checks specific to DASHCLAW_HOSTED mode (trial workspace provisioning).
// These only fire when hosted mode is enabled — self-host deploys see "skipped".

export async function runChecks({ env = process.env } = {}) {
  const hosted = env.DASHCLAW_HOSTED === 'true';
  const checks = [];

  if (!hosted) {
    checks.push({
      id: 'hosted_mode_disabled',
      category: 'hosted',
      status: 'skipped',
      title: 'Hosted mode',
      message: 'DASHCLAW_HOSTED is unset — hosted provisioning routes return 404.',
      fix: null,
    });
    return checks;
  }

  const hasTurnstileSecret = !!env.TURNSTILE_SECRET_KEY;
  checks.push({
    id: 'hosted_turnstile_secret',
    category: 'hosted',
    status: hasTurnstileSecret ? 'pass' : 'fail',
    title: 'Turnstile secret',
    message: hasTurnstileSecret
      ? 'TURNSTILE_SECRET_KEY is set — CAPTCHA verification is active.'
      : 'DASHCLAW_HOSTED=true but TURNSTILE_SECRET_KEY is unset. Provisioning is abuse-vulnerable. Set TURNSTILE_SECRET_KEY from your Cloudflare Turnstile dashboard.',
    fix: null,
  });

  const hasTurnstileSiteKey = !!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  checks.push({
    id: 'hosted_turnstile_site_key',
    category: 'hosted',
    status: hasTurnstileSiteKey ? 'pass' : 'warn',
    title: 'Turnstile site key',
    message: hasTurnstileSiteKey
      ? 'NEXT_PUBLIC_TURNSTILE_SITE_KEY is set — the widget can render in the hosted trial UI.'
      : 'NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset — the server still enforces Turnstile, but the widget will not render for public provisioning.',
    fix: null,
  });

  const hasCleanupSecret = !!env.HOSTED_CLEANUP_SECRET || !!env.CRON_SECRET;
  checks.push({
    id: 'hosted_cleanup_secret',
    category: 'hosted',
    status: hasCleanupSecret ? 'pass' : 'warn',
    title: 'Cleanup secret',
    message: hasCleanupSecret
      ? 'A cleanup secret is configured — scheduled sweeps can authenticate.'
      : 'No cleanup secret is configured — cleanup remains limited to admin-authenticated requests until HOSTED_CLEANUP_SECRET or CRON_SECRET is set.',
    fix: null,
  });

  // On serverless platforms (Vercel, Netlify Functions, Lambda) the
  // per-IP provisioning rate-limiter lives in per-instance memory, so each
  // cold start resets the hit map. Warn the operator so they know the
  // per-IP limit is effectively a soft hint under cold-start load.
  const isServerless = !!(env.VERCEL || env.NETLIFY || env.AWS_LAMBDA_FUNCTION_NAME);
  const hasSharedStore = !!(env.UPSTASH_REDIS_REST_URL || env.REDIS_URL);
  checks.push({
    id: 'hosted_rate_limiter_backing',
    category: 'hosted',
    status: !isServerless || hasSharedStore ? 'pass' : 'warn',
    title: 'Rate limiter backing store',
    message: !isServerless
      ? 'In-memory rate limiter is adequate for long-lived server deployments.'
      : hasSharedStore
        ? 'A shared store (Redis/Upstash) is configured — rate-limit state survives cold starts.'
        : 'Serverless platform detected and no shared store is configured — the per-IP provisioning rate limit resets on every cold start and provides little protection under real traffic. Rely on Turnstile as the primary defence or wire in Upstash/Redis.',
    fix: null,
  });

  return checks;
}
