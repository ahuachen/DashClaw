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

  // Check 1: Turnstile secret present in production
  const hasTurnstile = !!env.TURNSTILE_SECRET_KEY;
  checks.push({
    id: 'hosted_turnstile_secret',
    category: 'hosted',
    status: hasTurnstile ? 'pass' : 'fail',
    title: 'Turnstile secret',
    message: hasTurnstile
      ? 'TURNSTILE_SECRET_KEY is set — CAPTCHA verification is active.'
      : 'DASHCLAW_HOSTED=true but TURNSTILE_SECRET_KEY is unset. Provisioning is CAPTCHA-bypassed and abuse-vulnerable. Set TURNSTILE_SECRET_KEY from your Cloudflare Turnstile dashboard.',
    fix: null,
  });

  // Check 2: Cleanup secret is either set or unset with admin-only path (warn if cron is expected but secret missing)
  const hasCleanupSecret = !!env.HOSTED_CLEANUP_SECRET;
  checks.push({
    id: 'hosted_cleanup_secret',
    category: 'hosted',
    status: hasCleanupSecret ? 'pass' : 'warn',
    title: 'Cleanup secret',
    message: hasCleanupSecret
      ? 'HOSTED_CLEANUP_SECRET is set — cron-invoked cleanup is available.'
      : 'HOSTED_CLEANUP_SECRET is unset — cleanup sweeper requires admin-role API key (cron cannot call it without the secret).',
    fix: null,
  });

  return checks;
}
