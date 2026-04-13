# Codebase change awareness — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-agent codebase awareness system that pings the user when `HEAD` moves between prompts, and a `/whatsnew` slash command that shows a structured readout grouped by area and flags files that overlap with the current session's edits.

**Architecture:** A `UserPromptSubmit` hook compares current `HEAD` to a per-working-directory state file on every prompt; if they differ, it injects a one-line ping into prompt context. The state file is only advanced by an explicit `/whatsnew` invocation, so the ping is sticky until the user acknowledges. `/whatsnew` prints a structured report grouped by area; `/whatsnew --explain` hands the same data to the model for a semantic summary. No fetch, no daemon, no new deps.

**Tech Stack:** Node 20+ stdlib (no new npm deps), `node:test` runner for unit + integration tests, existing Claude Code hook/skill infrastructure (`~/.claude/hooks/`, `~/.claude/skills/`, `~/.claude/settings.json`).

**Reference spec:** `docs/superpowers/specs/2026-04-13-codebase-change-awareness-design.md`

**Safety note on shell invocations:** all code in this plan uses `spawnSync` / `execFileSync` with argument **arrays** — never `execSync` with string commands. This avoids shell interpolation entirely, which matters for test helpers that accept dynamic input and also plays well with the repo's security review pattern.

---

## Repository note — commits

All changes land in the user's `~/.claude/` directory, **not** in the DashClaw repo. If `~/.claude/` is under version control (dotfiles repo), commit at the end of each task using the shown commands. If it isn't, the checkbox list in this plan is your tracker — each task is still a natural stopping point.

---

## Task 1: Preflight — inspect existing hook conventions

No new files. Reconnaissance so subsequent tasks match existing conventions on this machine.

**Files:**
- Read: `~/.claude/settings.json`
- Read: referenced `UserPromptSubmit` hook scripts

- [ ] **Step 1: Read the hook settings**

Run:
```bash
cat ~/.claude/settings.json
```

Note:
- The current `hooks.UserPromptSubmit` array (you will add an entry in Task 9).
- The exact JSON shape each entry uses.

- [ ] **Step 2: Read an existing hook to learn the output convention**

Find a `UserPromptSubmit` hook referenced from settings and read its source. Typical candidates:
```bash
cat ./.claude/hooks/impeccable-reminder.py    # project-local, if present
ls ~/.claude/hooks/                           # user-level
```

Determine how the hook emits context:
- **Plain stdout** — whatever prints becomes prepended prompt context.
- **JSON stdout** — prints `{"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": "..."}}`.

The new hook in Task 7 emits plain stdout by default (matches the simplest convention); if your machine uses the JSON form, wrap the one output line in the JSON envelope in Task 7, Step 3.

- [ ] **Step 3: Confirm the per-project state directory exists**

```bash
ls ~/.claude/projects/C--Projects-DashClaw/
```
If absent:
```bash
mkdir -p ~/.claude/projects/C--Projects-DashClaw
```

- [ ] **Step 4: Record findings (no commit)**

```bash
mkdir -p ~/.claude/skills/whatsnew
cat > ~/.claude/skills/whatsnew/NOTES.md <<'EOF'
# whatsnew implementation notes

Hook output convention on this machine: <plain-stdout | json-additionalContext>
Existing UserPromptSubmit entries (verbatim JSON shape):
<paste from settings.json>
EOF
```

---

## Task 2: Project scaffolding

**Files:**
- Create: `~/.claude/skills/whatsnew/lib/`
- Create: `~/.claude/skills/whatsnew/tests/`
- Create: `~/.claude/skills/whatsnew/package.json`
- Create: `~/.claude/skills/whatsnew/tests/helpers.mjs`

- [ ] **Step 1: Create the directory skeleton**

```bash
mkdir -p ~/.claude/skills/whatsnew/lib
mkdir -p ~/.claude/skills/whatsnew/tests
```

- [ ] **Step 2: Create `package.json`**

Write `~/.claude/skills/whatsnew/package.json`:
```json
{
  "name": "whatsnew",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.mjs"
  }
}
```

The glob pattern matters: Node 22 on Windows rejects `node --test tests/` with `MODULE_NOT_FOUND` when trying to resolve the bare directory. Bash expands `tests/*.test.mjs` to actual test files, which the runner handles correctly.

- [ ] **Step 3: Create a shared test helper for safe git invocations**

Write `~/.claude/skills/whatsnew/tests/helpers.mjs`:
```js
// Array-based git helpers for tests. No string-interpolation into a shell.
import { spawnSync } from 'node:child_process';

export function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
  if (r.status !== 0) {
    const stderr = (r.stderr || '').toString().trim();
    throw new Error(`git ${args.join(' ')} failed (${r.status}): ${stderr}`);
  }
  return (r.stdout || '').toString();
}

export function gitOut(cwd, args) {
  return git(cwd, args).trim();
}
```

- [ ] **Step 4: Verify the runner picks up an empty suite**

```bash
cd ~/.claude/skills/whatsnew && npm test
```
Expected: `tests 0` / exit 0.

- [ ] **Step 5: Commit**

```bash
cd ~/.claude && git add skills/whatsnew/package.json skills/whatsnew/tests/helpers.mjs && git commit -m "feat(whatsnew): scaffold skill + safe git test helper"
```

---

## Task 3: Pure classification function (TDD)

**Files:**
- Create: `~/.claude/skills/whatsnew/lib/classify.mjs`
- Test: `~/.claude/skills/whatsnew/tests/classify.test.mjs`

- [ ] **Step 1: Write the failing test**

