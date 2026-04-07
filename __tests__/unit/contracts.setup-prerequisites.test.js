import { describe, expect, it } from 'vitest';
import { loadContracts } from '../../scripts/lib/contracts/load-contracts.mjs';
import { checkSetupPrerequisites } from '../../scripts/lib/contracts/check-setup-prerequisites.mjs';
import {
  CORE_SETUP_TABLES,
  SETUP_MIGRATION_SCRIPTS,
  SETUP_READINESS_MIGRATION_SCRIPTS,
} from '../../app/lib/setup/runtime-prerequisites.mjs';

describe('checkSetupPrerequisites', () => {
  it('fails when required setup prerequisites drift from the runtime declarations', async () => {
    const result = await checkSetupPrerequisites({
      setup: {
        'runtime-prerequisites': {
          owner: 'app/lib/setup/runtime-prerequisites.mjs',
          migration_scripts: ['scripts/migrate-multi-tenant.mjs'],
          readiness_migration_scripts: ['scripts/migrate-multi-tenant.mjs'],
          core_tables: ['action_records'],
          consumers: {
            setup_script: 'scripts/setup.mjs',
            schema_check: 'app/lib/schemaCheck.js',
            readiness_workflow: 'app/lib/readiness/workflow.mjs',
          },
        },
      },
    }, {
      migrationScripts: ['scripts/migrate-multi-tenant.mjs', 'scripts/migrate-capabilities.mjs'],
      readinessMigrationScripts: ['scripts/migrate-capabilities.mjs'],
      coreTables: ['action_records', 'guard_decisions'],
      consumers: {
        setup_script: '',
        schema_check: '',
        readiness_workflow: '',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.code === 'setup_migration_contract_drift')).toBe(true);
    expect(result.findings.some((finding) => finding.code === 'setup_core_tables_contract_drift')).toBe(true);
    expect(result.findings.some((finding) => finding.code === 'setup_consumer_not_using_shared_prerequisites')).toBe(true);
  });

  it('passes when the runtime setup declarations and consumers match the contract', async () => {
    const contracts = await loadContracts(process.cwd());
    const result = await checkSetupPrerequisites(contracts, {
      migrationScripts: SETUP_MIGRATION_SCRIPTS,
      readinessMigrationScripts: SETUP_READINESS_MIGRATION_SCRIPTS,
      coreTables: CORE_SETUP_TABLES,
      consumers: {
        setup_script: "import { buildSetupMigrationCommands, SETUP_MIGRATION_SCRIPTS } from '../app/lib/setup/runtime-prerequisites.mjs';",
        schema_check: "import { CORE_SETUP_TABLES, getSetupMigrationCommand } from './setup/runtime-prerequisites.mjs';",
        readiness_workflow: "import { buildSetupMigrationCommands, SETUP_READINESS_MIGRATION_SCRIPTS } from '../setup/runtime-prerequisites.mjs';",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });
});
