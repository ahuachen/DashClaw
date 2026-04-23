# Requirements: DashClaw — Claude Code Beachhead Milestone

**Defined:** 2026-04-11
**Core Value:** *Your coding agent can never surprise you with a destructive action, and you can always prove what it did.*
**Milestone goal:** Go from "207 stars, 4 real users, no clear audience" to **"first 100 developers running Claude Code through DashClaw daily, with a locked-in flagship demo, a public dogfood flywheel, and a defined trigger for paid tier launch."**

---

## v1 Requirements

### Claude Code Integration (CCI)

Core beachhead surface. Everything else in v1 serves this.

- [ ] **CCI-01** *(partial — walkthrough deferred)*: A developer can install DashClaw in front of Claude Code and get their first approval event through the dashboard in **under 5 minutes on a fresh machine**. Measured by a recorded end-to-end walkthrough. *Close status: the integration path exists and is functional end-to-end, but the recorded ≤5:00 Windows/WSL walkthrough artifact has not yet been produced — see `.planning/phases/02-claude-code-beachhead/02-01-SUMMARY.md` section 2 for close preconditions.*
- [x] **CCI-02
**: An opinionated default **coding-agent policy pack** ships with the integration: silently allow safe actions (git commits, git push to non-main branches, reading files, running tests), always block destructive actions (`rm -rf`, mass file deletion outside the repo, force-pushes to main), and require approval for ambiguous ones (network calls, package installs, editing files outside the current project).
- [x] **CCI-03
**: A developer can receive an approval request in **Discord**, approve or deny it from their phone in **under 10 seconds**, and the coding agent proceeds (or is blocked) accordingly. No browser required for the approval itself.
- [x] **CCI-04
**: A developer can open DashClaw and see a **readable, human-scale "what did my agent do today/this week" timeline** — commands run, files edited, approvals/denials, errors — not just a raw decision ledger. One glance communicates trust or alarm.
- [ ] **CCI-05** *(partial — screencast URL backfill deferred)*: Claude Code integration has **complete first-class documentation**: a dedicated page on dashclaw.io, a README section that leads the Getting Started flow, and at least one short screencast showing the install and the first Discord approval. No copy-paste snippets that don't work. *Close status: docs (`/guides/claude-code`), README Claude-Code-first lead, and 806-word homepage draft all shipped in 02-03. The ≤3-minute screencast itself has not been recorded; 4 `<SCREENCAST_URL>` placeholders remain in README.md and app/guides/claude-code/page.js — see `.planning/phases/02-claude-code-beachhead/02-01-SUMMARY.md` section 3 for backfill procedure.*

### Public Dogfood (DOG)

Pulls the Claude Code + Discord flow out of the GitHub issue comment and makes it the flagship demo.

