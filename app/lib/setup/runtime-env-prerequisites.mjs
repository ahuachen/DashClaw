export const ENV_METADATA = {
  DATABASE_URL: {
    description: 'Postgres connection string',
    help: 'Add DATABASE_URL to your environment, then restart or redeploy.',
  },
  NEXTAUTH_SECRET: {
    description: 'Session signing secret',
    help: 'Generate one with: openssl rand -base64 32',
  },
  NEXTAUTH_URL: {
    description: 'Public URL of this DashClaw instance',
    help: 'Set NEXTAUTH_URL so OAuth callbacks and login redirects use the correct host.',
  },
  DASHCLAW_API_KEY: {
    description: 'Default API key for agent authentication',
    help: 'Set DASHCLAW_API_KEY or sign in and generate a workspace API key before connecting agents.',
  },
  CRON_SECRET: {
    description: 'Secret token protecting /api/cron/* routes from unauthorized invocation',
    help: 'Generate with: openssl rand -hex 32, then add it to your deployment environment variables.',
  },
  ALLOWED_ORIGIN: {
    description: 'Allowed CORS origin for cross-origin API access',
    help: 'Set ALLOWED_ORIGIN to the trusted origin that should be allowed to call the API.',
  },
};

export const READINESS_REQUIRED_ENV_VARS = ['DATABASE_URL', 'NEXTAUTH_SECRET'];
export const READINESS_ADVISORY_ENV_VARS = ['NEXTAUTH_URL', 'DASHCLAW_API_KEY', 'CRON_SECRET'];

export const PRODUCTION_REQUIRED_ENV_VARS = ['DASHCLAW_API_KEY', 'NEXTAUTH_SECRET', 'ENCRYPTION_KEY'];
export const PRODUCTION_ADVISORY_ENV_VARS = ['CRON_SECRET', 'ALLOWED_ORIGIN'];

export const SELF_HOST_GENERATED_ENV_VARS = [
  'DASHCLAW_MODE',
  'NEXT_PUBLIC_DASHCLAW_MODE',
  'DATABASE_URL',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'DASHCLAW_API_KEY',
  'ENCRYPTION_KEY',
];

export const ENV_CONSTRAINTS = [
  {
    key: 'ENCRYPTION_KEY',
    type: 'length',
    value: 32,
    message: 'ENCRYPTION_KEY must be exactly 32 characters',
  },
];

export function describeEnvVars(keys = []) {
  return keys.map((key) => ({
    key,
    description: ENV_METADATA[key]?.description || `${key} environment variable`,
    help: ENV_METADATA[key]?.help || `Set ${key} in your environment.`,
  }));
}

