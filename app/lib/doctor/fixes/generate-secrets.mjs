// app/lib/doctor/fixes/generate-secrets.mjs
import { randomBytes } from 'node:crypto';
import { writeEnvUpdates } from './env-writer.mjs';

function b64url(n) {
  return randomBytes(n)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export async function applyGenerateSecret() {
  const value = b64url(32);
  const { backedUp } = writeEnvUpdates({ NEXTAUTH_SECRET: value });
  return {
    applied: true,
    description: `Generated NEXTAUTH_SECRET${backedUp ? ' (backed up .env to .env.backup)' : ''}`,
  };
}

export async function applyGenerateEncryptionKey() {
  const value = b64url(32).slice(0, 32);
  const { backedUp } = writeEnvUpdates({ ENCRYPTION_KEY: value });
  return {
    applied: true,
    description: `Generated ENCRYPTION_KEY${backedUp ? ' (backed up .env to .env.backup)' : ''}`,
  };
}

export async function applyGenerateApiKey() {
  const value = `oc_live_${randomBytes(24).toString('hex')}`;
  const { backedUp } = writeEnvUpdates({ DASHCLAW_API_KEY: value });
  return {
    applied: true,
    description: `Generated DASHCLAW_API_KEY${backedUp ? ' (backed up .env to .env.backup)' : ''}`,
  };
}
