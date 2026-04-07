# DashClaw Living Organism — Design Spec

**Date:** 2026-04-07
**Status:** Approved
**Scope:** Port giti's organism sensing framework to DashClaw as a Python module. DashClaw monitors its own codebase health, reviews changes against baselines, plans maintenance work, runs a supervised lifecycle cycle, and emits heartbeats on commit and schedule.

---

## Context

git-intelligence (`packages/giti/`) implemented a "living codebase" framework in TypeScript — 6 agents (sensory cortex, immune system, prefrontal cortex, motor cortex, memory, growth hormone) plus an orchestrator. DashClaw is a production governance platform (Next.js 16, JavaScript, 944 commits, 85 DB tables, 200 GitHub stars) that already has self-monitoring primitives (signal computation, action tracking, cron health jobs) but no codebase-level health sensing.

This spec ports the organism concept to DashClaw as a zero-dependency Python module. DashClaw becomes the first consumer of the livingcode framework — monitoring itself, reviewing its own changes, and surfacing maintenance work through its own standards.

## Guiding Decisions

- **Zero external dependencies** — stdlib only (subprocess, json, dataclasses, pathlib, datetime, argparse). Follows sdk-python's philosophy.
- **Python, not JavaScript** — lives alongside sdk-python as a peer module. Chosen because DashClaw's Python SDK is the natural extension surface and the user wants Python-native framework code.
- **No BUILD phase** — no autonomous code changes. DashClaw is a production platform. The organism senses, plans, and reviews but does not modify code. Motor Cortex is a future unlock after trust is earned.
- **Supervised mode by default** — lifecycle cycle produces reports, not actions. Human decides what to act on.

---

## Module Placement

```
C:\Projects\DashClaw\
├── app/                  # Next.js governance platform (JS)
├── sdk/                  # Node.js SDK
├── sdk-python/           # Python SDK (zero-dep, 2,017 lines)
├── cli/                  # Terminal approval client
├── livingcode/           # NEW — organism sensing framework (Python)
│   ├── __init__.py       # Public API: from livingcode import Organism
│   ├── schema/
│   │   ├── organism_schema.json
│   │   └── validator.py
│   ├── collectors/
│   │   ├── __init__.py
│   │   ├── git_stats.py
│   │   ├── test_health.py
│   │   ├── code_quality.py
│   │   ├── dependency_health.py
│   │   └── ci_health.py
│   ├── immune/
│   │   ├── __init__.py
│   │   ├── checks.py
│   │   └── verdict.py
│   ├── planner/
│   │   ├── __init__.py
│   │   ├── prioritizer.py
│   │   └── backlog.py
│   ├── orchestrator/
│   │   ├── __init__.py
│   │   ├── cycle.py
│   │   └── safety.py
│   ├── heartbeat/
│   │   ├── __init__.py
│   │   └── runner.py
│   ├── sensing.py
│   ├── types.py
│   └── state.py
├── tests/
│   └── livingcode/
│       ├── test_validator.py
│       ├── test_git_stats.py
│       ├── test_test_health.py
│       ├── test_code_quality.py
│       ├── test_dependency_health.py
│       ├── test_ci_health.py
│       ├── test_immune.py
│       ├── test_planner.py
│       ├── test_orchestrator.py
│       ├── test_heartbeat.py
│       └── test_sensing.py
├── organism.json          # NEW — DashClaw's self-identity
└── .organism/             # NEW — state reports directory (gitignored)
```

---

## organism.json

DashClaw's self-identity file. Defines purpose, boundaries, quality standards, and known CI gates.

