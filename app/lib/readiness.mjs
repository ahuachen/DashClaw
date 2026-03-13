/**
 * Canonical readiness checks for the /setup page.
 * Keep all instance-readiness logic here so /setup remains the single source
 * of truth for onboarding and recovery guidance.
 */

import { getSetupStatus } from './setupStatus.mjs';
import { getAuthConfig, getMissingAuthMessage } from './authConfig.mjs';
import { CORE_TABLES } from './schemaCheck.js';

export const REQUIRED_ENV_VARS = [
  {
    key: 'DATABASE_URL',
    description: 'Postgres connection string',
    help: 'Add DATABASE_URL to your environment, then restart or redeploy.',
  },
  {
    key: 'NEXTAUTH_SECRET',
    description: 'Session signing secret',
    help: 'Generate one with: openssl rand -base64 32',
  },
];

export const ADVISORY_ENV_VARS = [
  {
    key: 'NEXTAUTH_URL',
    description: 'Public URL of this DashClaw instance',
    help: 'Set NEXTAUTH_URL so OAuth callbacks and login redirects use the correct host.',
  },
  {
    key: 'DASHCLAW_API_KEY',
    description: 'Default API key for agent authentication',
    help: 'Set DASHCLAW_API_KEY or sign in and generate a workspace API key before connecting agents.',
  },
];

function pickStatus({ ok, warn = false, fail = false }) {
  if (fail) return 'fail';
  if (warn) return 'warn';
  if (ok) return 'pass';
  return 'info';
}

function createCheck({
  id,
  label,
  status,
  detail,
  subDetail = '',
  likelyCause = '',
  nextAction = '',
  publicDetail,
  publicSubDetail,
}) {
  return {
    id,
    label,
    status,
    detail,
    subDetail,
    likelyCause,
    nextAction,
    publicDetail: publicDetail ?? detail,
    publicSubDetail: publicSubDetail ?? subDetail,
  };
}

function createStep({
  id,
  title,
  variant,
  summary,
  details = [],
  code = '',
  publicCode,
  note = '',
  publicNote,
}) {
  return {
    id,
    title,
    variant,
    summary,
    details,
    code,
    publicCode: publicCode ?? code,
    note,
    publicNote: publicNote ?? note,
  };
}

export function checkConfiguration(env = process.env) {
  const required = REQUIRED_ENV_VARS.map(({ key, description, help }) => ({
    key,
    description,
    help,
    present: Boolean(env[key]),
    required: true,
  }));

  const advisory = ADVISORY_ENV_VARS.map(({ key, description, help }) => ({
    key,
    description,
    help,
    present: Boolean(env[key]),
    required: false,
  }));

  const missingRequired = required.filter((entry) => !entry.present);
  const missingAdvisory = advisory.filter((entry) => !entry.present);
  const vars = [...required, ...advisory];

  const checks = vars.map((entry) =>
    createCheck({
      id: entry.key.toLowerCase(),
      label: entry.key,
      status: entry.present ? 'pass' : entry.required ? 'fail' : 'warn',
      detail: entry.present
        ? `${entry.description} is configured.`
        : `${entry.required ? 'Required' : 'Recommended'} setting is missing.`,
      subDetail: entry.present ? entry.description : '',
      likelyCause: entry.present
        ? ''
        : 'This environment variable has not been added to the current deployment.',
      nextAction: entry.present ? '' : entry.help,
    })
  );

  return {
    ok: missingRequired.length === 0,
    status: missingRequired.length > 0 ? 'fail' : missingAdvisory.length > 0 ? 'warn' : 'pass',
    summary:
      missingRequired.length > 0
        ? `${missingRequired.length} required setting(s) missing.`
        : missingAdvisory.length > 0
          ? `${missingAdvisory.length} recommended setting(s) still missing.`
          : 'Required and recommended settings are present.',
    vars,
    checks,
    missingRequired,
    missingAdvisory,
  };
}

function buildApplicationSection(env) {
  const mode = env.NODE_ENV || 'development';

  return {
    id: 'application',
    title: 'Application',
    status: 'pass',
    description: 'Confirms that the setup page is rendering and the app process is alive.',
    summary: 'DashClaw is responding to setup checks.',
    checks: [
      createCheck({
        id: 'app_reachable',
        label: 'Setup page',
        status: 'pass',
        detail: 'The setup page rendered successfully.',
        nextAction: '',
      }),
      createCheck({
        id: 'runtime',
        label: 'Runtime',
        status: 'pass',
        detail: `Node.js ${process.version} running in ${mode}.`,
        publicDetail: 'Application runtime is available.',
        likelyCause: '',
        nextAction: '',
      }),
    ],
  };
}

