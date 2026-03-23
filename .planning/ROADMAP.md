# Roadmap: DashClaw — Adoption Milestone

## Overview

The governance runtime is architecturally complete. This milestone is a pure distribution problem: remove every friction point between a developer finding DashClaw on GitHub and having a live instance with a real agent producing decisions. Work proceeds in strict dependency order — the deploy funnel must be fixed before any traffic is sent, a security and product audit validates the system before guides go out, integration guides must be live before the public launch post, and the launch post executes last when all prerequisites are satisfied.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Deploy Funnel** - One-click Vercel deploy works end-to-end with automated migration and minimal env var friction
- [ ] **Phase 2: Security & Product Audit** - Deep security audit and product validation confirming DashClaw is secure, coherent, and genuinely useful as a free governance runtime
- [ ] **Phase 3: Integration Guides** - Four agent framework guides published, linked from README and app pages, each ending with a visible dashboard proof moment
- [ ] **Phase 4: Public Launch** - Show HN post live and social content published with visual assets

## Phase Details

### Phase 1: Deploy Funnel
**Goal**: A developer can go from the DashClaw GitHub README to a fully functional self-hosted instance in under 10 minutes without consulting external docs
**Depends on**: Nothing (first phase)
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04
**Success Criteria** (what must be TRUE):
  1. Clicking the deploy button in the README opens Vercel pre-populated with exactly 7 required env vars (DATABASE_URL, DASHCLAW_API_KEY, ENCRYPTION_KEY, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET, DASHCLAW_LOCAL_ADMIN_PASSWORD) — no more, no less
  2. After deployment completes, the app starts with schema migrations applied automatically — no manual `db:push` step required
  3. The `/setup` page detects and warns when NEXTAUTH_URL is misconfigured, Redis is running in-memory fallback mode, schema migration has not run, or CRON_SECRET is absent
  4. Post-deploy instructions in the README explicitly cover the NEXTAUTH_URL update step, Upstash Redis setup, and `/setup` as the verification landing page
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Configure vercel.json and add deploy button with post-deploy instructions to README
- [x] 01-02-PLAN.md — Add deploy readiness health checks (NEXTAUTH_URL, realtime backend, CRON_SECRET) to /setup

### Phase 2: Security & Product Audit
**Goal**: Deep codebase security audit and product validation — verify DashClaw is secure against common attack vectors, the governance loop works end-to-end from a fresh deploy, and the product is genuinely useful as a free tool for the developer community
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02, SEC-03, SEC-04, PROD-01, PROD-02, PROD-03
**Success Criteria** (what must be TRUE):
  1. All 7 canonical API routes audited against OWASP Top 10 — no injection, broken auth, security misconfiguration, or data exposure vulnerabilities
  2. Security headers (CSP, CORS, X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security) correctly configured on all routes
  3. Auth flow (API key validation, local admin password, session handling) verified secure with no bypass vectors
  4. End-to-end governance loop (record → guard → track → signal) works correctly from a fresh deploy perspective
  5. Product value proposition is clear to a new developer within 5 minutes — /connect, /mission-control, /decisions tell a coherent story
  6. Free-tier viability confirmed — deploy stays $0 on Vercel free tier with no hidden costs or paid-service gates
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Security hardening: fix HSTS headers, SSRF IPv6 blocklist, array validation, prompt injection guard integration, policy error codes, guard JSON parse logging
- [ ] 02-02-PLAN.md — Product validation: governance loop code path review, UX narrative assessment (3 personas), free-tier viability documentation, comprehensive audit report
- [ ] 02-03-PLAN.md — Security regression tests: HSTS headers, prompt injection guard, SSRF validation, array item validation

### Phase 3: Integration Guides
**Goal**: Developers using any of the four primary agent frameworks (Claude Code, OpenAI Agents SDK, LangChain/LangGraph, CrewAI) can find, follow, and complete a working integration guide in under 20 minutes
**Depends on**: Phase 2
**Requirements**: GUIDE-01, GUIDE-02, GUIDE-03, GUIDE-04, GUIDE-05, GUIDE-06
**Success Criteria** (what must be TRUE):
  1. Four guide pages are live and reachable from the README, `/connect`, and `/self-host` — one per framework
  2. Each guide opens with the Vercel deploy button as the prerequisite step and ends with a specific dashboard view (decision visible in the ledger or a guard evaluation showing in Mission Control) that confirms it worked
  3. LangChain/LangGraph and CrewAI guides include a runnable local example (`examples/langgraph-governed/` and `examples/crewai-governed/`) with pinned, tested dependency versions
  4. Every guide includes a `guardrails.yml` policy example showing governance-as-code in context
**Plans**: TBD

Plans:
- [ ] 03-01: Build Claude Code integration guide page (`app/guides/claude-code/page.js`)
- [ ] 03-02: Build OpenAI Agents SDK integration guide page (`app/guides/openai-agents-sdk/page.js`) linked to existing example
- [ ] 03-03: Build `examples/langgraph-governed/` Python example and LangChain/LangGraph guide page
- [ ] 03-04: Build `examples/crewai-governed/` Python example and CrewAI guide page (verify package versions first)
- [ ] 03-05: Wire guide navigation from README, `/connect`, and `/self-host`

### Phase 4: Public Launch
**Goal**: DashClaw is publicly announced to the Hacker News and developer communities with a problem-first narrative, working deploy path, and visual proof that the dashboard is real
**Depends on**: Phase 3
**Requirements**: COMM-04, COMM-05
**Success Criteria** (what must be TRUE):
  1. Show HN post is submitted and live — opens with a concrete agent failure mode story (not a product description), links to deploy button and at least 2 integration guides
  2. X thread and LinkedIn post are published with a Mission Control screenshot showing real decisions and a 30-second screen recording of the guard evaluation flow
**Plans**: TBD

Plans:
- [ ] 04-01: Draft and publish Show HN post (9-11am Pacific, not Friday)
- [ ] 04-02: Capture Mission Control screenshot and 30-second screen recording; publish X thread and LinkedIn post

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Deploy Funnel | 2/2 | Complete | 2026-03-17 |
| 2. Security & Product Audit | 0/3 | Not started | - |
| 3. Integration Guides | 0/5 | Not started | - |
| 4. Public Launch | 0/2 | Not started | - |