```json
{
  "identity": {
    "name": "dashclaw",
    "purpose": "Decision infrastructure for AI agents — intercept, govern, and record agent actions before execution",
    "philosophy": "Control before execution. Evidence over trust. Governance that agents actually use."
  },
  "boundaries": {
    "growth_zone": [
      "agent governance",
      "policy enforcement",
      "decision recording",
      "risk scoring",
      "approval workflows",
      "behavioral drift detection",
      "SDK ergonomics",
      "compliance evidence"
    ],
    "forbidden_zone": [
      "replacing agent frameworks",
      "executing agent logic directly",
      "storing customer secrets in plaintext",
      "breaking SDK backward compatibility without major version bump",
      "requiring specific LLM providers",
      "modifying organism.json or .organism/ autonomously"
    ]
  },
  "quality_standards": {
    "test_coverage_floor": 80,
    "max_complexity_per_function": 15,
    "max_file_length": 300,
    "zero_tolerance": ["unhandled errors", "security vulnerabilities", "OpenAPI contract drift"],
    "performance_budget": {
      "guard_evaluation": "< 200ms",
      "action_recording": "< 100ms",
      "signal_computation": "< 5s",
      "ci_pipeline": "< 10min"
    }
  },
  "ci_gates": [
    "lint",
    "docs:check",
    "openapi:check",
    "api:inventory:check",
    "route-sql:check",
    "reliability:ws1:check",
    "security-scan",
    "test",
    "sdk:integration",
    "sdk:integration:python",
    "build"
  ],
  "lifecycle": {
    "sensing_frequency": "on_commit",
    "state_directory": ".organism",
    "report_format": "json"
  }
}
```

---

## Sensing: Five Collectors

Each collector is a standalone Python module. All use stdlib only — `subprocess` for git/npm commands, `json` for parsing, `pathlib` for file operations. Each returns a structured dataclass.

### Collector 1: git_stats.py

Measures commit velocity, branch health, contributor distribution, bus factor.

| Metric | Source | Purpose |
|---|---|---|
| commits_7d, commits_30d | `git log --since` | Activity trend |
| active_branches | `git branch -r` | Parallel work pressure |
| stale_branches (>30d) | `git log -1` per branch | Abandoned work |
| top_contributors_30d | `git shortlog -sn` | Ownership distribution |
| bus_factor | Contributors covering 80% of commits | Single-point-of-failure risk |
| files_changed_7d | `git diff --stat` | Churn velocity |

### Collector 2: test_health.py

Measures test pass/fail across both JS (Vitest) and Python (pytest/unittest) suites.

| Metric | Source | Purpose |
|---|---|---|
| js_tests (total/passed/failed) | `npm run test -- --run` output | JS test health |
| python_tests (total/passed/failed) | `pytest` or `python -m unittest` output | SDK test health |
| test_file_ratio | Test files / source files | Coverage breadth |
| untested_routes | Compare `app/api/` vs `__tests__/unit/` | Gap detection |

### Collector 3: code_quality.py

Measures file length violations, complexity hotspots, lint status.

| Metric | Source | Purpose |
|---|---|---|
| files_over_300_lines | Count lines per `.js` file | organism.json violation |
| largest_files (top 10) | Sort by line count | Hotspot awareness |
| eslint_status | `npm run lint` exit code | Lint health |
| python_files_over_300 | Count lines in `sdk-python/` | SDK quality |
| todo_count | Grep TODO/FIXME across codebase | Tech debt markers |
| archive_size_kb | Measure `app/api/_archive/` | Dead weight |

### Collector 4: dependency_health.py

Measures dependency freshness, audit status, Python SDK zero-dep compliance.

| Metric | Source | Purpose |
|---|---|---|
| js_dependencies | Parse `package.json` | Dependency surface area |
| js_outdated | `npm outdated --json` | Staleness |
| js_vulnerabilities | `npm audit --json` | Security exposure |
| python_dependencies | Parse `pyproject.toml` | Should be zero (SDK philosophy) |
| lockfile_age_days | `package-lock.json` modified date | Drift signal |

### Collector 5: ci_health.py

Measures CI pipeline reliability. Requires GitHub CLI (`gh`) — gracefully degrades if unavailable.

| Metric | Source | Purpose |
|---|---|---|
| pass_rate_30d | `gh run list` | Pipeline reliability |
| last_10_runs | `gh run list --limit 10 --json` | Recent trend |
| last_failure_reason | `gh run view` on most recent failure | Active problem |
| slowest_gate | Parse workflow step durations | Bottleneck detection |
| gate_count | Count steps in workflow | Matches organism.json ci_gates |

### Sensing Orchestrator (sensing.py)

