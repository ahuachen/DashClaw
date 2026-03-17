# Project Research Summary

**Project:** DashClaw — Adoption Milestone
**Domain:** Open-source AI agent governance runtime (self-hosted, Next.js, Neon Postgres)
**Researched:** 2026-03-17
**Confidence:** MEDIUM — Core deployment mechanics verified from primary sources; integration guide framework versions and Show HN patterns from training knowledge (August 2025 cutoff).

## Executive Summary

DashClaw's governance runtime is architecturally complete. This milestone is a pure distribution problem: get from zero self-hosted instances to 10 active instances by removing friction from the deploy path, providing working integration guides for the four highest-volume agent frameworks, and creating a community surface before any public launch. All four research areas confirm the same conclusion: nothing new needs to be built in the governance runtime — the adoption gap is entirely in the deploy story, documentation, and community setup.

The recommended approach is sequential: fix the deploy funnel first, then build integration guides around it, then launch publicly. The deploy button is the linchpin — until a developer can go from GitHub to a running instance without consulting a 9-step manual process, all downstream distribution (Show HN, X/LinkedIn, integration guides) sends traffic to a broken funnel. Three concrete deploy-path problems must be solved before any public launch: NEXTAUTH_URL must be documented as a post-deploy configuration step, the Upstash Redis requirement must be surfaced as a first-class deploy step (not a footnote), and the database migration must be automated in the Vercel build step so the app isn't DOA on first deployment.

The key risk is over-engineering at the wrong layer. Research across all four files warns against adding new governance features, new API routes, a separate docs site, Discord bots, a second deploy target (Railway/Render), or a hosted SaaS offering. The CI boundary check (`npm run governance:boundary:check`) enforces the core architectural constraint. Everything in this milestone is additive at the edges — `vercel.json`, `README.md`, static guide pages in `app/guides/`, and an external Discord server. The governance runtime is not touched.

## Key Findings

### Recommended Stack

The existing stack (Next.js 15, Neon Postgres, Node 20, Drizzle ORM, Python SDK) requires no changes. For the adoption layer, the only configuration change is `vercel.json`: add `framework: "nextjs"`, register two existing cron routes (`/api/cron/signals` every 5 minutes, `/api/cron/integration-health` every 6 hours), and a `buildCommand` running `npm run db:push` to automate schema migration on deploy. Env var prompts belong in the deploy button URL query string — not in `vercel.json`.

**Core technologies for this milestone:**
- **Vercel deploy button URL:** Entry point for all new deployers — parameterized with 6 required env vars and link to `.env.example`; zero new tooling needed
- **LangGraph + langchain-core (Python):** Recommended over raw LangChain; graph node boundaries map cleanly to the DashClaw governance loop; `langgraph>=0.2`, `langchain-core>=0.3`
- **CrewAI (Python):** `@tool` decorator pattern wraps `guard()` before execute; `crewai>=0.63.0`; versions are LOW confidence — verify against PyPI before writing examples
- **Upstash Redis:** Must be treated as a required Vercel deploy dependency, not optional; the silent in-memory fallback on serverless is the top first-impression failure mode
- **Discord (external):** No bots, no in-app integration; plain webhook to `#announcements` for GitHub releases; minimal channels at launch (4-5 max)

**Critical version gaps:** LangGraph, LangChain, CrewAI, AutoGen, and `@openai/agents` package versions are unverified against current registries. Verify before writing `requirements.txt` files.

### Expected Features

**Must have (table stakes):**
- Vercel deploy button in README above the fold — absence signals the project is not production-ready
- Inline env var prompts scoped to 6 required vars only (not the full 122-line `.env.example`)
- Post-deploy instructions covering NEXTAUTH_URL (deployment-URL-dependent), Upstash Redis setup, and `/setup` as the verification landing page
- Database migration automated in Vercel build step (`npm run db:push` in `buildCommand`)
- Integration guides for Claude Code (hook already exists — guide only), OpenAI Agents SDK (example already exists — guide only), LangChain/LangGraph (new Python example needed), and CrewAI (new Python example needed)
- Discord server live before public launch — somewhere for evaluators to ask questions
- Show HN post leading with a concrete failure mode story, not a product description