- [ ] **DOG-01**: Wes **personally runs DashClaw daily against his own Claude Code workflow** for the entire milestone. This is an explicit commitment, not a vague intention — measured by DashClaw decision events in Wes's personal instance for ≥5 of 7 days per week.
- [ ] **DOG-02** *(partial — walkthrough deferred)*: A **flagship demo video** (≤3 minutes) shows Wes's real setup end-to-end: Claude Code fires a risky command → Discord notification → approve from phone → Claude Code continues. Raw, no slides. Published publicly. *Close status: `VideoHero` component + CSP `frame-src` directive + homepage iframe embed point shipped in 03-01 (commits `3eaa013d` + `a33bada7`) and are ready to accept a real URL; the recorded ≤3:00 walkthrough itself and the 5 placeholder backfill locations are deferred at 03-01 Task 3 human-action checkpoint per operator resume-signal `ship placeholder again`. Closes in the same future recording session as Phase 2 CCI-01 + CCI-05 — see `.planning/phases/03-public-launch/03-01-SUMMARY.md` sections 4–7 for the backfill procedure and cross-phase consolidation.*
- [x] **DOG-03**: Homepage **rewrite** leads with the Claude Code beachhead: hero headline, demo above the fold, `/connect` onboarding path rewritten for Claude Code users first. Rejected framings (homelab, enterprise compliance, governance-as-abstraction) removed from the hero.
- [ ] **DOG-04** *(partial — launch blitz deferred)*: **Launch content**: public tweet thread, HN "Show HN", and at least one blog post on dashclaw.io explaining the problem, the demo, and the dogfood story. Timed with the homepage rewrite. *Close status: launch content drafts (`docs/launch/{hn-post,tweet-thread,blog-post}.md`) + assertion guardrail (`scripts/check-launch-content.mjs`) shipped in 03-02 commit `668c548d`; blog post live at `app/blog/claude-code-beachhead/page.jsx` shipped in commit `6eb67d00` (with same `PLACEHOLDER_VIDEO_ID` as homepage hero — joins the cross-phase backfill commit); Discord new-connect alert wired in commit `8463abc8`. Same-day launch blitz (HN + tweet thread go-live) DEFERRED at 03-02 Task 4 human-action checkpoint per operator resume-signal `defer launch` — upstream precondition is 03-01 DOG-02 walkthrough recording (Pitfall 1: HN URL-change after submission kills rank means homepage must be its final form before Show HN posts). Closes immediately after the same future recording session that closes Phase 2 CCI-01 + CCI-05 + Phase 3 DOG-02 — see `.planning/phases/03-public-launch/03-02-SUMMARY.md` sections 4–6 for the launch-day recipe and PRE-LAUNCH GATE.*

### Closed-Loop Growth Flywheel (FLY)

The unique moat. DashClaw-governed agents grow DashClaw, *publicly*.

- [ ] **FLY-01**: A **research agent** scans HN, Twitter/X, Reddit, and GitHub Issues for signals ("claude code did something weird", "approval for my agent", "audit trail for AI agent", etc.), governed by DashClaw, and surfaces daily leads to Wes. Every run is visible in DashClaw's decision ledger.
- [ ] **FLY-02**: A **content drafting agent** drafts developer-facing replies, blog post outlines, and demo ideas from the research agent's leads, governed by DashClaw. Wes reviews/approves through the Discord flow — same flow the product uses.
- [ ] **FLY-03**: A **public "growth agents status page"** on dashclaw.io shows the flywheel running live: which agents are active, what they did today, what was approved vs. blocked. The flywheel is the ad.

### Activation Fixes (FIX)

Evidence of activation failure from `.planning/research/SIGNAL.md`. Non-negotiable — we can't demo the beachhead while new users hit these.

