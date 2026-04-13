// app/lib/doctor/checks/drift.mjs
//
// Compares the live shape snapshot (app/lib/doctor/generated/shape.json) against
// the last committed baseline (app/lib/doctor/generated/last-snapshot.json). If
// they disagree, something changed after the last `npm run livingcode:refresh`
// — the operator should regenerate before shipping.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = resolve(HERE, '..', 'generated');
const SHAPE_PATH = resolve(GENERATED_DIR, 'shape.json');
const SNAPSHOT_PATH = resolve(GENERATED_DIR, 'last-snapshot.json');

/**
 * The `regenerate_artifacts` fix is gated by FIX_REGISTRY's `scope: 'local'`
 * entry — remote invocations of the fix are rejected by applyFix, so it's safe
 * to always advertise the fix. Deployed clients can display the hint even
 * though they cannot execute it themselves.
 */
const REGENERATE_FIX = {
  type: 'auto',
  description: 'Run npm run livingcode:refresh to rebaseline',
  action: 'regenerate_artifacts',
};

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function countsOf(shape) {
  return {
    routes: Array.isArray(shape.routes) ? shape.routes.length : 0,
    env_vars: Array.isArray(shape.env_vars) ? shape.env_vars.length : 0,
    tables: Array.isArray(shape.tables) ? shape.tables.length : 0,
  };
}

function summariseDrift(prev, curr) {
  const diffs = [];
  for (const key of ['routes', 'env_vars', 'tables']) {
    const delta = curr[key] - prev[key];
    if (delta === 0) continue;
    const action = delta > 0 ? 'added' : 'removed';
    const abs = Math.abs(delta);
    diffs.push(`${abs} ${key} ${action}`);
  }
  return diffs;
}

/**
 * Pure comparison between a current shape and a baseline snapshot. Exported so
 * tests can exercise the full decision tree without mocking Node's fs module.
 * @param {object|null} shape
 * @param {object|null} snapshot
 * @returns {Array<object>} doctor check objects
 */
export function computeDriftChecks(shape, snapshot) {
  if (!shape) {
    return [
      {
        id: 'drift_shape_missing',
        category: 'drift',
        status: 'warn',
        title: 'Shape snapshot',
        message: 'app/lib/doctor/generated/shape.json is missing — run npm run livingcode:refresh',
        fix: REGENERATE_FIX,
      },
    ];
  }

  if (!snapshot) {
    return [
      {
        id: 'drift_baseline_missing',
        category: 'drift',
        status: 'warn',
        title: 'Drift baseline',
        message: 'No baseline snapshot found — run npm run livingcode:refresh to create one',
        fix: REGENERATE_FIX,
      },
    ];
  }

  if (shape.timestamp && snapshot.timestamp && shape.timestamp === snapshot.timestamp) {
    return [
      {
        id: 'drift_status',
        category: 'drift',
        status: 'pass',
        title: 'Shape vs baseline',
        message: `Baseline matches current shape (${shape.timestamp})`,
        fix: null,
      },
    ];
  }

  const diffs = summariseDrift(countsOf(snapshot), countsOf(shape));
  const detail =
    diffs.length > 0
      ? diffs.join(', ')
      : 'content signature changed but counts match — field-level changes';

  return [
    {
      id: 'drift_status',
      category: 'drift',
      status: 'warn',
      title: 'Shape vs baseline',
      message: `Shape drifted from baseline: ${detail}. Run npm run livingcode:refresh to rebaseline.`,
      fix: REGENERATE_FIX,
    },
  ];
}

/**
 * @param {{ env?: object, host?: string }} options
 */
export async function runChecks() {
  return computeDriftChecks(readJson(SHAPE_PATH), readJson(SNAPSHOT_PATH));
}
