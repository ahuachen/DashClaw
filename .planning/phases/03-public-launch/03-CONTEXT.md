# Phase 3: Public Launch - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Pull the DashClaw beachhead out of private dogfood into public daylight. Ship the flagship ≤3-minute demo video, rewrite the homepage around the Claude Code beachhead, publish coordinated launch content (Show HN + tweet thread + blog post), commit publicly to a specific monetization trigger, and design (not ship) the Pro tier feature boundaries so flipping to paid is a config change.

**Requirements covered:** DOG-02, DOG-03, DOG-04, MON-01, MON-02.

**Explicitly out of scope for Phase 3:**
- The paywall itself (Pro code paths may be present but gated by a tier flag that never flips in this phase)
- Any Phase 4 "growth flywheel" agents (research agent, content drafting agent, public status page)
- Cursor / Aider / Devin / other-agent integrations (Pro-tier territory; stays off the free hero for now)

</domain>

<decisions>
## Implementation Decisions

### MON-01 — Monetization trigger

- **D-01:** Trigger is **50 verified Claude Code integrations in the wild**. Measurable via a SQL query over `agents` / `action_records` / org-count joined data. Founder-verifiable; not inflated by low-intent signups.
- **D-02:** **No time-boxed backstop.** The trigger fires when it fires. If it never fires, that's a product signal — not a reason to flip to paid just because time passed.
- **D-03:** **Commit the trigger publicly in four locations** (all four, not a pick-one):
  1. `PROJECT.md` — canonical source of truth (required by MON-01 spec language).
  2. `README.md` — visible on the GitHub repo landing; transparency signal.
  3. Homepage `/pricing` (or equivalent) — most public surface.
  4. Launch tweet thread + HN post body — embedded in launch content so it's literally part of the launch narrative.

### MON-02 — Pro tier boundaries (designed only, NOT shipped)

- **D-04:** **Single paid tier.** `Free` + `Pro`. No Business/Team tier upfront. Add later if MON-01 fires strong.
- **D-05:** **Free forever (core Claude Code beachhead + more than the minimum):**
  - Solo-dev Claude Code integration — hook, MCP `dashclaw_wait_for_approval`, `claude-code-starter` policy pack, `/activity`, `/my-agent`, the 5-minute install path.
  - Discord + Telegram approval flow — the <10s phone approval loop.
  - Single-user `/decisions` ledger + audit trail.
  - **Semantic guard (LLM-backed policy evals)** — stays free. DashClaw calls the user's own `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GUARD_LLM_KEY`, so the LLM cost lives on the user's bill, not DashClaw's. Keeping this free removes the "can I even evaluate my policies" gate.
- **D-06:** **Pro tier** (feature-flagged, not shipped this phase):
  - Multi-user orgs + SSO + role-based policies. Classic team-tier gate. `org_id` scoping already exists — flip-to-paid is seed-data/config, not refactor.
  - Custom policy pack authoring UI + versioning. `claude-code-starter` stays free; authoring your own packs is Pro.
  - Audit export + compliance reporting (SOC 2 friendly). Monthly signed bundles, SIEM export, retention policies.
  - Integrations beyond Claude Code (Cursor, Aider, Devin, custom SDKs). Phase 4 growth territory — Pro-gates the "governance layer for agents" broader positioning.
- **D-07:** **Code-split approach: feature flags via tier check middleware.** One `requireTier('pro')` middleware helper; Pro routes gated at handler level. Consistent with the project's existing middleware pattern. Flip-to-paid when MON-01 fires = seed-data/config change, not a refactor. NOT a separate `/pro/*` route tree, NOT a separate `@dashclaw/pro` npm package.

### DOG-02 — Flagship demo video (Claude's Discretion on style/hosting; direction locked)

