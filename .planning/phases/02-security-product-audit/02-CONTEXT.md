# Phase 2: Security & Product Audit - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Deep codebase security audit and product validation. Verify DashClaw is secure against common attack vectors, the governance loop works end-to-end, and the product is genuinely useful as a free tool for the developer community. This phase fixes safe issues in-place and documents risky ones for future work. No new features. No new routes.

</domain>

<decisions>
## Implementation Decisions

### Audit approach — Fix vs. Report
- **D-01:** Fix issues in-place as they're found — audit produces working code, not a document
- **D-02:** Issues too risky to fix inline (encryption key rotation, schema changes, SSE refactors) are flagged and deferred with risk level documented
- **D-03:** Known bugs from CONCERNS.md are also in scope — fix safe-to-patch bugs, defer risky ones (SSE deadlock, schema-level changes)

### Security depth
- **D-04:** Deep analysis — OWASP Top 10 + auth bypass vectors + header hardening + input validation + SSRF/injection testing
- **D-05:** Build on existing CONCERNS.md findings (5 security items already flagged) — verify and expand, don't duplicate
- **D-06:** All exposed routes in scope — 7 canonical governance routes + extension routes (compliance, drift, evaluations, scoring) + cron endpoints + infrastructure routes

### Product validation approach
- **D-07:** UX narrative walkthrough — walk through /connect → /mission-control → /decisions as a new developer. Does the story hold? Is the value obvious?
- **D-08:** Three persona perspectives: solo agent builder, startup CTO (3-5 agents), enterprise evaluator (SOC 2/NIST compliance needs)
- **D-09:** Governance loop verified via code path review — trace guard → action → outcome → signal through the code. No live SDK test required.

### Free-tier viability
- **D-10:** Full stack $0 — Vercel free + Neon free + optional Upstash free. Document any limits (connections, storage, bandwidth) that could surprise users.
- **D-11:** Features requiring paid services must degrade gracefully — clear "upgrade to enable" messaging, not silent broken state. Fix any silent failures found.

### Claude's Discretion
- Prioritization order of security findings (which to fix first)
- Exact wording of graceful degradation messages
- How to structure the product narrative assessment (doc format, inline comments, etc.)
- Whether to update CONCERNS.md with new findings or create a separate audit report

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Security baseline
- `.planning/codebase/CONCERNS.md` — 5 security considerations, 4 known bugs, 6 fragile areas, test coverage gaps already identified
- `.planning/codebase/ARCHITECTURE.md` — Layer structure, route inventory, auth patterns, error handling strategy

### Core governance routes (audit targets)
- `app/api/guard/route.js` — Policy evaluation entry point
- `app/api/actions/route.js` — Action CRUD with redaction
- `app/api/approvals/[actionId]/route.js` — Human-in-the-loop approval
- `app/api/assumptions/route.js` — Reasoning integrity records
- `app/api/signals/route.js` — Anomaly detection signals
- `app/api/policies/route.js` — Guard policy management
- `app/api/health/route.js` — Health check endpoint

### Business logic (audit targets)
- `app/lib/guard.js` — Risk scoring engine, policy evaluation
- `app/lib/validate.js` — Input validation schemas + SSRF protection
- `app/lib/encryption.js` — AES-GCM encryption with CBC backward compat
- `app/lib/events.js` — SSE event system, Redis/memory backend
- `app/lib/security.js` — Sensitive data scanning/redaction
- `app/lib/promptInjection.js` — Prompt injection pattern detection
- `app/lib/integration-health.js` — Health checks with live API credentials

### Auth and session
- `app/lib/auth.js` or `app/lib/isDemoMode.js` — Auth configuration, demo mode cookie
- `middleware.js` — Request-level auth enforcement (if exists)

### Product UX pages (walkthrough targets)
- `app/connect/page.js` — 8-minute onboarding path
- `app/mission-control/page.js` — Strategic posture dashboard
- `app/decisions/page.js` — Visual causal chain ledger
- `app/setup/page.js` — Readiness verification
- `app/settings/page.js` — Configuration (was /setup, restructured)

### Deploy and free-tier
- `vercel.json` — Deploy configuration, cron routes
- `.env.example` — Full env var surface
- `docs/deploy-without-oauth.md` — Manual deploy path

### Existing codebase analysis
- `.planning/codebase/STACK.md` — Technology stack details
- `.planning/codebase/CONVENTIONS.md` — Coding patterns and standards
- `.planning/codebase/TESTING.md` — Test setup and coverage

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CONCERNS.md` — Pre-existing security audit with specific file/line references; use as starting checklist
- `validateGuardInput()`, `validateActionRecord()` in `app/lib/validate.js` — Existing validation; audit for completeness
- `scanSensitiveData()` in `app/lib/security.js` — PII/secrets redaction; verify coverage
- `checkCoreTables()` in `app/lib/schemaCheck.js` — Schema integrity check
- `getReadinessReport()` in `app/lib/readiness.mjs` — Health check framework

### Established Patterns
- Repository pattern: all DB access via `app/lib/repositories/*.repository.js` — no direct SQL in routes
- Org-scoped queries: all repositories filter by `org_id`
- Auth extraction: `getOrgId()`, `getOrgRole()`, `getUserId()` helpers used in every route
- Error logging: `console.error('[ROUTE-NAME] METHOD error:', err)` format
- Governance boundary: `npm run governance:boundary:check` enforces 7-route limit

### Integration Points
- Security headers: likely in `next.config.js` or middleware — need to verify
- CSP policy: check if exists, assess coverage
- CORS configuration: check all API routes for proper origin restrictions
- Rate limiting: check if any exists (429 responses mentioned in skill references)

</code_context>

<specifics>
## Specific Ideas

- User wants to verify the product "makes sense and is working as intended and is useful to the consumer as a product that is free and helps people"
- This is a confidence-building exercise before publishing integration guides and doing a public launch
- The audit should leave the codebase in a state where you'd feel comfortable sending traffic to it

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-security-product-audit*
*Context gathered: 2026-03-23*
