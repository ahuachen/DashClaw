import { NextResponse } from 'next/server';
import { isHostedMode, hostedConfig } from '../../../lib/hosted/flag.js';
import { verifyTurnstile } from '../../../lib/hosted/turnstile.js';
import { createRateLimiter } from '../../../lib/hosted/rate-limit.js';
import { provisionHostedWorkspace } from '../../../lib/repositories/hosted-workspace.repository.js';
import { getSql } from '../../../lib/db.js';

const DAY_MS = 24 * 60 * 60 * 1000;
let _limiter = null;
function getLimiter() {
  const cfg = hostedConfig();
  if (!_limiter || _limiter._max !== cfg.maxProvisionsPerIpPerDay) {
    _limiter = createRateLimiter({ max: cfg.maxProvisionsPerIpPerDay, windowMs: DAY_MS });
    _limiter._max = cfg.maxProvisionsPerIpPerDay;
  }
  return _limiter;
}

export function _resetLimiterForTests() {
  _limiter = null;
}

function clientIp(request) {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') || null;
}

function publicEndpoint(request) {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(request) {
  if (!isHostedMode()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ip = clientIp(request);

  let body = {};
  try { body = await request.json(); } catch { /* empty body allowed */ }

  // Verify turnstile BEFORE consuming a rate-limit slot so bot requests with bad
  // tokens don't burn quota for legitimate users sharing a NAT egress IP.
  const turnstile = await verifyTurnstile(body.turnstile_token || '', ip);
  if (!turnstile.ok) {
    return NextResponse.json(
      { error: `turnstile verification failed: ${turnstile.reason}` },
      { status: 400 },
    );
  }

  const rl = getLimiter().take(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Rate limit exceeded', retry_after_ms: rl.retryAfterMs },
      { status: 429 },
    );
  }

  const cfg = hostedConfig();
  try {
    const sql = getSql();
    const result = await provisionHostedWorkspace(sql, {
      trialDays: cfg.trialDays,
      trialActionCap: cfg.trialActionCap,
      label: 'trial',
    });
    return NextResponse.json({
      workspace_id: result.orgId,
      api_key: result.apiKey,
      key_prefix: result.keyPrefix,
      endpoint: publicEndpoint(request),
      expires_at: result.expiresAt,
      trial_action_cap: cfg.trialActionCap,
      next_steps_url: `${publicEndpoint(request)}/connect?hosted=${result.orgId}`,
    });
  } catch (err) {
    console.error('[HOSTED] provision failed:', err);
    return NextResponse.json({ error: 'Provisioning failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