- [ ] **FIX-01**: `lucide-react` build error blocking fresh clones (issue #71) is **fixed and validated** on a clean Node 20 environment.
- [ ] **FIX-02**: The 502 / "get API key doesn't work" failure surfaced in issue #31 is **fixed and validated**. Fresh-machine signup → working API key in ≤2 minutes.
- [ ] **FIX-03**: Lief's LAN / plain-HTTP fixes (CSP `upgrade-insecure-requests`, HSTS header, Secure-cookie flag conditional on HTTPS scheme) are **ported upstream** from `RyanTJoy/DashClaw` fork into main, with credit.
- [ ] **FIX-04**: Self-host schema migration path is **hardened**, incorporating lessons from Elpolini's fork commits (compat for legacy schemas, env overrides for doc/prompt paths). Upgrading from any v2.x to current works without manual intervention.

### User Research (USR)

Turn the "I've never talked to a user" answer into a recurring ritual.

- [ ] **USR-01**: Personal outreach **to all four real users identified in SIGNAL.md** (Lief/RyanTJoy, Elpolini, Jory Irving, Jasmeet Sidhu). Thank-you message, acknowledgment of their contributions, interview request. Documented in `.planning/research/OUTREACH.md`.
- [ ] **USR-02**: **Complete ≥2 user interviews** (30 min each), extract themes, write up findings in `.planning/research/INTERVIEW-NOTES.md`. These findings feed back into REQUIREMENTS on the next iteration.
- [ ] **USR-03**: **Weekly user research ritual** established — at minimum one outbound DM or interview per week, even after the milestone ends. A recurring Discord presence or a logged scheduled slot is acceptable.

### Monetization Foundation (MON)

We're not charging yet. We're making sure "free first, paid later" has an actual *later*.

- [x] **MON-01
**: A **specific monetization trigger** is defined, written down in PROJECT.md, and publicly committed to. Candidate triggers: 500 WAU, 50 Claude Code integrations verifiably running in the wild, 20 hours/week of founder time on DashClaw, or first unsolicited "take my money" inbound message. Pick one, commit.
- [x] **MON-02
**: **Pro tier feature boundaries are designed** (which features will be paid, which stay free forever) and the code is architected to support the split — without shipping the paywall. When the trigger fires, flipping to paid is configuration, not a rewrite.

### Governance Runtime Bugfixes (BUG) *(ADDED 2026-04-11 after live dogfood bug discovery)*

Two stacked bugs caught during a `/gsd-progress` session when DashClaw's own pretool hook silently blocked a legitimate bash call with zero audit trail. These bugs directly contradict DashClaw's core value proposition (*"audit-ready decision trails"*) and make Phase 1 / Plan 01-03's dogfood proof mechanism structurally impossible until they fix. **They block Phase 2's Claude Code beachhead launch** — you cannot credibly ship "the control plane for coding agents" on a control plane that silently fails closed.

- [x] **BUG-01**: The `"Secret Exposure Guard"` policy (`gp_178772c27d0f40e69240f82f`) in `POST /api/guard` runs a semantic classification step that is **erroring deterministically** on the hosted DashClaw instance. When it errors, the policy falls back to `decision: "block"` with reason string `"Secret Exposure Guard: Semantic check failed (fallback: block)"`. Root cause must be diagnosed (top suspect: `cd9dbaf5 chore: lazy openai, version env wiring` regression on the hosted Vercel instance, or a missing LLM provider API key), fixed, and verified by re-running the originally blocked command and confirming it no longer deterministic-blocks.
- [x] **BUG-02**: `hooks/dashclaw_pretool.py:344 handle_block()` **never calls `create_action()`** before exiting with code 2. Every other decision handler (`handle_allow`, `handle_warn`, `handle_require_approval`) records the action. Blocks vanish into stderr with zero audit trail — directly contradicting *"audit-ready decision trails"*. Fix: record the blocked action via `create_action(context, status="blocked")` at the top of `handle_block`, ensure the server accepts `"blocked"` as a valid action status (extend enum if necessary), and verify the block appears in the decisions ledger at `/decisions` after firing. Also add a regression test on the block-audit path.
- [ ] **BUG-03**: The founder is viewing his own DashClaw instance as `role='member'` instead of `role='admin'`. The `/approvals` page shows a *"READ-ONLY ACCESS — You are currently viewing as a member"* banner. Even if approvals existed, the founder could not approve them from his own UI. Top suspected root cause: `3dcb43dc`'s JWT org-resolution change (Lief LAN/CSP port in Plan 01-01). Fix: diagnose the exact root cause (DB default, bootstrap flow, org mismatch, or `3dcb43dc` regression), apply the minimal fix (preserving the LAN-HTTP cookie intent from `3dcb43dc` if it's the cause), add a one-off `scripts/promote-founder-to-admin.mjs` script so existing misassigned users can be promoted without raw SQL, and add a regression test verifying that the first user of a fresh DashClaw instance is auto-created with `role='admin'`. Validation requires Wes to visually confirm the banner is gone and complete a real approval flow.
- [ ] **BUG-04** *(ADDED 2026-04-22)*: `hooks/dashclaw_pretool.py:557-560` silently exits 0 when `/api/guard` is unreachable, with the single stderr line `"[DashClaw] Guard unavailable, proceeding"`. This is structurally the same failure class as BUG-02 (silent governance decision without audit): every tool call during any guard outage proceeds unaudited, directly contradicting *"your coding agent can never surprise you with a destructive action, and you can always prove what it did."* Surfaced 2026-04-22 during a diagnosis session where the hook was mis-routed to a local `dashclaw-demo` Docker container via a stale `DASHCLAW_BASE_URL` env var (`http://localhost:3000` overriding the `.env` value pointing at the real instance). Fix: in enforce mode, fail closed (block) when guard is unreachable; in observe mode, write the action to a local orphan log (`~/.dashclaw/orphan-actions.jsonl`) that can be backfilled on recovery — never lose the audit record. Add env var `DASHCLAW_GUARD_UNAVAILABLE_POLICY=block|warn|allow` with default `block`. Add regression test in `hooks/tests/` that stops guard, runs a governed command, and asserts either block-with-stderr or local-orphan-record. Acceptance: hook never silently exits 0 when `/api/guard` is unreachable in enforce mode; orphan log captures actions during network outage. Blocks Phase 2 launch alongside BUG-01/02/03 — the same audit-trail promise that BUG-02 restored on the *block* path must hold on the *outage* path. Full context: `.planning/todos/pending/todo-003-guard-unavailable-fail-open.md`.

