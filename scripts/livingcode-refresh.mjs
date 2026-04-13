#!/usr/bin/env node
/**
 * Refresh all derivative artifacts from the livingcode shape model.
 *
 * Run manually: `npm run livingcode:refresh`
 * Run automatically: pre-commit hook (via scripts/lib/run-pre-commit-checks.mjs)
 *
 * Outputs:
 *   - app/lib/doctor/generated/shape.json            (committed, JS reads at runtime)
 *   - app/lib/doctor/generated/last-snapshot.json    (drift-check baseline)
 *   - public/downloads/dashclaw-platform-intelligence/SKILL.md (website)
 *   - public/downloads/dashclaw-platform-intelligence.zip      (website)
 *   - public/downloads/dashclaw-platform-intelligence.zip.manifest (zip-idempotence marker)
 *   - ${USERPROFILE}/.claude/skills/dashclaw-platform-intelligence/SKILL.md (global)
 *
 * Zero new npm deps — relies on Python being on PATH (livingcode) and Node stdlib.
 * Production reads only the committed JSON, so Vercel never needs Python.
 *
 * Idempotence:
 *   - shape.json emitter substitutes a content-hash signature for the
 *     wall-clock timestamp, so re-runs produce byte-identical JSON.
 *   - SKILL.md gets the same signature spliced in place of its live timestamp.
 *   - The zip is only regenerated when the manifest hash disagrees with the
 *     skill directory contents, so git doesn't churn on every refresh.
 */
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir, platform, tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = process.cwd();
const GENERATED_DIR = resolve(REPO_ROOT, 'app', 'lib', 'doctor', 'generated');
const WEBSITE_SKILL_DIR = resolve(REPO_ROOT, 'public', 'downloads', 'dashclaw-platform-intelligence');
const WEBSITE_SKILL_ZIP = resolve(REPO_ROOT, 'public', 'downloads', 'dashclaw-platform-intelligence.zip');
const WEBSITE_SKILL_MANIFEST = `${WEBSITE_SKILL_ZIP}.manifest`;
const GLOBAL_SKILL_DIR = resolve(homedir(), '.claude', 'skills', 'dashclaw-platform-intelligence');

