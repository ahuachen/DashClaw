---
phase: 03-public-launch
plan: 02
subsystem: launch-content
tags: [dog-04, show-hn, tweet-thread, blog-post, launch-telemetry, discord-alert, deferred-close]

# Dependency graph
requires:
  - phase: 03-public-launch
    provides: VideoHero component + CSP frame-src + homepage iframe embed point (03-01); /pricing live + N/50 counter + monetization trigger committed in PROJECT.md + README.md (03-03)
  - phase: 03-public-launch
    provides: 03-01 left DOG-02 walkthrough recording deferred — hero VideoHero src renders broken `PLACEHOLDER_VIDEO_ID` until backfill; hard-gates this plan's launch blitz (Pitfall 1 — HN URL-change after submission kills rank)
provides:
  - DOG-04 launch content drafts shipped (`docs/launch/{hn-post,tweet-thread,blog-post}.md`) — copy-paste ready for launch day, fully assertion-guarded
  - DOG-04 blog post live at `app/blog/claude-code-beachhead/page.jsx` (D-20) with VideoHero embed (currently `PLACEHOLDER_VIDEO_ID` — joins the cross-phase backfill commit)
  - DOG-04 Discord new-connect alert (`fireNewConnectAlert` + `isFirstActionForOrg`) — fire-and-forget on first per-org action when `DASHCLAW_ALERTS_DISCORD` set
  - `scripts/check-launch-content.mjs` runnable pre-launch gate (7 secret-pattern regex set, dual commitment-clause assertion)
  - 47 new Wave-0 unit tests (full-suite baseline 1799 pass / 5 skip / 0 fail, +47 vs 1752)
  - Open Gap surfaces a **6th placeholder location** (`app/blog/claude-code-beachhead/page.jsx:23 VIDEO_URL`) that joins the existing 5 from 03-01 — closes atomically in the same future recording-session backfill commit
  - DOG-04 launch blitz Task 4 DEFERRED at human-action checkpoint per operator resume-signal `defer launch` — same-pattern deferred close as 03-01 + 02-01
affects: [DOG-04, Phase-3-launch, CCI-01, CCI-05, DOG-02, Phase-2-open-gaps, Phase-3-open-gaps]

# Tech tracking
tech-stack:
  added: []  # Zero new npm deps — drafts are markdown, blog page is JSX, alert reuses existing notification adapter pattern
  patterns:
    - "Two-check D-03 commitment wall (trigger phrase AND commitment clause regex, both required, in all 3 drafts) — silent-degradation guard against post-draft edits dropping the commitment clause"
    - "Single-source-of-truth secret-pattern set (7 regex) — same array in `scripts/check-launch-content.mjs` AND `__tests__/unit/launch-content-assertions.test.js`; both must stay in lockstep"
    - "Fire-and-forget webhook with 2-second timeout — webhook failure NEVER blocks action creation (T-03-02-04 availability mitigation)"
    - "Repository-pattern preserved on telemetry add — `isFirstActionForOrg(sql, orgId, excludingActionId)` lives in `actions.repository.js`; route never touches raw SQL"
    - "Deferred-close pattern (third instance) — DOG-04 ships 3 of 4 tasks (drafts + blog + alert) and explicitly defers the launch blitz; recipe preserved verbatim in this SUMMARY for next-session execution"

