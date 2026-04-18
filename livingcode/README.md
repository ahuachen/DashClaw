# livingcode

DashClaw's living-artifact system. Derivative files (doctor checks, platform
skills, MCP tool definitions, website downloads) are generated from the actual
codebase so they can never drift from the truth.

## Two Layers

The framework has two orthogonal purposes:

- **Health layer** (existing) — "is the codebase doing well?"
  Collectors for git stats, test health, code quality, dependencies, CI.
  Commands: `sense`, `plan`, `review`, `cycle`, `heartbeat`.

- **Shape layer** (new) — "what does the codebase consist of?"
  Collectors for routes, env vars, and DB tables. Produces a structured
  `ShapeModel` that other artifacts are generated from.
  Commands: `query`, `snapshot`, `diff`, `emit`.

Both layers run against the same repo and share the `.organism/` state
directory, but they answer different questions.

## Shape Layer Quick Reference

```bash
python -m livingcode query summary       # High-level shape
python -m livingcode query routes        # Every active API route + methods
python -m livingcode query env           # Required + optional env vars
python -m livingcode query tables        # DB tables from schema/schema.js
python -m livingcode query all --json    # Full machine-readable shape

python -m livingcode snapshot            # Save current shape to .organism/shape-snapshots/
python -m livingcode diff                # Diff current shape vs last snapshot
python -m livingcode diff --json         # Same, structured

python -m livingcode emit skill          # Stream generated skill markdown
python -m livingcode emit skill --output path/to/SKILL.md  # Write to file
python -m livingcode emit dashboard --with-context --output public/livingcode/index.html
python -m livingcode emit shape-json --output <path>       # Serialized ShapeModel (Node reads this)
python -m livingcode emit doctor-checks --output <path>    # ESM module of shape-derived doctor checks
python -m livingcode emit mcp-tools --output <path>        # JSON inventory of the MCP-facing API surface
```

In practice, run `npm run livingcode:refresh` from the repo root — it emits
every target to the right location, splices a content-hash signature into
SKILL.md for byte-stable output, and rebuilds the skill zip only when files
changed.

All commands accept `--path <repo>` (defaults to current directory).

## Architecture

```
collectors/
  routes.py     — walks app/api/, finds route.js files, extracts HTTP methods
  env_vars.py   — greps process.env.*, cross-refs .env.example
  schema.py     — parses schema/schema.js for pgTable() calls

shape.py        — build_shape(repo_path) assembles the ShapeModel
query.py        — human + JSON output per topic
diff.py         — save/load snapshots, compute_diff, format_diff
emit.py         — dispatcher: emit(repo_path, target)
emitters/
  skill.py         — platform-intelligence skill markdown (website + global install)
  shape_json.py    — serialized ShapeModel with content-hash signature timestamp
                     (consumed by app/lib/doctor/shape.mjs and the drift check)
  doctor_checks.py — ESM runShapeChecks: one batched to_regclass query for
                     every table + one presence check per required env var
  mcp_tools.py     — JSON inventory splitting active routes into mutation
                     vs read buckets; companion to mcp-server/lib/tools.js
  dashboard.py     — single-file HTML dashboard (counts, timeline, health, diff).
                     Served at /livingcode/ by Next.js and openable as a static file.

types.py        — dataclasses: ShapeModel, RouteInfo, EnvVarInfo, TableInfo
                  (with optional `domain` from `// @domain <name>` comments),
                  ShapeChange, ShapeDiff
```

Shape snapshots are JSON-serialized `ShapeModel` instances saved to
`.organism/shape-snapshots/`. `diff` loads the most recent and compares.

## The Living Artifact Pattern

Every derivative artifact falls into one of three categories:

| Pattern | Example | How |
|---------|---------|-----|
| Thin skill | Agent queries `livingcode query routes` at invocation time | Skill contains instructions, not facts |
| Generated artifact | `emit skill --output SKILL.md` regenerates on commit | Pre-commit hook regenerates, JSON/markdown commits |
| Snapshot + drift guard | `diff` shows what changed, surfaces via doctor | Makes staleness visible |

Zero hand-maintained facts. When DashClaw changes, the artifacts follow.

## Integration with the DashClaw Doctor

The doctor (`app/lib/doctor/`) consumes livingcode output through the
committed `app/lib/doctor/generated/shape.json`. Two categories live off it:

- `shape` — per-table presence checks (one batched `to_regclass` query) and
  per-required-env-var presence checks, wired to the existing fix registry.
- `drift` — compares the current shape against `last-snapshot.json` and warns
  when they diverge. Ships with a `regenerate_artifacts` fix (local-only).

Plus `app/lib/doctor/shape.mjs` exposes typed helpers (`getGovernanceTables`,
`getTable`, `getRequiredEnvVars`, `getRoute`, `findRoutesByPrefix`) that the
hand-written checks reach for instead of hardcoding table or env var names.

The Vercel runtime doesn't ship Python, so generation happens on developer
machines (pre-commit hook) and ships as committed JSON/markdown that Node
functions read directly. See `scripts/livingcode-refresh.mjs` and the
`livingcode-refresh --if-staged` step in `scripts/lib/run-pre-commit-checks.mjs`.

## Domain Annotations in schema.js

Tables can be tagged with `// @domain <name>` on the line directly above
`pgTable(...)`. The comment is picked up by `collectors/schema.py` and stored
on `TableInfo.domain`, then flows through shape.json so Node code can filter
by domain without a hand-maintained map. Example:

```js
// @domain governance
export const guardPolicies = pgTable('guard_policies', { ... });
```

`app/lib/doctor/shape.mjs` uses this via `getTablesByDomain('governance')`.
Adding a new governance table is one comment line; the next
`npm run livingcode:refresh` propagates it everywhere.

## Tests

```bash
python -m pytest tests/ -v
```

Shape-layer tests: `test_shape.py`, `test_diff.py`, `test_emit.py`,
`test_shape_json_emitter.py`, `test_doctor_checks_emitter.py`,
`test_mcp_tools_emitter.py`. Health-layer tests: existing `test_*.py` suite.

## Adding a New Collector

1. Add the dataclass to `types.py` (e.g., `SdkMethodInfo`) and include it in `ShapeModel`.
2. Write `collectors/<name>.py` with a `collect_<name>(repo_path) -> list[...]` function.
3. Wire it into `shape.py`'s `build_shape()`.
4. Add a query topic in `query.py`.
5. Decide which emitters surface the new field — typically at least
   `shape_json.py` (serialized automatically via `asdict`, no change needed)
   and potentially `skill.py`, `doctor_checks.py`, or `mcp_tools.py`.
6. Test in `tests/test_shape.py`.

## Adding a New Emitter

1. Create `emitters/<target>.py` with `emit_<target>(shape: ShapeModel) -> str`.
2. Register the target in `emit.py`'s `TARGETS` tuple and dispatch.
3. Wire it into `scripts/livingcode-refresh.mjs` so the pre-commit hook keeps
   it current, and add the output path to the `stage-artifacts` step in
   `scripts/lib/run-pre-commit-checks.mjs`.
4. Test in a new `tests/test_<target>_emitter.py`.
