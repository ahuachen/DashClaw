# Requirements: DashClaw — Claude Code Beachhead Milestone

**Defined:** 2026-04-11
**Core Value:** *Your coding agent can never surprise you with a destructive action, and you can always prove what it did.*
**Milestone goal:** Go from "207 stars, 4 real users, no clear audience" to **"first 100 developers running Claude Code through DashClaw daily, with a locked-in flagship demo, a public dogfood flywheel, and a defined trigger for paid tier launch."**

---

## v1 Requirements

### Claude Code Integration (CCI)

Core beachhead surface. Everything else in v1 serves this.

- [ ] **CCI-01**: A developer can install DashClaw in front of Claude Code and get their first approval event through the dashboard in **under 5 minutes on a fresh machine**. Measured by a recorded end-to-end walkthrough.
- [ ] **CCI-02**: An opinionated default **coding-agent policy pack** ships with the integration: silently allow safe actions (git commits, git push to non-main branches, reading files, running tests), always block destructive actions (`rm -rf`, mass file deletion outside the repo, force-pushes to main), and require approval for ambiguous ones (network calls, package installs, editing files outside the current project).
- [ ] **CCI-03**: A developer can receive an approval request in **Discord**, approve or deny it from their phone in **under 10 seconds**, and the coding agent proceeds (or is blocked) accordingly. No browser required for the approval itself.
- [ ] **CCI-04**: A developer can open DashClaw and see a **readable, human-scale "what did my agent do today/this week" timeline** — commands run, files edited, approvals/denials, errors — not just a raw decision ledger. One glance communicates trust or alarm.
- [ ] **CCI-05**: Claude Code integration has **complete first-class documentation**: a dedicated page on dashclaw.io, a README section that leads the Getting Started flow, and at least one short screencast showing the install and the first Discord approval. No copy-paste snippets that don't work.

### Public Dogfood (DOG)

Pulls the Claude Code + Discord flow out of the GitHub issue comment and makes it the flagship demo.

- [ ] **DOG-01**: Wes **personally runs DashClaw daily against his own Claude Code workflow** for the entire milestone. This is an explicit commitment, not a vague intention — measured by DashClaw decision events in Wes's personal instance for ≥5 of 7 days per week.
- [ ] **DOG-02**: A **flagship demo video** (≤3 minutes) shows Wes's real setup end-to-end: Claude Code fires a risky command → Discord notification → approve from phone → Claude Code continues. Raw, no slides. Published publicly.
- [ ] **DOG-03**: Homepage **rewrite** leads with the Claude Code beachhead: hero headline, demo above the fold, `/connect` onboarding path rewritten for Claude Code users first. Rejected framings (homelab, enterprise compliance, governance-as-abstraction) removed from the hero.
- [ ] **DOG-04**: **Launch content**: public tweet thread, HN "Show HN", and at least one blog post on dashclaw.io explaining the problem, the demo, and the dogfood story. Timed with the homepage rewrite.

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

- [ ] **MON-01**: A **specific monetization trigger** is defined, written down in PROJECT.md, and publicly committed to. Candidate triggers: 500 WAU, 50 Claude Code integrations verifiably running in the wild, 20 hours/week of founder time on DashClaw, or first unsolicited "take my money" inbound message. Pick one, commit.
- [ ] **MON-02**: **Pro tier feature boundaries are designed** (which features will be paid, which stay free forever) and the code is architected to support the split — without shipping the paywall. When the trigger fires, flipping to paid is configuration, not a rewrite.

### Governance Runtime Bugfixes (BUG) *(ADDED 2026-04-11 after live dogfood bug discovery)*

Two stacked bugs caught during a `/gsd-progress` session when DashClaw's own pretool hook silently blocked a legitimate bash call with zero audit trail. These bugs directly contradict DashClaw's core value proposition (*"audit-ready decision trails"*) and make Phase 1 / Plan 01-03's dogfood proof mechanism structurally impossible until they fix. **They block Phase 2's Claude Code beachhead launch** — you cannot credibly ship "the control plane for coding agents" on a control plane that silently fails closed.

- [ ] **BUG-01**: The `"Secret Exposure Guard"` policy (`gp_178772c27d0f40e69240f82f`) in `POST /api/guard` runs a semantic classification step that is **erroring deterministically** on the hosted DashClaw instance. When it errors, the policy falls back to `decision: "block"` with reason string `"Secret Exposure Guard: Semantic check failed (fallback: block)"`. Root cause must be diagnosed (top suspect: `cd9dbaf5 chore: lazy openai, version env wiring` regression on the hosted Vercel instance, or a missing LLM provider API key), fixed, and verified by re-running the originally blocked command and confirming it no longer deterministic-blocks.
- [ ] **BUG-02**: `hooks/dashclaw_pretool.py:344 handle_block()` **never calls `create_action()`** before exiting with code 2. Every other decision handler (`handle_allow`, `handle_warn`, `handle_require_approval`) records the action. Blocks vanish into stderr with zero audit trail — directly contradicting *"audit-ready decision trails"*. Fix: record the blocked action via `create_action(context, status="blocked")` at the top of `handle_block`, ensure the server accepts `"blocked"` as a valid action status (extend enum if necessary), and verify the block appears in the decisions ledger at `/decisions` after firing. Also add a regression test on the block-audit path.

**Related but scoped out of this category**: `BUG-03` (founder is member-not-admin on own instance, can't approve/deny actions from the UI). Tracked as a separate follow-up — likely a Phase 1.5 Plan 2 or Phase 1.6.

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
| BUG-01 | Phase 1.5 — Governance Runtime Bugfix | Pending |
| BUG-02 | Phase 1.5 — Governance Runtime Bugfix | Pending |
| CCI-01 | Phase 2 — Claude Code Beachhead | Pending |
| CCI-02 | Phase 2 — Claude Code Beachhead | Pending |
| CCI-03 | Phase 2 — Claude Code Beachhead | Pending |
| CCI-04 | Phase 2 — Claude Code Beachhead | Pending |
| CCI-05 | Phase 2 — Claude Code Beachhead | Pending |
| DOG-02 | Phase 3 — Public Launch | Pending |
| DOG-03 | Phase 3 — Public Launch | Pending |
| DOG-04 | Phase 3 — Public Launch | Pending |
| MON-01 | Phase 3 — Public Launch | Pending |
| MON-02 | Phase 3 — Public Launch | Pending |
| FLY-01 | Phase 4 — Growth Flywheel | Pending |
| FLY-02 | Phase 4 — Growth Flywheel | Pending |
| FLY-03 | Phase 4 — Growth Flywheel | Pending |

**Coverage:**
- v1 requirements: 23 total (21 original + 2 added in Phase 1.5 insertion)
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 after live dogfood bug discovery (added BUG-01, BUG-02, Phase 1.5 insertion)*
