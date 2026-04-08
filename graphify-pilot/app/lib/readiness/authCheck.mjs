import { getMissingAuthMessage } from '../authConfig.mjs';
import { createSection, createCheck } from './factories.mjs';

export function buildAuthSection(authConfig, env) {
  const methods = [
    ...(authConfig.oauthProviders || []).map((provider) => provider.name),
    ...(authConfig.hasLocalPassword ? ['Local password'] : []),
  ];
  const checks = [];

  checks.push(
    createCheck({
      id: 'signin_methods',
      label: 'Sign-in readiness',
      status: authConfig.hasAnySignInMethod ? 'pass' : 'warn',
      detail: authConfig.hasAnySignInMethod
        ? `Configured sign-in method(s): ${methods.join(', ')}.`
        : 'No complete sign-in method is configured yet.',
      publicDetail: authConfig.hasAnySignInMethod
        ? 'At least one sign-in method is configured.'
        : 'No complete sign-in method is configured yet.',
      likelyCause: authConfig.hasAnySignInMethod ? '' : getMissingAuthMessage(),
      nextAction: authConfig.hasAnySignInMethod
        ? ''
        : 'Configure DASHCLAW_LOCAL_ADMIN_PASSWORD for local access, or finish GitHub, Google, or OIDC setup.',
    })
  );

  for (const provider of authConfig.providerChecks || []) {
    if (provider.configured) {
      checks.push(
        createCheck({
          id: `auth_${provider.id}`,
          label: provider.name,
          status: 'pass',
          detail: `${provider.name} is configured.`,
        })
      );
      continue;
    }

    if (provider.partiallyConfigured) {
      checks.push(
        createCheck({
          id: `auth_${provider.id}`,
          label: provider.name,
          status: 'warn',
          detail: `${provider.name} is partially configured.`,
          subDetail: `Missing: ${provider.missingKeys.join(', ')}`,
          publicDetail: `${provider.name} is partially configured.`,
          publicSubDetail: 'Sign in for exact missing keys.',
          likelyCause: 'Some provider settings were added, but the full set required for sign-in is not complete.',
          nextAction: `Add the missing settings for ${provider.name}, then redeploy or restart DashClaw.`,
        })
      );
    }
  }

  checks.push(
    createCheck({
      id: 'auth_local_password',
      label: 'Local admin password',
      status: authConfig.hasLocalPassword ? 'pass' : 'warn',
      detail: authConfig.hasLocalPassword
        ? 'DASHCLAW_LOCAL_ADMIN_PASSWORD is configured.'
        : 'Local password login is not configured.',
      likelyCause: authConfig.hasLocalPassword ? '' : 'Local admin password has not been set for this deployment.',
      nextAction: authConfig.hasLocalPassword
        ? ''
        : 'Set DASHCLAW_LOCAL_ADMIN_PASSWORD if you want password-based setup access without OAuth.',
    })
  );

  checks.push(
    createCheck({
      id: 'agent_api_access',
      label: 'Agent API access',
      status: env.DASHCLAW_API_KEY ? 'pass' : 'warn',
      detail: env.DASHCLAW_API_KEY
        ? 'A default agent API key is configured.'
        : 'Default agent API key is not configured.',
      publicDetail: env.DASHCLAW_API_KEY
        ? 'Agent API authentication appears configured.'
        : 'Agent API authentication still needs setup.',
      likelyCause: env.DASHCLAW_API_KEY
        ? ''
        : 'Agents will not be able to authenticate until an API key is configured or generated after sign-in.',
      nextAction: env.DASHCLAW_API_KEY
        ? ''
        : 'Set DASHCLAW_API_KEY or sign in and create an API key from the API Keys page.',
    })
  );

  const hasWarnings = checks.some((check) => check.status === 'warn' || check.status === 'fail');

  return createSection({
    id: 'auth',
    title: 'Auth Readiness',
    status: authConfig.hasAnySignInMethod ? (hasWarnings ? 'warn' : 'pass') : 'warn',
    description: 'Checks whether operators can sign in and whether agents have an authentication path.',
    summary: authConfig.hasAnySignInMethod
      ? 'At least one sign-in method is available.'
      : 'DashClaw cannot be signed into normally until auth setup is completed.',
    whatWasChecked: 'Whether at least one complete sign-in method exists and whether agent API authentication has a configured path.',
    evidenceSummary: authConfig.hasAnySignInMethod
      ? 'Auth ready: a normal operator sign-in path exists.'
      : 'Auth is still inferred as incomplete because no sign-in method is fully configured.',
    pendingProof: env.DASHCLAW_API_KEY
      ? ''
      : 'Agent and SDK verification remain limited until API key access is configured.',
    checks,
    ok: authConfig.hasAnySignInMethod,
    methods,
    config: authConfig,
    hasAgentApiKey: Boolean(env.DASHCLAW_API_KEY),
    hasPartialProviderWarnings: (authConfig.providerChecks || []).some((provider) => provider.partiallyConfigured),
    hasLocalPassword: authConfig.hasLocalPassword,
  });
}
