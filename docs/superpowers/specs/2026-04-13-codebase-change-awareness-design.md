# Codebase change awareness (multi-agent readout) — design

**Date:** 2026-04-13
**Status:** Approved
**Scope:** DashClaw only

## Problem

Multiple Claude Code agents work concurrently in `C:\Projects\DashClaw`, all commit-and-pushing to `main`. Between prompts, other agents can move `HEAD`, refactor code the user is actively editing, or add routes that affect the user's current task. The user has no reliable way to find out *what changed* between their prompts without manually running `git log` every time. This design adds a lightweight awareness layer so the user is never surprised by the repo state.

## Goals

- **Ambient ping** on every prompt, only when the repo has actually moved.
- **On-demand structured readout** with grouping by area and overlap flagging for files the current session has touched.
- **LLM-assisted semantic summary** available on request when the structured readout isn't enough.
- **Zero new infrastructure**: hooks + scripts + Node stdlib, reuses the existing `UserPromptSubmit` hook mechanism.

## Non-goals

- Remote awareness (no `git fetch` on the pre-prompt check).
- Unstaged-work awareness of *other* agents' worktrees.
- Portability to repos other than DashClaw. The classification table is DashClaw-specific.
- Background notifications (no daemon, no toasts).

## User-approved decisions (brainstorm transcript)

| Question | Decision |
|---|---|
| Primary scenario | Both ambient ping + on-demand rich readout (option C) |
| When ping fires | Prompt-submit hook, only if HEAD has moved (option D) |
| Scope of change | Local `HEAD` moved only — no fetch, no status of other worktrees (option A) |
| Readout smartness | Structured formatter by default, LLM escalation on `--explain` (option D) |
| Stickiness | Sticky until `/whatsnew` runs, which is the implicit ack (option C) |
| Noise filter | Artifact-only commits ping but are labeled (option: Labeled) |
| Overlap detection in v1 | Yes, worth the extra git call per turn |
| Portability | DashClaw-specific is fine |

## Architecture

A per-working-directory state file records the last HEAD the user has been briefed on. A `UserPromptSubmit` hook compares `git rev-parse HEAD` to the state file on every prompt; if they differ, it prepends a one-line ping to the prompt context. The state file is only advanced by an explicit `/whatsnew` invocation, so the ping persists across turns until the user acknowledges. `/whatsnew` prints a structured report grouped by area and flags files that overlap with the current session's unstaged edits; `/whatsnew --explain` routes the same data through the model for a semantic summary. No fetch, no background daemon, no external services.

```
┌──────────────────────────────────────────────────────────────────┐
│ User prompt submitted                                            │
│     │                                                            │
│     ▼                                                            │
│  UserPromptSubmit hook (whatsnew-check.mjs)                      │
│     │                                                            │
│     ├─ read current HEAD                                         │
│     ├─ read state file (~/.claude/projects/<proj>/last-seen-head)│
│     ├─ write session-touched.txt (this turn's unstaged files)    │
│     ├─ if HEAD == state → exit silent                            │
│     └─ else → inject one-line ping, do NOT advance state         │
│                                                                  │
│ User invokes /whatsnew (on demand)                               │
│     │                                                            │
│     ▼                                                            │
│  whatsnew script                                                 │
│     ├─ read state + current HEAD                                 │
│     ├─ git log state..HEAD --name-status                         │
│     ├─ classify each commit (category + artifact-only)           │
│     ├─ intersect with session-touched.txt → overlap list         │
│     ├─ either print structured report (default)                  │
│     │   or feed to model with overlap context (--explain)        │
│     └─ write state ← current HEAD (atomic rename)                │
└──────────────────────────────────────────────────────────────────┘
```

## Components

### 1. State file

