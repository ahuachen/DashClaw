// app/lib/doctor/checks/config.mjs
import { checkConfiguration } from '../../readiness/configurationCheck.mjs';

const GENERATE_FIXES = {
  NEXTAUTH_SECRET: { action: 'generate_secret', description: 'Generate a random NEXTAUTH_SECRET' },
  ENCRYPTION_KEY: { action: 'generate_encryption_key', description: 'Generate a random ENCRYPTION_KEY' },
  DASHCLAW_API_KEY: { action: 'generate_api_key', description: 'Generate a new API key' },
};

/**
 * @param {{ env?: object }} options
 */
export async function runChecks({ env = process.env } = {}) {
  const config = checkConfiguration(env);
  const checks = [];

  for (const check of config.checks) {
    const fixInfo = GENERATE_FIXES[check.id];
    checks.push({
      id: `env_${check.id}`,
      category: 'config',
      status: check.status === 'info' ? 'pass' : check.status,
      title: check.label || check.id,
      message: check.detail,
      fix:
        check.status === 'fail' && fixInfo
          ? { type: 'auto', description: fixInfo.description, action: fixInfo.action }
          : null,
    });
  }

  return checks;
}