**Should have (competitive differentiators):**
- Neon Vercel Marketplace integration pre-wired via `integration-ids` parameter in the deploy button URL — would eliminate the manual "create Neon account" step; HIGH value if confirmed; verify exact integration ID against Vercel Marketplace before shipping
- `guardrails.yml` shown at the end of every integration guide — governance-as-code resonates with the infrastructure persona; differentiates from UI-click governance tools
- Decision Replay URL highlighted in onboarding as the shareable proof artifact
- `$0 deploy` callout surfaced in README (already in `deploy-without-oauth.md` — just needs surfacing)
- Pre-populated Discord content before invite link goes public (3-5 real messages, pinned troubleshooting guide, `#changelog` first entry)

**Defer to post-adoption traction:**
- `DashClawCallbackHandler` as a pip/npm export — high value but requires SDK release coordination
- Railway/Render deploy buttons — validate Vercel traction first
- Dedicated AutoGen example repo — adoption lower than other frameworks; cover in CrewAI guide appendix
- MDX infrastructure for docs — justified only at 20+ pages; current static JSX pattern is sufficient
- In-app Discord widget or notification integration — out of governance boundary scope

### Architecture Approach

All adoption-layer work is additive at the edges of the existing app. No governance routes are modified. Guide pages follow the established `app/docs/page.js` + `app/self-host/SetupTabs.js` pattern: server component with static JSX, client islands only for copy buttons or framework switchers. The `PublicNavbar`, `PublicFooter`, and `CopyableCodeBlock` components are reused across all new guide pages. A new `app/guides/[framework]/page.js` directory is the only structural addition to the Next.js app.

**Major components for this milestone:**
1. **`vercel.json` (updated)** — Registers cron routes, sets framework preset, adds `buildCommand` for schema migration; the minimal config that makes Vercel deployments functional out of the box
2. **Deploy button URL (README + /self-host)** — Parameterized one-click URL encoding 6 required env vars; the single highest-leverage change in the entire milestone
3. **`app/guides/[framework]/page.js` (new, 4 pages)** — Static documentation pages following existing doc page patterns; no API calls, no database reads, no new governance routes
4. **Discord server (external)** — Community platform; linked from README, `/self-host`, and `/connect`; no in-app integration
5. **Launch content (external)** — Show HN post, X/LinkedIn thread; gates on deploy button and at least two integration guides being live

### Critical Pitfalls

1. **NEXTAUTH_URL chicken-and-egg** — Vercel deploy button cannot pre-populate this var because the deployment URL isn't known until after first deploy. Without correction, users get a redirect loop on sign-in and abandon. Fix: add explicit post-deploy instructions ("copy your Vercel URL, paste as NEXTAUTH_URL, redeploy"), add a `/setup` health check that detects URL mismatch.

2. **Silent Redis fallback kills the core value proposition** — `app/lib/events.js` falls back to in-memory EventEmitter when `REDIS_URL` is unset. On Vercel serverless, this means Mission Control's live decision stream shows nothing. First impression of the product's signature feature is a blank screen. Fix: treat Upstash Redis as required in deploy docs and Vercel env var prompts; add `/setup` health check warning when running memory backend on serverless.

3. **Database migration not automated** — Vercel build runs `next build`, not migrations. New deploys arrive with empty tables and return 500 on first API call. Fix: add `npm run db:push` to `vercel.json` `buildCommand`.

4. **Env var overload kills conversion at deploy form** — The `.env.example` is 122 lines. Deploy button must list only the 6 critical vars. Optional vars shown as blockers cause abandonment before the first deploy completes. Fix: restrict the deploy button `env=` parameter to: `DATABASE_URL,DASHCLAW_API_KEY,ENCRYPTION_KEY,NEXTAUTH_SECRET,NEXTAUTH_URL,CRON_SECRET`.

5. **Integration guides written as tutorials, not conversion guides** — Guides that teach how DashClaw works produce high views and zero deployments. Every guide must start with "Prerequisites: a running DashClaw instance" with the deploy button as step one, and must end with a concrete "you know this worked" moment visible in the dashboard. The 20-minute completability threshold is the quality gate.

## Implications for Roadmap

Based on combined research, all four files agree on a strict sequential dependency: deploy funnel must be fixed before any public distribution. Suggested 4-phase structure:

### Phase 1: Deploy Funnel (Foundation)
**Rationale:** Every other deliverable (integration guides, Show HN, Discord promotion) sends traffic to the deploy path. If the deploy path is broken, all downstream distribution effort is wasted. Three HIGH-confidence pitfalls (NEXTAUTH_URL, silent Redis, missing migration) require fixes before any user-facing launch. This phase is entirely infrastructure configuration — no new product features.
**Delivers:** A working one-click deploy experience where a developer goes from GitHub to a functional DashClaw instance in under 10 minutes
**Addresses features:** Vercel deploy button (table stakes), env var prompts, post-deploy `/setup` verification, `$0 deploy` callout
**Avoids pitfalls:** Pitfalls 1, 2, 3, 4 (NEXTAUTH_URL, Redis fallback, missing migration, env var overload)
**Key tasks:**
- Update `vercel.json`: `framework`, `crons`, `buildCommand: "npm run db:push && next build"`
- Construct deploy button URL with 6 required env vars + Neon `integration-ids` (verify before shipping)
- Add deploy badge to README above the fold
- Add post-deploy instructions: NEXTAUTH_URL, Upstash Redis setup link, `/setup` verification URL
- Add `/setup` health checks for NEXTAUTH_URL mismatch, Redis backend, schema presence, CRON_SECRET

### Phase 2: Discord Community Setup
**Rationale:** Community must exist before any public launch so evaluators have somewhere to ask questions. Zero engineering work — creates in parallel with Phase 1. Must be pre-populated with real content before the invite link is embedded anywhere public. Done before integration guides are published because guides will reference Discord for support.
**Delivers:** A live Discord server with 4-5 channels, pre-populated content, and a permanent invite link ready to embed
**Addresses features:** Community platform (table stakes), GitHub release webhook in `#announcements`
**Avoids pitfalls:** Pitfall 6 (Discord empty at launch)
**Key tasks:**
- Create server with 4-5 channels: `#announcements` (read-only), `#general`, `#deploy-help`, `#show-and-tell`, `#feature-requests`
- Pre-populate `#general` and `#show-and-tell` with 3-5 real messages before making invite public
- Pin troubleshooting guide in `#deploy-help` covering NEXTAUTH_URL, Redis, migration
- Set up GitHub release webhook in `#announcements`
- Generate permanent invite link for embedding

### Phase 3: Integration Guides
**Rationale:** Guides depend on Phase 1 (deploy button must work before guide step 1 sends users to it) and Phase 2 (guides reference Discord for support). Priority order driven by FEATURES.md: Claude Code guide first (existing hook, documentation only — 2 hours), OpenAI Agents SDK guide second (existing example, documentation only — 2 hours), LangChain/LangGraph guide third (new Python example + guide — highest framework volume), CrewAI guide fourth. Each guide uses conversion-guide structure, not tutorial structure.
**Delivers:** 4 integration guides at `app/guides/[framework]/page.js`, 2 new runnable examples (`examples/langgraph-governed/`, `examples/crewai-governed/`), links wired from README and `/connect`
**Addresses features:** All 4 integration guides (table stakes), framework-specific code snippets in README (table stakes), `guardrails.yml` shown per guide (differentiator)
**Avoids pitfalls:** Pitfall 5 (tutorial-mode guides), Pitfall 8 (framework version staleness — pin + date-stamp)
**Key tasks:**
- `docs/guides/claude-code.md` — hook setup, env vars, guardrails.yml config (no new example needed)
- `docs/guides/openai-agents-sdk.md` — links to `examples/openai-agents-governed/` with explanation
- `examples/langgraph-governed/` + `docs/guides/langchain-langgraph.md` — new Python example
- `examples/crewai-governed/` + `docs/guides/crewai.md` — new Python example (verify package versions first)
- Add navigation from README, `/connect`, and `/self-host` to all guide pages
- Each guide: deploy button as prereq step 1, sub-20-minute completion target, ends with dashboard proof