function buildDatabaseSection(dbStatus) {
  const missing = Array.isArray(dbStatus.missing) ? dbStatus.missing : [];
  const presentCount = CORE_TABLES.length - missing.length;

  if (dbStatus.reason === 'missing_database_url') {
    return {
      id: 'database',
      title: 'Database',
      status: 'fail',
      description: 'Checks whether DashClaw can reach its database and verify required tables.',
      summary: 'Database setup is blocked because DATABASE_URL is missing.',
      checks: [
        createCheck({
          id: 'database_url',
          label: 'DATABASE_URL',
          status: 'fail',
          detail: 'DATABASE_URL is missing.',
          likelyCause: 'The deployment does not have a database connection string configured.',
          nextAction: 'Add DATABASE_URL, then restart or redeploy DashClaw.',
        }),
        createCheck({
          id: 'db_connection',
          label: 'Connection test',
          status: 'info',
          detail: 'Skipped because there is no database URL to test.',
          likelyCause: '',
          nextAction: '',
        }),
        createCheck({
          id: 'db_schema',
          label: 'Core schema',
          status: 'info',
          detail: 'Skipped because database connectivity is not configured yet.',
          likelyCause: '',
          nextAction: '',
        }),
      ],
      ok: false,
      reason: dbStatus.reason,
      missing,
      allTables: CORE_TABLES,
    };
  }

  if (dbStatus.reason === 'connection_error') {
    return {
      id: 'database',
      title: 'Database',
      status: 'fail',
      description: 'Checks whether DashClaw can reach its database and verify required tables.',
      summary: 'Database connectivity failed.',
      checks: [
        createCheck({
          id: 'database_url',
          label: 'DATABASE_URL',
          status: 'pass',
          detail: 'DATABASE_URL is present.',
          likelyCause: '',
          nextAction: '',
        }),
        createCheck({
          id: 'db_connection',
          label: 'Connection test',
          status: 'fail',
          detail: 'Database connection check failed.',
          likelyCause: 'The database may be down, unreachable from this deployment, or using invalid credentials.',
          nextAction: 'Verify DATABASE_URL, confirm the database is reachable, and redeploy if you changed configuration.',
        }),
        createCheck({
          id: 'db_schema',
          label: 'Core schema',
          status: 'info',
          detail: 'Schema verification could not run because the connection test failed.',
          likelyCause: '',
          nextAction: '',
        }),
      ],
      ok: false,
      reason: dbStatus.reason,
      missing,
      allTables: CORE_TABLES,
    };
  }

  if (dbStatus.reason === 'no_tables') {
    return {
      id: 'database',
      title: 'Database',
      status: 'fail',
      description: 'Checks whether DashClaw can reach its database and verify required tables.',
      summary: `${missing.length} required table(s) are still missing.`,
      checks: [
        createCheck({
          id: 'database_url',
          label: 'DATABASE_URL',
          status: 'pass',
          detail: 'DATABASE_URL is present.',
          likelyCause: '',
          nextAction: '',
        }),
        createCheck({
          id: 'db_connection',
          label: 'Connection test',
          status: 'pass',
          detail: 'Database connection succeeded.',
          likelyCause: '',
          nextAction: '',
        }),
        createCheck({
          id: 'db_schema',
          label: 'Core schema',
          status: 'fail',
          detail: `${presentCount} of ${CORE_TABLES.length} required tables are present.`,
          subDetail: `Missing tables: ${missing.join(', ')}`,
          publicDetail: `${missing.length} required table check(s) failed.`,
          publicSubDetail: 'Sign in for the exact missing table names.',
          likelyCause: 'Bootstrap migrations have not run yet, or they did not complete successfully.',
          nextAction: 'Run the setup migrations, then reload this page.',
        }),
      ],
      ok: false,
      reason: dbStatus.reason,
      missing,
      allTables: CORE_TABLES,
    };
  }

  return {
    id: 'database',
    title: 'Database',
    status: 'pass',
    description: 'Checks whether DashClaw can reach its database and verify required tables.',
    summary: 'Database connectivity and core schema checks passed.',
    checks: [
      createCheck({
        id: 'database_url',
        label: 'DATABASE_URL',
        status: 'pass',
        detail: 'DATABASE_URL is present.',
      }),
      createCheck({
        id: 'db_connection',
        label: 'Connection test',
        status: 'pass',
        detail: 'Database connection succeeded.',
      }),
      createCheck({
        id: 'db_schema',
        label: 'Core schema',
        status: 'pass',
        detail: `All ${CORE_TABLES.length} required tables are present.`,
        subDetail: CORE_TABLES.join(', '),
        publicSubDetail: '',
      }),
    ],
    ok: true,
    reason: 'ready',
    missing,
    allTables: CORE_TABLES,
  };
}