Write `~/.claude/skills/whatsnew/tests/classify.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCommit } from '../lib/classify.mjs';

test('schema-only commit → category=schema, artifactOnly=false', () => {
  const r = classifyCommit({ files: ['schema/schema.js'] });
  assert.equal(r.category, 'schema');
  assert.equal(r.artifactOnly, false);
});

test('middleware.js → category=schema', () => {
  assert.equal(classifyCommit({ files: ['middleware.js'] }).category, 'schema');
});

test('livingcode python → category=livingcode', () => {
  const r = classifyCommit({ files: ['livingcode/emitters/mcp_tools.py'] });
  assert.equal(r.category, 'livingcode');
  assert.equal(r.artifactOnly, false);
});

test('doctor source (not generated) → category=doctor', () => {
  assert.equal(classifyCommit({ files: ['app/lib/doctor/engine.mjs'] }).category, 'doctor');
});

test('doctor generated file alone → category=generated, artifactOnly=true', () => {
  const r = classifyCommit({ files: ['app/lib/doctor/generated/shape.json'] });
  assert.equal(r.category, 'generated');
  assert.equal(r.artifactOnly, true);
});

test('cli/bin/dashclaw.js → category=doctor', () => {
  assert.equal(classifyCommit({ files: ['cli/bin/dashclaw.js'] }).category, 'doctor');
});

test('api route → category=api', () => {
  assert.equal(classifyCommit({ files: ['app/api/doctor/route.js'] }).category, 'api');
});

test('lib non-doctor → category=lib', () => {
  assert.equal(classifyCommit({ files: ['app/lib/repositories/agents.repository.js'] }).category, 'lib');
});

test('mcp source (not generated) → category=mcp', () => {
  assert.equal(classifyCommit({ files: ['mcp-server/lib/tools.js'] }).category, 'mcp');
});

test('sdk → category=sdk', () => {
  assert.equal(classifyCommit({ files: ['sdk/README.md'] }).category, 'sdk');
});

test('ui app page → category=ui', () => {
  assert.equal(classifyCommit({ files: ['app/mission-control/page.js'] }).category, 'ui');
});

test('test file → category=tests', () => {
  assert.equal(classifyCommit({ files: ['__tests__/unit/doctor-engine.test.js'] }).category, 'tests');
});

test('docs → category=docs', () => {
  assert.equal(classifyCommit({ files: ['docs/sdk-parity.md'] }).category, 'docs');
});

test('scripts → category=scripts', () => {
  assert.equal(classifyCommit({ files: ['scripts/livingcode-refresh.mjs'] }).category, 'scripts');
});

test('unknown path → category=other', () => {
  assert.equal(classifyCommit({ files: ['random-file.xyz'] }).category, 'other');
});

test('all-artifact commit with multiple files → artifactOnly=true', () => {
  const r = classifyCommit({
    files: [
      'app/lib/doctor/generated/shape.json',
      'docs/api-inventory.json',
      'mcp-server/lib/routes-inventory.generated.json',
    ],
  });
  assert.equal(r.artifactOnly, true);
  assert.equal(r.category, 'generated');
});

test('mixed artifact + source → artifactOnly=false, source wins category', () => {
  const r = classifyCommit({
    files: ['app/lib/doctor/engine.mjs', 'app/lib/doctor/generated/shape.json'],
  });
  assert.equal(r.artifactOnly, false);
  assert.equal(r.category, 'doctor');
});

test('multi-category: schema + livingcode → schema wins, otherAreas=1', () => {
  const r = classifyCommit({
    files: ['schema/schema.js', 'livingcode/emitters/shape_json.py'],
  });
  assert.equal(r.category, 'schema');
  assert.equal(r.otherAreas, 1);
});

test('multi-category: api + ui + tests → api wins, otherAreas=2', () => {
  const r = classifyCommit({
    files: ['app/api/x/route.js', 'app/page.js', '__tests__/x.test.js'],
  });
  assert.equal(r.category, 'api');
  assert.equal(r.otherAreas, 2);
});

test('empty files list → category=other, artifactOnly=false', () => {
  const r = classifyCommit({ files: [] });
  assert.equal(r.category, 'other');
  assert.equal(r.artifactOnly, false);
});

test('app/lib/doctor/generated/ under lib is recognised as generated, not lib', () => {
  const r = classifyCommit({ files: ['app/lib/doctor/generated/checks-from-shape.mjs'] });
  assert.equal(r.category, 'generated');
  assert.equal(r.artifactOnly, true);
});

test('mcp generated inventory alone → generated', () => {
  const r = classifyCommit({ files: ['mcp-server/lib/routes-inventory.generated.json'] });
  assert.equal(r.artifactOnly, true);
  assert.equal(r.category, 'generated');
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd ~/.claude/skills/whatsnew && npm test
```
Expected: FAIL — `Cannot find module '../lib/classify.mjs'`.

- [ ] **Step 3: Implement `classify.mjs`**

Write `~/.claude/skills/whatsnew/lib/classify.mjs`:
```js
// Pure classification of a commit's file list into an area category and an
// artifact-only flag. See the design spec for the precedence order.

const ARTIFACT_PATTERNS = [
  /^app\/lib\/doctor\/generated\//,
  /^public\/downloads\/dashclaw-platform-intelligence(\/|\.zip(\.manifest)?$)/,
  /^docs\/openapi\/critical-stable\.openapi\.json$/,
  /^docs\/api-inventory\.(json|md)$/,
  /^mcp-server\/lib\/routes-inventory\.generated\.json$/,
];

const CATEGORY_RULES = [
  { name: 'generated', test: (p) => ARTIFACT_PATTERNS.some((r) => r.test(p)) },
  { name: 'schema', test: (p) => /^schema\// .test(p) || p === 'middleware.js' },
  { name: 'livingcode', test: (p) => /^livingcode\// .test(p) },
  {
    name: 'doctor',
    test: (p) =>
      (/^app\/lib\/doctor\// .test(p) && !/^app\/lib\/doctor\/generated\// .test(p)) ||
      p === 'cli/lib/doctor.js' ||
      p === 'cli/bin/dashclaw.js',
  },
  { name: 'api', test: (p) => /^app\/api\// .test(p) },
  {
    name: 'lib',
    test: (p) => /^app\/lib\// .test(p) && !/^app\/lib\/doctor\/generated\// .test(p),
  },
  {
    name: 'mcp',
    test: (p) => /^mcp-server\// .test(p) && p !== 'mcp-server/lib/routes-inventory.generated.json',
  },
  { name: 'sdk', test: (p) => /^(sdk|sdk-python)\// .test(p) },
  {
    name: 'tests',
    test: (p) => /^__tests__\// .test(p) || /^livingcode\/tests\// .test(p) || /\.test\.[a-zA-Z]+$/.test(p),
  },
  {
    name: 'ui',
    test: (p) =>
      (/^app\// .test(p) && !/^app\/(api|lib)\// .test(p)) ||
      p === 'app/globals.css' ||
      p === '.impeccable.md',
  },
  {
    name: 'docs',
    test: (p) =>
      (/^docs\// .test(p) && !ARTIFACT_PATTERNS.some((r) => r.test(p))) ||
      p === 'README.md' ||
      p === 'PROJECT_DETAILS.md' ||
      p === 'QUICK-START.md' ||
      p === 'CLAUDE.md',
  },
  { name: 'scripts', test: (p) => /^scripts\// .test(p) || /^\.claude\// .test(p) },
];

const PRECEDENCE = [
  'schema',
  'livingcode',
  'doctor',
  'api',
  'lib',
  'mcp',
  'sdk',
  'ui',
  'tests',
  'docs',
  'scripts',
  'generated',
  'other',
];

function categoryOf(path) {
  for (const rule of CATEGORY_RULES) {
    if (rule.test(path)) return rule.name;
  }
  return 'other';
}

/**
 * @param {{ files: string[] }} commit
 * @returns {{ category: string, artifactOnly: boolean, otherAreas: number }}
 */
export function classifyCommit({ files }) {
  if (!files || files.length === 0) {
    return { category: 'other', artifactOnly: false, otherAreas: 0 };
  }
  const artifactOnly = files.every((p) => ARTIFACT_PATTERNS.some((r) => r.test(p)));
  const categories = new Set(files.map(categoryOf));

  let category = 'other';
  for (const c of PRECEDENCE) {
    if (categories.has(c)) {
      category = c;
      break;
    }
  }
  const otherAreas = Math.max(0, categories.size - 1);
  return { category, artifactOnly, otherAreas };
}

export { ARTIFACT_PATTERNS, PRECEDENCE };
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd ~/.claude/skills/whatsnew && npm test
```

