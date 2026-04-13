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
```

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
  skill.py      — renders ShapeModel as platform-intelligence skill markdown

types.py        — dataclasses: ShapeModel, RouteInfo, EnvVarInfo, TableInfo,
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

The doctor (`app/lib/doctor/`) is the first consumer that needs full shape-driven
regeneration. See `INTEGRATION_PROMPT.md` for the detailed implementation plan —
designed to be handed to a fresh Claude Code session running in the DashClaw root.

The Vercel runtime doesn't ship Python, so generation happens on developer
machines (pre-commit hook) and ships as committed JSON/markdown that Node
functions read directly.

## Tests

```bash
python -m pytest tests/ -v
```

Shape-layer tests: `test_shape.py`, `test_diff.py`, `test_emit.py` (37 total).
Health-layer tests: existing `test_*.py` suite.

## Adding a New Collector

1. Add the dataclass to `types.py` (e.g., `SdkMethodInfo`) and include it in `ShapeModel`.
2. Write `collectors/<name>.py` with a `collect_<name>(repo_path) -> list[...]` function.
3. Wire it into `shape.py`'s `build_shape()`.
4. Add a query topic in `query.py`.
5. Update `emitters/skill.py` to render the new surface.
6. Test in `tests/test_shape.py`.

## Adding a New Emitter

1. Create `emitters/<target>.py` with `emit_<target>(shape: ShapeModel) -> str`.
2. Register the target in `emit.py`'s `TARGETS` tuple and dispatch.
3. Test in `tests/test_emit.py`.
