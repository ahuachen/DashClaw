---
phase: 03-public-launch
plan: 01
subsystem: video-homepage-connect
tags: [dog-02, dog-03, homepage, connect, flagship-video, launch, deferred-close]

# Dependency graph
requires:
  - phase: 02-claude-code-beachhead
    provides: README Claude-Code-first lead + `/guides/claude-code` walkthrough page + `<SCREENCAST_URL>` placeholders (02-03); CCI-01 walkthrough recording + CCI-05 URL backfill left deferred (02-01)
provides:
  - DOG-03 homepage hero rewrite + `/connect` single-page runbook + CSP frame-src directive (shipped `3eaa013d` + `a33bada7`)
  - `VideoHero` component with Loom + YouTube-nocookie host allowlist (T-03-01-04 SSRF mitigation)
  - `scripts/check-screencast-backfilled.mjs` guardrail handling raw + HTML-entity-encoded forms
  - 4 new Wave-0 unit test files; full-suite baseline 1752 pass / 5 skip / 0 fail
  - Phase 3 CCI-01 / CCI-05 / DOG-02 walkthrough recording left deferred (same hard-gate as Phase 2 02-01 close)
affects: [DOG-02, DOG-03, CCI-01, CCI-05, Phase-3-launch, Phase-2-open-gaps]

# Tech tracking
tech-stack:
  added: []  # Zero new npm deps — iframe embed is native HTML + CSS tokens
  patterns:
    - "Allowlist-gated iframe wrapper (`VideoHero`) — throws at render time on any host not in `{loom.com, youtube-nocookie.com}` — mitigates T-03-01-04 SSRF at the React layer before CSP ever fires"
    - "Dual-form placeholder-backfill script — regex handles both raw `<SCREENCAST_URL>` and HTML-entity `&lt;SCREENCAST_URL&gt;` forms; mirrors the Phase 2 02-01-SUMMARY §3 warning against naive single-form grep"
    - "Deferred-close pattern (second instance) — ship shippable portion, record deferred artifact as Open Gap with explicit close preconditions and cross-reference to any sibling gap that closes in the same future session"

key-files:
  created:
    - app/components/VideoHero.jsx (iframe wrapper with Loom + youtube-nocookie host allowlist)
    - scripts/check-screencast-backfilled.mjs (dual-form placeholder guardrail)
    - __tests__/unit/video-hero.test.jsx (allowlist + a11y assertions)
    - __tests__/unit/homepage-hero.test.jsx (iframe presence, Claude Code headline, CTA order, ≤60 chars)
    - __tests__/unit/homepage-rejected-framings.test.jsx (9 negative assertions per D-13)
    - __tests__/unit/connect-runbook.test.jsx (no wizard; 3 runbook elements; HostedProvisionSection preserved)
    - .planning/phases/03-public-launch/03-01-SUMMARY.md (this file)
  modified:
    - app/page.jsx (renamed from app/page.js — hero rewrite, VideoHero embed, CTA order Watch→Install→Star)
    - app/connect/page.jsx (renamed from app/connect/page.js — single-page runbook, HostedProvisionSection preserved)
    - next.config.js (CSP frame-src directive permitting loom.com + youtube-nocookie.com — T-03-01-01 mitigation)
    - docs/client-setup-guide.md (broken-link fix adjacent to /connect edits)
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Operator deferred Task 3 walkthrough recording + Task 4 URL backfill at the human-action checkpoint with resume-signal `ship placeholder again`. This mirrors Phase 2 Plan 02-01's deferred-close pattern exactly — DOG-03 (homepage + /connect + CSP + tests) ships complete in commits `3eaa013d` + `a33bada7`; DOG-02 (walkthrough artifact) and the 5 placeholder locations are recorded as Open Gaps with close preconditions."
  - "VideoHero hostname allowlist enforced at React render time (throws on any host not in `{loom.com, youtube-nocookie.com}`), not only at CSP layer — T-03-01-04 mitigation is belt-and-suspenders."
  - "CSP frame-src directive added AFTER existing `frame-ancestors 'none'` — these are separate directives (frame-ancestors governs who can frame us; frame-src governs who we can frame). Pitfall 3 avoided."
  - "Pre-existing `bg-[#0a0a0a]` at `app/guides/claude-code/page.js:204` deliberately untouched — surgical-change rule (Pitfall 7) preserved across this plan despite proximity to placeholder-backfill edits at lines 104 and 249."
  - "Phase 2 CCI-01 walkthrough + CCI-05 URL backfill + Phase 3 DOG-02 walkthrough collapse into a single future recording session — one ≤3:00 walkthrough + one atomic backfill commit closes all three open gaps simultaneously (see section 4)."
  - "Hero VideoHero placeholder src (`https://www.loom.com/embed/PLACEHOLDER_VIDEO_ID`) renders a broken iframe until backfilled. This makes **the production homepage unshippable to dashclaw.io until the recording lands** — hard-gates 03-02's Show HN blitz (Pitfall 1 — URL-change after HN submission kills rank)."

