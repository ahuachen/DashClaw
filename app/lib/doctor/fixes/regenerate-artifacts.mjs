// app/lib/doctor/fixes/regenerate-artifacts.mjs
//
// Runs `npm run livingcode:refresh` to rebuild shape.json, last-snapshot.json,
// checks-from-shape.mjs, SKILL.md, and the zip bundle. Local-only — the
// deployed API cannot execute npm scripts, so FIX_REGISTRY marks it scope=local.
import { spawnSync } from 'node:child_process';

export async function apply() {
  const result = spawnSync('npm', ['run', 'livingcode:refresh'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.status === 0) {
    return {
      applied: true,
      description: 'Regenerated livingcode artifacts (shape.json, SKILL.md, doctor-checks, zip)',
    };
  }

  const stderr = (result.stderr || '').toString().trim();
  const tail = stderr.split(/\r?\n/).slice(-3).join(' | ');
  return {
    applied: false,
    description: `livingcode refresh failed (status ${result.status}): ${tail || 'no stderr output'}`,
  };
}
