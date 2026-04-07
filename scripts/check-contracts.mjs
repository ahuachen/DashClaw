import { loadContracts } from './lib/contracts/load-contracts.mjs';
import { checkApiSurface } from './lib/contracts/check-api-surface.mjs';
import { checkSetupEnvPrerequisites } from './lib/contracts/check-setup-env-prerequisites.mjs';
import { checkSchemaSetup } from './lib/contracts/check-schema-setup.mjs';
import { checkSetupPrerequisites } from './lib/contracts/check-setup-prerequisites.mjs';
import { checkSdkSurface } from './lib/contracts/check-sdk-surface.mjs';

function parseArgs(args) {
  const modeArg = args.find((arg) => arg.startsWith('--mode='));
  return {
    mode: modeArg ? modeArg.split('=')[1] : 'ci',
  };
}

function getValidatorFns(contracts) {
  const validators = [];

  if (contracts.index.validators?.schema_setup) {
    validators.push((loadedContracts) => checkSchemaSetup(loadedContracts));
  }

  if (contracts.index.validators?.sdk_surface) {
    validators.push((loadedContracts) => checkSdkSurface(loadedContracts));
  }

  if (contracts.index.validators?.api_surface) {
    validators.push((loadedContracts) => checkApiSurface(loadedContracts));
  }

  if (contracts.index.validators?.setup_prerequisites) {
    validators.push((loadedContracts) => checkSetupPrerequisites(loadedContracts));
  }

  if (contracts.index.validators?.setup_env_prerequisites) {
    validators.push((loadedContracts) => checkSetupEnvPrerequisites(loadedContracts));
  }

  return validators;
}

function printFindings(findings) {
  if (findings.length === 0) {
    console.log('contracts check passed');
    return;
  }

  console.error('Contract violation(s) found:');
  for (const finding of findings) {
    console.error(`- [${finding.code}] ${finding.message}`);
  }
}

export async function runContractsCheck({ mode = 'ci', contracts = null, validatorFns = null } = {}) {
  const loadedContracts = contracts || await loadContracts(process.cwd());
  const validators = validatorFns || getValidatorFns(loadedContracts);

  const results = await Promise.all(validators.map((validator) => validator(loadedContracts)));
  const findings = results.flatMap((result) => result.findings || []);

  printFindings(findings);

  return {
    exitCode: findings.length > 0 && mode !== 'warn' ? 1 : 0,
    findings,
  };
}

const isCliEntry = process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href;

if (isCliEntry) {
  const { exitCode } = await runContractsCheck(parseArgs(process.argv.slice(2)));
  process.exit(exitCode);
}