---

## v2 Requirements

Deferred. Not in this milestone. Tracked for the *next* milestone once Claude Code beachhead is proven.

### Coding Agent Expansion

- **EXP-01**: First-class Cursor integration with the same 5-minute path
- **EXP-02**: Aider integration
- **EXP-03**: Cody integration
- **EXP-04**: Generic "bring-your-own-agent" SDK path documented for custom agents

### Paid Tier Launch

- **PAY-01**: Pro tier activated and billing wired when MON-01 trigger fires
- **PAY-02**: First 10 paying customers
- **PAY-03**: Team / organization features (multi-user approval, shared audit trail)
- **PAY-04**: Retention tier (extended audit history beyond free limit)

### Audit & Compliance Surfaces (expansion, NOT enterprise)

- **AUD-01**: Export audit trail to common formats (JSON, CSV, SARIF)
- **AUD-02**: Retention / data-deletion controls
- **AUD-03**: Evidence bundles for developer self-reporting (not SOC2 packets)

### Mobile Experience

- **MOB-01**: Responsive mobile dashboard (issue #60 — self-filed)
- **MOB-02**: Native Discord / Slack / iOS Shortcut approvals polished for one-handed use

---

## Out of Scope

Explicit exclusions — every one of these was considered and rejected in the 2026-04-11 discovery session or rolled up from PROJECT.md.

| Feature | Reason |
|---|---|
| Homelab / self-host as identity | Real users skew this way, but founder rejected it as identity. Capability stays, marketing does not |
| Enterprise security / compliance primary framing | Solo indie dev can't run an enterprise sales motion. Capability stays, marketing does not |
| OpenClaw-specific integration | Naming homage only — founder views OpenClaw as "one niche." Stay framework-agnostic |
| VC-scale fundraising / team hiring | Ambition is indie profitable. Every requirement must be deliverable by one person |
| Framework lock-in (langchain-only, autogen-only, etc.) | Claude Code is first, not only. Architecture stays agent-agnostic |
| Paid advertising / paid placements | Organic distribution only. No ad budget. No exceptions |
| Day-1 hard paywall | Founder chose free-first. Paywall comes at the MON-01 trigger, not before |
| Mobile app (separate codebase) | Responsive web and Discord approval flow are enough for the beachhead |
| Custom enterprise SSO / SAML | v2+ after paid tier has validated demand |
| Deep ecosystem integration with specific LLM providers beyond existing (OpenAI/Anthropic/Gemini) | Multi-LLM already shipped; adding Vertex/Bedrock/etc. is v3+ |

---

## Traceability

Mapped against `.planning/ROADMAP.md` phases.

| Requirement | Phase | Status |
|---|---|---|
| FIX-01 | Phase 1 — Foundation | Pending |
| FIX-02 | Phase 1 — Foundation | Pending |
| FIX-03 | Phase 1 — Foundation | Pending |
| FIX-04 | Phase 1 — Foundation | Pending |
| USR-01 | Phase 1 — Foundation | Pending |
| USR-02 | Phase 1 — Foundation | Pending |
| USR-03 | Phase 1 — Foundation | Pending |
| DOG-01 | Phase 1 — Foundation | Pending |
| BUG-01 | Phase 1.5 — Governance Runtime Bugfix (Plan 01.5-01) | Complete |
| BUG-02 | Phase 1.5 — Governance Runtime Bugfix (Plan 01.5-01) | Complete |
| BUG-03 | Phase 1.5 — Governance Runtime Bugfix (Plan 01.5-02) | Pending |
| BUG-04 | Phase 1.5 — Governance Runtime Bugfix (Plan 01.5-03, new) | Pending |
| CCI-01 | Phase 2 — Claude Code Beachhead (Plan 02-01) | Partial — walkthrough deferred (see Open Gaps) |
| CCI-02 | Phase 2 — Claude Code Beachhead (Plan 02-01) | Complete |
| CCI-03 | Phase 2 — Claude Code Beachhead (Plan 02-02) | Complete |
| CCI-04 | Phase 2 — Claude Code Beachhead (Plan 02-03) | Complete |
| CCI-05 | Phase 2 — Claude Code Beachhead (Plan 02-03 + 02-01) | Partial — screencast URL backfill deferred (see Open Gaps) |
| DOG-02 | Phase 3 — Public Launch (Plan 03-01) | Partial — walkthrough recording + 6-location URL backfill deferred (see Open Gaps) |
| DOG-03 | Phase 3 — Public Launch (Plan 03-01) | Complete |
| DOG-04 | Phase 3 — Public Launch (Plan 03-02) | Partial — launch blitz deferred; drafts + blog page + alert shipped (see Open Gaps) |
| MON-01 | Phase 3 — Public Launch | Pending |
| MON-02 | Phase 3 — Public Launch | Pending |
| FLY-01 | Phase 4 — Growth Flywheel | Pending |
| FLY-02 | Phase 4 — Growth Flywheel | Pending |
| FLY-03 | Phase 4 — Growth Flywheel | Pending |

**Coverage:**
- v1 requirements: 25 total (21 original + 3 added in Phase 1.5 insertion + 1 added 2026-04-22)
- Mapped to phases: 25
- Unmapped: 0 ✓

---

## Open Gaps

Requirements in a **partial** close state at end of their nominal phase. Each has the core deliverable shipped but a follow-up artifact pending. Tracked so Phase 3 (or an ad-hoc closure plan via `/gsd-plan-milestone-gaps`) can pick them up without rediscovery.

| Gap | Phase | Plan that left it open | Reason | Close path |
|---|---|---|---|---|
| CCI-01 (walkthrough recording) | Phase 2 | 02-01 | Operator deferred Task 2 human-action checkpoint with resume-signal `skip recording for now, ship placeholder`; Discord bot not yet registered and `.env.local` has zero `DISCORD_*` entries on the recording-target machine | (1) Register Discord bot + populate 5 env vars; (2) record ≤5:00 Windows/WSL walkthrough per recipe in `02-01-PLAN.md` Task 2 `<what-built>` block; (3) publish Loom public or YouTube Unlisted; (4) note URL + wall-clock + phone-to-resolution time; see `02-01-SUMMARY.md` section 5 for full runbook. **Collapsed close with CCI-05 + DOG-02 + DOG-04 — see cross-reference below.** |
| CCI-05 (screencast URL backfill) | Phase 2 | 02-01 (extended by 03-01, then 03-02) | Cannot backfill without a recorded walkthrough; skipped per the same resume-signal as CCI-01. Plan 03-01 added a 5th placeholder location (`app/page.jsx:59` VideoHero src) on top of the 4 inherited from Phase 2; **Plan 03-02 added a 6th** (`app/blog/claude-code-beachhead/page.jsx:23` VIDEO_URL constant — same `PLACEHOLDER_VIDEO_ID` literal as the homepage hero) | Same as CCI-01; after recording, run the atomic **6-location** backfill procedure in `03-02-SUMMARY.md` section 5 — replaces all 6 placeholders (2 `PLACEHOLDER_VIDEO_ID` + 3 raw `<SCREENCAST_URL>` + 1 HTML-entity `&lt;SCREENCAST_URL&gt;`) across `app/page.jsx:59`, **`app/blog/claude-code-beachhead/page.jsx:23`**, `README.md:8,19`, `app/guides/claude-code/page.js:104,249`, then commit `docs(03-01): backfill CCI-05 screencast URLs + flip both VideoHero srcs to live video (DOG-02)`. **Collapsed close with CCI-01 + DOG-02 + DOG-04.** |
| DOG-02 (flagship ≤3:00 walkthrough + homepage + blog video embed) | Phase 3 | 03-01 (extended by 03-02) | Operator deferred Task 3 human-action checkpoint with resume-signal `ship placeholder again` — mirrors Phase 2 02-01's deferred-close pattern exactly. DOG-03 (homepage + /connect + CSP + tests) shipped complete in commits `3eaa013d` + `a33bada7`; DOG-02 walkthrough artifact + 6-location URL backfill (was 5, +1 from 03-02 blog page) deferred. Hero AND blog page VideoHero both currently render with `src="...PLACEHOLDER_VIDEO_ID"` — broken iframe state on both surfaces | **Same future recording session** closes CCI-01 + CCI-05 + DOG-02 + DOG-04 simultaneously. One ≤3:00 walkthrough + one atomic 6-location backfill commit + one same-day 2-hour launch window. Hard-gates 03-02 Show HN submission (Pitfall 1 — URL-change after HN submit kills rank; homepage unshippable until backfill). Full runbook: `03-02-SUMMARY.md` sections 4 + 5 + 6 |
| DOG-04 (launch blitz — Show HN + tweet thread + blog go-live) | Phase 3 | 03-02 | Operator deferred Task 4 human-action checkpoint with resume-signal `defer launch` — third instance of the deferred-close pattern this milestone (after 02-01 and 03-01). Tasks 1-3 shipped complete (drafts + blog page + Discord alert) in commits `668c548d` + `6eb67d00` + `8463abc8`. Launch blitz blocked on upstream DOG-02 walkthrough recording — Pitfall 1 means homepage must be its final form (live video, not placeholder) before Show HN submission | **Closes immediately after** the 6-location backfill commit lands and incognito verification passes on both homepage AND blog page. Run PRE-LAUNCH GATE (8 items in `03-02-SUMMARY.md` section 4) → execute LAUNCH SEQUENCE (T+0 → T+2h) on next Tue/Wed/Thu 8-11am ET window → capture telemetry block per resume-signal format → Phase 3 fully closes. Estimated active time: ~50 min recording + backfill + ~2h launch window |

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-22 — Plan 03-02 deferred close: DOG-04 marked Partial with launch blitz deferred; drafts + blog page + Discord alert shipped in commits `668c548d` + `6eb67d00` + `8463abc8`. CCI-05 and DOG-02 Open Gaps rows extended to reflect the 6-location backfill checklist (was 5; +1 from `app/blog/claude-code-beachhead/page.jsx:23` VIDEO_URL constant added by 03-02 Task 2). DOG-04 row added with explicit cross-reference collapsing all four gaps (CCI-01 + CCI-05 + DOG-02 + DOG-04) into a single future recording-session-plus-launch-window close path.*
