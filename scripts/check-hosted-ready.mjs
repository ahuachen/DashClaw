#!/usr/bin/env node
// Pre-deploy readiness checker for DASHCLAW_HOSTED=true deployments.
// Exits 0 on ok or skipped, 1 on fail. Prints a readable report either way.

const API_KEY_PATTERN = /^oc_live_[0-9a-f]{32}$/;

export function assessHostedReadiness(env = process.env) {
  if (env.DASHCLAW_HOSTED !== 'true') {
    return { status: 'skipped', failures: [], warnings: [], info: 'hosted mode not enabled' };
  }

  const failures = [];
  const warnings = [];

  if (!env.DATABASE_URL) failures.push('DATABASE_URL missing');
  if (!env.TURNSTILE_SECRET_KEY) failures.push('TURNSTILE_SECRET_KEY missing');
  if (!env.DASHCLAW_API_KEY) {
    failures.push('DASHCLAW_API_KEY missing');
  } else if (!API_KEY_PATTERN.test(env.DASHCLAW_API_KEY)) {
    failures.push('DASHCLAW_API_KEY format invalid (expect oc_live_<32hex>)');
  }

  if (!env.HOSTED_CLEANUP_SECRET && !env.CRON_SECRET) {
    warnings.push('no cleanup secret configured (HOSTED_CLEANUP_SECRET or CRON_SECRET) — cleanup route is admin-only');
  }
  if (!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    warnings.push('NEXT_PUBLIC_TURNSTILE_SITE_KEY unset — Turnstile widget will not render (server still gates provisioning)');
  }

  return {
    status: failures.length > 0 ? 'fail' : 'ok',
    failures,
    warnings,
  };
}

// CLI entrypoint
import { pathToFileURL } from 'url';
const isMain = process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const result = assessHostedReadiness();
  const lines = [`[hosted:check-ready] status=${result.status}`];
  for (const f of result.failures) lines.push(`  FAIL: ${f}`);
  for (const w of result.warnings) lines.push(`  WARN: ${w}`);
  if (result.info) lines.push(`  INFO: ${result.info}`);
  console.log(lines.join('\n'));
  process.exit(result.status === 'fail' ? 1 : 0);
}
