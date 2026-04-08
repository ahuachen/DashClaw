---
source-of-truth: true
owner: Platform PM
last-verified: 2026-02-13
doc-type: decision
---

# ADR 0002: Stable Version Pinning for Infrastructure Dependencies

## Status
Accepted

## Context
During the v1.3.0 security audit and subsequent CI deployment, we upgraded `next` to the "latest" version (which resolved to v16.x). This caused widespread failures in both GitHub Actions and local development environments.

### The Problem
Next.js v16 (experimental/alpha) introduced breaking changes to its CLI argument parsing. The command `next lint` (which previously defaulted to the current directory) began interpreting trailing arguments differently, leading to "Invalid project directory" errors.

## Decision
We will pin all core infrastructure dependencies (`next`, `esbuild`, `drizzle-kit`) to **stable** releases. We will avoid `latest` or `^` ranges for these packages in `package.json` to ensure deterministic builds across CI and developer machines.

### Fixed Versions (as of v1.3.0)
- `next`: `15.1.12`
- `esbuild`: `0.25.0`

## Consequences
- **Pros**: 100% reliable CI builds; no "surprises" on Monday mornings when a major framework releases an unstable alpha.
- **Cons**: We must manually bump these versions to receive updates.

## Lesson Learned
Never use `npm install package@latest` for core frameworks in a production-grade repository without verifying CLI compatibility first. Always run `npm run lint` and `npm run build` locally before pushing a dependency update.
