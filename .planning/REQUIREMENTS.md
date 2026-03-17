# Requirements: DashClaw Adoption Milestone

**Defined:** 2026-03-17
**Core Value:** Get a developer from zero to a working DashClaw instance with at least one real agent connected and decisions flowing — as fast as possible.

## v1 Requirements

### Deploy Funnel

- [ ] **DEPLOY-01**: One-click Vercel deploy button appears in README above the fold, parameterized with exactly 7 required env vars (DATABASE_URL, DASHCLAW_API_KEY, ENCRYPTION_KEY, NEXTAUTH_SECRET, NEXTAUTH_URL, CRON_SECRET, DASHCLAW_LOCAL_ADMIN_PASSWORD)
- [ ] **DEPLOY-02**: `vercel.json` registers cron routes (`/api/cron/signals` every 5 min, `/api/cron/integration-health` every 6 hours) and sets `buildCommand` to run `npm run db:push && next build` for automated schema migration
- [ ] **DEPLOY-03**: Post-deploy setup instructions cover NEXTAUTH_URL (set to deployment URL after first deploy), Upstash Redis setup, and `/setup` as the verification page
- [ ] **DEPLOY-04**: `/setup` page health checks include: NEXTAUTH_URL configuration detected, realtime backend (warns if running in-memory on serverless), schema migration status, CRON_SECRET presence

### Integration Guides

- [ ] **GUIDE-01**: Official Claude Code integration guide covering pretool hook setup, env var configuration, and guardrails.yml policy example
- [ ] **GUIDE-02**: Official OpenAI Agents SDK integration guide linked to `examples/openai-agents-governed/` with annotated walkthrough
- [ ] **GUIDE-03**: LangChain/LangGraph integration guide with new runnable Python example (`examples/langgraph-governed/`) covering guard + createAction + updateOutcome in a graph node
- [ ] **GUIDE-04**: CrewAI integration guide with new runnable Python example (`examples/crewai-governed/`) using `@tool` decorator pattern
- [ ] **GUIDE-05**: All 4 guides follow conversion-guide structure: deploy button as step 1, sub-20-minute completion target, ends with a visible proof moment in the dashboard
- [ ] **GUIDE-06**: All 4 guides are navigable from README, `/connect`, and `/self-host` pages

### Community + Launch

- [ ] **COMM-01**: Discord server created with 4-5 channels (`#announcements`, `#general`, `#deploy-help`, `#show-and-tell`, `#feature-requests`), pre-populated with real content before invite goes public
- [ ] **COMM-02**: Discord permanent invite link embedded in README, `/connect`, and `/self-host` pages
- [ ] **COMM-03**: GitHub release webhook wired to `#announcements` channel
- [ ] **COMM-04**: Show HN post drafted and published — opens with concrete agent failure mode story (not product description), includes deploy button link, demo link, and at least 2 guide links; submitted 9-11am Pacific, not Friday
- [ ] **COMM-05**: X/LinkedIn launch content with visual assets: Mission Control screenshot showing real decisions + 30-second screen recording of guard evaluation flow; X thread format, LinkedIn single post

## v2 Requirements

### Distribution

- **DIST-01**: Railway one-click deploy button — validate Vercel traction first
- **DIST-02**: Render deploy button — third option after Railway proves demand
- **DIST-03**: `DashClawCallbackHandler` as pip/npm export — high value but requires SDK release coordination

### Integration Guides

- **GUIDE-07**: AutoGen/Microsoft Agents SDK integration guide — lower volume than priority 4 frameworks; defer post-launch
- **GUIDE-08**: MDX-based doc infrastructure — justified only at 20+ pages; static JSX is sufficient for current scope

### Community

- **COMM-06**: Discord bot for automated support threads
- **COMM-07**: Dedicated `#integrations` channel with per-framework threads
- **COMM-08**: Community showcase page on DashClaw website

## Out of Scope

| Feature | Reason |
|---------|--------|
| New governance API routes | Runtime boundary is enforced by CI; this milestone is distribution only |
| SaaS / hosted offering | MIT self-hosted positioning is intentional; no cloud lock-in |
| Mobile app | Web-first; mobile after adoption milestone |
| Additional auth providers | `DASHCLAW_LOCAL_ADMIN_PASSWORD` is sufficient for deploy button DX; OAuth providers already exist |
| In-app Discord integration | Out of governance boundary scope |
| Separate documentation site | Static JSX pages in `app/guides/` are sufficient; MDX infrastructure not justified at current scale |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEPLOY-01 | Phase 1 | Pending |
| DEPLOY-02 | Phase 1 | Pending |
| DEPLOY-03 | Phase 1 | Pending |
| DEPLOY-04 | Phase 1 | Pending |
| GUIDE-01 | Phase 3 | Pending |
| GUIDE-02 | Phase 3 | Pending |
| GUIDE-03 | Phase 3 | Pending |
| GUIDE-04 | Phase 3 | Pending |
| GUIDE-05 | Phase 3 | Pending |
| GUIDE-06 | Phase 3 | Pending |
| COMM-01 | Phase 2 | Pending |
| COMM-02 | Phase 2 | Pending |
| COMM-03 | Phase 2 | Pending |
| COMM-04 | Phase 4 | Pending |
| COMM-05 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after plan revision (env var count 6 -> 7 per CONTEXT.md locked decision)*
