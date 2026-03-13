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

export const OVERALL_STATE_META = {
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