patterns-established:
  - "Allowlist-gated iframe host wrapper component — reusable for any future third-party embed"
  - "Dual-form placeholder sentinel + guardrail script — reusable pattern for any staged content backfill"

requirements-completed: [DOG-03]
requirements-partial: [DOG-02]

# Metrics
duration: 30min  # Writeup + state rollup only; Tasks 1-2 shipped in prior session commits 3eaa013d + a33bada7
completed: 2026-04-22
---

# Phase 03 Plan 01: Video + Homepage + /connect Summary (Deferred Close)

**DOG-03 homepage hero rewrite + `/connect` single-page runbook + CSP frame-src directive + `VideoHero` component + 25 new tests SHIPPED in commits `3eaa013d` + `a33bada7` (full suite 1752 pass / 5 skip / 0 fail). DOG-02 flagship video recording + the 5 placeholder backfill locations DEFERRED at Task 3 human-action checkpoint per operator resume-signal `ship placeholder again`. This mirrors Phase 2 Plan 02-01's deferred-close pattern — the technical infrastructure ships now; the evidence artifact waits for the same future recording session that closes Phase 2 CCI-01 + CCI-05.**

## Close State At A Glance

| Success Criterion | Status | Evidence |
|---|---|---|
| DOG-03 homepage hero rewrite (Claude Code headline ≤8 words, video embed, CTA order Watch→Install→Star) | **COMPLETE** | Commit `a33bada7`; headline "Govern Claude Code before it runs rm -rf." (47 chars / 8 words); 9 negative framings asserted absent; CTA order verified |
| DOG-03 `/connect` single-page runbook (D-15) | **COMPLETE** | Commit `a33bada7`; linear 3-step copy-paste (clone+hooks:install → workspace token inline → Discord + Verify); HostedProvisionSection preserved; no wizard state machine |
| DOG-03 CSP frame-src permitting loom.com + youtube-nocookie.com | **COMPLETE** | Commit `3eaa013d`; `next.config.js` csp array |
| DOG-03 `VideoHero` component with host allowlist | **COMPLETE** | Commit `3eaa013d`; throws on any host not in `{loom.com, youtube-nocookie.com}` — T-03-01-04 |
| DOG-03 full test suite green | **COMPLETE** | 1752 pass / 5 skip / 0 fail (baseline 1727 + 25 new Wave-0 tests) |
| DOG-03 static guardrails held | **COMPLETE** | lint, route-sql:check, openapi:check, api:inventory:check, docs:check, check-readme-lead.mjs all green |
| DOG-02 flagship ≤3:00 walkthrough recorded + published | **DEFERRED** | Operator resume-signal `ship placeholder again` — no Loom/YouTube URL captured; no recording artifact exists |
| Task 4: 5 placeholder locations backfilled (4 `<SCREENCAST_URL>` + 1 `PLACEHOLDER_VIDEO_ID`) | **SKIPPED** | Depends on DOG-02 URL; `check-screencast-backfilled.mjs` reports 4 remaining; VideoHero src reports 1 placeholder |
| Manual incognito verification of hero video iframe | **BLOCKED** | Cannot verify with placeholder embed URL; hard-gates 03-02 HN submission |

## 1. DOG-03 Homepage Rewrite — COMPLETE

**Commit `a33bada7` shipped:**