- **D-08:** **Demo video = Phase 2 CCI-01 walkthrough, promoted to flagship.** Same recording session closes both Phase 2 open gaps (CCI-01 artifact, CCI-05 URL backfill) and delivers the Phase 3 flagship demo. Runbook already in `.planning/phases/02-claude-code-beachhead/02-01-SUMMARY.md` §5.
- **D-09:** Target **≤3:00 duration** (Phase 3 DOG-02 spec tightens the Phase 2 ≤5:00 number — trim the setup preamble for the public cut). Raw over polished. No slides. Real codebase, real phone tap, real Claude Code resume.
- **D-10:** **Hosting = Loom public (preferred) OR YouTube Unlisted.** Per Phase 2 RESEARCH §Pitfall 8: Loom's default "anyone with link" can gate behind a captcha for unauthenticated viewers — use Loom **"public"** visibility (not the default) OR switch to YouTube Unlisted. URL must load in an incognito browser with no captcha / no workspace-only auth wall.
- **D-11:** **Embedded locations:** homepage hero above-the-fold (primary), `/guides/claude-code` page, `README.md` top-of-file (replacing the `<SCREENCAST_URL>` placeholders currently in the 4 locations from Phase 2 03-01 plan).

### DOG-03 — Homepage rewrite + /connect