const PY = process.env.PYTHON || 'python';
const SKILL_TIMESTAMP_LINE = /^(\*\*Shape snapshot:\*\*\s+`)[^`]+(`)/m;

// Source file patterns that imply the generated shape may have changed.
// If pre-commit (--if-staged) sees none of these staged, it skips the refresh.
const SOURCE_PATH_RE = /^(app\/api\/|app\/lib\/|schema\/schema\.js$|middleware\.js$|livingcode\/)/;
// Paths that are themselves generated output — staging these doesn't count as
// a source change that should trigger a refresh.
const GENERATED_PATH_RE = /^(app\/lib\/doctor\/generated\/|public\/downloads\/dashclaw-platform-intelligence)/;

function isSourceChange(path) {
  const normalised = path.replace(/\\/g, '/');
  if (GENERATED_PATH_RE.test(normalised)) return false;
  return SOURCE_PATH_RE.test(normalised);
}

function log(msg) {
  process.stdout.write(`[livingcode] ${msg}\n`);
}

function warn(msg) {
  process.stderr.write(`[livingcode] WARN: ${msg}\n`);
}

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function runPython(args, { cwd = REPO_ROOT } = {}) {
  const result = spawnSync(PY, ['-m', 'livingcode', ...args], {
    cwd,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (result.status !== 0) {
    throw new Error(`livingcode ${args.join(' ')} exited with code ${result.status}`);
  }
}

function emitShapeJson() {
  ensureDir(GENERATED_DIR);
  const out = join(GENERATED_DIR, 'shape.json');
  runPython(['emit', 'shape-json', '--output', out]);
  log(`shape.json -> ${relative(REPO_ROOT, out)}`);
  return out;
}

function emitDoctorChecks() {
  ensureDir(GENERATED_DIR);
  const out = join(GENERATED_DIR, 'checks-from-shape.mjs');
  runPython(['emit', 'doctor-checks', '--output', out]);
  log(`checks-from-shape.mjs -> ${relative(REPO_ROOT, out)}`);
  return out;
}

function writeLastSnapshot(shapeJsonPath) {
  const out = join(GENERATED_DIR, 'last-snapshot.json');
  copyFileSync(shapeJsonPath, out);
  log(`last-snapshot.json -> ${relative(REPO_ROOT, out)}`);
  return out;
}

function loadShapeSignature(shapeJsonPath) {
  const parsed = JSON.parse(readFileSync(shapeJsonPath, 'utf8'));
  if (typeof parsed.timestamp !== 'string' || parsed.timestamp.length === 0) {
    throw new Error('shape.json is missing a timestamp/signature');
  }
  return parsed.timestamp;
}

/**
 * Emit the livingcode skill and splice in the content-hash signature so the
 * output is byte-identical across runs with unchanged source.
 */
function emitSkill(signature) {
  const tempOut = join(tmpdir(), `dashclaw-skill-${process.pid}.md`);
  runPython(['emit', 'skill', '--output', tempOut]);
  const raw = readFileSync(tempOut, 'utf8');
  rmSync(tempOut, { force: true });

  const normalised = raw.replace(SKILL_TIMESTAMP_LINE, `$1${signature}$2`);
  if (normalised === raw) {
    warn('skill emitter output did not match expected timestamp line — SKILL.md may be non-idempotent');
  }
  return normalised;
}

function writeIfChanged(path, content, label) {
  ensureDir(dirname(path));
  if (existsSync(path) && readFileSync(path, 'utf8') === content) {
    log(`${label} unchanged`);
    return false;
  }
  writeFileSync(path, content, 'utf8');
  log(`${label} -> ${relative(REPO_ROOT, path)}`);
  return true;
}

function hashDirectory(dir) {
  const hash = createHash('sha256');
  const walk = (current) => {
    const entries = readdirSync(current, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        hash.update(`D|${relative(dir, full)}\n`);
        walk(full);
      } else if (entry.isFile()) {
        hash.update(`F|${relative(dir, full)}|${statSync(full).size}\n`);
        hash.update(readFileSync(full));
        hash.update('\n');
      }
    }
  };
  walk(dir);
  return hash.digest('hex');
}

function readManifest(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Rebuild the skill zip only when the skill directory hash disagrees with the
 * manifest. The manifest is committed alongside the zip so re-runs stay
 * idempotent — the zip format embeds timestamps, so naive re-packaging would
 * produce a byte-different archive every invocation.
 */
function refreshSkillZip(skillDir, zipPath, manifestPath) {
  if (!existsSync(skillDir)) {
    warn(`skill dir missing, cannot zip: ${skillDir}`);
    return;
  }

  const hash = hashDirectory(skillDir);
  const manifest = readManifest(manifestPath);
  if (manifest && manifest.hash === hash && existsSync(zipPath)) {
    log(`zip unchanged (hash ${hash.slice(0, 12)}…)`);
    return;
  }

  rmSync(zipPath, { force: true });

  const isWindows = platform() === 'win32';
  let status;
  if (isWindows) {
    const result = spawnSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Compress-Archive -Path "${skillDir}" -DestinationPath "${zipPath}" -Force`,
      ],
      { stdio: ['ignore', 'inherit', 'inherit'] },
    );
    status = result.status;
  } else {
    const parent = dirname(skillDir);
    const name = skillDir.split(/[\\/]/).pop();
    const result = spawnSync('zip', ['-r', zipPath, name], {
      cwd: parent,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    status = result.status;
  }

  if (status !== 0) {
    warn(`zip command failed (status ${status}) — skipping manifest update`);
    return;
  }

  writeFileSync(
    manifestPath,
    JSON.stringify({ hash, generatedBy: 'livingcode-refresh' }, null, 2) + '\n',
    'utf8',
  );
  log(`zip -> ${relative(REPO_ROOT, zipPath)} (manifest updated)`);
}

function stagedFiles() {
  const result = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) return [];
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function hasRelevantStagedFiles() {
  return stagedFiles().some(isSourceChange);
}

async function main() {
  const ifStaged = process.argv.includes('--if-staged');
  if (ifStaged && !hasRelevantStagedFiles()) {
    log('no staged changes affect shape — skipping refresh');
    return;
  }

  log(`refreshing derivative artifacts from livingcode (cwd=${REPO_ROOT})`);

  const shapeJsonPath = emitShapeJson();
  writeLastSnapshot(shapeJsonPath);
  emitDoctorChecks();
  const signature = loadShapeSignature(shapeJsonPath);

  const skillContent = emitSkill(signature);
  writeIfChanged(join(WEBSITE_SKILL_DIR, 'SKILL.md'), skillContent, 'skill (website)');

  try {
    writeIfChanged(join(GLOBAL_SKILL_DIR, 'SKILL.md'), skillContent, 'skill (global)');
  } catch (err) {
    warn(`could not write global skill (${err.message}) — fine on CI/non-dev machines`);
  }

  refreshSkillZip(WEBSITE_SKILL_DIR, WEBSITE_SKILL_ZIP, WEBSITE_SKILL_MANIFEST);

  log('refresh complete');
}

main().catch((err) => {
  console.error(`[livingcode] refresh failed: ${err.message}`);
  process.exit(1);
});