- [ ] **Step 5: Commit**

```bash
cd ~/.claude && git add skills/whatsnew/lib/classify.mjs skills/whatsnew/tests/classify.test.mjs && git commit -m "feat(whatsnew): pure commit classification function"
```

---

## Task 4: Git helpers with temp-repo integration tests

Every helper fails soft (returns `null` / `[]` on error). All invocations use `spawnSync` with argument arrays.

**Files:**
- Create: `~/.claude/skills/whatsnew/lib/git.mjs`
- Test: `~/.claude/skills/whatsnew/tests/git.test.mjs`

- [ ] **Step 1: Write the failing tests**

Write `~/.claude/skills/whatsnew/tests/git.test.mjs`:
```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { git, gitOut } from './helpers.mjs';
import {
  getRepoRoot,
  getHead,
  getUnstagedFiles,
  getCommitsSince,
  isShaReachable,
} from '../lib/git.mjs';

let tmpDir;
let sha1;
let sha2;
let sha3;

before(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'whatsnew-git-'));
  git(tmpDir, ['init', '-q', '-b', 'main']);
  git(tmpDir, ['config', 'user.email', 'test@example.com']);
  git(tmpDir, ['config', 'user.name', 'Test User']);

  writeFileSync(join(tmpDir, 'README.md'), 'hi\n');
  git(tmpDir, ['add', 'README.md']);
  git(tmpDir, ['commit', '-q', '-m', 'initial']);
  sha1 = gitOut(tmpDir, ['rev-parse', 'HEAD']);

  mkdirSync(join(tmpDir, 'schema'));
  writeFileSync(join(tmpDir, 'schema/schema.js'), 'export {};\n');
  git(tmpDir, ['add', 'schema/schema.js']);
  git(tmpDir, ['commit', '-q', '-m', 'feat: add schema']);
  sha2 = gitOut(tmpDir, ['rev-parse', 'HEAD']);

  writeFileSync(join(tmpDir, 'CHANGES.md'), 'changed\n');
  git(tmpDir, ['add', 'CHANGES.md']);
  git(tmpDir, ['commit', '-q', '-m', 'docs: changes']);
  sha3 = gitOut(tmpDir, ['rev-parse', 'HEAD']);
});

after(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

test('getRepoRoot returns the top-level dir', () => {
  const root = getRepoRoot(tmpDir);
  assert.ok(root, 'getRepoRoot returned null');
  // On macOS, mkdtempSync may resolve symlinks (/var -> /private/var); compare loosely.
  assert.ok(
    root === tmpDir || root.endsWith(tmpDir.split(/[\\/]/).pop()),
    `expected repo root ≈ ${tmpDir}, got ${root}`,
  );
});

test('getHead returns the current HEAD sha', () => {
  assert.equal(getHead(tmpDir), sha3);
});

test('getUnstagedFiles returns modified paths', () => {
  writeFileSync(join(tmpDir, 'README.md'), 'edited\n');
  const files = getUnstagedFiles(tmpDir);
  assert.ok(files.includes('README.md'), `expected README.md in ${JSON.stringify(files)}`);
  git(tmpDir, ['checkout', '--', 'README.md']);
});

test('getUnstagedFiles returns empty array when clean', () => {
  assert.deepEqual(getUnstagedFiles(tmpDir), []);
});

test('getCommitsSince returns commits oldest-first with files', () => {
  const commits = getCommitsSince(tmpDir, sha1);
  assert.equal(commits.length, 2);
  assert.equal(commits[0].sha, sha2);
  assert.equal(commits[0].subject, 'feat: add schema');
  assert.deepEqual(commits[0].files, ['schema/schema.js']);
  assert.equal(commits[1].sha, sha3);
  assert.deepEqual(commits[1].files, ['CHANGES.md']);
});

test('getCommitsSince returns [] when range is empty', () => {
  assert.deepEqual(getCommitsSince(tmpDir, sha3), []);
});

test('isShaReachable returns true for ancestor', () => {
  assert.equal(isShaReachable(tmpDir, sha1), true);
});

test('isShaReachable returns false for unknown sha', () => {
  assert.equal(isShaReachable(tmpDir, '0'.repeat(40)), false);
});

test('getRepoRoot returns null outside a repo', () => {
  const outside = mkdtempSync(join(tmpdir(), 'whatsnew-notrepo-'));
  try {
    assert.equal(getRepoRoot(outside), null);
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd ~/.claude/skills/whatsnew && npm test
```

- [ ] **Step 3: Implement `git.mjs`**

