# Roadmap: DashClaw — Adoption Milestone

## Overview

The governance runtime is architecturally complete. This milestone is a pure distribution problem: remove every friction point between a developer finding DashClaw on GitHub and having a live instance with a real agent producing decisions. Work proceeds in strict dependency order — the deploy funnel must be fixed before any traffic is sent, a community surface must exist before guides or launch reference it, integration guides must be live before the public launch post, and the launch post executes last when all prerequisites are satisfied.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Deploy Funnel** - One-click Vercel deploy works end-to-end with automated migration and minimal env var friction
- [ ] **Phase 2: Community Setup** - Discord server live, pre-populated, and ready to receive evaluators before any public link goes out
- [ ] **Phase 3: Integration Guides** - Four agent framework guides published, linked from README and app pages, each ending with a visible dashboard proof moment
- [ ] **Phase 4: Public Launch** - Show HN post live and social content published with visual assets

## Phase Details

### Phase 1: Deploy Funnel
**Goal**: A developer can go from the DashClaw GitHub README to a fully functional self-hosted instance in under 10 minutes without consulting external docs
**Depends on**: Nothing (first phase)
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04
**Success Criteria** (what must be TRUE):
  1. Clicking the deploy button in the README opens Vercel pre-populated with exactly 6 required env vars — no more, no less
  2. After deployment completes, the app starts with schema migrations applied automatically — no manual `db:push` step required
  3. The `/setup` page detects and warns when NEXTAUTH_URL is misconfigured, Redis is running in-memory fallback mode, schema migration has not run, or CRON_SECRET is absent
  4. Post-deploy instructions in the README explicitly cover the NEXTAUTH_URL update step, Upstash Redis setup, and `/setup` as the verification landing page
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Configure vercel.json and add deploy button with post-deploy instructions to README
- [ ] 01-02-PLAN.md — Add deploy readiness health checks (NEXTAUTH_URL, realtime backend, CRON_SECRET) to /setup

### Phase 2: Community Setup
**Goal**: A Discord server exists, is pre-populated with real content, and has a permanent invite link ready to embed in code before any guide or launch content references it
**Depends on**: Phase 1
**Requirements**: COMM-01, COMM-02, COMM-03
**Success Criteria** (what must be TRUE):
  1. Discord server has at least 4 channels (`#announcements`, `#general`, `#deploy-help`, `#show-and-tell`) with pinned content in `#deploy-help` before the invite link is made public
  2. The permanent Discord invite link appears in the README, `/connect` page, and `/self-host` page
  3. A GitHub release webhook posts automatically to `#announcements` — verifiable by cutting a test release
**Plans**: TBD

Plans:
- [ ] 02-01: Create and configure Discord server with channels, pinned troubleshooting guide, and pre-populated content
- [ ] 02-02: Wire GitHub release webhook to `#announcements` and embed permanent invite link in README and app pages

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
| 1. Deploy Funnel | 0/2 | Not started | - |
| 2. Community Setup | 0/2 | Not started | - |
| 3. Integration Guides | 0/5 | Not started | - |
| 4. Public Launch | 0/2 | Not started | - |
