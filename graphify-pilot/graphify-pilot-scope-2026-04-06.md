# DashClaw Graphify Pilot Scope

Date: 2026-04-06
Purpose: High-signal first Graphify run for architecture understanding without ingesting build output, dependencies, caches, or secrets.

## Include

### Root docs
- README.md
- PROJECT_DETAILS.md
- QUICK-START.md
- PROJECT_CONTEXT.md
- package.json
- CLAUDE.md

### Directories
- app/
- docs/
- sdk/
- schema/
- packages/

### Conditional include
- sdk-python/dashclaw/
- sdk-python/README.md
- sdk-python/setup.py

## Exclude
- node_modules/
- .next/
- .git/
- .worktrees/
- .npm-cache/
- .pytest_cache/
- .vercel/
- secrets/
- sdk-python/dist/
- sdk-python/dashclaw.egg-info/
- sdk-python/__pycache__/
- any *.map files
- any build artifacts or lockfile-heavy vendor output

## Why this scope
- app/ captures the runtime and UI/application surface
- docs/ captures architectural rationale and product framing
- sdk/ and sdk-python/ capture the public integration surface
- schema/ captures structured contract shape
- packages/ captures shared internal abstractions
- root docs anchor the graph with canonical project intent

## First-run goal
Produce a graph that helps answer:
1. What are DashClaw's god nodes?
2. How do governance runtime concepts connect to implementation surfaces?
3. Where are the natural product and architecture clusters?
4. What files/areas act as bridges between docs and code?

## Operating rule
Do not graph the full repo root until the pilot output proves useful and clean.