Write `~/.claude/skills/whatsnew/lib/git.mjs`:
```js
// Thin wrappers around git CLI calls. Array-based spawnSync — never a shell.
// Every helper fails soft: returns null or [] on error.
import { spawnSync } from 'node:child_process';

function run(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) return null;
  return result.stdout;
}

export function getRepoRoot(cwd) {
  const out = run(cwd, ['rev-parse', '--show-toplevel']);
  return out == null ? null : out.trim() || null;
}

export function getHead(cwd) {
  const out = run(cwd, ['rev-parse', 'HEAD']);
  return out == null ? null : out.trim() || null;
}

export function getUnstagedFiles(cwd) {
  const diffOut = run(cwd, ['diff', '--name-only', 'HEAD']);
  const statusOut = run(cwd, ['status', '--porcelain']);
  const set = new Set();
  if (diffOut) for (const line of diffOut.split('\n')) if (line) set.add(line);
  if (statusOut) {
    for (const line of statusOut.split('\n')) {
      if (line.startsWith('?? ')) set.add(line.slice(3));
    }
  }
  return [...set].sort();
}

export function isShaReachable(cwd, sha) {
  if (!sha) return false;
  const result = spawnSync('git', ['merge-base', '--is-ancestor', sha, 'HEAD'], {
    cwd,
    stdio: 'ignore',
  });
  return result.status === 0;
}

/**
 * Return commits in `sha..HEAD` oldest-first with their changed files.
 * Records separated by RS (\x1e); fields inside the header separated by NUL (\x00).
 */
export function getCommitsSince(cwd, sinceSha) {
  if (!sinceSha) return [];
  const sep = '\x1e';
  const fmt = `--pretty=format:${sep}%H%x00%s%x00%an%x00%ae%x00%ar`;
  const out = run(cwd, ['log', '--reverse', '--name-only', fmt, `${sinceSha}..HEAD`]);
  if (out == null || !out.trim()) return [];

  const records = out.split(sep).filter((r) => r.trim().length > 0);
  const commits = [];
  for (const rec of records) {
    const lines = rec.split('\n');
    const [sha, subject, authorName, authorEmail, relDate] = lines[0].split('\x00');
    const files = lines.slice(1).filter((l) => l.trim().length > 0);
    commits.push({ sha, subject, authorName, authorEmail, relDate, files });
  }
  return commits;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd ~/.claude/skills/whatsnew && npm test
```

- [ ] **Step 5: Commit**

```bash
cd ~/.claude && git add skills/whatsnew/lib/git.mjs skills/whatsnew/tests/git.test.mjs && git commit -m "feat(whatsnew): git helper wrappers with temp-repo tests"
```

---

## Task 5: State + session-touched (atomic read/write)

**Files:**
- Create: `~/.claude/skills/whatsnew/lib/state.mjs`
- Create: `~/.claude/skills/whatsnew/lib/session-touched.mjs`
- Test: `~/.claude/skills/whatsnew/tests/state.test.mjs`

- [ ] **Step 1: Write the failing tests**

Write `~/.claude/skills/whatsnew/tests/state.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readState, writeState, stateFilePath } from '../lib/state.mjs';
import { writeTouched, readTouched, touchedFilePath } from '../lib/session-touched.mjs';

test('stateFilePath encodes the cwd under the given home', () => {
  const p = stateFilePath('/tmp/whatsnew-test', '/fake/home');
  assert.ok(p.startsWith('/fake/home'));
  assert.ok(p.endsWith('last-seen-head.txt'));
});

test('readState returns null when file does not exist', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'whatsnew-state-'));
  try {
    assert.equal(readState('/anywhere', tmp), null);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('writeState then readState round-trips', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'whatsnew-state-'));
  try {
    const sha = 'a'.repeat(40);
    writeState('/the/project', sha, tmp);
    assert.equal(readState('/the/project', tmp), sha);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('writeState leaves no temp file behind on success', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'whatsnew-state-'));
  try {
    writeState('/p', 'b'.repeat(40), tmp);
    const target = stateFilePath('/p', tmp);
    assert.ok(existsSync(target));
    assert.ok(!existsSync(target + '.tmp'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('writeState rejects non-sha input', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'whatsnew-state-'));
  try {
    assert.throws(() => writeState('/p', 'not-a-sha', tmp), /invalid sha/i);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('touched file round-trips a list', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'whatsnew-touch-'));
  try {
    writeTouched('/proj', ['a.js', 'b.js'], tmp);
    assert.deepEqual(readTouched('/proj', tmp), ['a.js', 'b.js']);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('empty list writes empty file', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'whatsnew-touch-'));
  try {
    writeTouched('/proj', [], tmp);
    assert.equal(readFileSync(touchedFilePath('/proj', tmp), 'utf8'), '');
    assert.deepEqual(readTouched('/proj', tmp), []);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd ~/.claude/skills/whatsnew && npm test
```

- [ ] **Step 3: Implement `state.mjs`**

Write `~/.claude/skills/whatsnew/lib/state.mjs`:
```js
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

const SHA_RE = /^[0-9a-f]{40}$/;

export function encodeProjectDir(cwd) {
  return resolve(cwd).replace(/[\\/:]/g, '-');
}

export function stateFilePath(cwd, claudeHome = join(homedir(), '.claude')) {
  return join(claudeHome, 'projects', encodeProjectDir(cwd), 'last-seen-head.txt').replace(/\\/g, '/');
}

export function readState(cwd, claudeHome) {
  const p = stateFilePath(cwd, claudeHome);
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, 'utf8').trim();
    return SHA_RE.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeState(cwd, sha, claudeHome) {
  if (!SHA_RE.test(sha)) throw new Error(`invalid sha: ${sha}`);
  const p = stateFilePath(cwd, claudeHome);
  mkdirSync(dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  writeFileSync(tmp, sha + '\n', 'utf8');
  renameSync(tmp, p);
}
```

- [ ] **Step 4: Implement `session-touched.mjs`**

Write `~/.claude/skills/whatsnew/lib/session-touched.mjs`:
```js
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import { encodeProjectDir } from './state.mjs';

export function touchedFilePath(cwd, claudeHome = join(homedir(), '.claude')) {
  return join(claudeHome, 'projects', encodeProjectDir(cwd), 'session-touched.txt').replace(/\\/g, '/');
}

export function writeTouched(cwd, files, claudeHome) {
  const p = touchedFilePath(cwd, claudeHome);
  mkdirSync(dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  writeFileSync(tmp, files.join('\n'), 'utf8');
  renameSync(tmp, p);
}

export function readTouched(cwd, claudeHome) {
  const p = touchedFilePath(cwd, claudeHome);
  if (!existsSync(p)) return [];
  try {
    const raw = readFileSync(p, 'utf8');
    return raw.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd ~/.claude/skills/whatsnew && npm test
```

- [ ] **Step 6: Commit**

```bash
cd ~/.claude && git add skills/whatsnew/lib/state.mjs skills/whatsnew/lib/session-touched.mjs skills/whatsnew/tests/state.test.mjs && git commit -m "feat(whatsnew): state + session-touched file helpers"
```

---

## Task 6: Report formatter

**Files:**
- Create: `~/.claude/skills/whatsnew/lib/report.mjs`
- Test: `~/.claude/skills/whatsnew/tests/report.test.mjs`