Runs all 5 collectors sequentially. Each collector has a 30-second timeout — if one hangs, it gets skipped with an error status. Individual failures don't block others. The report includes a `collector_status` map.

Output written to `.organism/state-reports/{timestamp}.json`. Previous reports are kept (last 100, older pruned).

---

## Immune System: Six Checks

Reviews changes against baselines and produces pass/block verdicts.

| Check | What it validates | Failure severity |
|---|---|---|
| ci_gates | All 11 CI checks still pass | Hard block |
| openapi_contract | API schema hasn't drifted | Hard block |
| file_length | No new files exceed 300 lines | Soft warning |
| test_regression | Test count hasn't decreased, no new failures | Hard block |
| dependency_safety | No new audit vulnerabilities | Hard block |
| sdk_parity | Python SDK method count hasn't diverged from Node SDK | Soft warning |

### Verdict Logic

- All checks pass → `"merge"` recommendation
- Any hard-block check fails → `"fix_required"`
- Only soft-warning checks fail → `"needs_discussion"`

### Baselines

Stored in `.organism/baselines.json`. Updated automatically after each successful sensing run. Immune system compares current state against these baselines.

```json
{
  "updated_at": "2026-04-07T06:30:00Z",
  "test_count": {"js": 107, "python": 12},
  "file_count_over_300": 12,
  "js_vulnerabilities": 0,
  "sdk_methods": {"node": 67, "python": 236},
  "ci_pass_rate_30d": 0.94
}
```

---

## Planning: Tiered Prioritizer

Takes sensing data and immune verdicts, produces prioritized work items.

### Five Tiers

| Tier | Trigger | Example |
|---|---|---|
| 1: Critical | CI failing, security vulns, test failures | "npm audit found 2 high-severity vulnerabilities" |
| 2: Regression | Quality metrics degrading vs. previous report | "3 new files exceeded 300-line limit since last sense" |
| 3: Maintenance | Stale deps, growing TODOs, untested routes | "8 API routes have no corresponding test file" |
| 4: Improvement | Bus factor warnings, archive cleanup | "Bus factor is 1 — 97% of commits from single contributor" |
| 5: Growth | Positive trends worth accelerating | "Test file ratio improved 3 consecutive reports" |

### Rules

- Maximum 10 items per plan
- Tier 1 always first
- Each item references the specific metric that triggered it
- Items include affected files
- Cooldown: won't re-suggest items from last 3 plans unless metric worsened

### Backlog

Work items written to `.organism/backlog/{id}.json`:

```json
{
  "id": "wk-20260407-001",
  "tier": 2,
  "title": "Split app/docs/page.js (1,703 lines)",
  "description": "Exceeds organism.json max_file_length of 300 by 5.6x. Largest file in codebase.",
  "affected_files": ["app/docs/page.js"],
  "metric": "code_quality.largest_files",
  "created_at": "2026-04-07T06:30:00Z",
  "status": "proposed"
}
```

---

## Autonomous Lifecycle: Orchestrator

Full cycle: SENSE → PLAN → REVIEW → REFLECT. Managed by safety systems.

### Cycle

| Phase | Action | Output |
|---|---|---|
| SENSE | Run all 5 collectors | State report |
| PLAN | Prioritize work items from sensing data | Plan with up to 10 items |
| REVIEW | Run immune checks against baselines | Verdict (merge/fix/discuss) |
| REFLECT | Update baselines, log cycle, note lessons | Reflection record |

**No BUILD phase.** The organism does not modify code. It surfaces what needs attention. Human decides what to act on.

### Safety Systems

| Safety | Mechanism |
|---|---|
| Kill switch | `.organism/kill-switch` file presence halts all activity |
| Cycle lock | `.organism/active-cycle.json` prevents concurrent runs |
| Consecutive failure limit | 3 failed cycles → `.organism/paused` created, organism stops |
| Cycle counter | `.organism/cycle-counter.json` — monotonic, never resets |
| Cycle history | Each completed cycle logged to `.organism/cycle-history/` |
| Supervised mode (default) | Produces reports only, no actions taken |

### Entry Point