- **Hero headline:** `"Govern Claude Code before it runs rm -rf."` (47 chars, 8 words — exactly at D-12's ≤8 limit; terse-technical voice locked)
- **VideoHero embedded above-fold** with placeholder src `"https://www.loom.com/embed/PLACEHOLDER_VIDEO_ID"` — iframe renders but the video host will serve a broken-iframe state until backfilled
- **CTA order (D-14):** Watch demo → Install (`href="/connect"`) → Star on GitHub (`href="https://github.com/ucsandman/DashClaw"` + `target="_blank"` + `rel="noopener noreferrer"`)
- **9 rejected-framings negative assertions pass** (D-13): zero matches for `homelab`, `SOC 2`, `SOC2`, `compliance team`, `control plane for agents`, `policy-as-code for AI`, `works with any agent framework`, `enterprise compliance`, `policy firewall for AI agents` in rendered HTML
- **Renamed** `app/page.js` → `app/page.jsx` (JSX-bearing file extension matches vitest oxc parser expectation per 02-03 lesson)

## 2. DOG-03 `/connect` Single-Page Runbook — COMPLETE

**Commit `a33bada7` shipped:**

- **Preserved** HostedProvisionSection (inline workspace-token provisioning — the UX D-15 actually wants)
- **Removed** wizard framing (no "Step N of M", no step tabs, no collapsible advanced sections)
- **Three runbook elements** top-to-bottom: (1) `npm install` + `DASHCLAW_API_KEY` env, (2) workspace token paste (auto-generated inline by HostedProvision), (3) Discord bot + Verify
- **Renamed** `app/connect/page.js` → `app/connect/page.jsx`
- **Broken-link fix** in `docs/client-setup-guide.md` — adjacent one-line repair while touching the /connect tree

## 3. DOG-02 Flagship Walkthrough — DEFERRED

**Status:** Not recorded this cycle. Operator deferred at Task 3's human-action checkpoint with explicit resume-signal **`ship placeholder again`**.

**Why deferred** (same structural gap as Phase 2 Plan 02-01):
- Discord bot registration is the recording precondition (not an env-var gap this time — the bot itself needs to be stood up in the Developer Portal, the 5 `DISCORD_*` env vars populated in `.env.local`, and the Interactions Endpoint URL handshake confirmed green)
- Recording a walkthrough that terminates at "Discord DM never arrived because the bot isn't registered" or "Interactions endpoint PING never succeeded" would document a broken path, not the ≤3:00 aha moment DOG-02 targets

**Pre-flight from Task 2's `<what-built>` block (infrastructure ready):**

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | VideoHero component accepts a Loom/YouTube URL | READY | `app/components/VideoHero.jsx` — allowlist-gated |
| 2 | Homepage hero embedding VideoHero with placeholder src | READY | `app/page.jsx:59` — literal `PLACEHOLDER_VIDEO_ID` awaits real URL |
| 3 | `/connect` rewritten as single-page runbook | READY | `app/connect/page.jsx` ships D-15-compliant |
| 4 | CSP `frame-src` permits Loom + YouTube | READY | `next.config.js` — confirmed via grep |
| 5 | 4 `<SCREENCAST_URL>` placeholders staged | READY | Still present — script reports 4 remaining |
| 6 | `scripts/check-screencast-backfilled.mjs` guardrail | READY | Handles both raw + HTML-entity forms |

## 4. Task 4 URL Backfill — SKIPPED

**Status:** Task skipped per plan's resume-signal handling for `ship placeholder again`. Cannot backfill without a recorded walkthrough's EMBED_URL + WATCH_URL.

**Exact placeholder locations (5 total — verified 2026-04-22 23:03 local):**

| # | File | Line | Form | Context |
|---|---|---|---|---|
| 1 | `app/page.jsx` | 59 | `https://www.loom.com/embed/PLACEHOLDER_VIDEO_ID` | VideoHero `src` in hero above-fold — iframe currently renders broken until backfilled |
| 2 | `README.md` | 8 | `<SCREENCAST_URL>` raw | `<a href>` wrapping `public/images/demo-gif2.gif` (D-17 click-through pattern) |
| 3 | `README.md` | 19 | `<SCREENCAST_URL>` raw | "Watch the 3-min walkthrough →" text link |
| 4 | `app/guides/claude-code/page.js` | 104 | `<SCREENCAST_URL>` raw | Step 1 "Watch the 3-minute walkthrough" note text |
| 5 | `app/guides/claude-code/page.js` | 249 | `&lt;SCREENCAST_URL&gt;` (HTML-entity) | Dedicated "Watch the 3-minute walkthrough" section body |

**Important:** Location 5 is HTML-entity-encoded (`&lt;SCREENCAST_URL&gt;`). A naive single-form grep misses it. `scripts/check-screencast-backfilled.mjs` handles both forms and is the single source of truth for "are all placeholders closed?"

**Backfill procedure when walkthrough is recorded** (atomic single-commit recovery — mirrors Phase 2 02-01-SUMMARY §3):

```bash
# 1. Enumerate — expect exactly 5 matches (1 PLACEHOLDER_VIDEO_ID + 3 raw <SCREENCAST_URL> + 1 HTML-entity &lt;SCREENCAST_URL&gt;)
node scripts/check-screencast-backfilled.mjs      # reports 4
grep -n "PLACEHOLDER_VIDEO_ID" app/page.jsx       # reports 1

# 2. Replace all 5 with the real URLs:
#    - app/page.jsx:59            → EMBED_URL  (iframe src — /embed/ form required)
#    - README.md:8, 19            → WATCH_URL  (user-clickable anchor hrefs — /share/ or /watch?v= form)
#    - app/guides/claude-code/page.js:104   → WATCH_URL (raw form)
#    - app/guides/claude-code/page.js:249   → WATCH_URL (HTML-entity form — replace full &lt;SCREENCAST_URL&gt; token)

# 3. Verify zero matches remain
node scripts/check-screencast-backfilled.mjs      # exits 0
grep -n "PLACEHOLDER_VIDEO_ID" app/page.jsx       # no output

# 4. Re-run full suite + guardrails
npm test -- --run                                 # 1752+ pass, 0 fail
node scripts/check-readme-lead.mjs                # exits 0
npm run lint && npm run route-sql:check && npm run openapi:check && npm run api:inventory:check && npm run docs:check

# 5. Manual incognito re-verification (step 7 from Task 4 original plan)
#    Load dashclaw.io in incognito from phone hotspot → iframe renders, video plays, zero CSP violations in DevTools console

# 6. Atomic single commit
git commit -m "docs(03-01): backfill CCI-05 screencast URLs + flip VideoHero to live video (DOG-02)"
```

## 5. Phase 2 Open Gap Consolidation

The **same future recording session** closes three gaps across two phases:

| Gap | Source phase | Source plan | Close artifact |
|---|---|---|---|
| CCI-01 (walkthrough recording) | Phase 2 | 02-01 | ≤5:00 Windows/WSL recorded walkthrough |
| CCI-05 (screencast URL backfill — 4 `<SCREENCAST_URL>` locations) | Phase 2 | 02-01 → extended by 03-01 | Single backfill commit |
| DOG-02 (flagship ≤3:00 walkthrough + hero video embed backfill) | Phase 3 | 03-01 | Same recording; same single backfill commit (now 5 locations — 1 extra VideoHero src) |

**Collapsed close path:** record one ≤3:00 walkthrough (tighter than Phase 2's ≤5:00 ceiling — D-09), publish once, run the backfill procedure in section 4 above → all three gaps close in a single atomic commit. Estimated total time to close all three: ~45 minutes (Discord bot setup 10 min + recording 5 min + review/re-record buffer 10 min + backfill + publish + incognito verify 20 min).

## 6. Hard-Gate For 03-02 — Homepage Not Shippable Until Recording Lands

**Critical:** The hero's VideoHero currently renders with `src="https://www.loom.com/embed/PLACEHOLDER_VIDEO_ID"` — a broken iframe state. **The production homepage at dashclaw.io therefore cannot ship publicly until the recording + backfill lands.** This directly hard-gates Phase 3's launch sequencing:

- **03-02 (Show HN + tweet thread + blog post) cannot execute** until this backfill closes. Pitfall 1 (HN URL-change after submission kills rank) means 03-02's publication task is blocked on a working homepage.
- DOG-04 (launch blitz) chains off DOG-02 + DOG-03 both being live. DOG-03 ships today; DOG-02 is the remaining blocker.
- Treat this as Wave 1's deferred gate — 03-02 does not start until section 4's backfill procedure has run and manual incognito verification passes.

## 7. Next Action For Wes

When ready to close the three open gaps:

1. **Register Discord bot** (one-time, ~10 min):
   - https://discord.com/developers/applications → New Application
   - Bot tab → Reset Token → copy `DISCORD_BOT_TOKEN`
   - General Information → copy `APPLICATION ID` (=`DISCORD_APPROVER_ORG_ID` slot) + `PUBLIC KEY` (=`DISCORD_PUBLIC_KEY`)
   - OAuth2 → URL Generator → `bot` + `applications.commands` scopes → install to throwaway server
   - Desktop client → User Settings → Advanced → Developer Mode ON → right-click own name → Copy User ID (=`DISCORD_APPROVER_USER_ID`)
   - Populate all 5 vars in `.env.local` (see `.env.example`)
   - Developer Portal → Interactions Endpoint URL → `https://<deployment>/api/discord/interactions` → Save (wait for green checkmark)

2. **Pre-flight env sanity check** (per Pitfall 4 — BUG-04 lesson):
   ```bash
   echo $DASHCLAW_BASE_URL     # must NOT be http://localhost:3000
   curl -s $DASHCLAW_BASE_URL/api/health | jq .version  # must NOT be "demo"
   ```
   Close any `dashclaw-demo` Docker container before recording.

3. **Record ≤3:00 walkthrough** on Windows/WSL (tighter than Phase 2's ≤5:00 per D-09):
   - Follow the 9-segment recipe in `.planning/phases/02-claude-code-beachhead/02-01-PLAN.md` Task 2 `<what-built>` block
   - Trim setup preamble for the public cut (≤3:00 target)
   - Raw over polished. No slides. Real codebase. Real phone tap. Real Claude Code resume.
   - **Scrub every frame for secrets** (`DISCORD_BOT_TOKEN`, `DASHCLAW_API_KEY`, etc. — T-03-01-05 mitigation)

4. **Publish + verify incognito** (D-10 + Pitfall 2):
   - Loom → visibility **Public** (not the default "anyone with link") OR YouTube → **Unlisted**
   - Capture:
     - `EMBED_URL` (iframe form): Loom `https://www.loom.com/embed/<id>` OR YouTube `https://www.youtube-nocookie.com/embed/<id>`
     - `WATCH_URL` (anchor href form): Loom `/share/` OR YouTube `/watch?v=`
   - Verify in incognito from **phone hotspot** (different IP): URL loads, no captcha, no workspace-auth wall, video plays

5. **Run the backfill procedure** (section 4 above) — single atomic commit.

6. **Manual incognito re-verification on dashclaw.io** after deploy: hero iframe renders, video plays, zero CSP violations in DevTools console. **This check unblocks 03-02's Show HN submission.**

7. **Mark CCI-01 + CCI-05 + DOG-02 fully closed** — the phase verifier updates REQUIREMENTS.md traceability + Open Gaps sections.

## Task Execution Record

| Task | Status | Commit | Notes |
|---|---|---|---|
| Task 1 — Wave-0 scaffolds + VideoHero + CSP + check script (RED) | PASSED | `3eaa013d` | `test(03-01)` — VideoHero passes; 3 other test files RED by design until Task 2 GREENs them |
| Task 2 — Homepage + /connect rewrite (GREEN) | PASSED | `a33bada7` | `feat(03-01)` — all 4 Wave-0 test files GREEN; full suite 1752/5/0; all static guardrails clean |
| Task 3 — Record walkthrough + publish + incognito verify (human-action) | DEFERRED | — | Resume-signal `ship placeholder again`; Discord bot not yet registered |
| Task 4 — Backfill 4 `<SCREENCAST_URL>` + flip VideoHero src + full-suite verify | SKIPPED | — | Cannot backfill without URL; skipped per resume-signal. 5 placeholder locations remain |

**Plan metadata commit:** this SUMMARY + STATE + ROADMAP + REQUIREMENTS update is the final commit for Plan 03-01.

## Deviations from Plan

### None (resume-signal handled per plan spec)

The plan's `<resume-signal>` block at Task 3 explicitly defined `ship placeholder again` as a valid operator response, with the downstream handling: "skip Task 4 backfill". This SUMMARY honors that path exactly — DOG-03 ships complete, DOG-02 + Task 4 deferred, Phase 3 Plan 03-01 closes with open gaps recorded rather than silently skipped. This is the plan executing as designed, not a deviation.

## Authentication Gates

None encountered during execution. The Task 3 human-action checkpoint is not an auth gate — it is a designed human-only step (record video, publish to Loom/YouTube, verify incognito from phone hotspot) that cannot be automated.

## Threat Flags

No new security-relevant surface was introduced beyond the `<threat_model>` in the PLAN. All four active mitigations landed in the shipped commits:

| Threat | Mitigation status |
|---|---|
| T-03-01-01 (CSP gap) | **MITIGATED** — `frame-src 'self' https://www.loom.com https://www.youtube-nocookie.com` added to `next.config.js` csp array (commit `3eaa013d`). Browser incognito re-verification deferred until after recording. |
| T-03-01-02 (HN URL-change penalty) | **GATED** — homepage unshippable until backfill (section 6); 03-02 blocked on this check. |
| T-03-01-03 (rejected framings leak) | **MITIGATED** — `homepage-rejected-framings.test.jsx` asserts 9 negative patterns absent (full suite green in `a33bada7`). |
| T-03-01-04 (SSRF via iframe src) | **MITIGATED** — `VideoHero` component throws on any host not in `{loom.com, youtube-nocookie.com}`; `video-hero.test.jsx` asserts throw behavior (commit `3eaa013d`). |
| T-03-01-05 (secrets in recorded frames) | **DEFERRED** — guidance captured in section 7 step 3; activated when recording happens. |
| T-03-01-06 (HTML-entity placeholder missed) | **MITIGATED** — `scripts/check-screencast-backfilled.mjs` handles both raw + HTML-entity forms (commit `3eaa013d`). |
| T-03-01-07 (clickjacking) | **ACCEPTED** — pre-existing `X-Frame-Options: DENY` + `frame-ancestors 'none'` unchanged by this plan. |

## Known Stubs

| Stub | File | Line | Reason |
|---|---|---|---|
| `PLACEHOLDER_VIDEO_ID` in hero iframe src | `app/page.jsx` | 59 | Awaits EMBED_URL from deferred walkthrough recording. Hero renders broken iframe until backfilled. |
| `<SCREENCAST_URL>` raw | `README.md` | 8 | Awaits WATCH_URL from deferred recording; anchor href around demo-gif2.gif |
| `<SCREENCAST_URL>` raw | `README.md` | 19 | Awaits WATCH_URL; "Watch the 3-min walkthrough" text link |
| `<SCREENCAST_URL>` raw | `app/guides/claude-code/page.js` | 104 | Awaits WATCH_URL; Step 1 note text |
| `&lt;SCREENCAST_URL&gt;` HTML-entity | `app/guides/claude-code/page.js` | 249 | Awaits WATCH_URL; dedicated walkthrough section body |

All five stubs close atomically via the backfill procedure in section 4. Closure requires only a recorded video URL — no structural code change.

## Self-Check

Verify claims before closing:

- **SUMMARY file exists:** FOUND `.planning/phases/03-public-launch/03-01-SUMMARY.md` (this file)
- **Task 1 commit:** FOUND `3eaa013d test(03-01): add wave-0 scaffolds + VideoHero + CSP frame-src + placeholder-backfill script (RED)`
- **Task 2 commit:** FOUND `a33bada7 feat(03-01): rewrite homepage hero + /connect runbook (DOG-03)`
- **`scripts/check-screencast-backfilled.mjs`:** VERIFIED exit 1 — 4 `<SCREENCAST_URL>` placeholders remain at the exact 4 locations listed in section 4
- **`PLACEHOLDER_VIDEO_ID` in hero:** VERIFIED 1 match at `app/page.jsx:59`
- **Five placeholder locations intact:** VERIFIED total 5 (1 hero VideoHero src + 4 SCREENCAST_URL across README.md + app/guides/claude-code/page.js)
- **No walkthrough artifact created:** No `dog-02-walkthrough.mp4` file in `.planning/phases/03-public-launch/` — correctly absent per deferred state
- **No new code changes this session:** Files modified this session are limited to SUMMARY + STATE + ROADMAP + REQUIREMENTS — zero production code or test code touched in the close commit

## Self-Check: PASSED

---
*Phase: 03-public-launch*
*Completed: 2026-04-22 (deferred close — DOG-03 shipped; DOG-02 walkthrough + URL backfill deferred)*
*Next-session closure path: record walkthrough + atomic 5-location backfill; closes Phase 2 CCI-01 + CCI-05 + Phase 3 DOG-02 in one commit; unblocks 03-02 Show HN submission.*