- [ ] **Step 1: Write the failing test**

Write `~/.claude/skills/whatsnew/tests/report.test.mjs`:
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatReport, computeOverlap } from '../lib/report.mjs';

test('computeOverlap returns files in both sets', () => {
  const commit = { files: ['a.js', 'b.js', 'c.js'] };
  assert.deepEqual(computeOverlap(commit, new Set(['b.js', 'd.js'])), ['b.js']);
});

test('computeOverlap empty on no intersection', () => {
  assert.deepEqual(computeOverlap({ files: ['a.js'] }, new Set(['x.js'])), []);
});

test('formatReport no-commits case', () => {
  const out = formatReport({ commits: [], touched: new Set(), me: { name: 'a', email: 'a@b' } });
  assert.match(out, /No new commits/);
});

test('formatReport groups by category and labels author', () => {
  const commits = [
    {
      sha: '1'.repeat(40),
      subject: 'feat: add schema',
      authorName: 'Wes Sander',
      authorEmail: 'wes@example.com',
      relDate: '2h ago',
      files: ['schema/schema.js'],
    },
    {
      sha: '2'.repeat(40),
      subject: 'feat: livingcode thing',
      authorName: 'Other Agent',
      authorEmail: 'other@example.com',
      relDate: '1h ago',
      files: ['livingcode/emit.py'],
    },
    {
      sha: '3'.repeat(40),
      subject: 'chore: refresh generated artifacts',
      authorName: 'Other Agent',
      authorEmail: 'other@example.com',
      relDate: '30m ago',
      files: ['app/lib/doctor/generated/shape.json'],
    },
  ];
  const out = formatReport({
    commits,
    touched: new Set(['schema/schema.js']),
    me: { name: 'Wes Sander', email: 'wes@example.com' },
  });

  assert.match(out, /3 new commits/);
  assert.match(out, /\[schema\] 1 commit/);
  assert.match(out, /\[livingcode\] 1 commit/);
  assert.match(out, /\[artifact-only\] 1 commit/);
  assert.match(out, /\(you, 2h ago\)/);
  assert.match(out, /\(Other Agent, 1h ago\)/);
  assert.match(out, /overlaps your session/);
});

test('formatReport tags multi-area commits with +N other areas', () => {
  const commits = [
    {
      sha: 'a'.repeat(40),
      subject: 'feat: multi',
      authorName: 'X',
      authorEmail: 'x@y',
      relDate: '5m ago',
      files: ['app/api/x/route.js', 'app/page.js', '__tests__/x.test.js'],
    },
  ];
  const out = formatReport({
    commits,
    touched: new Set(),
    me: { name: 'Z', email: 'z@z' },
  });
  assert.match(out, /\[api\] 1 commit \+2 other areas/);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd ~/.claude/skills/whatsnew && npm test
```

- [ ] **Step 3: Implement `report.mjs`**

Write `~/.claude/skills/whatsnew/lib/report.mjs`:
```js
import { classifyCommit } from './classify.mjs';

export function computeOverlap(commit, touchedSet) {
  return commit.files.filter((f) => touchedSet.has(f));
}

function authorLabel(commit, me) {
  if (!me) return commit.authorName;
  if (commit.authorEmail === me.email || commit.authorName === me.name) return 'you';
  return commit.authorName;
}

/**
 * @param {{
 *   commits: Array<{sha:string, subject:string, authorName:string, authorEmail:string, relDate:string, files:string[]}>,
 *   touched: Set<string>,
 *   me: {name:string, email:string} | null,
 * }} args
 * @returns {string}
 */
export function formatReport({ commits, touched, me }) {
  if (commits.length === 0) return 'No new commits since last check.';

  const enriched = commits.map((c) => {
    const { category, artifactOnly, otherAreas } = classifyCommit({ files: c.files });
    return { ...c, category, artifactOnly, otherAreas, overlap: computeOverlap(c, touched) };
  });

  const groups = new Map();
  const artifactOnly = [];
  for (const c of enriched) {
    if (c.artifactOnly) {
      artifactOnly.push(c);
      continue;
    }
    if (!groups.has(c.category)) groups.set(c.category, []);
    groups.get(c.category).push(c);
  }

  const ORDER = ['schema', 'livingcode', 'doctor', 'api', 'lib', 'mcp', 'sdk', 'ui', 'tests', 'docs', 'scripts', 'other'];

  const lines = [];
  lines.push(`${commits.length} new commit${commits.length === 1 ? '' : 's'} on main since your last /whatsnew:`);
  lines.push('');

  for (const cat of ORDER) {
    const group = groups.get(cat);
    if (!group || group.length === 0) continue;
    const maxOther = Math.max(0, ...group.map((c) => c.otherAreas));
    const tag = maxOther > 0 ? ` +${maxOther} other area${maxOther === 1 ? '' : 's'}` : '';
    lines.push(`[${cat}] ${group.length} commit${group.length === 1 ? '' : 's'}${tag}`);
    for (const c of group) {
      lines.push(`  ${c.sha.slice(0, 8)}  ${c.subject}  (${authorLabel(c, me)}, ${c.relDate})`);
      for (const f of c.overlap) lines.push(`      ${f}  ← overlaps your session`);
    }
    lines.push('');
  }

  if (artifactOnly.length > 0) {
    lines.push(`[artifact-only] ${artifactOnly.length} commit${artifactOnly.length === 1 ? '' : 's'}  (auto-regenerated, low signal)`);
    for (const c of artifactOnly) {
      lines.push(`  ${c.sha.slice(0, 8)}  ${c.subject}  (${authorLabel(c, me)}, ${c.relDate})`);
      for (const f of c.overlap) lines.push(`      ${f}  ← overlaps your session`);
    }
  }

  return lines.join('\n').replace(/\n+$/, '\n');
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd ~/.claude/skills/whatsnew && npm test
```

- [ ] **Step 5: Commit**

```bash
cd ~/.claude && git add skills/whatsnew/lib/report.mjs skills/whatsnew/tests/report.test.mjs && git commit -m "feat(whatsnew): structured report formatter"
```

---

## Task 7: Hook entry point

**Files:**
- Create: `~/.claude/hooks/whatsnew-check.mjs`
- Test: `~/.claude/skills/whatsnew/tests/hook.test.mjs`

- [ ] **Step 1: Write the failing integration test**

Write `~/.claude/skills/whatsnew/tests/hook.test.mjs`:
```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, resolve } from 'node:path';

import { git, gitOut } from './helpers.mjs';

const HOOK_PATH = resolve(homedir(), '.claude', 'hooks', 'whatsnew-check.mjs');

let repoDir;
let fakeHome;

before(() => {
  repoDir = mkdtempSync(join(tmpdir(), 'whatsnew-hook-'));
  fakeHome = mkdtempSync(join(tmpdir(), 'whatsnew-fakehome-'));
  git(repoDir, ['init', '-q', '-b', 'main']);
  git(repoDir, ['config', 'user.email', 'wes@example.com']);
  git(repoDir, ['config', 'user.name', 'Wes Sander']);
  writeFileSync(join(repoDir, 'README.md'), 'hi\n');
  git(repoDir, ['add', 'README.md']);
  git(repoDir, ['commit', '-q', '-m', 'initial']);
});

after(() => {
  rmSync(repoDir, { recursive: true, force: true });
  rmSync(fakeHome, { recursive: true, force: true });
});

function runHook() {
  return spawnSync(process.execPath, [HOOK_PATH], {
    cwd: repoDir,
    env: { ...process.env, CLAUDE_WHATSNEW_HOME: fakeHome },
    encoding: 'utf8',
  });
}

test('hook exits silent on first run (bootstraps state)', () => {
  const r = runHook();
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '');
});

test('hook still silent on second run (HEAD unchanged)', () => {
  const r = runHook();
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), '');
});