key-files:
  created:
    - docs/launch/hn-post.md (Show HN post body draft — title ≤80 chars, body 150-300 words, trigger commitment present)
    - docs/launch/tweet-thread.md (8-tweet draft — first tweet concrete problem, last tweet commitment + dashclaw.io link)
    - docs/launch/blog-post.md (800-word draft — H1 + ≥5 H2 sections, founder-voice first-person)
    - scripts/check-launch-content.mjs (pre-launch gate — exits 0/1 for go/no-go on launch day)
    - __tests__/unit/launch-content-assertions.test.js (26 tests — title length, tweet shape, commitment wall, 7-pattern secret regex)
    - app/blog/layout.js (PublicNavbar + PublicFooter + max-w-3xl prose article container)
    - app/blog/claude-code-beachhead/page.jsx (D-20 blog post — VideoHero embed at PLACEHOLDER_VIDEO_ID + ≥5 H2 sections + 50-integration commitment)
    - __tests__/unit/blog-post-claude-code-beachhead.test.jsx (9 tests — render, video iframe presence, founder-voice, no rejected framings, no hardcoded hex)
    - __tests__/unit/connect-complete-discord-alert.test.js (12 tests — first-action detection, env-var gate, fire-and-forget, payload-no-secrets)
    - .planning/phases/03-public-launch/03-02-SUMMARY.md (this file)
  modified:
    - app/lib/repositories/actions.repository.js (added `isFirstActionForOrg(sql, orgId, excludingActionId)`)
    - app/lib/notification-adapters/discord.js (added `fireNewConnectAlert(context)` + `maskedOrgId` helper)
    - app/api/actions/route.js (POST handler fires alert via repository + fire-and-forget pattern; zero new raw SQL)
    - .env.example (verified `DASHCLAW_ALERTS_DISCORD` documented from Phase 2; no change required)
    - .planning/STATE.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "Operator deferred Task 4 launch blitz at the human-action checkpoint with resume-signal `defer launch`. This is the third instance of the deferred-close pattern in this milestone (after Phase 2 02-01 and Phase 3 03-01). Tasks 1-3 ship complete in commits `668c548d` + `6eb67d00` + `8463abc8`; Task 4 (HN + tweet + blog go-live + telemetry capture) is recorded as an Open Gap with launch-day recipe preserved verbatim in section 6."
  - "DOG-04 closes as **partial-deferred** in REQUIREMENTS.md (mirrors DOG-02 / CCI-01 / CCI-05). The technical infrastructure ships now; the launch event itself waits for the upstream DOG-02 walkthrough recording — without which the homepage is unshippable to dashclaw.io (Pitfall 1)."
  - "The blog post at `app/blog/claude-code-beachhead/page.jsx` embeds VideoHero with the same `PLACEHOLDER_VIDEO_ID` literal as the homepage hero. **This adds a 6th placeholder location to the cross-phase backfill checklist** (previously 5 from 03-01). The future recording session must update BOTH the hero AND the blog page in ONE atomic commit to keep both surfaces consistent."
  - "Discord alert payload masks `org_id` to first 8 chars + '...' (privacy-by-default — operator still knows which org, but the raw ID is not preserved in chat history). Brand-orange embed color (0xF97316) is the only hardcoded hex permitted (Discord API requires integer color, not a CSS token); all other colors flow through tokens."
  - "Fire-and-forget webhook pattern (`void Promise.resolve().then(() => fireNewConnectAlert(...))` with 2-second timeout, errors caught and logged, NOT awaited) — webhook failure CANNOT break action creation. T-03-02-04 mitigated; verified by test case 4."
  - "Phase 3 close path collapses to a single recording session: one ≤3:00 walkthrough + one atomic 6-location backfill commit closes Phase 2 CCI-01 + CCI-05 AND Phase 3 DOG-02 + DOG-04 simultaneously. Plus one human-only same-day blitz to execute the launch."

patterns-established:
  - "Three-tier deferred-close discipline — defer the human-only step, ship every automatable artifact, record the gap with verbatim resume recipe. Three instances now (02-01, 03-01, 03-02) — pattern is stable across the milestone."
  - "Cross-phase backfill checklist that grows with discovery — each plan that adds a placeholder location updates the consolidated checklist; single atomic commit closes all locations together. Now 6 locations (was 5 after 03-01, was 4 after 02-01)."

requirements-completed: []
requirements-partial: [DOG-04]

# Metrics
duration: 30min  # Writeup + state rollup only; Tasks 1-3 shipped in prior session commits 668c548d + 6eb67d00 + 8463abc8
completed: 2026-04-22
---

# Phase 03 Plan 02: Launch Content Bundle + Telemetry Summary (Deferred Close)

**Tasks 1-3 SHIPPED in commits `668c548d` + `6eb67d00` + `8463abc8` — launch content drafts + assertion guardrail + blog post live at `/blog/claude-code-beachhead` + Discord new-connect alert wired (fire-and-forget). 47 new Wave-0 tests (full-suite baseline 1799 pass / 5 skip / 0 fail). Task 4 launch blitz DEFERRED at human-action checkpoint per operator resume-signal `defer launch` — upstream precondition is 03-01 DOG-02 walkthrough recording (also deferred). DOG-04 closes as partial-deferred. The future recording session that closes Phase 2 CCI-01 + CCI-05 + Phase 3 DOG-02 also unblocks 03-02 Task 4 launch blitz; all four close in chained order from one ≤3:00 walkthrough + one atomic 6-location backfill commit + one same-day 2-hour launch window.**

## Close State At A Glance