- **D-12:** **Hero voice = technical + terse.** Developer-reader-first. Evidence over decoration (`.impeccable.md` tiebreaker #1). Sample direction: `"The approval layer for Claude Code."` or `"Your coding agent, with a pause button."` Final exact copy TBD during planning/drafting — **voice is locked, precise wording is not.**
- **D-13:** **Remove from current hero (all four rejected framings):**
  - All homelab references, screenshots, examples.
  - Enterprise compliance language (SOC 2, ISO, audit-first framing, "your compliance team will love you"). Compliance is Pro-tier downstream, not the free hook.
  - Generic AI governance abstractions ("govern your AI stack", "control plane for agents", "policy-as-code for AI"). Be Claude-Code-specific.
  - Multi-agent platform positioning ("works with any agent framework"). Cursor/Aider/Devin are Pro territory — off the free hero.
- **D-14:** **CTA priority (top = most prominent):** `Watch demo → Install → Star on GitHub`. Video is the star. Watch first (no commitment), install if convinced, star as a social-proof ask once they're bought in.
- **D-15:** **`/connect` rewrite = single-page copy-paste runbook.** One page, top-to-bottom: paste this command → paste this workspace token → configure Discord bot in 3 steps → done. Auto-generate workspace token inline. Match the ≤5-minute target from the DOG-02 demo. NOT a multi-step wizard. NOT collapsible advanced sections.

### DOG-04 — Launch content + timing

- **D-16:** **Same-day blitz.** Homepage flip + tweet thread + HN post + blog post all live within a 2-hour window on launch day. Maximum coordinated attention. Accept single-shot risk — we're going for the signal, not hedging.
- **D-17:** **HN post timing: Tue–Thu, 8–11am ET.** Classic Show HN peak window. Avoids Mon (post-weekend backlog) and Fri (dead zone). Specific day to be picked at launch-ready time based on what's dominating the HN homepage that week.
- **D-18:** **Tweet thread tone = technical + specific + personal.** Founder voice. Sample direction: `"I got tired of Claude Code running rm -rf. Built DashClaw. Here's exactly how it works in 3 min."` Concrete problem → demo payoff → the 50-integration public monetization trigger as a closing commitment. Matches the homepage voice.
- **D-19:** **HN reply strategy: Wes-authored only, fast + honest.** Replies within 30min during peak window. No content-agent drafts (Phase 4 territory — the flywheel isn't built yet). Honest "that's a fair criticism" over defensive. Highest trust-building posture.
- **D-20:** **Blog post scope:** One blog post on `dashclaw.io`. Explains the problem (Claude Code + destructive actions), shows the demo, tells the dogfood story. Length/tone to match the homepage voice — technical + terse, no marketing copy. Pegged to the launch day; posted alongside or minutes before the HN post so the HN post can link to it.

### Claude's Discretion (planner + researcher + implementer call these during Phase 3 execution)

- Exact hero headline copy (voice and rejected-framings are locked; precise wording is TBD).
- Exact `/connect` runbook copy + the inline workspace-token-generation UX.
- Blog post exact title + paragraph structure (length/voice locked above).
- Tweet thread exact wording + image assets (tone locked above).
- Rollback plan if the homepage rewrite tanks — planner to include as a must-have (feature-flag the old homepage for 7 days? one-commit revert? acceptable to decide at plan time).
- Launch-window telemetry/analytics instrumentation (Vercel analytics check-in, Discord alert on new `/connect` completions, counter for "verified integrations" toward MON-01).
- The `/pricing` page structure and copy (one-paragraph monetization-trigger commitment is required; visual presentation is open).
- Exact demo video edit cuts (≤3:00, raw, no slides, real-hardware recording — that's locked; post-production choices are open).

</decisions>

<specifics>
## Specific Ideas

- **The video = the product.** The CTA order (`Watch demo → Install → Star`) treats the demo as the thing to ship, not a decoration. Every surface in Phase 3 references the demo.
- **Public-commitment wall around MON-01.** The trigger lives in PROJECT.md, README.md, /pricing, and both launch posts — so reneging costs reputation, not just a private retro. This is deliberate: a public commitment to "50 verified integrations" is a forcing function for Phase 4 growth work.
- **Closed-loop flywheel framing in the blog post.** Phase 4's "DashClaw-governed agents doing research + content to grow DashClaw" is the differentiator — the blog post should seed this narrative (without launching those agents yet). Mention the intent, point at the public status page that will exist in Phase 4.
- **"Free forever" guardrail.** The Free tier includes the semantic guard + Discord/Telegram + audit ledger — it's not a crippled tier. This is deliberate: low-willingness-to-pay users get real value, and Pro is for team/compliance use cases that actually justify billing.
- **Transparency posture** (`.impeccable.md` aesthetic + the public monetization trigger) is the voice of the phase. Hero, /connect, blog post, tweet thread, HN post should all feel like they were written by the same person on the same afternoon — terse, technical, specific, honest about what's free and what's coming.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 2 carryover (demo video + docs placeholders)
- `.planning/phases/02-claude-code-beachhead/02-01-SUMMARY.md` §5 — Walkthrough recording runbook (Discord bot registration, env vars, throwaway workspace, recording checklist, publishing checklist). Phase 3 03-01 executes this runbook for the flagship video.
- `.planning/phases/02-claude-code-beachhead/02-03-SUMMARY.md` §handoff — 4 `<SCREENCAST_URL>` literal placeholders across `README.md` (lines ~8 + ~19) and `app/guides/claude-code/page.js` (lines ~104 raw + ~249 HTML-entity-encoded). Phase 3 03-01 backfills these after the demo URL is published.
- `.planning/phases/02-claude-code-beachhead/02-VERIFICATION.md` — Phase 2 close state, threat model verification, info-level pre-existing hex finding at `app/guides/claude-code/page.js:204`.

### Phase 3 requirements + roadmap
- `.planning/REQUIREMENTS.md` DOG-02, DOG-03, DOG-04, MON-01, MON-02 — acceptance criteria for each requirement.
- `.planning/ROADMAP.md` §Phase 3 — goal, success criteria, plan breakdown (3 plans).
- `.planning/PROJECT.md` — core value, governance boundary, rejected framings from Phase 1 discovery (homelab, enterprise compliance, generic AI governance).

### Design + voice
- `.impeccable.md` — brand orange as signal not noise, CSS tokens only, 4 anti-references, 7 tiebreaker principles, WCAG 2.1 AA floor, developer-reader-first. Homepage rewrite + `/pricing` page must honor all seven tiebreakers.
- `app/globals.css` — CSS tokens. NEVER hardcode hex. Pre-existing `bg-[#0a0a0a]` at `app/guides/claude-code/page.js:204` is an info-level carryover from commit `936a2030` — not introduced by Phase 3, but Phase 3 should not add new instances.
- `CLAUDE.md` §Design Context — enforces `.impeccable.md` as hard gate on UI/copy/marketing changes.

### Existing code Phase 3 will touch
- `app/page.js` — current homepage. DOG-03 rewrites the hero.
- `app/connect/page.js` (or `app/connect/*` segment — check file tree) — current `/connect` onboarding. DOG-03 rewrites as single-page runbook.
- `app/pricing/page.js` — may not exist yet. MON-01 requires a `/pricing` surface for the public commitment. Planner decides whether to reuse an existing surface (e.g., add a section to homepage) or ship a dedicated `/pricing` page.
- `README.md` — MON-01 public commitment + DOG-02 demo URL backfill + DOG-03 Claude-Code-first lead already in place from Phase 2.
- `PROJECT.md` — MON-01 canonical commitment location.

### Governance + auto-regenerated docs (never hand-edit)
- `app/lib/doctor/generated/*`, `public/livingcode/index.html`, `public/downloads/dashclaw-platform-intelligence*` — regenerated by `npm run livingcode:refresh` via pre-commit hook.
- `docs/api-inventory.md`, `docs/api-inventory.json`, `docs/openapi/critical-stable.openapi.json` — auto-regenerated; route/SDK additions trigger updates.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Phase 2 `/my-agent` + `/activity` + `/guides/claude-code`** — shipped 2026-04-22. The demo video + homepage can confidently link at these without worrying about them being half-baked.
- **Telegram approval parity as the Discord template** — both now exist. Homepage can show "Discord OR Telegram" as the approval option without caveat.
- **`useRealtime` hook + `useAgentFilter` context** — already power `/my-agent`. Any launch-window analytics counter (e.g., "integrations in the wild: N / 50") can reuse these primitives.
- **`claude-code-starter` policy pack** — shipped Plan 02-01 (2026-04-21). Installable with one command. Demo points at this as "the default governance for coding agents."

### Established Patterns

- **Middleware tier-check pattern for MON-02 `requireTier('pro')`.** Mirror the existing admin-gating middleware (`getOrgRole(request) !== 'admin'` 403 pattern at multiple `/api/*` routes). Extend with a `tier` column / config check.
- **SDK docs checklist discipline.** Any new route (e.g., `/api/tier/*` for MON-02 middleware, `/api/pricing` if /pricing is a data page) must update the 6 SDK doc files per CLAUDE.md memory.
- **Content-voice consistency across pages.** Homepage + `/connect` + `/guides/claude-code` + README + blog post all need the same terse-technical voice. Planner should treat voice as a cross-cutting constraint, not a per-page concern.

### Integration Points

- **DashClaw SDK `dashclaw` npm 2.11.1** — no SDK method changes needed for Phase 3 (no new governance features being added). Plan 03-03 MON-02 may design Pro-tier SDK method gating but does not ship it.
- **NextAuth + local-admin session dual auth** — already handled by `getViewerContextFromCookieHeader` (recent fix at `d3e96819`). Tier check middleware can compose on top; no auth layer changes.
- **Analytics** — Vercel Web Analytics already available per `.env.example:108` (`NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS`). Launch-window metrics ride this; no new analytics stack.

</code_context>

<deferred>
## Deferred Ideas

- **Live sandbox / no-install demo** — came up briefly when discussing CTA options. Out of scope for Phase 3 (would be a new capability; touches infra cost and security). Backlog candidate.
- **Pro-tier paywall actually shipping** — explicitly deferred per MON-02 spec language. MON-02 designs the boundaries; PAY-01 (separate requirement in REQUIREMENTS.md) ships the paywall when MON-01 fires.
- **Phase 4 growth flywheel agents (research + content + public status page)** — referenced by the blog post narrative but explicitly out-of-scope for Phase 3. Phase 4 builds them.
- **Cursor / Aider / Devin / other-agent integrations** — D-06 locks these as Pro territory; NOT in Phase 3 scope (free hero stays Claude-Code-specific). Backlog for post-MON-01.
- **Enterprise compliance deep-dive content (SOC 2 explainer, audit trail whitepaper)** — Pro-tier content; Phase 3 removes this framing from the free hero. Reintroduce in Pro-tier marketing after MON-01 fires.
- **Content-agent-drafted HN reply queue (Phase 4)** — came up in DOG-04 HN reply strategy discussion. Rejected for Phase 3 (flywheel not built). Belongs in Phase 4.
- **`/pricing` structured price table** — Phase 3 ships a `/pricing` surface as a **monetization-trigger commitment page**, not a traditional SaaS pricing table. Full pricing (Free $0 / Pro $X) waits for PAY-01. Deferred.

</deferred>

---

*Phase: 03-public-launch*
*Context gathered: 2026-04-22*
*Carries forward Phase 2 deferred gaps (CCI-01 walkthrough recording + CCI-05 URL backfill) — both closed by D-08 / D-11 when Plan 03-01 executes the recording runbook.*