test('hook emits a one-line ping after HEAD moves', () => {
  writeFileSync(join(repoDir, 'schema.js'), 'x\n');
  git(repoDir, ['add', 'schema.js']);
  git(repoDir, ['commit', '-q', '-m', 'feat: schema']);

  const r = runHook();
  assert.equal(r.status, 0);
  assert.match(r.stdout, /1 new commit/);
  assert.match(r.stdout, /run \/whatsnew/i);
});

test('hook writes session-touched.txt with unstaged files', () => {
  writeFileSync(join(repoDir, 'README.md'), 'edited\n');
  runHook();
  const projectsDir = join(fakeHome, 'projects');
  const encoded = readdirSync(projectsDir)[0];
  const touchedPath = join(projectsDir, encoded, 'session-touched.txt');
  assert.ok(existsSync(touchedPath));
  assert.match(readFileSync(touchedPath, 'utf8'), /README\.md/);
  git(repoDir, ['checkout', '--', 'README.md']);
});

test('hook exits silent in a non-git directory', () => {
  const notRepo = mkdtempSync(join(tmpdir(), 'whatsnew-notrepo-'));
  try {
    const r = spawnSync(process.execPath, [HOOK_PATH], {
      cwd: notRepo,
      env: { ...process.env, CLAUDE_WHATSNEW_HOME: fakeHome },
      encoding: 'utf8',
    });
    assert.equal(r.status, 0);
    assert.equal(r.stdout.trim(), '');
  } finally {
    rmSync(notRepo, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd ~/.claude/skills/whatsnew && npm test
```

- [ ] **Step 3: Implement the hook**

Write `~/.claude/hooks/whatsnew-check.mjs`:
```js
#!/usr/bin/env node
// UserPromptSubmit hook. Runs on every prompt submit.
// Read-only against the state file. Writes session-touched.txt every turn.
// Output: a single line when HEAD has advanced past last-seen; silent otherwise.
// Never fails the prompt — every error is caught, logged, and swallowed.

import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL_LIB = resolve(HERE, '..', 'skills', 'whatsnew', 'lib');
const lib = (name) => pathToFileURL(resolve(SKILL_LIB, name)).href;

const LOG_PATH = join(homedir(), '.claude', 'logs', 'whatsnew-hook.log');

function logError(err) {
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    const line = `${new Date().toISOString()} ${err.stack || err.message || String(err)}\n`;
    appendFileSync(LOG_PATH, line, 'utf8');
  } catch {
    /* swallow — never block the prompt */
  }
}

async function main() {
  const { getRepoRoot, getHead, getUnstagedFiles, getCommitsSince, isShaReachable } = await import(
    lib('git.mjs')
  );
  const { readState, writeState } = await import(lib('state.mjs'));
  const { writeTouched } = await import(lib('session-touched.mjs'));
  const { classifyCommit } = await import(lib('classify.mjs'));

  const cwd = process.cwd();
  const claudeHome = process.env.CLAUDE_WHATSNEW_HOME || join(homedir(), '.claude');

  const root = getRepoRoot(cwd);
  if (!root) return;

  const head = getHead(root);
  if (!head) return;

  try {
    writeTouched(root, getUnstagedFiles(root), claudeHome);
  } catch (err) {
    logError(err);
  }

  const last = readState(root, claudeHome);
  if (last == null) {
    try {
      writeState(root, head, claudeHome);
    } catch (err) {
      logError(err);
    }
    return;
  }
  if (last === head) return;

  if (!isShaReachable(root, last)) {
    process.stdout.write('⚠ HEAD moved and history diverged since last /whatsnew — run /whatsnew to resync.\n');
    return;
  }

  const commits = getCommitsSince(root, last);
  if (commits.length === 0) return;

  let significant = 0;
  let artifactOnly = 0;
  for (const c of commits) {
    const { artifactOnly: ao } = classifyCommit({ files: c.files });
    if (ao) artifactOnly += 1;
    else significant += 1;
  }

  const total = commits.length;
  const split =
    artifactOnly > 0 && significant > 0
      ? ` (${significant} significant + ${artifactOnly} artifact-only)`
      : artifactOnly === total
        ? ' (all artifact-only, low signal)'
        : '';

  process.stdout.write(
    `⚠ ${total} new commit${total === 1 ? '' : 's'} since last /whatsnew${split}. Run /whatsnew to review. HEAD: ${head.slice(0, 8)}\n`,
  );
}

main().catch((err) => {
  logError(err);
  process.exit(0);
});
```

**If your machine uses the JSON hook output convention** (determined in Task 1, Step 2), replace each `process.stdout.write(msg)` above with:
```js
process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: msg.trimEnd() },
  }) + '\n',
);
```

- [ ] **Step 4: Make executable (POSIX; no-op on Windows)**

```bash
chmod +x ~/.claude/hooks/whatsnew-check.mjs 2>/dev/null || true
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd ~/.claude/skills/whatsnew && npm test
```

- [ ] **Step 6: Commit**

```bash
cd ~/.claude && git add hooks/whatsnew-check.mjs skills/whatsnew/tests/hook.test.mjs && git commit -m "feat(whatsnew): UserPromptSubmit hook"
```

---

## Task 8: `/whatsnew` slash command + SKILL.md

**Files:**
- Create: `~/.claude/skills/whatsnew/whatsnew.mjs`
- Create: `~/.claude/skills/whatsnew/SKILL.md`
- Test: `~/.claude/skills/whatsnew/tests/whatsnew.test.mjs`

- [ ] **Step 1: Write the failing test**

Write `~/.claude/skills/whatsnew/tests/whatsnew.test.mjs`:
```js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { git, gitOut } from './helpers.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const WHATSNEW_PATH = resolve(HERE, '..', 'whatsnew.mjs');

