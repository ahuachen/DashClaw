---
source-of-truth: true
owner: Platform PM
last-verified: 2026-04-11
doc-type: decision
---

# ADR 0003: Next.js 16.2.3 Adopted as Forced Security Upgrade

## Status
Accepted (supersedes [ADR 0002](./0002-nextjs-versioning.md))

## Context
ADR 0002 (2026-02-13) pinned `next` to `15.1.12` after an earlier attempt to
move to v16 — which at that point was an **experimental/alpha** release —
broke the CI lint step because of CLI argument-parsing changes.

On 2026-04-10, Dependabot flagged a high-severity Denial of Service
vulnerability in Next.js Server Components affecting releases `16.0.0-beta.0`
through `16.2.2` ([GHSA-q4gf-8mx6-v5v3][advisory]). The only safe remediation
was to move to a **stable** `16.2.3` patch release. Remaining on 15.1.12 was
not materially affected by this specific advisory, but Next.js 15 is no longer
receiving feature work, and the project had to move to 16 eventually for the
App Router features the runtime relies on (async search params, streaming
metadata, turbopack stability).

## Decision
Adopt `next@^16.2.3` as the stable baseline.

### What changed
- `package.json`: `"next": "^16.2.3"` (commit [`b17e91c8`][commit]).
- All doc references to "Next.js 15" on live canonical surfaces updated:
  `CLAUDE.md`, `.github/copilot-instructions.md`, `CHANGELOG.md`,
  `docs/FULL_CONTEXT.md`, `public/downloads/.../platform-knowledge.md`,
  `scripts/bootstrap-prompt.md`.
- Historical artifacts (plan documents in `docs/superpowers/plans/*`,
  archived security reviews in `docs/archive/*`, timeline entries in
  RFC status docs, and the `graphify-pilot/` snapshot) are **intentionally
  left alone**. They are point-in-time records and rewriting them would
  falsify history.

### What stays the same
ADR 0002's core discipline still applies: we still pin core infrastructure
dependencies to stable releases and manually bump after local verification
(`npm run lint` + `npm run build` + full vitest run). The v16 upgrade was
verified locally — 1406/1406 vitest suites passing and eslint clean — before
the bump was pushed.

## Consequences
- **Pros**: DoS advisory remediated; unblocks adoption of Next.js 16 App
  Router features (async `searchParams`, improved streaming metadata,
  Turbopack-backed dev).
- **Cons**: Developers working on plan documents dated before 2026-04-10 may
  see "Next.js 15" references in those historical artifacts; that is expected
  and should not be swept.

## Lessons Learned
- The v16 that broke CI in ADR 0002 was an experimental/alpha. The v16.2.3
  adopted here is a stable patch release. The two should not be conflated.
- When a forced dependency bump supersedes a prior ADR, add a new ADR
  rather than rewriting the old one. Historical context is load-bearing.

[advisory]: https://github.com/advisories/GHSA-q4gf-8mx6-v5v3
[commit]: https://github.com/ucsandman/DashClaw/commit/b17e91c8