### Phase 4: Public Launch
**Rationale:** Launch gates on Phase 1 (working deploy), Phase 2 (live Discord), and at least Phase 3 partial (Claude Code + OpenAI Agents guides sufficient for HN). Can launch with 2 guides and add remaining 2 post-launch. Show HN post must lead with a concrete failure mode story. Social content (X/LinkedIn) needs visual assets prepared before submission.
**Delivers:** Show HN post, X/LinkedIn thread with Mission Control screenshot and screen recording, Discord invite promoted publicly
**Addresses features:** Show HN launch (table stakes), X/LinkedIn content with visual assets (differentiator)
**Avoids pitfalls:** Pitfall 4 (problem-first story), Pitfall 10 (Show HN prefix), Pitfall 12 (text-only social posts)
**Key tasks:**
- Draft Show HN post: opens with concrete failure mode, not product description; includes `/connect` demo link, deploy button link, 2 guide links; submit 9-11am US Pacific, not Friday
- Prepare Mission Control screenshot with real decisions visible
- Prepare 30-second screen recording: tool call → guard evaluation → decision in ledger
- X thread: lead with blocked-action clip from `npx dashclaw-demo`; LinkedIn: single post with clip
- Respond to every Show HN comment within first 2 hours

### Phase Ordering Rationale

- Phase 1 before all others: three HIGH-confidence pitfalls make the deploy path non-functional today; any traffic before fixing these hits a broken funnel
- Phase 2 parallel with Phase 1: no code dependencies; finishing Discord setup before guides publish means every guide can reference a live support channel
- Phase 3 before Phase 4: Show HN credibility requires at least one working integration guide so evaluators can actually connect an agent after deploying
- AutoGen deferred out of Phase 3: framework adoption is lower than the four priority frameworks; cover in a CrewAI guide appendix for MVP

### Research Flags

Phases needing additional research or verification during planning:
- **Phase 1 (Neon integration-ids):** The Neon Vercel Marketplace `integration-ids` parameter value must be verified against the live Vercel Marketplace before the deploy button URL is finalized. Both STACK.md (suggests `oac_VqOgBHqhEoFTPzGkPd7L0iH6`) and FEATURES.md flag this as needing live verification — MEDIUM confidence.
- **Phase 1 (NEXTAUTH_URL pattern):** The exact mechanism for handling `NEXTAUTH_URL` post-deploy (use `$VERCEL_URL` env substitution in `vercel.json`, or instruct users to set it manually after first deploy) needs a live test to confirm the least-friction path. PITFALLS.md documents two options; the right one depends on how Vercel resolves the env at build time vs. runtime.
- **Phase 3 (Python package versions):** LangGraph, LangChain-core, CrewAI, and AutoGen versions are LOW confidence — drawn from training knowledge. Verify against PyPI before writing `requirements.txt` files. STACK.md explicitly flags this.
- **Phase 3 (`@openai/agents` current version):** Project pins `^0.7.0`. Verify this is still the recommended version given the OpenAI Agents SDK was in active development as of early 2025.

Phases with well-established patterns (research-phase not required):
- **Phase 2 (Discord setup):** Developer community Discord patterns are fully established. Channel structure, pre-population approach, and GitHub webhook setup are standard — no research phase needed.
- **Phase 4 (Show HN mechanics):** HN submission rules and show-HN best practices are stable and well-documented across the community. PITFALLS.md covers the key failure modes thoroughly.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core runtime stack is HIGH confidence (direct codebase inspection). Deploy button URL parameter schema confirmed from Vercel docs (partial fetch — skeleton returned on first access). Vercel cron config in `vercel.json` is HIGH confidence from full doc fetch. Python package versions for LangGraph/CrewAI are LOW — unverified against live registries. |
| Features | HIGH | Feature requirements sourced directly from `.env.example`, `deploy-without-oauth.md`, `QUICK-START.md`, and README analysis — all primary sources. Framework integration hook points (LangChain callbacks, OpenAI Agents RunHooks, CrewAI task callbacks) are MEDIUM — training knowledge through August 2025. |
| Architecture | HIGH | Architecture findings sourced from direct codebase inspection: `app/docs/page.js`, `app/self-host/SetupTabs.js`, `.planning/codebase/ARCHITECTURE.md`, `vercel.json`, `.vercel/project.json`. The "additive at edges, no runtime changes" finding is fully confirmed. Component boundaries are unambiguous. |
| Pitfalls | HIGH | Four of the five critical pitfalls are sourced from primary codebase evidence: NEXTAUTH_URL default in `.env.example`, Redis fallback documented in `CONCERNS.md`, missing migration from STACK.md and empty `vercel.json`, env var count from `.env.example` line count. Only Show HN and integration guide conversion pitfalls draw from training knowledge (MEDIUM). |