```python
from livingcode import Organism

org = Organism(repo_path="/c/Projects/DashClaw")

# Individual operations
report = org.sense()
verdict = org.review(branch="feat/new-policy-engine")
plan = org.plan()

# Full cycle
result = org.cycle(supervised=True)  # default
```

---

## Heartbeat

Scheduled sensing that keeps the organism's awareness current.

### Three Modes

| Mode | Trigger | What runs | Duration |
|---|---|---|---|
| quick | Git post-commit hook | git_stats + code_quality only | < 5 seconds |
| full | Cron / CI schedule / manual | Complete lifecycle cycle | 1-3 minutes |
| manual | `python -m livingcode cycle` | Complete lifecycle cycle | 1-3 minutes |

### Post-Commit Hook (Quick)

Git hook at `.git/hooks/post-commit`:

```bash
#!/bin/bash
python -m livingcode heartbeat --mode quick
```

Runs git_stats and code_quality only (no network, no npm commands). Writes lightweight heartbeat to `.organism/heartbeats/{timestamp}.json`.

### Scheduled Full Cycle (GitHub Actions)

```yaml
# .github/workflows/organism-heartbeat.yml
on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6am UTC
  workflow_dispatch:

jobs:
  heartbeat:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
      - run: python -m livingcode cycle
      - run: |
          git add .organism/
          git commit -m "organism: daily heartbeat cycle"
          git push
```

### CLI Entry Points

```bash
python -m livingcode sense              # Run sensing only
python -m livingcode review <branch>    # Run immune review
python -m livingcode plan               # Run planner
python -m livingcode cycle              # Full lifecycle cycle
python -m livingcode heartbeat --mode quick   # Quick heartbeat
python -m livingcode status             # Show last report summary
```

---

## .organism/ Directory Structure

```
.organism/
├── state-reports/        # Sensing outputs (JSON, timestamped)
├── heartbeats/           # Quick heartbeat snapshots
├── backlog/              # Work items from planner
├── cycle-history/        # Completed cycle results
├── baselines.json        # Immune system comparison baseline
├── cycle-counter.json    # Monotonic cycle number
├── active-cycle.json     # Concurrent execution lock
├── kill-switch           # Halt signal (presence = stopped)
└── paused                # Auto-pause after 3 consecutive failures
```

**Gitignore policy:**
- **Gitignored (ephemeral):** `state-reports/`, `heartbeats/`, `cycle-history/`, `active-cycle.json`, `kill-switch`, `paused`
- **Committed (persistent identity):** `baselines.json`, `cycle-counter.json`
- **Committed but human-managed:** `backlog/` items with status `"accepted"` (proposed items are gitignored)

---

## Testing Strategy

One test file per module in `tests/livingcode/`. Tests use stdlib `unittest` (matching sdk-python's approach). Git operations are mocked via patching `subprocess.run`.

| Test file | What it covers |
|---|---|
| test_validator.py | organism.json schema validation (valid, invalid, missing fields) |
| test_git_stats.py | Git stats collector (mocked subprocess output) |
| test_test_health.py | Test health collector (mocked npm/pytest output) |
| test_code_quality.py | Code quality collector (mocked file system) |
| test_dependency_health.py | Dependency collector (mocked npm audit/outdated) |
| test_ci_health.py | CI health collector (mocked gh CLI output, graceful degradation) |
| test_immune.py | All 6 immune checks + verdict logic |
| test_planner.py | Tiered prioritization, cooldown, max items |
| test_orchestrator.py | Full cycle, safety systems (kill switch, lock, pause) |
| test_heartbeat.py | Quick and full heartbeat modes |
| test_sensing.py | Orchestrator runs all collectors, handles failures |

---

## Explicit Non-Goals (Future Phases)

- **Motor Cortex (BUILD phase)** — No autonomous code changes. Too risky for production platform.
- **DashClaw agent integration** — Sensing data feeding into DashClaw's own guard/signal system.
- **Dashboard UI** — "System Health" page showing DashClaw's own vitals.
- **Memory agent** — Curated knowledge base from cycle history.
- **Growth Hormone** — Feature proposals from trend analysis.
- **Cross-repo sensing** — Monitoring multiple repos from one organism.
