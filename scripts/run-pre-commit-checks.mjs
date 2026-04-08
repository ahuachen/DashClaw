process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

import { runPreCommitChecks } from './lib/run-pre-commit-checks.mjs';

const result = runPreCommitChecks();

if (!result.success) {
  const failed = result.steps.find((s) => !s.success);
  console.error(`\npre-commit failed at step: ${failed?.label ?? 'unknown'}`);
  if (failed?.error) console.error(failed.error);
  process.exit(1);
}