let repoDir;
let fakeHome;

before(() => {
  repoDir = mkdtempSync(join(tmpdir(), 'whatsnew-cmd-'));
  fakeHome = mkdtempSync(join(tmpdir(), 'whatsnew-cmd-home-'));
  git(repoDir, ['init', '-q', '-b', 'main']);
  git(repoDir, ['config', 'user.email', 'wes@example.com']);
  git(repoDir, ['config', 'user.name', 'Wes Sander']);
  writeFileSync(join(repoDir, 'README.md'), 'a\n');
  git(repoDir, ['add', 'README.md']);
  git(repoDir, ['commit', '-q', '-m', 'initial']);
});

after(() => {
  rmSync(repoDir, { recursive: true, force: true });
  rmSync(fakeHome, { recursive: true, force: true });
});

function runCmd(args = []) {
  return spawnSync(process.execPath, [WHATSNEW_PATH, ...args], {
    cwd: repoDir,
    env: { ...process.env, CLAUDE_WHATSNEW_HOME: fakeHome },
    encoding: 'utf8',
  });
}

test('prints no-state message on first run', () => {
  const r = runCmd();
  assert.equal(r.status, 0);
  assert.match(r.stdout, /No previous state|No new commits/);
});

test('prints structured report after new commits land', () => {
  runCmd(); // seed state

  writeFileSync(join(repoDir, 'schema.js'), 'x\n');
  git(repoDir, ['add', 'schema.js']);
  git(repoDir, ['commit', '-q', '-m', 'feat: schema']);

  const r = runCmd();
  assert.equal(r.status, 0);
  assert.match(r.stdout, /1 new commit/);
});

test('advances state so a second run reports no new commits', () => {
  const r = runCmd();
  assert.match(r.stdout, /No new commits/);
});

