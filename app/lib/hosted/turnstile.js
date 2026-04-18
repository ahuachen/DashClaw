const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: true, bypassed: true };
  }
  if (!token) {
    return { ok: false, reason: 'missing_token' };
  }
  try {
    const body = new URLSearchParams();
    body.set('secret', secret);
    body.set('response', token);
    if (remoteIp) body.set('remoteip', remoteIp);
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const json = await res.json();
    if (json.success) return { ok: true };
    return { ok: false, reason: 'cf_rejected', errors: json['error-codes'] || [] };
  } catch (err) {
    console.error('[HOSTED] turnstile verify failed:', err.message);
    return { ok: false, reason: 'verify_failed' };
  }
}