- **Path:** `~/.claude/projects/C--Projects-DashClaw/last-seen-head.txt`
- **Content:** single line, a 40-char git sha.
- **Lifecycle:** created by the hook on first run (seeded to current HEAD so the user is not spammed with ancient history). Read by the hook on every turn. Written only by `/whatsnew` — atomic write via temp-file-plus-rename.
- **Rationale for location:** Claude Code already stores per-project state under `~/.claude/projects/<url-encoded-cwd>/`; placing the file there makes it per-working-directory, not per-session, so new Claude sessions inherit the same "last seen" point.

### 2. `UserPromptSubmit` hook

- **Path:** `~/.claude/hooks/whatsnew-check.mjs`
- **Runtime:** Node, stdlib-only. Matches the existing pattern in `scripts/livingcode-refresh.mjs`.
- **Behavior:**
  1. Discover repo root via `git rev-parse --show-toplevel`. Exit silent if not in a git repo.
  2. Read current HEAD (`git rev-parse HEAD`).
  3. Read state file; if missing, write current HEAD and exit silent (bootstrap).
  4. Write `session-touched.txt` from `git diff --name-only HEAD` (unstaged edits in the current working tree).
  5. If state sha matches current → exit silent (no output).
  6. Else compute commit count and artifact-only split via `git log state..HEAD --name-only`, emit a single-line ping.
- **Failure mode:** wrapped in try/catch; any exception is logged to `~/.claude/logs/whatsnew-hook.log` and exits 0 so the prompt is never blocked.
- **Latency budget:** under 100 ms on a warm git repo (Windows). Three git calls per turn: `rev-parse --show-toplevel`, `rev-parse HEAD`, `diff --name-only HEAD`. Plus `git log` only when HEAD has moved.

### 3. `/whatsnew` slash command

- **Path:** `~/.claude/skills/whatsnew/SKILL.md` + backing `whatsnew.mjs` script under the same directory.
- **Form:** user skill (portable to other projects should the user later clone it) invoked by the user as `/whatsnew` in any Claude Code session.
- **Modes:**
  - Default: structured formatter prints to terminal, advances state.
  - `--explain`: same diff collection, but renders a prompt to the model with the full diff + session-touched list, asking for a semantic brief. State still advances.
- **State advance:** happens on either mode. Running `/whatsnew` is the acknowledgement action.

## Data flow

### On every prompt submit

1. Hook runs `git rev-parse HEAD` → `curr`.
2. Hook reads state file → `last` (bootstraps if missing).
3. Hook writes `session-touched.txt` from `git diff --name-only HEAD`.
4. If `curr == last` → exit silent.
5. Else: `git log last..curr --name-only --pretty=format:'%H|%s|%an'` → list of commits with files.
6. For each commit, decide `artifact-only` iff every file matches a generated-artifact pattern.
7. Emit one-line ping of the form:
   ```
   ⚠ 3 new commits since last /whatsnew (2 significant + 1 artifact-only). Run /whatsnew to review. HEAD: a4fc5156
   ```
8. Hook exits 0 without writing the state file.

### On `/whatsnew` (default)

1. Read `last` and `curr`; if equal, print `No new commits since last check.` and exit.
2. `git log last..curr --name-status --pretty=format:'%H|%s|%an|%ar'` → parsed commit records.
3. Categorise each commit by top-level-directory mapping; for multi-area commits, pick the highest-precedence category and append `+N other areas`.
4. Read `session-touched.txt`; intersect with each commit's file list → per-commit overlap badges.
5. Print report grouped by category, with artifact-only commits collapsed under their own group at the end.
6. Atomic-write state ← `curr`.

### On `/whatsnew --explain`

1. Same steps 1–4 as default.
2. Instead of printing the formatter, assemble a prompt: commit list + `git diff last..curr` (capped at last 15 commits if the range is longer, with an explicit truncation banner) + session-touched list.
3. Hand to the model with a brief: "Other agents landed N commits on DashClaw since my last check. Brief me on what changed, flag anything affecting my current work, call out risks. Terse."
4. Atomic-write state ← `curr`.

## Classification rules

### Artifact-only patterns (noise filter)

A commit is artifact-only iff *every* changed file matches one of:

```
app/lib/doctor/generated/**
public/downloads/dashclaw-platform-intelligence/**
public/downloads/dashclaw-platform-intelligence.zip
public/downloads/dashclaw-platform-intelligence.zip.manifest
docs/openapi/critical-stable.openapi.json
docs/api-inventory.json
docs/api-inventory.md
mcp-server/lib/routes-inventory.generated.json
```

This list mirrors `scripts/lib/run-pre-commit-checks.mjs` (the paths auto-staged by the pre-commit hook). Both lists live as named constants so the correspondence is enforceable by review.

### Area categories

| Category | Path pattern |
|---|---|
| `schema` | `schema/**`, `middleware.js` |
| `livingcode` | `livingcode/**` |
| `doctor` | `app/lib/doctor/**` (excluding `generated/`), `cli/lib/doctor.js`, `cli/bin/dashclaw.js` |
| `api` | `app/api/**` |
| `lib` | `app/lib/**` (excluding `app/lib/doctor/generated/**`) |
| `mcp` | `mcp-server/**` (excluding `routes-inventory.generated.json`) |
| `sdk` | `sdk/**`, `sdk-python/**` |
| `ui` | `app/**` (excluding `app/api/**` and `app/lib/**`), `app/globals.css`, `.impeccable.md` |
| `tests` | `__tests__/**`, `livingcode/tests/**`, `**/*.test.*` |
| `docs` | `docs/**` (non-generated), `README.md`, `PROJECT_DETAILS.md`, `QUICK-START.md`, `CLAUDE.md` |
| `scripts` | `scripts/**`, `.claude/**` |
| `generated` | any path matching the artifact-only patterns above |
| `other` | everything else |

**Precedence for multi-category commits** (top wins):

`schema > livingcode > doctor > api > lib > mcp > sdk > ui > tests > docs > scripts > generated > other`

Schema and livingcode win because they tend to cascade into generated artifacts and routes.

### Overlap rule

A commit overlaps the current session if any of its changed paths appears in `session-touched.txt`. Overlap applies to artifact-only commits too — if the user has manually edited a generated file, that is exactly the kind of conflict that deserves surfacing.

## Report format

Example structured output:

```
5 new commits on main since your last /whatsnew:

[schema] 1 commit
  ce14b1b2  feat(doctor): Phase 1 — shape-json emitter and constants handoff  (you, 2h ago)
      schema/schema.js  ← overlaps your session

[livingcode] 2 commits
  08584f29  feat(doctor): Phase 3 — generated shape-derived check modules  (agent-2, 1h ago)
  279c4dce  feat(livingcode): Phase 2 — refresh script and pre-commit integration  (agent-2, 1h ago)

[doctor] 1 commit +1 other area
  b1b5b34f  feat(doctor): Phase 4 — drift guard check and regenerate_artifacts fix  (agent-3, 30m ago)

[artifact-only] 1 commit  (auto-regenerated, low signal)
  abc12345  chore: refresh generated artifacts
```

The `← overlaps your session` badge is the key flag — it is what turns the ping from a nag into a warning.

**Author label**: the report compares each commit's author name/email against `git config user.name` / `user.email`. Matches render as `you`; others render as the git author string. This is how the user distinguishes commits they made from another pane versus commits another agent made.

## Error handling

| Failure | Behaviour |
|---|---|
| `git` not on PATH | Hook exits silent. `/whatsnew` prints a clear error and exits non-zero. |
| Not in a git repo | Hook exits silent. `/whatsnew` prints `not a git repository` and exits non-zero. |
| State file missing | Hook bootstraps to current HEAD (silent). `/whatsnew` treats as "no previous state, showing last 10 commits". |
| State sha unreachable from HEAD (rebase, force-push) | Hook prints `⚠ HEAD moved, history diverged — run /whatsnew` (no count). `/whatsnew` shows `git log HEAD~10..HEAD` with a warning banner that history diverged. |
| `git log` returns empty (sha equal but file stale) | Hook exits silent — no drift to show. |
| Race between two `/whatsnew` runs | Atomic temp-file-and-rename write makes this a no-op race: whichever finishes last wins, both see consistent output. |
| Hook exception (unexpected) | Caught, logged to `~/.claude/logs/whatsnew-hook.log`, exit 0. Prompt submission never blocked. |
| Large commit range for `--explain` | Capped at 15 commits; prompt notes truncation and suggests running default `/whatsnew` first. |