test('--explain emits a model-ready brief', () => {
  writeFileSync(join(repoDir, 'b.js'), 'y\n');
  git(repoDir, ['add', 'b.js']);
  git(repoDir, ['commit', '-q', '-m', 'feat: b']);

  const r = runCmd(['--explain']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Brief me/);
  assert.match(r.stdout, /feat: b/);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd ~/.claude/skills/whatsnew && npm test
```

- [ ] **Step 3: Implement `whatsnew.mjs`**

Write `~/.claude/skills/whatsnew/whatsnew.mjs`:
```js
#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { getRepoRoot, getHead, getCommitsSince, isShaReachable } from './lib/git.mjs';
import { readState, writeState } from './lib/state.mjs';
import { readTouched } from './lib/session-touched.mjs';
import { formatReport } from './lib/report.mjs';

const EXPLAIN_CAP = 15;

function getMe(root) {
  const nameR = spawnSync('git', ['config', 'user.name'], { cwd: root, encoding: 'utf8' });
  const emailR = spawnSync('git', ['config', 'user.email'], { cwd: root, encoding: 'utf8' });
  if (nameR.status !== 0 || emailR.status !== 0) return null;
  return { name: nameR.stdout.trim(), email: emailR.stdout.trim() };
}

function getDiff(root, last, head) {
  const r = spawnSync(
    'git',
    [
      'log',
      '--patch',
      `${last}..${head}`,
      '--',
      '.',
      ':(exclude)app/lib/doctor/generated',
      ':(exclude)public/downloads/dashclaw-platform-intelligence',
    ],
    { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  if (r.status !== 0) return '(failed to collect diff)';
  return r.stdout;
}

function fail(msg, code = 1) {
  process.stderr.write(`whatsnew: ${msg}\n`);
  process.exit(code);
}

function printDefault({ commits, touched, me }) {
  const report = formatReport({ commits, touched: new Set(touched), me });
  process.stdout.write(report.endsWith('\n') ? report : report + '\n');
}

function printExplain({ commits, touched, root, last, head }) {
  const truncated = commits.length > EXPLAIN_CAP;
  const slice = truncated ? commits.slice(-EXPLAIN_CAP) : commits;

  const header = [
    `Brief me: other agents landed ${commits.length} commit${commits.length === 1 ? '' : 's'} on DashClaw since my last check.`,
    truncated ? `(Showing the last ${EXPLAIN_CAP} of ${commits.length}. Run /whatsnew (default) first for full coverage.)` : '',
    `Range: ${last.slice(0, 8)}..${head.slice(0, 8)}`,
    `Current session's unstaged files: ${touched.length ? touched.join(', ') : '(none)'}`,
    '',
    'Flag anything that affects my current work, call out risks, terse.',
    '',
    '--- Commits ---',
  ].filter(Boolean);

  const body = slice.map((c) => {
    const files = c.files.map((f) => `    ${f}`).join('\n');
    return `${c.sha.slice(0, 8)}  ${c.subject}  (${c.authorName}, ${c.relDate})\n${files}`;
  });

  let diff = getDiff(root, last, head);
  if (truncated) {
    diff = `(diff truncated to the last ${EXPLAIN_CAP} commits — re-run without --explain for the full grouped view)\n` + diff;
  }

  process.stdout.write([...header, ...body, '', '--- Diff ---', diff].join('\n'));
  if (!diff.endsWith('\n')) process.stdout.write('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const explain = args.includes('--explain');

  const cwd = process.cwd();
  const claudeHome = process.env.CLAUDE_WHATSNEW_HOME || join(homedir(), '.claude');

  const root = getRepoRoot(cwd);
  if (!root) fail('not a git repository', 2);

  const head = getHead(root);
  if (!head) fail('could not read HEAD', 2);

  const last = readState(root, claudeHome);
  const me = getMe(root);
  const touched = readTouched(root, claudeHome);

  if (last == null) {
    process.stdout.write('No previous state — seeding baseline to current HEAD. Next run will show commits since now.\n');
    writeState(root, head, claudeHome);
    return;
  }

  if (last === head) {
    process.stdout.write('No new commits since last check.\n');
    return;
  }

  if (!isShaReachable(root, last)) {
    process.stdout.write('⚠ History diverged since last /whatsnew (rebase or force-push). Showing the last 10 commits as a resync.\n');
    const resyncFrom = `${head}~10`;
    const fallback = getCommitsSince(root, resyncFrom);
    if (explain) printExplain({ commits: fallback, touched, root, last: resyncFrom, head });
    else printDefault({ commits: fallback, touched, me });
    writeState(root, head, claudeHome);
    return;
  }

  const commits = getCommitsSince(root, last);
  if (explain) printExplain({ commits, touched, root, last, head });
  else printDefault({ commits, touched, me });
  writeState(root, head, claudeHome);
}

main().catch((err) => fail(err.message || String(err)));
```

- [ ] **Step 4: Write `SKILL.md`**

Write `~/.claude/skills/whatsnew/SKILL.md`:
```markdown
---
name: whatsnew
description: Show what other agents committed to this repo since your last check. Groups commits by area (schema / livingcode / doctor / api / etc.), flags files that overlap with your current session's edits, and labels artifact-only commits. Default mode prints a structured report; `--explain` produces a model-authored brief that reads the diff and flags risks. Paired with the `whatsnew-check.mjs` UserPromptSubmit hook.
---

# /whatsnew

## When to use

- You saw a `⚠ N new commits since last /whatsnew` ping at the top of a prompt.
- You suspect another agent touched files you're editing.
- You just came back to a repo after a gap.

## Modes

- **Default** — structured formatter. Groups commits by area, flags overlap with the current session's unstaged files, collapses artifact-only commits under their own heading. Advances the state file.
- `--explain` — hand the diff to the model for a semantic brief. Same state advance. Capped at the last 15 commits.

## Running

```bash
node ~/.claude/skills/whatsnew/whatsnew.mjs             # default
node ~/.claude/skills/whatsnew/whatsnew.mjs --explain   # model brief
```

When invoked via the slash command, the default form runs; `/whatsnew --explain` passes `--explain` through.
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd ~/.claude/skills/whatsnew && npm test
```

- [ ] **Step 6: Commit**

```bash
cd ~/.claude && git add skills/whatsnew/whatsnew.mjs skills/whatsnew/SKILL.md skills/whatsnew/tests/whatsnew.test.mjs && git commit -m "feat(whatsnew): /whatsnew slash command (default + --explain)"
```

---

## Task 9: Register the hook + end-to-end verification

**Files:**
- Modify: `~/.claude/settings.json`

- [ ] **Step 1: Add the hook registration**

Open `~/.claude/settings.json`. Find or create `hooks.UserPromptSubmit`. Add an entry matching the shape of any existing UserPromptSubmit entries. Most common shape:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/whatsnew-check.mjs"
          }
        ]
      }
    ]
  }
}
```

If other entries already exist under `UserPromptSubmit`, preserve them and append the new entry inside the same matcher (or a new matcher) — match whichever style is in use.

- [ ] **Step 2: Verify the settings file still parses**

```bash
node -e "JSON.parse(require('node:fs').readFileSync(process.env.HOME + '/.claude/settings.json','utf8'))"
```
Expected: no output, exit 0.

- [ ] **Step 3: Dry-run the hook in DashClaw**

```bash
cd /c/Projects/DashClaw && node ~/.claude/hooks/whatsnew-check.mjs
```
Expected: silent (bootstraps state file).

Confirm:
```bash
cat ~/.claude/projects/C--Projects-DashClaw/last-seen-head.txt
```
Expected: current DashClaw HEAD sha.

- [ ] **Step 4: Simulate a new commit on a scratch branch**

```bash
cd /c/Projects/DashClaw
git checkout -b whatsnew-smoke
echo "" >> .gitignore
git add .gitignore
git commit -m "test(whatsnew): smoke"
```

Re-run the hook:
```bash
node ~/.claude/hooks/whatsnew-check.mjs
```
Expected: one-line ping mentioning `1 new commit since last /whatsnew`.

- [ ] **Step 5: Run `/whatsnew`**

```bash
node ~/.claude/skills/whatsnew/whatsnew.mjs
```
Expected: structured report showing the smoke commit.

- [ ] **Step 6: Re-run the hook — expect silence**

```bash
node ~/.claude/hooks/whatsnew-check.mjs
```
Expected: silent (state advanced by `/whatsnew`).

- [ ] **Step 7: Tear down the smoke branch**

```bash
cd /c/Projects/DashClaw && git checkout main && git branch -D whatsnew-smoke
```

- [ ] **Step 8: Verify `--explain`**

Create one more smoke commit, run:
```bash
node ~/.claude/skills/whatsnew/whatsnew.mjs --explain
```
Expected: a brief starting with `Brief me:`, commits listed, `--- Diff ---` block. Tear down.

- [ ] **Step 9: Restart Claude Code and test live**

Close and reopen Claude Code so the hook registration takes effect. Submit any prompt. Make a commit from another pane; submit the next prompt — expect the ping prepended. Run `/whatsnew` inside Claude — expect the report.

- [ ] **Step 10: Commit the settings change**

```bash
cd ~/.claude && git add settings.json && git commit -m "feat(whatsnew): register UserPromptSubmit hook"
```

---

## Self-Review

**Spec coverage** — every spec section has a task:
- State file → Task 5
- UserPromptSubmit hook → Task 7 (registered in Task 9)
- `/whatsnew` slash command → Task 8
- Artifact-only classification → Task 3
- Area categories + precedence → Task 3
- Overlap detection → Tasks 6, 7, 8
- Report format → Task 6
- Author `you` normalization → Task 6
- Error handling (git missing, not-a-repo, state missing, rebase/unreachable, race, hook exception, large range) → Tasks 4, 7, 8
- Unit + integration tests → Tasks 3–8
- Manual verification → Task 9

**Placeholder scan** — no TBD, no hand-waves. Every code block is complete. The one conditional note (JSON vs plain-stdout hook output in Task 7) is a real environment difference with concrete replacement code, not a placeholder.

**Type consistency** — function names match across tasks: `classifyCommit`, `computeOverlap`, `formatReport`, `getRepoRoot`, `getHead`, `getUnstagedFiles`, `getCommitsSince`, `isShaReachable`, `readState`, `writeState`, `readTouched`, `writeTouched`, `stateFilePath`, `touchedFilePath`, `encodeProjectDir`.

**Shell-safety review** — every shell invocation in test code and script code uses `spawnSync` / `execFileSync`-style argument arrays. No `execSync(string)` or template-string command construction anywhere in the plan.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-13-codebase-change-awareness.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
