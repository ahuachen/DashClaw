# Roadmap: DashClaw — Claude Code Beachhead Milestone

## Overview

Four coarse phases take DashClaw from *"207 stars, ~4 real users, no clear audience"* to *"first 100 developers running Claude Code through DashClaw daily, with a locked-in flagship demo and a live dogfood-driven growth flywheel."* Phase 1 cleans the ground (activation fixes + first-ever user research + the founder's own daily dogfood commitment). Phase 2 ships the Claude Code integration so the "5-minute aha moment" is actually true. Phase 3 turns that integration into a public launch — the flagship demo, the homepage rewrite, and the monetization trigger. Phase 4 builds the closed-loop flywheel where DashClaw-governed AI agents do the research and content work that grows DashClaw, publicly and forever.

## Phases

- [ ] **Phase 1: Foundation** — Fix activation bugs, run first-ever user interviews, commit to personal dogfood
- [ ] **Phase 1.5: Governance Runtime Bugfix** *(INSERTED 2026-04-11)* — Fix two bugs caught during live dogfood: `handle_block` has no audit trail (BUG-02) and `/api/guard` semantic check is deterministic-falling-back to block (BUG-01). Blocks Phase 2 launch
- [ ] **Phase 2: Claude Code Beachhead** — Ship the 5-minute install-to-first-approval integration
- [ ] **Phase 3: Public Launch** — Flagship demo, homepage rewrite, launch content, monetization trigger
- [ ] **Phase 4: Growth Flywheel** — DashClaw-governed agents doing research + content, publicly visible

## Phase Details

### Phase 1: Foundation
**Goal**: Before we build anything new, clean the ground. Kill the bugs that are silently bouncing every new user on arrival, run the first real user-research pass in DashClaw's history, and turn the founder's working-but-hidden Claude Code dogfood into a daily committed ritual with instrumentation.

**Depends on**: Nothing (first phase)

**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, USR-01, USR-02, USR-03, DOG-01

**Success Criteria** (what must be TRUE):
1. A developer cloning DashClaw on a fresh Node 20 machine can run `npm install && npm run dev` and land on a working dashboard with zero build errors (no `lucide-react` icon failure, no missing deps)
2. A developer signing up fresh can obtain a working API key on the hosted `/connect` path in ≤2 minutes — no 502s, no "get API key doesn't work"
3. LAN self-host on plain HTTP works end-to-end (login renders, session persists, cookies land) — incorporating Lief's CSP/HSTS and cookie-flag fixes, credited upstream
4. Upgrading from a 6-month-old DashClaw schema to current works without manual intervention
5. All 4 real users from SIGNAL.md have received personal outreach by name, and at least 2 user interviews have been completed with notes filed in `.planning/research/INTERVIEW-NOTES.md`
6. Wes has a weekly user-research ritual defined and calendared (Discord presence, scheduled DMs, or equivalent) — not just an intention
7. Wes's personal Claude Code workflow has been running through DashClaw every working day for the entire phase, with decision events visible in his personal instance on ≥5 of 7 days/week

**Plans**: 3 plans

Plans:
- [x] 01-01: **Activation fixes** — close the four known blockers (lucide-react #71, docs 502 #31, Lief's LAN/CSP fixes, Elpolini's migration compat). Each fix gets a failing test first where practical, then the fix, then a clean-machine validation. (FIX-01..04)
- [ ] 01-02: **First-ever user research pass** — write outreach messages for Lief, Elpolini, Jory, Jasmeet; send them; complete ≥2 interviews; write up findings in `.planning/research/INTERVIEW-NOTES.md`; surface any REQUIREMENTS edits that emerge. (USR-01, USR-02)
- [ ] 01-03: **Founder dogfood commitment + weekly ritual** — Wes's personal DashClaw instance pointed at his own Claude Code, Discord approvals flowing daily; weekly research ritual scheduled; both instrumented so we can *prove* the commitment is being kept. (DOG-01, USR-03)

---

### Phase 1.5: Governance Runtime Bugfix *(INSERTED 2026-04-11)*
**Goal**: Fix two stacked bugs in DashClaw's own governance runtime that were caught during a live dogfood session on 2026-04-11 when the `dashclaw_pretool.py` hook blocked a legitimate `gsd-tools` bash call and the block vanished with zero audit trail. Phase 2's Claude Code beachhead cannot credibly ship on a product that silently fails closed and loses audit trails, and Phase 1 / Plan 01-03's dogfood proof mechanism (≥5/7 days of approvals in the ledger) is structurally broken until these fix.

**Depends on**: Nothing technical (the bugs are independent of Phase 1's plans), but **blocks Phase 2**. This is a hard prerequisite for the Claude Code beachhead — you cannot demo governance-as-a-product when the governance layer itself fails silently.

**Requirements**: BUG-01, BUG-02, BUG-03

**Success Criteria** (what must be TRUE):
1. `handle_block` in `hooks/dashclaw_pretool.py` records every blocked action via `create_action(context, status="blocked")` before exiting. Blocks are persisted, queryable at `/api/actions?status=blocked`, and visible in the decisions ledger at `/decisions`
2. The server accepts `"blocked"` as a valid action status (enum extended if necessary, or documented as already unconstrained)
3. The "Secret Exposure Guard" policy's semantic check no longer deterministic-falls-back to block on ordinary commands — the root cause in `/api/guard`'s server-side classifier is diagnosed, fixed, and proven with a reproduced-then-cleared test case
4. When the originally blocked command (`node gsd-tools.cjs init progress`) is re-fired with policies re-enabled, it either succeeds or legitimately blocks with a visible audit trail entry — never with the fallback string `"Semantic check failed (fallback: block)"`
5. A regression test covers `handle_block`'s audit-trail behavior so future regressions on the block path get caught automatically
6. **Founder's user record has `role='admin'` on his own instance** — the `/approvals` page no longer shows the "READ-ONLY ACCESS" banner, and Wes can click Approve/Deny on a real pending approval
7. **Bootstrap flow auto-promotes the first user of a fresh DashClaw instance to admin** — any new developer deploying via Vercel 1-click becomes admin of their own instance without running SQL
8. **A one-off promotion script** (`scripts/promote-founder-to-admin.mjs`) exists so existing users who are incorrectly `role='member'` can be promoted via the script, not a raw SQL query
9. None of the existing guardrails (`route-sql:check`, `openapi:check`, `api-inventory:check`, `npm test`) regress

**Plans**: 3 plans (sequential waves)

Plans:
- [x] 01.5-01: **Governance runtime bugfix — BUG-01 + BUG-02** *(Wave 1)* — diagnose and fix the server-side semantic check failure (BUG-01), fix the client-side `handle_block` audit-trail gap (BUG-02), extend server-side action status handling, add regression test, and validate end-to-end by re-firing the originally blocked command. Captures `01.5-DIAGNOSIS.md` and `01.5-VALIDATION.md` as permanent evidence of the fix.
- [ ] 01.5-02: **Founder admin role bugfix — BUG-03** *(Wave 2, depends on 01.5-01)* — diagnose why Wes is `role='member'` on his own instance (top suspect: `3dcb43dc` JWT org-resolution regression), fix the root cause, add `scripts/promote-founder-to-admin.mjs` for existing users, add regression test for first-user-is-admin bootstrap, validate by having Wes visually confirm the READ-ONLY banner is gone and completing a real approval flow. Captures `01.5-BUG03-DIAGNOSIS.md` and `01.5-BUG03-VALIDATION.md`.
- [ ] 01.5-03: **Hook fail-open bugfix — BUG-04** *(Wave 3, added 2026-04-22 during Phase 2 CONTEXT-gathering)* — `hooks/dashclaw_pretool.py:557-560` silently exits 0 when `/api/guard` is unreachable. Same failure class as BUG-02 (silent governance without audit). Fix: fail closed in enforce mode; write local orphan log (`~/.dashclaw/orphan-actions.jsonl`) in observe mode for backfill on recovery. Add env var `DASHCLAW_GUARD_UNAVAILABLE_POLICY=block|warn|allow` (default `block`). Add regression test: stop guard, run governed command, assert block-with-stderr or local-orphan-record. Captures `01.5-BUG04-DIAGNOSIS.md` and `01.5-BUG04-VALIDATION.md`. Full context: `.planning/todos/pending/todo-003-guard-unavailable-fail-open.md`.

---

### Phase 2: Claude Code Beachhead
**Goal**: Ship the core integration so a new developer goes from "I just heard about DashClaw" to "oh THIS is why I needed this" in under 5 minutes. This is the product half of the beachhead — the integration, the default policy pack, the Discord approval flow, and the activity timeline that makes the audit trail legible to humans.

**Depends on**: Phase 1 (activation fixes must land and user research should inform the default policy pack before we lock it)

**Requirements**: CCI-01, CCI-02, CCI-03, CCI-04, CCI-05

**Success Criteria** (what must be TRUE):
1. A developer on a fresh machine can follow the documented Claude Code integration path and see their first approval event in the DashClaw dashboard in ≤5 minutes, measured by a recorded walkthrough
2. The default coding-agent policy pack correctly handles the common cases: silently allows git commits and test runs, always blocks `rm -rf /` and mass-delete patterns, requires approval for network calls and package installs
3. When Claude Code hits an approval-required action, the developer receives a Discord notification and can approve or deny from their phone in ≤10 seconds, with Claude Code proceeding (or being blocked) accordingly
4. The DashClaw dashboard has a readable "what did my agent do today/this week" timeline — not raw JSON, not a bare ledger — that a developer can glance at and immediately understand what their agent actually touched
5. Claude Code integration has complete first-class docs: dedicated dashclaw.io page, README section, and at least one ≤3-minute screencast — with every snippet tested and working

**Plans**: 3 plans

Plans:
- [ ] 02-01-PLAN.md — **CCI-02 no-regression gate + CCI-01 recorded walkthrough (Wave 2, depends on 02-02 + 02-03)**. Foundation pieces (hook, starter policy pack, MCP tool, guides v1) shipped 2026-04-21; plan 02-01 is the end-of-phase validation: hold CCI-02 (starter pack 9/9 tests) + full suite green, then record the ≤5:00 Windows/WSL walkthrough with a live Discord approval, backfill the published screencast URL into the README + guide. (CCI-01, CCI-02)
- [x] 02-02-PLAN.md — **Discord approval flow (Wave 1)** ✓ Shipped 2026-04-22 (CCI-03). `/api/discord/interactions` + `fireDiscordApproval` + middleware allowlist + .env.example block + actions-route wiring all green; 26 Discord unit tests pass; full suite 1675 pass / 0 fail. Rule 1 fix folded in for jsdom Uint8Array cross-realm compat.
- [x] 02-03-PLAN.md — **Activity timeline + /my-agent + docs bundle (Wave 1, parallel with 02-02)** ✓ Shipped 2026-04-22 (CCI-04, CCI-05). `/activity` day-grouping `useMemo` layer + new `app/my-agent/page.jsx` narrative page (today/week toggle, pinned denials, install-prompt empty state, realtime via `useRealtime`); `/guides/claude-code` Discord Developer Portal walkthrough + screencast placeholder; README.md Claude-Code-first lead with D-17 GIF click-through (anchor-wrapped demo-gif2); `docs/homepage-draft-claude-code.md` Phase 3 handoff (806 words); `scripts/check-readme-lead.mjs` CI gate (exits 0). 15 new unit tests green; full suite 1690 pass / 5 skip / 0 fail. Week-scope fixture Rule 1 fix folded in.

---

### Phase 3: Public Launch
**Goal**: Pull the beachhead out of the private dogfood and into public daylight. Ship the flagship demo video, rewrite the homepage around Claude Code, publish the launch content, and commit to a specific monetization trigger so "free first, paid later" has a defined *later*.

**Depends on**: Phase 2 (the integration has to actually work before we demo it publicly — launching on a half-shipped integration is how trust gets burned)

**Requirements**: DOG-02, DOG-03, DOG-04, MON-01, MON-02

**Success Criteria** (what must be TRUE):
1. A publicly linkable ≤3-minute flagship demo video exists, showing Wes's real Claude Code → Discord approval flow end-to-end on a real codebase (no slides, no fake walkthroughs, raw over polished)
2. `dashclaw.io` homepage hero leads with the Claude Code beachhead: headline, demo above the fold, Claude-Code-first `/connect` onboarding path. The rejected framings (homelab, enterprise compliance, generic AI governance language) are gone from the hero
3. Launch content is live: a "Show HN" post, a developer-facing tweet thread (X/Twitter), and at least one blog post on dashclaw.io explaining the problem / demo / dogfood story
4. A **specific monetization trigger** is written into PROJECT.md and publicly committed to on dashclaw.io or the README (not just "when it makes sense later"). Candidates: 500 WAU, 50 verified Claude Code integrations in the wild, 20 hrs/week of founder time on DashClaw, or first unsolicited "take my money" inbound message
5. Pro tier feature boundaries are designed and the code is architected for the split, *without* shipping the paywall — flipping to paid at the trigger is a config change, not a refactor

**Plans**: 3 plans

Plans:
- [ ] 03-01: **Flagship demo video + homepage rewrite** — one bundled plan because the video is the asset the new homepage is built around. Ships the ≤3-min demo, the homepage hero rewrite, and the `/connect` Claude-Code-first onboarding path. (DOG-02, DOG-03)
- [ ] 03-02: **Launch content bundle** — Show HN post, tweet thread, blog post, all timed with the homepage rewrite. Written partly by Wes, partly by a DashClaw-governed content agent as a pre-flywheel proof (see Phase 4). (DOG-04)
- [ ] 03-03: **Monetization trigger + Pro tier boundary design** — pick the trigger, write it into PROJECT.md, design which features will go Pro when it fires, architect the code split, do NOT ship the paywall. (MON-01, MON-02)

---

### Phase 4: Growth Flywheel
**Goal**: Build the closed-loop moat. A research agent that scans HN / Twitter / Reddit / GitHub for Claude Code complaints and surfaces leads, a content drafting agent that drafts developer-facing replies and posts, and a public "growth agents status page" — all governed by DashClaw, all publicly visible. The flywheel is the ad.

**Depends on**: Phase 3 (public launch needs to be live so the flywheel has a real product to grow, and the research/content agents need the beachhead as their canonical subject matter)

**Requirements**: FLY-01, FLY-02, FLY-03

**Success Criteria** (what must be TRUE):
1. A research agent runs at least daily, scans HN / Twitter/X / Reddit / GitHub for Claude Code pain signals and feature-request patterns, and surfaces a daily digest of leads to Wes. Every run is governed by DashClaw and visible in the decision ledger
2. A content drafting agent takes leads from the research agent and drafts developer-facing content (replies, tweet threads, blog post outlines), governed by DashClaw — and Wes approves/denies the outputs through the *same* Discord approval flow the product uses for Claude Code
3. A public "Growth Agents" status page on dashclaw.io shows the flywheel running live: which agents are active today, what they did, what was approved vs. blocked. The page is an unstaged proof surface — visitors can see the product governing its own growth agents, publicly, as they browse it

**Plans**: 2 plans

Plans:
- [ ] 04-01: **Research + content drafting agents, DashClaw-governed** — the two agents, the policy rules they run under, the Discord approval flow for their outputs, and the evidence that Wes is actually approving/rejecting through them daily. (FLY-01, FLY-02)
- [ ] 04-02: **Public growth agents status page** — the public surface on dashclaw.io that shows the flywheel live. Designed so it's compelling for someone who just landed on the homepage and wants to see the product working on its own behalf. (FLY-03)

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4. No parallelization across phases (each phase's output is a hard precondition for the next). *Within* phases, plans may run in parallel where independent.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 1/3 | In Progress|  |
| 1.5. Governance Runtime Bugfix *(INSERTED)* | 1/2 | In Progress|  |
| 2. Claude Code Beachhead | 0/3 | Not started | - |
| 3. Public Launch | 0/3 | Not started | - |
| 4. Growth Flywheel | 0/2 | Not started | - |

---
*Roadmap defined: 2026-04-11 after discovery session*