**Overall confidence:** MEDIUM-HIGH. The "what to build and in what order" is HIGH confidence. The specific values (Neon integration ID, Python package versions, OpenAI Agents SDK version) are MEDIUM-LOW and require live verification before implementation.

### Gaps to Address

- **Neon Marketplace integration ID:** Verify `oac_VqOgBHqhEoFTPzGkPd7L0iH6` against `https://vercel.com/integrations/neon` before shipping the deploy button URL. If incorrect, the deploy button silently omits database provisioning. Handle during Phase 1 implementation by fetching the Vercel Marketplace page directly.
- **NEXTAUTH_URL post-deploy pattern:** Test whether setting `"env": { "NEXTAUTH_URL": "https://$VERCEL_URL" }` in `vercel.json` resolves correctly for a production (non-preview) URL. The failure mode is subtle — auth works in preview, breaks on production custom domains. Handle during Phase 1 by testing both patterns against a staging deploy.
- **Python package versions:** LangGraph, langchain-core, CrewAI, and `pyautogen` versions listed in STACK.md are from training knowledge. Must verify against PyPI before writing `requirements.txt` for `examples/langgraph-governed/` and `examples/crewai-governed/`. Likely higher than listed.
- **`db:push` in buildCommand idempotency:** Verify that `npm run db:push` (Drizzle `drizzle-kit push`) is safe to run on every Vercel deploy including redeployments with an existing schema. If it has destructive behavior on schema drift, the `buildCommand` approach must be replaced with startup-time migration detection. Handle during Phase 1 by reviewing Drizzle push behavior for existing schemas.
- **Mission Control on Vercel free tier (cron frequency):** Vercel's free tier restricts cron job frequency. The recommended `*/5 * * * *` schedule for `/api/cron/signals` may require the Pro tier. Document the limitation and the self-hosted Docker path as the workaround for free-tier deployers.

## Sources

### Primary (HIGH confidence)
- `C:/Projects/DashClaw/.env.example` — complete env var surface; required vs. optional classification
- `C:/Projects/DashClaw/vercel.json` — confirmed empty `{}`; establishes baseline for additions
- `C:/Projects/DashClaw/docs/deploy-without-oauth.md` — existing manual deploy path (confirms the 9-step gap)
- `C:/Projects/DashClaw/CONCERNS.md` — Redis silent fallback documented as known issue
- `C:/Projects/DashClaw/.planning/codebase/ARCHITECTURE.md` — runtime architecture and component map
- `C:/Projects/DashClaw/app/docs/page.js`, `app/self-host/page.js`, `app/self-host/SetupTabs.js` — established doc page patterns
- `C:/Projects/DashClaw/.vercel/project.json` — confirms existing Vercel project connection
- `C:/Projects/DashClaw/examples/openai-agents-governed/` — confirms OpenAI Agents SDK example complete
- Vercel project configuration docs (`vercel.com/docs/project-configuration/vercel-json`) — cron block, framework preset; HIGH confidence from full content fetch

### Secondary (MEDIUM confidence)
- Vercel deploy button docs (`vercel.com/docs/deploy-button`) — URL parameter schema (`env`, `envDescription`, `envLink`, `integration-ids`); JavaScript-rendered page returned skeleton on first fetch; parameter existence confirmed via cross-reference with working examples
- Training knowledge — LangChain/LangGraph callback handler pattern, OpenAI Agents SDK hooks, CrewAI `@tool` decorator pattern, Show HN best practices (knowledge cutoff August 2025)
- `C:/Projects/DashClaw/.planning/PROJECT.md` — milestone scope and out-of-scope list; anti-feature decisions

### Tertiary (LOW confidence)
- LangGraph, langchain-core, CrewAI, pyautogen package versions — training knowledge, unverified against live PyPI registries; must verify before writing requirements files
- Neon Vercel Marketplace integration ID (`oac_VqOgBHqhEoFTPzGkPd7L0iH6`) — cited in FEATURES.md research; must verify against live Vercel Marketplace before embedding in deploy button URL
- `@openai/agents` current recommended version — project pins `^0.7.0`; OpenAI Agents SDK was in active development; verify currency

---
*Research completed: 2026-03-17*
*Ready for roadmap: yes*
