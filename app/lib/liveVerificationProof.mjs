import { SignJWT, jwtVerify } from 'jose';

const LIVE_PROOF_AUDIENCE = 'dashclaw-setup-live-proof';
const LIVE_PROOF_ISSUER = 'dashclaw';
const MAX_CHECKS = 24;

function getJwtSecret(env = process.env) {
  if (!env.NEXTAUTH_SECRET) {
    throw new Error('NEXTAUTH_SECRET is required to sign live verification proof.');
  }
  return new TextEncoder().encode(env.NEXTAUTH_SECRET);
}

function normalizeTool(tool) {
  return tool === 'python' ? 'python' : 'node';
}

function normalizeMode(mode) {
  return mode === 'full' ? 'full' : 'read_only';
}

function sanitizeText(value, maxLength = 140) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, maxLength);
}

function summarizeChecks(checks) {
  return (Array.isArray(checks) ? checks : [])
    .slice(0, MAX_CHECKS)
    .map((check) => ({
      name: sanitizeText(check?.name || check?.label || 'Unnamed check', 80),
      status: check?.status === 'fail' ? 'fail' : check?.status === 'skip' ? 'skip' : 'pass',
    }))
    .filter((check) => check.name);
}

function buildProofStatement(tool, mode, summary) {
  const toolLabel = tool === 'python' ? 'Python SDK' : 'Node validator';
  const modeLabel = mode === 'full' ? 'full validation' : 'read-only validation';
  return `${toolLabel} ${modeLabel} passed with ${summary.passed} successful check(s) and ${summary.skipped} skipped check(s).`;
}

export function normalizeLiveVerificationPayload(payload = {}, options = {}) {
  const tool = normalizeTool(payload.tool);
  const mode = normalizeMode(payload.mode);
  const summary = {
    passed: Math.max(0, Number(payload?.summary?.passed || 0)),
    failed: Math.max(0, Number(payload?.summary?.failed || 0)),
    skipped: Math.max(0, Number(payload?.summary?.skipped || 0)),
    score: Math.max(0, Math.min(100, Number(payload?.summary?.score || 0))),
  };

  if (summary.failed > 0 || summary.passed === 0) {
    throw new Error('Only successful live validation runs can be captured as proof.');
  }

  const checks = summarizeChecks(payload.checks);

  return {
    validator: sanitizeText(payload.validator || 'dashclaw-integration-validator', 80),
    tool,
    mode,
    capturedAt: new Date().toISOString(),
    host: sanitizeText(options.host || payload.host || '', 120),
    summary,
    checks,
    proofStatement: buildProofStatement(tool, mode, summary),
  };
}

export async function createLiveVerificationProofToken(payload, options = {}) {
  const normalized = normalizeLiveVerificationPayload(payload, options);
  const secret = getJwtSecret(options.env);

  const token = await new SignJWT(normalized)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(LIVE_PROOF_ISSUER)
    .setAudience(LIVE_PROOF_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);

  return {
    token,
    proof: normalized,
  };
}

export async function readLiveVerificationProofToken(token, env = process.env) {
  if (!token) return null;

  try {
    const secret = getJwtSecret(env);
    const { payload } = await jwtVerify(token, secret, {
      issuer: LIVE_PROOF_ISSUER,
      audience: LIVE_PROOF_AUDIENCE,
    });

    return {
      validator: sanitizeText(payload.validator || '', 80),
      tool: normalizeTool(payload.tool),
      mode: normalizeMode(payload.mode),
      capturedAt: payload.capturedAt ? new Date(payload.capturedAt).toISOString() : null,
      host: sanitizeText(payload.host || '', 120),
      summary: {
        passed: Math.max(0, Number(payload?.summary?.passed || 0)),
        failed: Math.max(0, Number(payload?.summary?.failed || 0)),
        skipped: Math.max(0, Number(payload?.summary?.skipped || 0)),
        score: Math.max(0, Math.min(100, Number(payload?.summary?.score || 0))),
      },
      checks: summarizeChecks(payload.checks),
      proofStatement: sanitizeText(payload.proofStatement || '', 180),
      verified: true,
    };
  } catch {
    return null;
  }
}