## Testing

- **Unit** — pure classification function: given a `{files: [...], message, author}`, returns `{category, artifactOnly}`. Table-driven: one case per category, one multi-category commit, one all-generated commit, one empty-files commit.
- **Integration** — temporary git repo fixture (`git init` in a tmp dir, commit a handful of files). Tests drive the hook and `/whatsnew` script end-to-end and assert:
  - Silent exit when HEAD hasn't moved.
  - Correct ping text when HEAD has moved.
  - State file advances only on `/whatsnew`, not on hook.
  - Overlap detection flags files in `session-touched.txt`.
  - Rebase/unreachable-state fallback path.
- **Manual** — after first install: commit from another pane, verify the ping appears on next prompt, verify `/whatsnew` clears it, verify a second `/whatsnew` prints the no-commits message.

## Risks and trade-offs

- **Ping fires on the user's own commits** made from a separate terminal pane. Mitigated by author labelling in the report; ping text says "since last /whatsnew", not "from another agent".
- **Rebases/force-pushes** break the state-to-HEAD delta. Fallback path handles this by showing recent history with a warning.
- **Large commit backlog** after a long idle gap. Structured report collapses artifact-only commits; `--explain` caps at 15.
- **Hook latency** on every prompt (~40–100 ms on Windows). Acceptable given frequency and that it runs in parallel with other `UserPromptSubmit` hooks.
- **Session scratch staleness** — `session-touched.txt` is rewritten every turn from current `git status`, so stale data from a previous session is always overwritten before it can mislead.
- **Single-project scope** — path patterns are DashClaw-specific. Porting means editing the category table. Explicitly accepted.

## Open questions

None blocking. These are implementation details for the plan step:

- Exact hook registration mechanism for `UserPromptSubmit` (inspect `~/.claude/settings.json` and the existing `impeccable-reminder.py` wiring to match conventions).
- Whether to cache the repo-root discovery (first `git rev-parse --show-toplevel`) in the state file for subsequent turns, shaving one git call per prompt.
- Exact prompt wording for `--explain` mode — iterate on first use.

## Implementation notes (post-build)

Three Windows-specific adjustments surfaced during implementation. They don't change the architecture — noting them here so future readers understand the shipped code.

- **Dynamic ESM imports need file URLs on Windows.** The hook uses `await import(...)` so it can load skill lib modules from a sibling directory. Passing a raw path like `C:\Users\...\lib\git.mjs` to `import()` throws `ERR_UNSUPPORTED_ESM_URL_SCHEME` on Windows. The fix: wrap each path with `pathToFileURL(resolve(...)).href` before passing it to `import()`. Static `import` statements in the other files are fine — the issue is specific to dynamic `import()`.
- **Path output uses forward slashes.** `stateFilePath` and `touchedFilePath` normalise their return value to forward slashes (`p.replace(/\\/g, '/')`). Node's `fs` accepts both separators on Windows, so I/O is unaffected, but it keeps string comparisons and log output consistent across platforms.
- **Test runner glob.** `package.json` uses `"test": "node --test tests/*.test.mjs"` rather than `node --test tests/` because Node 22 fails to resolve the bare directory as a test root on Windows. The bash glob expands to actual test files, which Node 22 handles correctly.

## Out of scope (deferred)

- `git fetch` before comparison.
- Cross-worktree unstaged awareness.
- Background toast notifications independent of Claude Code.
- Project-configurable category tables (`.whatsnew.json`).
- GUI dashboard view of commit activity.
