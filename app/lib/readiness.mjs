/**
 * Canonical readiness and verification checks for the /setup page.
 * Keep instance verification logic here so the page and proof artifact share
 * the same structured source of truth.
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

const OVERALL_STATE_META = {
  verified: {
    label: 'Verified',
    summary: 'Core verification checks passed and operator access looks ready.',
    readiness: 'healthy',
  },
  ready_unverified: {
    label: 'Ready but not fully verified',
    summary: 'Core checks are passing, but deeper validation or operator follow-up is still pending.',
    readiness: 'healthy',
  },
  needs_attention: {
    label: 'Needs attention',
    summary: 'DashClaw can partially verify this instance, but some follow-up is required before normal use is trustworthy.',
    readiness: 'needs_attention',
  },
  blocked: {
    label: 'Blocked',
    summary: 'Required verification checks are failing. Resolve those first before trusting the instance.',
    readiness: 'blocked',
  },
};

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

function createSection({
  id,
  title,
  status,
  description,
  summary,
  whatWasChecked,
  evidenceSummary = '',
  pendingProof = '',
  checks,
  ...rest
}) {
  return {
    id,
    title,
    status,
    description,
    summary,
    whatWasChecked,
    evidenceSummary,
    pendingProof,
    checks,
    ...rest,
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

function createWorkflowStep({ id, title, status, summary, proof, nextAction }) {
  return {
    id,
    title,
    status,
    summary,
    proof,
    nextAction,
  };
}

function getBaseUrl(host) {
  if (!host) return 'https://your-dashclaw-host';
  if (host.startsWith('http://') || host.startsWith('https://')) return host;
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export function getSdkCommands(host) {
  const baseUrl = getBaseUrl(host);

  return {
    baseUrl,
    node: `node .claude/skills/dashclaw-platform-intelligence/scripts/validate-integration.mjs \\
  --base-url ${baseUrl} \\
  --api-key <api-key> \\
  --full \\
  --capture-setup-proof`,
    python: `pip install dashclaw
python -c "from dashclaw import DashClaw; dc = DashClaw(base_url='${baseUrl}', api_key='<api-key>'); print(dc.ping())"`,
    pythonCapture: `python - <<'PY'
import json
import urllib.request

payload = {
    "validator": "python-sdk-helper",
    "tool": "python",
    "mode": "read_only",
    "summary": {"passed": 1, "failed": 0, "skipped": 0, "score": 100},
    "checks": [{"name": "Python SDK ping", "status": "pass"}],
}

req = urllib.request.Request(
    "${baseUrl}/api/setup/live-proof",
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Content-Type": "application/json",
        "x-api-key": "<api-key>",
    },
    method="POST",
)

with urllib.request.urlopen(req) as response:
    print(response.read().decode("utf-8"))
PY`,
  };
}

function getAgentStarterSnippets(host) {
  const baseUrl = getBaseUrl(host);

  return {
    node: `npm install dashclaw

import { DashClaw } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: '${baseUrl}',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-agent',
  agentName: 'My Agent',
});

await claw.createAction({
  action_type: 'test',
  declared_goal: 'Verify DashClaw connection',
  risk_score: 10,
});`,
    python: `pip install dashclaw

import os
from dashclaw import DashClaw

claw = DashClaw(
    base_url='${baseUrl}',
    api_key=os.environ['DASHCLAW_API_KEY'],
    agent_id='my-agent',
    agent_name='My Agent',
)

claw.create_action(
    action_type='test',
    declared_goal='Verify DashClaw connection',
    risk_score=10,
)`,
  };
}

export function projectConnectNextStep({
  isAuthenticated = false,
  verification = {},
  onboarding = null,
  host = '',
  sdk = null,
} = {}) {
  const steps = onboarding?.steps || {};
  const snippets = getAgentStarterSnippets(host);
  const validatorCommand = sdk?.commands?.node || getSdkCommands(host).node;
  const docsHref = '/connect';
  const statusItems = [
    {
      label: 'Workspace ready',
      complete: Boolean(steps.workspace_created),
    },
    {
      label: 'API key ready',
      complete: Boolean(steps.api_key_exists),
    },
    {
      label: steps.first_action_sent ? 'First live action received' : 'Waiting for first live action',
      complete: Boolean(steps.first_action_sent),
    },
  ];

  if (!isAuthenticated) {
    return {
      state: 'sign_in',
      title: 'Next step: connect your first agent',
      summary: 'Core checks can be reviewed here, but connecting a real agent requires operator access.',
      primaryCta: { label: 'Sign in to continue', href: '/login' },
      secondaryCtas: [{ label: 'Go to dashboard', href: '/dashboard' }],
      statusItems: [],
      snippets: null,
      validatorCommand: '',
    };
  }

  if (!steps.workspace_created) {
    return {
      state: 'create_workspace',
      title: 'Connect your first agent',
      summary: 'Create a workspace before generating API keys or sending live agent traffic.',
      primaryCta: { label: 'Create workspace', href: '/dashboard' },
      secondaryCtas: [{ label: 'Open dashboard', href: '/dashboard' }],
      statusItems,
      snippets: null,
      validatorCommand: '',
    };
  }

  if (!steps.api_key_exists) {
    return {
      state: 'create_api_key',
      title: 'Connect your first agent',
      summary: 'Workspace is ready. Next, generate an API key so your first agent can authenticate.',
      primaryCta: { label: 'Generate API key', href: '/api-keys' },
      secondaryCtas: [{ label: 'Open dashboard', href: '/dashboard' }],
      statusItems,
      snippets: null,
      validatorCommand: '',
    };
  }

  if (steps.first_action_sent) {
    return {
      state: 'connected',
      title: 'Your first agent is connected',
      summary:
        verification?.overall === 'verified'
          ? 'Core checks and live proof are in place. Move into day-to-day controls from here.'
          : 'DashClaw has already recorded a real agent action. From here, tighten controls and review live activity.',
      primaryCta: { label: 'Open dashboard', href: '/dashboard' },
      secondaryCtas: [
        { label: 'Enable pairings', href: '/pairings' },
        { label: 'Review policies', href: '/policies' },
      ],
      statusItems,
      snippets: null,
      validatorCommand,
    };
  }

  return {
    state: 'connect_agent',
    title: 'Connect your first agent',
    summary: 'Core checks are passing. Next, connect a real agent so DashClaw can record live actions.',
    primaryCta: { label: 'Open connect guide', href: docsHref },
    secondaryCtas: [
      { label: 'Node starter', href: '#connect-node' },
      { label: 'Python starter', href: '#connect-python' },
      { label: 'Run validator', href: '#connect-validator' },
    ],
    statusItems,
    snippets,
    validatorCommand,
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
        ? `${entry.key} is present.`
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

  return createSection({
    id: 'application',
    title: 'Core Readiness',
    status: 'pass',
    description: 'Confirms that DashClaw is serving the verify surface and the app process is alive.',
    summary: 'DashClaw responded to the verification request.',
    whatWasChecked: 'The /setup page rendered and the server runtime reported process metadata.',
    evidenceSummary: 'Behavior verified: the app process responded and exposed runtime metadata.',
    pendingProof: '',
    checks: [
      createCheck({
        id: 'app_reachable',
        label: 'Verify surface reachable',
        status: 'pass',
        detail: 'The Setup & Verify page rendered successfully.',
      }),
      createCheck({
        id: 'runtime',
        label: 'Runtime metadata',
        status: 'pass',
        detail: `Node.js ${process.version} running in ${mode}.`,
        publicDetail: 'Application runtime is available.',
      }),
    ],
    ok: true,
  });
}

function buildDatabaseSection(dbStatus) {
  const missing = Array.isArray(dbStatus.missing) ? dbStatus.missing : [];
  const presentCount = CORE_TABLES.length - missing.length;

  if (dbStatus.reason === 'missing_database_url') {
    return createSection({
      id: 'database',
      title: 'Database Verification',
      status: 'fail',
      description: 'Checks whether DashClaw can reach its database and confirm the core schema exists.',
      summary: 'Database verification is blocked because DATABASE_URL is missing.',
      whatWasChecked: 'Environment presence for DATABASE_URL, then database connectivity and core table checks when possible.',
      evidenceSummary: 'Verification blocked before a live connection test could run.',
      pendingProof: 'Database behavior is not yet verified because no connection string is configured.',
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
        }),
        createCheck({
          id: 'db_schema',
          label: 'Core schema',
          status: 'info',
          detail: 'Skipped because database connectivity is not configured yet.',
        }),
      ],
      ok: false,
      reason: dbStatus.reason,
      missing,
      allTables: CORE_TABLES,
    });
  }

  if (dbStatus.reason === 'connection_error') {
    return createSection({
      id: 'database',
      title: 'Database Verification',
      status: 'fail',
      description: 'Checks whether DashClaw can reach its database and confirm the core schema exists.',
      summary: 'Database connectivity failed.',
      whatWasChecked: 'DATABASE_URL presence and a live connection attempt from this deployment.',
      evidenceSummary: 'Configuration is present, but live database behavior is failing.',
      pendingProof: 'Schema verification remains pending until the connection succeeds.',
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
        }),
      ],
      ok: false,
      reason: dbStatus.reason,
      missing,
      allTables: CORE_TABLES,
    });
  }

  if (dbStatus.reason === 'no_tables') {
    return createSection({
      id: 'database',
      title: 'Database Verification',
      status: 'fail',
      description: 'Checks whether DashClaw can reach its database and confirm the core schema exists.',
      summary: `${missing.length} required table(s) are still missing.`,
      whatWasChecked: 'DATABASE_URL presence, a live database connection, and the required DashClaw core tables.',
      evidenceSummary: 'Connection succeeded, but schema verification failed.',
      pendingProof: 'Bootstrap migrations still need to complete before database verification can pass.',
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
    });
  }

  return createSection({
    id: 'database',
    title: 'Database Verification',
    status: 'pass',
    description: 'Checks whether DashClaw can reach its database and confirm the core schema exists.',
    summary: 'Database connection and core schema checks passed.',
    whatWasChecked: 'DATABASE_URL presence, a live connection from this deployment, and all required core tables.',
    evidenceSummary: 'Database verified: connection succeeded and required core tables were present.',
    pendingProof: '',
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
  });
}

function buildConfigurationSection(config) {
  return createSection({
    id: 'configuration',
    title: 'Configuration',
    status: config.status,
    description: 'Verifies required settings and highlights recommended follow-up configuration.',
    summary: config.summary,
    whatWasChecked: 'Presence of required and advisory environment variables. Values are never shown here.',
    evidenceSummary:
      config.missingRequired.length > 0
        ? 'Configuration verification failed because required settings are missing.'
        : config.missingAdvisory.length > 0
          ? 'Required settings are present, but some recommended configuration is still pending.'
          : 'Configuration presence checks passed for required and recommended settings.',
    pendingProof:
      config.missingAdvisory.length > 0
        ? 'Recommended configuration is still pending for a stronger operator setup.'
        : '',
    checks: config.checks,
    ok: config.ok,
    vars: config.vars,
    missingRequired: config.missingRequired,
    missingAdvisory: config.missingAdvisory,
  });
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

function formatCapturedAt(value) {
  if (!value) return 'recently';
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildSdkSection(host, report, liveProof) {
  const commands = getSdkCommands(host);
  const coreReady = report.db.ok && report.config.ok && report.auth.ok;
  const apiReady = report.auth.hasAgentApiKey || report.config.vars.some((entry) => entry.key === 'DASHCLAW_API_KEY' && entry.present);
  const hasLiveProof = Boolean(liveProof?.verified);
  const status = !coreReady ? 'warn' : hasLiveProof ? 'pass' : apiReady ? 'info' : 'warn';
  const summary = !coreReady
    ? 'Finish core verification first, then run live SDK checks.'
    : hasLiveProof
      ? 'A successful live SDK validation has been captured for this verify view.'
      : apiReady
      ? 'Live validation paths are ready to run. Proof remains pending until you execute them.'
      : 'Core checks are in place, but you still need an API key before running live SDK validation.';

  return createSection({
    id: 'sdk',
    title: 'SDK and Integration Verification',
    status,
    description: 'Provides guided live validation paths for Node and Python once core verification is in place.',
    summary,
    whatWasChecked: 'This section does not execute SDK calls. It verifies whether a live validation path is available and documents the exact next commands.',
    evidenceSummary: hasLiveProof
      ? liveProof.proofStatement
      : coreReady
      ? 'Verification path available: DashClaw can now guide live SDK checks.'
      : 'Live SDK proof is pending because core instance verification is not complete yet.',
    pendingProof: hasLiveProof
      ? ''
      : 'SDK and integration proof is still pending until one of the live validation commands is run successfully.',
    checks: [
      createCheck({
        id: 'sdk_live_proof',
        label: 'Captured live validation proof',
        status: hasLiveProof ? 'pass' : coreReady ? 'info' : 'warn',
        detail: hasLiveProof
          ? `${liveProof.tool === 'python' ? 'Python SDK' : 'Node validator'} ${liveProof.mode === 'full' ? 'full' : 'read-only'} validation passed on ${formatCapturedAt(liveProof.capturedAt)}.`
          : 'No successful live validation proof has been attached to this verify view yet.',
        subDetail: hasLiveProof
          ? `${liveProof.summary.passed} passed, ${liveProof.summary.failed} failed, ${liveProof.summary.skipped} skipped.`
          : 'Run a live validation command, then capture the result to upgrade this instance from ready_unverified to verified.',
        nextAction: hasLiveProof
          ? 'Download the updated JSON proof artifact or share the setup URL that includes this live proof token.'
          : 'Use the Node auto-capture flow or POST a sanitized Python success payload to /api/setup/live-proof after the command succeeds.',
      }),
      createCheck({
        id: 'sdk_gate',
        label: 'Core verification gate',
        status: coreReady ? 'pass' : 'warn',
        detail: coreReady
          ? 'Core instance verification checks are passing.'
          : 'Core verification is still incomplete, so SDK validation should wait.',
        likelyCause: coreReady ? '' : 'Database, required configuration, or auth readiness still needs attention.',
        nextAction: coreReady ? '' : 'Fix the blocked or warning checks above, then return to live SDK validation.',
      }),
      createCheck({
        id: 'sdk_node',
        label: 'Node live validation path',
        status: coreReady ? 'info' : 'warn',
        detail: 'Use the Node validation script to prove the instance accepts authenticated SDK traffic.',
        subDetail: 'What it proves: API ingress, auth, and a real end-to-end SDK request path.',
        nextAction: coreReady
          ? 'Use a valid API key and run the Node command shown below.'
          : 'Wait until core verification passes before running this.',
      }),
      createCheck({
        id: 'sdk_python',
        label: 'Python live validation path',
        status: coreReady ? 'info' : 'warn',
        detail: 'Use the Python SDK ping flow to prove a second client path works against this instance.',
        subDetail: 'What it proves: package install, authentication, base URL correctness, and a live request/response loop.',
        nextAction: coreReady
          ? 'Install the SDK, then run the Python command shown below.'
          : 'Wait until core verification passes before running this.',
      }),
      createCheck({
        id: 'sdk_api_key_gate',
        label: 'API key available for live checks',
        status: apiReady ? 'pass' : 'warn',
        detail: apiReady
          ? 'An API authentication path is available for SDK verification.'
          : 'You still need an API key before you can complete live SDK validation.',
        likelyCause: apiReady ? '' : 'Neither DASHCLAW_API_KEY nor an operator-generated workspace API key is currently available.',
        nextAction: apiReady ? '' : 'Set DASHCLAW_API_KEY or sign in and create a workspace API key.',
      }),
    ],
    commands,
    coreReady,
    apiReady,
    liveProof,
    hasLiveProof,
  });
}

function buildWorkflow(report) {
  const coreReady = report.db.ok && report.config.ok;
  const authReady = report.auth.ok;
  const apiReady = report.auth.hasAgentApiKey;
  const requiredMissing = report.config.missingRequired.length > 0;
  const hasLiveProof = Boolean(report.sdk?.hasLiveProof);

  return [
    createWorkflowStep({
      id: 'core_instance',
      title: 'Core instance verification',
      status: coreReady ? 'pass' : requiredMissing || !report.db.ok ? 'fail' : 'warn',
      summary: coreReady
        ? 'DashClaw rendered, required config is present, and database checks completed.'
        : 'Core instance verification is not complete yet.',
      proof: coreReady
        ? 'Verified by page reachability, config presence checks, database connectivity, and core schema inspection.'
        : 'Blocked until required config and database checks pass.',
      nextAction: coreReady ? '' : 'Resolve the blocked checks in Configuration and Database first.',
    }),
    createWorkflowStep({
      id: 'auth_operator',
      title: 'Operator and auth verification',
      status: authReady ? (apiReady ? 'pass' : 'warn') : 'warn',
      summary: authReady
        ? 'At least one operator sign-in path is configured.'
        : 'Normal operator sign-in still needs setup.',
      proof: authReady
        ? 'Verified by checking complete sign-in provider configuration.'
        : 'Only inferred as incomplete because no complete sign-in method was found.',
      nextAction: authReady
        ? apiReady
          ? ''
          : 'Add or generate an API key before running live SDK validation.'
        : 'Finish local password or OAuth setup before relying on dashboard access.',
    }),
    createWorkflowStep({
      id: 'sdk_live',
      title: 'SDK and integration verification',
      status: !coreReady ? 'blocked' : hasLiveProof ? 'pass' : apiReady ? 'pending' : 'warn',
      summary: !coreReady
        ? 'Live SDK validation should wait until core checks pass.'
        : hasLiveProof
          ? 'Live SDK proof has been captured for this verify view.'
        : apiReady
          ? 'Live validation commands are ready, but proof is still pending until you run them.'
          : 'Core checks are in place, but you still need API credentials for live SDK validation.',
      proof: hasLiveProof
        ? report.sdk.evidenceSummary
        : !coreReady
        ? 'No live SDK proof collected yet.'
        : 'This page provides the commands and explains what each live validation will prove.',
      nextAction: !coreReady
        ? 'Complete the core verification step first.'
        : hasLiveProof
          ? 'Download the refreshed proof artifact or share the setup URL with the attached live proof token.'
        : apiReady
          ? 'Run the Node or Python validation command below and capture the result in your deployment notes.'
          : 'Configure an API key, then run one of the live validation commands.',
    }),
    createWorkflowStep({
      id: 'proof_artifact',
      title: 'Verification proof artifact',
      status: 'pass',
      summary: 'A structured JSON artifact is available for the current verification view.',
      proof: 'The artifact records timestamp, mode, overall state, categories checked, per-check status, and next steps.',
      nextAction: 'Download the proof artifact once you are ready to share or archive the current verification state.',
    }),
  ];
}

function buildRecommendations(report) {
  const steps = [];
  const hasLiveProof = Boolean(report.sdk?.hasLiveProof);

  if (report.config.missingRequired.length > 0) {
    steps.push(
      createStep({
        id: 'set_required_env',
        title: 'Set required environment variables',
        variant: 'error',
        summary: `DashClaw is missing ${report.config.missingRequired.length} required setting(s).`,
        details: report.config.missingRequired.map((entry) => `${entry.key}: ${entry.help}`),
      })
    );
  }

  if (report.db.reason === 'missing_database_url') {
    steps.push(
      createStep({
        id: 'set_database_url',
        title: 'Set DATABASE_URL',
        variant: 'error',
        summary: 'DashClaw cannot start database verification until DATABASE_URL is configured.',
        details: [
          'What failed: no database connection string was present.',
          'Likely cause: the deployment is missing its database connection string.',
          'Next action: add DATABASE_URL to your environment and restart or redeploy.',
        ],
        code: 'DATABASE_URL=postgres://user:password@localhost:5432/dashclaw',
        publicCode: '',
        note: 'Use the real connection string from your Postgres deployment. Do not paste secrets into shared screenshots.',
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
          'What failed: the live database connection attempt did not succeed.',
          'Likely cause: the database is offline, unreachable from this deployment, or using invalid credentials.',
          'Next action: verify DATABASE_URL, confirm the database is reachable, then reload /setup.',
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
          'What failed: one or more required core tables are still missing.',
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

  if (!report.auth.ok) {
    steps.push(
      createStep({
        id: 'configure_auth',
        title: 'Configure a sign-in method',
        variant: 'warn',
        summary: 'Operators need at least one complete sign-in method before normal dashboard access will work.',
        details: [
          'What failed: no complete operator sign-in path is configured.',
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
        details: report.config.missingAdvisory.map((entry) => `${entry.key}: ${entry.help}`),
      })
    );
  }

  if (report.db.ok && report.config.ok) {
    steps.push(
      createStep({
        id: 'run_sdk_validation',
        title: hasLiveProof ? 'Live SDK proof captured' : 'Run live SDK validation',
        variant: hasLiveProof ? 'info' : report.auth.hasAgentApiKey ? 'info' : 'warn',
        summary: hasLiveProof
          ? 'A successful live validation result is attached to this verify view.'
          : report.auth.hasAgentApiKey
          ? 'Core verification passed. Use the Node or Python validation path to collect live client proof.'
          : 'Core verification passed, but you still need API credentials before live SDK validation can succeed.',
        details: hasLiveProof
          ? [
              `Captured proof: ${report.sdk.evidenceSummary}`,
              'Next action: download the refreshed JSON proof artifact or keep the signed setup URL for operational handoff.',
            ]
          : report.auth.hasAgentApiKey
          ? [
              'What this proves next: real API ingress, authentication, and a live client request path.',
              'Next action: run the Node or Python command in the SDK verification section and archive the result with the JSON proof artifact.',
            ]
          : [
              'What is pending: live integration proof still depends on API credentials.',
              'Next action: set DASHCLAW_API_KEY or sign in and create a workspace API key before running the SDK validation commands.',
            ],
      })
    );
  }

  if (steps.length === 0) {
    steps.push(
      createStep({
        id: 'instance_verified',
        title: 'Instance verification looks strong',
        variant: 'info',
        summary: 'Core verification checks are passing and operator access looks ready.',
        details: ['Next action: download the JSON proof artifact and run a live SDK validation command if you want additional client-path evidence.'],
      })
    );
  }

  return steps;
}

function buildVerificationState(report) {
  const hasBlockingFailure = !report.db.ok || !report.config.ok;
  if (hasBlockingFailure) {
    return {
      overall: 'blocked',
      ...OVERALL_STATE_META.blocked,
      ready: false,
      fullyVerified: false,
    };
  }

  const hasAttentionIssue =
    !report.auth.ok ||
    report.config.missingAdvisory.length > 0 ||
    report.auth.hasPartialProviderWarnings;

  if (hasAttentionIssue) {
    return {
      overall: 'needs_attention',
      ...OVERALL_STATE_META.needs_attention,
      ready: false,
      fullyVerified: false,
    };
  }

  if (!report.auth.hasAgentApiKey || !report.sdk?.hasLiveProof) {
    return {
      overall: 'ready_unverified',
      ...OVERALL_STATE_META.ready_unverified,
      ready: true,
      fullyVerified: false,
    };
  }

  return {
    overall: 'verified',
    ...OVERALL_STATE_META.verified,
    ready: true,
    fullyVerified: true,
  };
}

function buildProofArtifact(view, host) {
  const categories = view.sections.map((section) => ({
    id: section.id,
    title: section.title,
    status: section.status,
    summary: section.summary,
    what_was_checked: section.whatWasChecked,
    evidence_summary: section.evidenceSummary,
    pending_proof: section.pendingProof,
    checks: section.checks.map((check) => ({
      id: check.id,
      label: check.label,
      status: check.status,
      detail: check.detail,
      sub_detail: check.subDetail,
      likely_cause: check.likelyCause,
      next_action: check.nextAction,
    })),
  }));

  return {
    artifact_version: 1,
    generated_at: new Date().toISOString(),
    checked_at: view.checkedAt,
    route: '/setup',
    viewer_mode: view.mode,
    host: host || '',
    verification: {
      overall: view.verification.overall,
      label: view.verification.label,
      summary: view.verification.summary,
      ready: view.verification.ready,
      fully_verified: view.verification.fullyVerified,
      readiness_status: view.overall,
    },
    runtime: {
      node_version: process.version,
      node_env: process.env.NODE_ENV || 'development',
    },
    categories,
    workflow: view.workflow.map((step) => ({
      id: step.id,
      title: step.title,
      status: step.status,
      summary: step.summary,
      proof: step.proof,
      next_action: step.nextAction,
    })),
    recommended_next_steps: view.recommendations.map((step) => ({
      id: step.id,
      title: step.title,
      variant: step.variant,
      summary: step.summary,
      details: step.details,
      code: step.code,
      note: step.note,
    })),
    sdk_validation: view.sdk?.commands
      ? {
          base_url: view.sdk.commands.baseUrl,
          node_command: view.sdk.commands.node,
          python_command: view.sdk.commands.python,
          live_proof: view.sdk.liveProof
            ? {
                tool: view.sdk.liveProof.tool,
                mode: view.sdk.liveProof.mode,
                captured_at: view.sdk.liveProof.capturedAt,
                summary: view.sdk.liveProof.summary,
                proof_statement: view.sdk.liveProof.proofStatement,
                checks: view.sdk.liveProof.checks,
              }
            : null,
          note: view.sdk.liveProof
            ? 'This artifact includes a signed live validation proof token summary for the current verify view.'
            : 'These commands are guidance for live validation. The artifact does not claim they have already been executed.',
        }
      : null,
    notice: view.notice || '',
  };
}

export async function getReadinessReport(env = process.env, options = {}) {
  const { host = '', liveProof = null } = options;

  const [dbStatus, authConfig, config] = await Promise.all([
    getSetupStatus(env),
    Promise.resolve(getAuthConfig(env)),
    Promise.resolve(checkConfiguration(env)),
  ]);

  const application = buildApplicationSection(env);
  const db = buildDatabaseSection(dbStatus);
  const configuration = buildConfigurationSection(config);
  const auth = buildAuthSection(authConfig, env);
  const baseReport = {
    checkedAt: new Date().toISOString(),
    application,
    db,
    config: configuration,
    auth,
  };

  const sdk = buildSdkSection(host, baseReport, liveProof);
  const sections = [application, db, configuration, auth, sdk];

  let overall = 'healthy';
  if (!db.ok || !configuration.ok) {
    overall = 'blocked';
  } else if (!auth.ok || configuration.missingAdvisory.length > 0 || auth.status === 'warn') {
    overall = 'needs_attention';
  }

  const report = {
    overall,
    checkedAt: baseReport.checkedAt,
    application,
    db,
    config: configuration,
    auth,
    sdk,
    sections,
  };

  const verification = buildVerificationState(report);

  return {
    ...report,
    verification,
    workflow: buildWorkflow(report),
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

export function projectReadinessReport(report, { isAuthenticated = false, host = '' } = {}) {
  const projectedSections = report.sections.map((section) => ({
    ...section,
    checks: section.checks.map((check) => projectCheck(check, isAuthenticated)),
  }));

  const projectedSdk = projectedSections.find((section) => section.id === 'sdk') || report.sdk;
  const view = {
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
    sdk: projectedSdk,
    sections: projectedSections,
    workflow: report.workflow.map((step) => ({ ...step })),
    recommendations: report.recommendations.map((step) => projectStep(step, isAuthenticated)),
  };

  return {
    ...view,
    proofArtifact: buildProofArtifact(view, host),
  };
}
