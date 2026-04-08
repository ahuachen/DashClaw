import { execFileSync } from 'node:child_process';

const STEPS = [
  {
    id: 'generate-api-inventory',
    label: 'Generate API inventory',
    command: [process.execPath, 'scripts/generate-api-inventory.mjs'],
    failHook: true,
  },
  {
    id: 'generate-openapi',
    label: 'Generate OpenAPI spec',
    command: [process.execPath, 'scripts/generate-openapi.mjs'],
    failHook: true,
  },
  {
    id: 'stage-artifacts',
    label: 'Stage generated artifacts',
    command: [
      'git',
      'add',
      'docs/api-inventory.json',
      'docs/api-inventory.md',
      'docs/openapi/critical-stable.openapi.json',
    ],
    failHook: true,
  },
  {
    id: 'contracts-check',
    label: 'Run contracts check (warn-only)',
    command: [process.execPath, 'scripts/check-contracts.mjs', '--mode=warn'],
    failHook: false,
  },
];

/**
 * Run all pre-commit checks in sequence.
 *
 * @param {{ execImpl?: Function }} options
 * @returns {{ success: boolean, steps: Array<{ id: string, label: string, success: boolean, error?: string }> }}
 */
export function runPreCommitChecks({ execImpl = execFileSync } = {}) {
  const steps = [];
  let success = true;

  for (const step of STEPS) {
    const [cmd, ...args] = step.command;
    try {
      execImpl(cmd, args, { stdio: 'inherit' });
      steps.push({ id: step.id, label: step.label, success: true });
    } catch (err) {
      const error = err.message || String(err);
      steps.push({ id: step.id, label: step.label, success: false, error });

      if (step.failHook) {
        success = false;
        break;
      }
      // warn-only steps don't set success = false
    }
  }

  return { success, steps };
}