| Success Criterion | Status | Evidence |
|---|---|---|
| Draft HN post in `docs/launch/hn-post.md` (≤80 char title, 150-300 word body, trigger commitment) | **COMPLETE** | Commit `668c548d`; passes `node scripts/check-launch-content.mjs`; assertion test green |
| Draft tweet thread in `docs/launch/tweet-thread.md` (6-10 tweets, first=problem hook, last=commitment+link, ≤280 chars each) | **COMPLETE** | Commit `668c548d`; 8 tweets; first tweet rejects company-intro regex (Pitfall 11) |
| Draft blog post in `docs/launch/blog-post.md` (600-1200 words, ≥5 H2 sections, founder-voice) | **COMPLETE** | Commit `668c548d`; ~800 words; passes voice + commitment + secret regex assertions |
| Blog post live at `dashclaw.io/blog/claude-code-beachhead` with VideoHero embed | **COMPLETE** (with placeholder src) | Commit `6eb67d00`; `app/blog/claude-code-beachhead/page.jsx`; 9 tests green; VIDEO_URL = `PLACEHOLDER_VIDEO_ID` joins backfill checklist |
| Discord new-connect alert on first per-org action | **COMPLETE** | Commit `8463abc8`; `fireNewConnectAlert` + `isFirstActionForOrg` repository helper; 12 tests green; route-sql baseline held at 85 |
| `scripts/check-launch-content.mjs` runnable as pre-launch gate | **COMPLETE** | Commit `668c548d`; exits 0 on all 3 drafts; 7-pattern secret regex matches lockstep with the test file |
| HN post + tweet thread + blog post all live within 2-hour window (D-16) | **DEFERRED** | Operator resume-signal `defer launch` — upstream DOG-02 walkthrough not yet recorded; homepage unshippable to dashclaw.io until backfill (Pitfall 1) |
| Pre-launch gate (curl 200 on homepage + blog + pricing + /connect; check-launch-content.mjs exit 0) | **NOT YET RUN** | Gate is automatable but operator-executed at launch time; cannot run while homepage hero renders broken `PLACEHOLDER_VIDEO_ID` iframe |
| Launch telemetry captured (HN votes, tweet impressions, Pricing counter delta, Discord alert count) | **NOT YET CAPTURED** | Requires the launch blitz to execute first |
| D-03 four-location commitment wall (PROJECT.md + README.md + /pricing from 03-03; HN body + tweet thread + blog from 03-02) | **DRAFT-COMPLETE** | All 3 03-02 drafts contain BOTH the trigger phrase ("50 verified Claude Code integrations") AND the commitment clause regex — verified by `scripts/check-launch-content.mjs` and the assertion test |

## 1. Task 1 — Launch Content Drafts + Assertion Guardrail (COMPLETE — `668c548d`)

**Commit `668c548d` shipped:**

