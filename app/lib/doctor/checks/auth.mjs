// app/lib/doctor/checks/auth.mjs
import { getAuthConfig } from '../../authConfig.mjs';

/**
 * @param {{ env?: object }} options
 */
export async function runChecks({ env = process.env } = {}) {
  const authConfig = getAuthConfig(env);
  const checks = [];

  // API key
  checks.push({
    id: 'auth_api_key',
    category: 'auth',
    status: env.DASHCLAW_API_KEY ? 'pass' : 'fail',
    title: 'API Key',
    message: env.DASHCLAW_API_KEY
      ? 'DASHCLAW_API_KEY is set'
      : 'DASHCLAW_API_KEY is missing — agents cannot authenticate',
    fix: env.DASHCLAW_API_KEY
      ? null
      : { type: 'auto', description: 'Generate a new API key', action: 'generate_api_key' },
  });

  // Sign-in methods
  const availableMethods = [
    ...authConfig.oauthProviders.map((p) => p.name),
    ...(authConfig.hasLocalPassword ? ['Local password'] : []),
  ];
  checks.push({
    id: 'auth_signin',
    category: 'auth',
    status: authConfig.hasAnySignInMethod ? 'pass' : 'warn',
    title: 'Sign-In Methods',
    message: authConfig.hasAnySignInMethod
      ? `Sign-in available via: ${availableMethods.join(', ')}`
      : 'No sign-in method configured — operators cannot access the dashboard',
    fix: null,
  });

  // Partial provider warnings
  for (const provider of authConfig.providerChecks || []) {
    if (provider.partiallyConfigured) {
      checks.push({
        id: `auth_${provider.id}_partial`,
        category: 'auth',
        status: 'warn',
        title: `${provider.name} OAuth (Partial)`,
        message: `Missing: ${provider.missingKeys.join(', ')}`,
        fix: null,
      });
    }
  }

  return checks;
}
