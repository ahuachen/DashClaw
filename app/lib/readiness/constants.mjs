import {
  describeEnvVars,
  READINESS_ADVISORY_ENV_VARS,
  READINESS_REQUIRED_ENV_VARS,
} from '../setup/runtime-env-prerequisites.mjs';

export const REQUIRED_ENV_VARS = describeEnvVars(READINESS_REQUIRED_ENV_VARS);

export const ADVISORY_ENV_VARS = describeEnvVars(READINESS_ADVISORY_ENV_VARS);

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
