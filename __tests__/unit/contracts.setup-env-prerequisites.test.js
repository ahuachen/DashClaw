import { describe, expect, it } from 'vitest';
import { loadContracts } from '../../scripts/lib/contracts/load-contracts.mjs';
import { checkSetupEnvPrerequisites } from '../../scripts/lib/contracts/check-setup-env-prerequisites.mjs';
import {
  PRODUCTION_REQUIRED_ENV_VARS,
  PRODUCTION_ADVISORY_ENV_VARS,
  READINESS_REQUIRED_ENV_VARS,
  READINESS_ADVISORY_ENV_VARS,
  SELF_HOST_GENERATED_ENV_VARS,
  ENV_CONSTRAINTS,
} from '../../app/lib/setup/runtime-env-prerequisites.mjs';

describe('checkSetupEnvPrerequisites', () => {
  it('fails when env prerequisite contracts drift from runtime declarations', async () => {
    const result = await checkSetupEnvPrerequisites({
      setup: {
        'runtime-env-prerequisites': {
          owner: 'app/lib/setup/runtime-env-prerequisites.mjs',
          production_required_env: ['DATABASE_URL'],
          production_advisory_env: ['NEXTAUTH_URL'],
          self_host_generated_env: ['DATABASE_URL'],
          constraints: [{ key: 'ENCRYPTION_KEY', type: 'length', value: 32 }],
          consumers: {
            startup_validation: 'app/lib/validateEnv.js',
            readiness_constants: 'app/lib/readiness/constants.mjs',
            self_host_init: 'scripts/init-self-host-env.mjs',
          },
        },
      },
    }, {
      productionRequiredEnv: ['DATABASE_URL', 'NEXTAUTH_SECRET'],
      productionAdvisoryEnv: ['NEXTAUTH_URL', 'CRON_SECRET'],
      selfHostGeneratedEnv: ['DATABASE_URL', 'NEXTAUTH_SECRET'],
      constraints: [{ key: 'ENCRYPTION_KEY', type: 'length', value: 64 }],
      consumers: {
        startup_validation: '',
        readiness_constants: '',
        self_host_init: '',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === 'setup_env_required_contract_drift')).toBe(true);
    expect(result.findings.some((finding) => finding.code === 'setup_env_constraints_contract_drift')).toBe(true);
    expect(result.findings.some((finding) => finding.code === 'setup_env_consumer_not_using_shared_prerequisites')).toBe(true);
  });

  it('passes when runtime env prerequisites and consumers match the contract', async () => {
    const contracts = await loadContracts(process.cwd());
    const result = await checkSetupEnvPrerequisites(contracts, {
      productionRequiredEnv: PRODUCTION_REQUIRED_ENV_VARS,
      productionAdvisoryEnv: PRODUCTION_ADVISORY_ENV_VARS,
      readinessRequiredEnv: READINESS_REQUIRED_ENV_VARS,
      readinessAdvisoryEnv: READINESS_ADVISORY_ENV_VARS,
      selfHostGeneratedEnv: SELF_HOST_GENERATED_ENV_VARS,
      constraints: ENV_CONSTRAINTS,
      consumers: {
        startup_validation: "import { ENV_CONSTRAINTS, PRODUCTION_ADVISORY_ENV_VARS, PRODUCTION_REQUIRED_ENV_VARS } from './setup/runtime-env-prerequisites.mjs';",
        readiness_constants: "import { describeEnvVars, READINESS_ADVISORY_ENV_VARS, READINESS_REQUIRED_ENV_VARS } from '../setup/runtime-env-prerequisites.mjs';",
        self_host_init: "import { SELF_HOST_GENERATED_ENV_VARS } from '../app/lib/setup/runtime-env-prerequisites.mjs';",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });
});