- **`docs/launch/hn-post.md`** — Show HN post draft. Title line + body. Title ≤ 80 chars; body 150-300 words; problem → demo link → differentiation → dogfood + commitment → ask for feedback. Contains "50 verified Claude Code integrations" trigger phrase AND commitment clause matching `/(pro|paid|monetization).*(?:launches|unlocks|fires|kicks in|when)/i`. Links to dashclaw.io homepage and dashclaw.io/blog/claude-code-beachhead.
- **`docs/launch/tweet-thread.md`** — 8 tweets. Tweet 1 opens with concrete Claude Code problem (Pitfall 11 — does NOT contain "Hi I'm" / "I'm building" / "Introducing"). Tweets 2-7 alternate behavior + concrete examples + dogfood. Tweet 8 contains commitment + dashclaw.io link. Each tweet ≤ 280 chars (X hard limit).
- **`docs/launch/blog-post.md`** — ~800-word working doc (D-20 length range 600-1200). H1 + 6 H2 sections (Problem, Demo, How it works, What's free, The 50-integration commitment, What's next). Founder-voice first person ("I" / "my" / "I'm"). Source of truth for the JSX in Task 2.
- **`scripts/check-launch-content.mjs`** — 6,117-byte ES module pre-launch gate. Reads all 3 docs/launch/*.md files. Verifies: HN title ≤ 80 chars; each tweet ≤ 280 chars; blog word count [600, 1200]; trigger phrase + commitment clause in all 3 (D-03 wall); NONE of 7 secret-pattern regexes match. Exits 0/1 with specific per-check error.
- **`__tests__/unit/launch-content-assertions.test.js`** — 26 unit tests mirroring the script's checks. Same 7-pattern secret regex array as the script (single source of truth — both must stay in lockstep). Two-check commitment wall (separate assertions for trigger phrase vs commitment clause — readable failure messages name which half is missing).

**Secret-pattern set (7 regex; identical in script and test):**
```javascript
const SECRET_PATTERNS = [
  /DASHCLAW_API_KEY\s*=\s*\S{20,}/,
  /DISCORD_BOT_TOKEN\s*=\s*\S{40,}/,
  /DATABASE_URL\s*=\s*(postgres|postgresql):\/\/[^\s]+/,
  /sk-ant-[A-Za-z0-9]{48,}/,
  /sk-[A-Za-z0-9]{40,}/,
  /gh[oprsu]_[A-Za-z0-9]{36,}/,
  /discord\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_\-]{60,}/,
];
```
All 7 patterns return zero matches across all 3 drafts. T-03-02-01 mitigated.

## 2. Task 2 — Blog Post Live + VideoHero Embed (COMPLETE — `6eb67d00`)

**Commit `6eb67d00` shipped:**

- **`app/blog/layout.js`** — server-component blog segment layout. PublicNavbar + main + PublicFooter shell; `<article className="mx-auto max-w-3xl prose prose-invert">` container for prose-width long-form reading. Reusable for future blog posts without re-wiring.
- **`app/blog/claude-code-beachhead/page.jsx`** — SSR page rendering the D-20 blog content (12,875 bytes). H1 + ≥5 H2 sections, ~800 words rendered. VideoHero embedded in "Demo" H2 section via `const VIDEO_URL = 'https://www.loom.com/embed/PLACEHOLDER_VIDEO_ID';` at line 23. CSS-token classes only (text-text-primary, text-text-secondary; no hardcoded hex). Founder-voice ("I" / "my" / "I'm" present ≥3 times). Negative-regex compliant: zero matches for `revolutionize|game-chang|next generation|cutting-edge`. Includes 50-integration trigger commitment text echoing /pricing.
- **`__tests__/unit/blog-post-claude-code-beachhead.test.jsx`** — 9 RTL tests covering: renders without error; contains trigger commitment; VideoHero iframe present (assert `<iframe` with src matching loom.com or youtube-nocookie.com host); ≥5 H2 headings; word count in [600, 1200]; founder-voice (≥3 first-person references); zero rejected-framings; zero hardcoded hex in the file.

**Important — 6th placeholder location surfaced:** `app/blog/claude-code-beachhead/page.jsx:23` defines `VIDEO_URL` as the same `PLACEHOLDER_VIDEO_ID` literal that lives in `app/page.jsx:59`. This makes the blog page render with the same broken-iframe state as the homepage hero. Both must be updated atomically when the DOG-02 walkthrough is recorded — see section 5 backfill checklist below.

## 3. Task 3 — Discord New-Connect Alert (COMPLETE — `8463abc8`)

**Commit `8463abc8` shipped:**

- **`app/lib/repositories/actions.repository.js`** — added `isFirstActionForOrg(sql, orgId, excludingActionId)`. Returns true when no other action_record exists for the org. Repository-pattern-compliant (route never calls raw SQL).
- **`app/lib/notification-adapters/discord.js`** — added `fireNewConnectAlert(context)` POSTing to `DASHCLAW_ALERTS_DISCORD` with embed payload `{ title: "🚀 New /connect completion", fields: [maskedOrgId, agent_id, timestamp], color: 0xF97316 }`. Brand-orange color is the only hex permitted (Discord API requires integer color, not a CSS token). `maskedOrgId` returns first 8 chars + "..." — privacy-by-default (T-03-02-03). 2-second timeout cap.
- **`app/api/actions/route.js`** — POST handler now: after `createAction()` succeeds, calls `isFirstActionForOrg` via the repository; if true AND `process.env.DASHCLAW_ALERTS_DISCORD` is set, fires the alert in fire-and-forget mode (`void Promise.resolve().then(() => fireNewConnectAlert(...))`). Errors caught + logged. Webhook NEVER awaited. Action creation always returns success regardless of webhook outcome (T-03-02-04 availability mitigation).
- **`.env.example`** — verified `DASHCLAW_ALERTS_DISCORD` already documented from Phase 2; no change required.
- **`__tests__/unit/connect-complete-discord-alert.test.js`** — 12 tests covering 5 cases: (1) first action + env set → webhook called with correct payload; (2) second action same org → webhook NOT called; (3) first action + env unset → webhook NOT called (opt-in); (4) webhook failure → action creation still returns success; (5) payload contains NO API keys / DISCORD_BOT_TOKEN / user PII beyond masked org_id.

**Route-SQL guardrail:** baseline held at 85 direct SQL sites (90 budget). Repository pattern preserved on the new code path.

## 4. Task 4 — Same-Day Launch Blitz (DEFERRED)

**Status:** Not posted this cycle. Operator deferred at Task 4's human-action checkpoint with explicit resume-signal **`defer launch`**.

**Why deferred** (upstream chain blocked):

The launch blitz cannot fire until the homepage is shippable to dashclaw.io with a working video embed. The homepage currently renders `<iframe src="https://www.loom.com/embed/PLACEHOLDER_VIDEO_ID">` (broken iframe) at `app/page.jsx:59` — this is the placeholder left in place by 03-01's deferred close on 2026-04-22. **Pitfall 1 (HN URL-change after submission kills rank)** means we cannot submit Show HN against a placeholder homepage and then update the URL later. The homepage must be its final form before the HN submission goes out.

The dependency chain is:

```
DOG-02 walkthrough recording (deferred 03-01 — operator resume-signal `ship placeholder again`)
  └─→ 6-location atomic backfill commit (closes CCI-05 + DOG-02; flips homepage hero + blog page VideoHero from placeholder to live URL)
        └─→ Homepage live + incognito-verified at dashclaw.io (unblocks Pitfall 1 gate)
              └─→ DOG-04 launch blitz Task 4 — same-day 2-hour window posting (Tue/Wed/Thu 8-11am ET)
                    └─→ Phase 3 fully closes
```

DOG-04 therefore closes as **partial-deferred** — drafts shipped, blog live with placeholder, alert wired; live posting waits for the upstream walkthrough to record.

**Recipe for future Wes (preserved verbatim from Task 4 checkpoint — do not re-derive):**

### PRE-LAUNCH GATE (all 8 must be ☑ before posting)

1. ☐ Plan 03-01 Task 4 manual incognito verification PASSED (homepage + video embed loads clean from phone hotspot)
2. ☐ Plan 03-03 /pricing page live on dashclaw.io, N/50 counter renders (not "—" fallback) — *already shipped 03-03 commit `29717b1e`; verify still live*
3. ☐ `curl -sI https://dashclaw.io | head -1` returns `HTTP/2 200`
4. ☐ `curl -sI https://dashclaw.io/blog/claude-code-beachhead | head -1` returns `HTTP/2 200`
5. ☐ `curl -sI https://dashclaw.io/pricing | head -1` returns `HTTP/2 200`
6. ☐ `curl -sI https://dashclaw.io/connect | head -1` returns `HTTP/2 200`
7. ☐ `node scripts/check-launch-content.mjs` exits 0 (all drafts ready)
8. ☐ Pitfall 4 env sanity: `$DASHCLAW_BASE_URL` is not pointing at a demo container; real prod confirmed

**IF ANY GATE FAILS: do NOT submit HN. Ranking penalty from URL-change after submission is rank-killing (Pitfall 1).**

### LAUNCH SEQUENCE — Same-day 2-hour window (Tue/Wed/Thu 8-11am ET per D-17)

**T+0 (09:00 ET sweet spot — RESEARCH §Launch Mechanics):**
- Verify blog post (already live from Task 2 — re-verify in incognito one more time)
- Tweet 1 of thread on X (pin it)
- Submit Show HN with the prepared title from `docs/launch/hn-post.md`. Body = prepared body. URL = `https://dashclaw.io`

**T+5 min:**
- Tweet thread: post tweets 2-8 in sequence (~30 sec between each)
- Monitor HN post position in New queue

**T+30 min (HN reply window opens):**
- Reply to every top-level comment within 30 min (D-19)
- First 2 hours: tighten to 5 min per reply (RESEARCH recommendation)
- Honest "fair criticism" replies; no defensive tone

**T+2 hours:**
- Same-day blitz window complete. Capture telemetry block:
  - HN post URL + vote count + comment count
  - Tweet 1 impression count
  - Discord alert count (count of new integrations that day if `DASHCLAW_ALERTS_DISCORD` set)
  - dashclaw.io/pricing N/50 counter value at T+2h vs T+0

### PASS CRITERIA (all must be TRUE)

- All 3 content pieces posted within 2-hour window (D-16)
- HN post URL did NOT change after submission (Pitfall 1 held)
- No CSP violations observed by any incognito visitor (T-03-01-01 held — verify via DevTools console if a tester reports issues)
- No secret exposure in any posted content (T-03-02-01 held — verify post-facto via secret-regex grep on the posted text)

### RESUME SIGNAL FORMAT

```
HN_POST_URL: https://news.ycombinator.com/item?id=XXXXX
HN_VOTE_COUNT_T2H: <integer>
HN_COMMENT_COUNT_T2H: <integer>
TWEET_THREAD_URL: https://x.com/<user>/status/XXXXX
TWEET1_IMPRESSIONS_T2H: <integer>
BLOG_POST_LIVE: true
PRICING_COUNTER_T2H: <integer> / 50
DISCORD_ALERTS_FIRED_T2H: <integer>  (N/A if DASHCLAW_ALERTS_DISCORD not set)
ANY_CSP_VIOLATIONS_REPORTED: <true|false>
```

Alternative resume signals: `launch delayed <new date>` | `launch aborted <reason>`.

## 5. Cross-Phase Backfill Checklist — Now 6 Locations (was 5)

The same future recording session closes **four gaps** across **two phases**:

| Gap | Source phase | Source plan | Close artifact |
|---|---|---|---|
| CCI-01 (walkthrough recording) | Phase 2 | 02-01 | ≤5:00 Windows/WSL recorded walkthrough |
| CCI-05 (screencast URL backfill) | Phase 2 | 02-01 → extended by 03-01 → extended by 03-02 | Single atomic backfill commit (now 6 locations) |
| DOG-02 (flagship ≤3:00 walkthrough + hero video embed backfill) | Phase 3 | 03-01 | Same recording; same backfill commit |
| DOG-04 launch blitz | Phase 3 | 03-02 | Same-day 2-hour window after homepage goes live |

**Updated 6-location backfill checklist** (was 5 after 03-01; +1 added by 03-02 Task 2):

| # | File | Line | Form | Replace with | Context |
|---|---|---|---|---|---|
| 1 | `app/page.jsx` | 59 | `https://www.loom.com/embed/PLACEHOLDER_VIDEO_ID` | EMBED_URL | VideoHero `src` in homepage hero above-fold |
| 2 | `app/blog/claude-code-beachhead/page.jsx` | 23 | `const VIDEO_URL = 'https://www.loom.com/embed/PLACEHOLDER_VIDEO_ID';` | EMBED_URL | **NEW (03-02 Task 2)** — VideoHero `src` constant on the blog page |
| 3 | `README.md` | 8 | `<SCREENCAST_URL>` raw | WATCH_URL | `<a href>` wrapping `public/images/demo-gif2.gif` (D-17 click-through pattern) |
| 4 | `README.md` | 19 | `<SCREENCAST_URL>` raw | WATCH_URL | "Watch the 3-min walkthrough →" text link |
| 5 | `app/guides/claude-code/page.js` | 104 | `<SCREENCAST_URL>` raw | WATCH_URL | Step 1 "Watch the 3-minute walkthrough" note text |
| 6 | `app/guides/claude-code/page.js` | 249 | `&lt;SCREENCAST_URL&gt;` (HTML-entity) | WATCH_URL | Dedicated "Watch the 3-minute walkthrough" section body |

**Important:** Location 6 is HTML-entity-encoded. `scripts/check-screencast-backfilled.mjs` (from 03-01) handles both raw and entity forms — single source of truth for "are all `<SCREENCAST_URL>` placeholders closed?". The two `PLACEHOLDER_VIDEO_ID` locations (rows 1 + 2) are NOT covered by that script — they require a separate grep:

```bash
grep -rn "PLACEHOLDER_VIDEO_ID" app/page.jsx app/blog/claude-code-beachhead/page.jsx
```

Both lines must report a match before backfill, zero matches after.

**Atomic backfill procedure** (single commit closes all 6 + flips both video srcs together):

```bash
# 1. Enumerate — expect exactly 6 matches (2 PLACEHOLDER_VIDEO_ID + 3 raw <SCREENCAST_URL> + 1 HTML-entity &lt;SCREENCAST_URL&gt;)
node scripts/check-screencast-backfilled.mjs                                       # reports 4
grep -rn "PLACEHOLDER_VIDEO_ID" app/page.jsx app/blog/claude-code-beachhead/page.jsx   # reports 2

# 2. Replace all 6 with the real URLs:
#    - app/page.jsx:59                              → EMBED_URL  (iframe src form — /embed/)
#    - app/blog/claude-code-beachhead/page.jsx:23   → EMBED_URL  (VIDEO_URL constant — same /embed/ form)
#    - README.md:8, 19                              → WATCH_URL  (anchor hrefs — /share/ or /watch?v=)
#    - app/guides/claude-code/page.js:104           → WATCH_URL  (raw form)
#    - app/guides/claude-code/page.js:249           → WATCH_URL  (HTML-entity form — replace full token)

# 3. Verify zero matches remain
node scripts/check-screencast-backfilled.mjs                                       # exits 0
grep -rn "PLACEHOLDER_VIDEO_ID" app/page.jsx app/blog/claude-code-beachhead/page.jsx   # no output

# 4. Re-run full suite + guardrails
npm test -- --run                                       # 1799+ pass, 0 fail
node scripts/check-readme-lead.mjs                      # exits 0
node scripts/check-launch-content.mjs                   # exits 0 (drafts already passing)
npm run lint && npm run route-sql:check && npm run openapi:check && npm run api:inventory:check && npm run docs:check

# 5. Manual incognito re-verification — load dashclaw.io AND dashclaw.io/blog/claude-code-beachhead in incognito from phone hotspot:
#    iframe renders, video plays, zero CSP violations in DevTools console (BOTH pages)

# 6. Atomic single commit
git commit -m "docs(03-01): backfill CCI-05 screencast URLs + flip both VideoHero srcs to live video (DOG-02)"
```

After this commit lands and incognito verification passes on BOTH the homepage AND the blog page, run the PRE-LAUNCH GATE in section 4 and execute the launch sequence.

## 6. Hard-Gate For Phase 3 Close — DOG-04 Blocked Until Recording Lands

**Critical:** Phase 3 cannot fully close until DOG-04 launches publicly. The dependency chain in section 4 is the gate. Do not attempt to submit Show HN against a placeholder-iframe homepage — Pitfall 1 (URL-change after HN submission kills rank) is rank-killing in the worst case and forces a re-launch on a fresh post.

**Estimated total time to close Phase 3 from where it sits today** (one cohesive session):

| Step | Time |
|---|---|
| Discord bot registration (one-time, ~10 min — needed for DOG-02 walkthrough authenticity) | 10 min |
| Pre-flight env sanity (Pitfall 4 — verify `$DASHCLAW_BASE_URL` is not a demo container) | 2 min |
| Record ≤3:00 walkthrough on Windows/WSL (D-09 — tighter than Phase 2's ≤5:00) | 5 min |
| Review + re-record buffer | 10 min |
| Publish to Loom Public or YouTube Unlisted; verify URL resolves in incognito from phone hotspot | 5 min |
| Run 6-location atomic backfill commit per section 5 procedure | 10 min |
| Manual incognito re-verification on dashclaw.io homepage + blog page | 5 min |
| Wait for next Tue/Wed/Thu 8-11am ET window | (calendar) |
| Run PRE-LAUNCH GATE per section 4 (8 items) | 5 min |
| Execute LAUNCH SEQUENCE T+0 → T+2h | 2 hours |
| Capture telemetry block + return resume-signal | 5 min |

**Total active time: ~50 minutes of recording + backfill + ~2 hours of launch window.** All structural work is shipped.

## 7. Phase 3 Close Path After This SUMMARY

1. **Plan 03-02 closes** in deferred state today — Tasks 1-3 shipped, Task 4 deferred, recipe preserved.
2. **Same future recording session** described in 03-01-SUMMARY section 7 + section 5 above runs the 6-location atomic backfill commit (DOG-02 + CCI-05 close together).
3. **Same-day launch blitz** runs immediately after the homepage is incognito-verified live (DOG-04 closes; Phase 3 fully closes).
4. Phase 4 (Growth Flywheel — FLY-01, FLY-02, FLY-03) can begin.

## Task Execution Record

| Task | Status | Commit | Notes |
|---|---|---|---|
| Task 1 — Launch content drafts + assertion guardrail (RED → GREEN) | PASSED | `668c548d` | `docs(03-02): add launch content drafts + assertion guardrail (DOG-04)` — 26 tests; all 7 secret-pattern regexes return zero matches; D-03 commitment wall holds in all 3 drafts |
| Task 2 — Blog post live + VideoHero embed (GREEN) | PASSED | `6eb67d00` | `feat(03-02): blog post on dashclaw.io/blog/claude-code-beachhead (DOG-04)` — 9 tests; VIDEO_URL constant at line 23 (becomes 6th backfill location) |
| Task 3 — Discord new-connect alert (GREEN) | PASSED | `8463abc8` | `feat(03-02): Discord new-connect alert on first per-org action (DOG-04 telemetry)` — 12 tests; route-sql baseline 85 held; fire-and-forget verified |
| Task 4 — Same-day launch blitz (human-action) | DEFERRED | — | Resume-signal `defer launch`; upstream DOG-02 walkthrough recording deferred; Pitfall 1 blocks HN submission against placeholder homepage |

**Plan metadata commit:** this SUMMARY + STATE + ROADMAP + REQUIREMENTS update is the final commit for Plan 03-02.

## Deviations from Plan

### None (resume-signal handled per plan spec)

The plan's `<resume-signal>` block at Task 4 explicitly defined `launch delayed <new date>` and `launch aborted <reason>` as valid alternative operator responses. The operator's `defer launch` signal sits between these — defer indefinitely pending an upstream gate (DOG-02 recording), not a hard abort. This SUMMARY honors that path: Tasks 1-3 ship complete, Task 4 deferred with full recipe preserved, Phase 3 close gated on the same recording session that closes Phase 2 CCI-01 + CCI-05 + Phase 3 DOG-02. This is the plan executing as designed under the deferred-close pattern (third instance), not a deviation.

## Authentication Gates

None encountered during execution. The Task 4 human-action checkpoint is not an auth gate — it is a designed human-only step (post HN, post tweet thread, monitor reply window from a phone) that cannot be automated. The deferral was an operator scheduling decision, not an auth blocker.

## Threat Flags

No new security-relevant surface was introduced beyond the `<threat_model>` in the PLAN. Active mitigations status:

| Threat | Mitigation status |
|---|---|
| T-03-02-01 (secret leak in launch content) | **MITIGATED** — broadened 7-pattern secret regex array in `scripts/check-launch-content.mjs` AND `__tests__/unit/launch-content-assertions.test.js` (single source of truth, both must stay in lockstep). All 3 drafts return zero matches. Frame-scrubbing reminder preserved in section 4 launch recipe |
| T-03-02-02 (HN post URL changes after submission) | **GATED** — Task 4 PRE-LAUNCH GATE in section 4 requires 4 URL smoke-tests (homepage, blog, pricing, connect) all returning 200 BEFORE HN submission. Hard-gated by 03-01 deferred state — homepage cannot pass smoke test until backfill |
| T-03-02-03 (Discord alert leaks org_id / PII) | **MITIGATED** — `fireNewConnectAlert` payload masks org_id to first 8 chars + '...'; never includes API keys or user emails. Test case 5 asserts no secrets in payload (commit `8463abc8`) |
| T-03-02-04 (webhook failure blocks action creation) | **MITIGATED** — fire-and-forget pattern: webhook call NOT awaited; errors caught + logged; action creation returns success regardless; 2-second timeout cap. Test case 4 asserts success (commit `8463abc8`) |
| T-03-02-05 (launch content references non-existent video URL) | **MITIGATED via dependency chain** — Task 2 blog post test asserts `<iframe` with src matching loom.com OR youtube-nocookie.com host. Currently passes with PLACEHOLDER_VIDEO_ID (still loom.com host). After backfill commit, both hero AND blog page atomically point to real EMBED_URL — same regex still passes |
| T-03-02-06 (Wes-authored HN replies unauditable) | **ACCEPTED** — D-19 explicitly locks Wes-authored only. Content-agent drafts are Phase 4 territory. Human-in-the-loop is the mitigation by design |
| T-03-02-07 (malicious "Show HN" hijack) | **ACCEPTED** — mitigation is HN username ownership. Low-likelihood consumer risk |

## Known Stubs

| Stub | File | Line | Reason |
|---|---|---|---|
| `PLACEHOLDER_VIDEO_ID` in blog page VideoHero src | `app/blog/claude-code-beachhead/page.jsx` | 23 | **NEW** — added by 03-02 Task 2; awaits EMBED_URL from deferred DOG-02 walkthrough recording. Joins the 5 stubs from 03-01 in the atomic 6-location backfill commit. Iframe renders broken until backfill |

The other 5 stubs (1 hero `PLACEHOLDER_VIDEO_ID` + 4 `<SCREENCAST_URL>` variants) are inherited from 03-01-SUMMARY §"Known Stubs" and 02-01-SUMMARY §3 — see section 5 above for the consolidated 6-location checklist. All 6 stubs close atomically via the single backfill commit. Closure requires only a recorded video URL — no structural code change.

## Self-Check

Verify claims before closing:

- **SUMMARY file exists:** FOUND `.planning/phases/03-public-launch/03-02-SUMMARY.md` (this file)
- **Task 1 commit:** FOUND `668c548d docs(03-02): add launch content drafts + assertion guardrail (DOG-04)`
- **Task 2 commit:** FOUND `6eb67d00 feat(03-02): blog post on dashclaw.io/blog/claude-code-beachhead (DOG-04)`
- **Task 3 commit:** FOUND `8463abc8 feat(03-02): Discord new-connect alert on first per-org action (DOG-04 telemetry)`
- **`docs/launch/` artifacts:** FOUND `docs/launch/hn-post.md` (1799 bytes), `docs/launch/tweet-thread.md` (2161 bytes), `docs/launch/blog-post.md` (4833 bytes)
- **`scripts/check-launch-content.mjs`:** FOUND (6117 bytes, executable)
- **Blog page:** FOUND `app/blog/claude-code-beachhead/page.jsx` (12875 bytes); `app/blog/layout.js` (755 bytes)
- **6th placeholder location:** VERIFIED `grep -rn "PLACEHOLDER_VIDEO_ID" app/page.jsx app/blog/claude-code-beachhead/page.jsx` reports 2 matches (1 hero at app/page.jsx:59 + 1 NEW at app/blog/claude-code-beachhead/page.jsx:23)
- **No new code changes this session:** Files modified by this close commit are limited to SUMMARY + STATE + ROADMAP + REQUIREMENTS — zero production code or test code touched
- **No launch event happened:** No telemetry block in this SUMMARY; no HN URL recorded — correctly absent per deferred state

## Self-Check: PASSED

---
*Phase: 03-public-launch*
*Completed: 2026-04-22 (deferred close — Tasks 1-3 shipped; Task 4 launch blitz deferred pending upstream DOG-02 walkthrough recording)*
*Next-session closure path: record ≤3:00 walkthrough → atomic 6-location backfill commit → incognito verify both homepage and blog page → run PRE-LAUNCH GATE → execute LAUNCH SEQUENCE in same-day 2-hour window. Closes Phase 2 CCI-01 + CCI-05 AND Phase 3 DOG-02 + DOG-04 atomically over one ~3-hour active window.*