function buildConfigurationSection(config) {
  return {
    id: 'configuration',
    title: 'Configuration',
    status: config.status,
    description: 'Verifies required settings and highlights recommended follow-up configuration.',
    summary: config.summary,
    checks: config.checks,
    ok: config.ok,
    vars: config.vars,
    missingRequired: config.missingRequired,
    missingAdvisory: config.missingAdvisory,
  };
}

function buildAuthSection(authConfig, env) {
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

  return {
    id: 'auth',
    title: 'Authentication and API Access',
    status: authConfig.hasAnySignInMethod ? (hasWarnings ? 'warn' : 'pass') : 'warn',
    description: 'Checks whether operators can sign in and whether agents can authenticate.',
    summary: authConfig.hasAnySignInMethod
      ? 'At least one sign-in method is available.'
      : 'DashClaw cannot be signed into normally until auth setup is completed.',
    checks,
    ok: authConfig.hasAnySignInMethod,
    methods,
    config: authConfig,
  };
}

function buildSdkSection() {
  return {
    id: 'sdk',
    title: 'SDK and Integration Verification',
    status: 'info',
    description: 'Provides safe validation commands you can use after setup is ready.',
    summary: 'Use these commands to verify the SDK once login and API access are ready.',
    checks: [
      createCheck({
        id: 'sdk_node',
        label: 'Node.js validation',
        status: 'info',
        detail: 'Use the Node validation script after you have a base URL and API key.',
        nextAction: 'Install the SDK or validation helper, then run the command shown below.',
      }),
      createCheck({
        id: 'sdk_python',
        label: 'Python validation',
        status: 'info',
        detail: 'Use the Python SDK after you have a base URL and API key.',
        nextAction: 'Install dashclaw and run a basic ping once auth is ready.',
      }),
    ],
  };
}

function buildRecommendations(report) {
  const steps = [];

  if (report.db.reason === 'missing_database_url') {
    steps.push(
      createStep({
        id: 'set_database_url',
        title: 'Set DATABASE_URL',
        variant: 'error',
        summary: 'DashClaw cannot start database checks until DATABASE_URL is configured.',
        details: [
          'Likely cause: the deployment is missing its database connection string.',
          'Next action: add DATABASE_URL to your environment and restart or redeploy.',
        ],
        code: 'DATABASE_URL=postgres://user:password@localhost:5432/dashclaw',
        publicCode: '',
        note: 'Use the real connection string from your Postgres or Neon deployment. Do not paste secrets into shared screenshots.',
      })
    );
  }

  if (report.db.reason === 'connection_error') {
    steps.push(
      createStep({
        id: 'fix_database_connection',
        title: 'Fix database connectivity',
        variant: 'error',
        summary: 'DashClaw found DATABASE_URL but could not connect to the database.',
        details: [
          'Likely cause: database is offline, unreachable from this deployment, or using invalid credentials.',
          'Next action: verify DATABASE_URL, confirm the database is accepting connections, then reload /setup.',
        ],
        code: `# Confirm the database is reachable from this environment
node scripts/_run-with-env.mjs scripts/migrate-multi-tenant.mjs`,
        publicCode: '',
        note: 'If migrations have never been run, start with the bootstrap migration once connectivity is fixed.',
      })
    );
  }

  if (report.db.reason === 'no_tables') {
    steps.push(
      createStep({
        id: 'run_migrations',
        title: 'Run setup migrations',
        variant: 'warn',
        summary: 'The database is reachable, but DashClaw schema setup is incomplete.',
        details: [
          'Likely cause: bootstrap migrations have not run, or they only ran partially.',
          'Next action: run the migration commands, then reload /setup.',
        ],
        code: `node scripts/_run-with-env.mjs scripts/migrate-multi-tenant.mjs
node scripts/_run-with-env.mjs scripts/migrate-cost-analytics.mjs
node scripts/_run-with-env.mjs scripts/migrate-identity-binding.mjs
node scripts/_run-with-env.mjs scripts/migrate-capabilities.mjs`,
        publicCode: 'Sign in for the exact migration commands.',
        note: report.db.missing.length > 0 ? `Missing tables: ${report.db.missing.join(', ')}` : '',
        publicNote: `${report.db.missing.length} required schema check(s) are still failing.`,
      })
    );
  }

  if (report.config.missingRequired.length > 0) {
    steps.push(
      createStep({
        id: 'set_required_env',
        title: 'Set required environment variables',
        variant: 'error',
        summary: `DashClaw is missing ${report.config.missingRequired.length} required setting(s).`,
        details: report.config.missingRequired.map(
          (entry) => `${entry.key}: ${entry.help}`
        ),
      })
    );
  }

  if (!report.auth.ok) {
    steps.push(
      createStep({
        id: 'configure_auth',
        title: 'Configure a sign-in method',
        variant: 'warn',
        summary: 'Operators need at least one complete sign-in method before normal dashboard access will work.',
        details: [
          'Likely cause: neither local password login nor a fully configured OAuth provider is available yet.',
          'Next action: set DASHCLAW_LOCAL_ADMIN_PASSWORD for solo access, or finish GitHub, Google, or OIDC setup.',
        ],
        code: `DASHCLAW_LOCAL_ADMIN_PASSWORD=change-me
NEXTAUTH_SECRET=$(openssl rand -base64 32)`,
        publicCode: 'DASHCLAW_LOCAL_ADMIN_PASSWORD=<set-a-strong-password>',
      })
    );
  }

  if (report.config.ok && report.auth.ok && report.config.missingAdvisory.length > 0) {
    steps.push(
      createStep({
        id: 'finish_recommended_env',
        title: 'Finish recommended configuration',
        variant: 'info',
        summary: 'DashClaw can run, but a few optional settings will improve reliability and integrations.',
        details: report.config.missingAdvisory.map(
          (entry) => `${entry.key}: ${entry.help}`
        ),
      })
    );
  }

  if (steps.length === 0) {
    steps.push(
      createStep({
        id: 'instance_ready',
        title: 'Instance looks ready',
        variant: 'info',
        summary: 'Core readiness checks are passing.',
        details: [
          'Next action: sign in, create or verify an API key, and run an SDK validation command.',
        ],
      })
    );
  }

  return steps;
}

export async function getReadinessReport(env = process.env) {
  const [dbStatus, authConfig, config] = await Promise.all([
    getSetupStatus(env),
    Promise.resolve(getAuthConfig(env)),
    Promise.resolve(checkConfiguration(env)),
  ]);

  const application = buildApplicationSection(env);
  const db = buildDatabaseSection(dbStatus);
  const auth = buildAuthSection(authConfig, env);
  const configuration = buildConfigurationSection(config);
  const sdk = buildSdkSection();

  let overall = 'healthy';
  if (!db.ok || !configuration.ok) {
    overall = 'blocked';
  } else if (!auth.ok || configuration.missingAdvisory.length > 0) {
    overall = 'needs_attention';
  }

  const report = {
    overall,
    checkedAt: new Date().toISOString(),
    application,
    db,
    config: configuration,
    auth,
    sdk,
  };

  return {
    ...report,
    sections: [application, db, configuration, auth, sdk],
    recommendations: buildRecommendations(report),
  };
}

function projectAuthConfig(auth, isAuthenticated) {
  if (isAuthenticated) return auth;

  return {
    ...auth,
    config: {
      hasGitHub: auth.config.hasGitHub,
      hasGoogle: auth.config.hasGoogle,
      hasOIDC: auth.config.hasOIDC,
      hasLocalPassword: auth.config.hasLocalPassword,
      hasAnyOAuth: auth.config.hasAnyOAuth,
      hasAnySignInMethod: auth.config.hasAnySignInMethod,
      oauthProviders: auth.config.oauthProviders,
      providerChecks: (auth.config.providerChecks || []).map((provider) => ({
        id: provider.id,
        name: provider.name,
        configured: provider.configured,
        partiallyConfigured: provider.partiallyConfigured,
        missingKeys: provider.partiallyConfigured ? ['Hidden until sign-in'] : [],
      })),
    },
  };
}

function projectCheck(check, isAuthenticated) {
  return {
    ...check,
    detail: isAuthenticated ? check.detail : check.publicDetail,
    subDetail: isAuthenticated ? check.subDetail : check.publicSubDetail,
  };
}

function projectStep(step, isAuthenticated) {
  return {
    ...step,
    code: isAuthenticated ? step.code : step.publicCode,
    note: isAuthenticated ? step.note : step.publicNote,
  };
}

export function projectReadinessReport(report, { isAuthenticated = false } = {}) {
  return {
    ...report,
    isAuthenticated,
    mode: isAuthenticated ? 'operator' : 'public',
    notice: isAuthenticated
      ? ''
      : 'This page is intentionally safe to open before login. Some operator details stay hidden until you sign in.',
    db: {
      ...report.db,
      missing: isAuthenticated ? report.db.missing : [],
    },
    auth: projectAuthConfig(report.auth, isAuthenticated),
    sections: report.sections.map((section) => ({
      ...section,
      checks: section.checks.map((check) => projectCheck(check, isAuthenticated)),
    })),
    recommendations: report.recommendations.map((step) => projectStep(step, isAuthenticated)),
  };
}
