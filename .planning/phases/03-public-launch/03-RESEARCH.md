# Phase 3: Public Launch — Research

**Researched:** 2026-04-22
**Domain:** Marketing-surface rewrite + public monetization commitment + tier-gate middleware design (no paywall shipped) + coordinated HN/Twitter/blog launch
**Confidence:** HIGH (the heavy lifts — demo video, tier column, CSP, admin-gate pattern — are all already-existing pieces we're composing; MEDIUM on Show-HN-2026 timing specifics because that data drifts faster than quarterly)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

These are the 20 locked decisions. Research THESE, not alternatives. Do not propose replacements.

### Locked Decisions

**MON-01 — Monetization trigger**
- **D-01:** Trigger is **50 verified Claude Code integrations in the wild**. Founder-verifiable via a SQL query over `agents` / `action_records` / org-count joins.
- **D-02:** **No time-boxed backstop.** The trigger fires when it fires.
- **D-03:** **Commit the trigger publicly in four locations** — `.planning/PROJECT.md`, `README.md`, homepage `/pricing` (or equivalent), launch tweet thread + HN post body.

**MON-02 — Pro tier boundaries (designed only, NOT shipped)**
- **D-04:** Single paid tier: `Free` + `Pro`. No Business/Team.
- **D-05:** **Free forever includes:** solo-dev Claude Code integration (hook + MCP + `claude-code-starter` pack + `/activity` + `/my-agent`), Discord + Telegram approvals, single-user `/decisions` ledger, **semantic guard (LLM-backed policy evals)** — user's own API key, cost lives on their bill.
- **D-06:** **Pro (feature-flagged, not shipped this phase):** multi-user orgs + SSO + RBAC, custom policy pack authoring, audit export + SOC-2-friendly reporting, non-Claude-Code integrations (Cursor/Aider/Devin).
- **D-07:** **Code-split approach = `requireTier('pro')` middleware helper.** Handler-level gate. NOT a `/pro/*` route tree. NOT a separate `@dashclaw/pro` package.

**DOG-02 — Flagship demo video**
- **D-08:** Demo video = Phase 2 CCI-01 walkthrough promoted. Same recording session closes both Phase 2 open gaps AND delivers the Phase 3 flagship.
- **D-09:** Target **≤3:00 duration**. Raw over polished. No slides. Real codebase, real phone tap, real Claude Code resume.
- **D-10:** **Hosting = Loom public (preferred) OR YouTube Unlisted.** URL must load in incognito with no captcha / no workspace-only wall (Phase 2 RESEARCH §Pitfall 8).
- **D-11:** **Embedded locations:** homepage hero above-the-fold (primary), `/guides/claude-code`, `README.md` top-of-file. Replaces the 4 `<SCREENCAST_URL>` placeholders from Phase 2 (3 raw + 1 HTML-entity-encoded).

**DOG-03 — Homepage rewrite + /connect**
- **D-12:** Hero voice = technical + terse. Developer-reader-first. Evidence over decoration. Precise wording TBD in plan.
- **D-13:** **Remove from hero (all four rejected framings):** homelab refs, enterprise compliance language (SOC 2 / ISO / "your compliance team will love you"), generic AI governance abstractions ("control plane for agents", "policy-as-code for AI"), multi-agent platform positioning ("works with any agent framework").
- **D-14:** **CTA priority:** `Watch demo → Install → Star on GitHub`. Video is the star.
- **D-15:** **`/connect` rewrite = single-page copy-paste runbook.** Top-to-bottom: paste this command → paste this workspace token → configure Discord bot in 3 steps → done. Auto-generate workspace token inline. NOT a wizard. NOT collapsible advanced sections.

**DOG-04 — Launch content + timing**
- **D-16:** **Same-day blitz.** Homepage flip + tweet thread + HN post + blog post all live within a 2-hour window on launch day.
- **D-17:** **HN timing: Tue–Thu, 8–11am ET.** Specific day chosen at launch-ready time.
- **D-18:** **Tweet thread tone = technical + specific + personal.** Founder voice. 50-integration trigger as closing commitment.
- **D-19:** **HN reply strategy: Wes-authored only, fast + honest.** Replies within 30 min during peak window. No content-agent drafts. Honest "that's a fair criticism" over defensive.
- **D-20:** **Blog post scope:** One post on `dashclaw.io`. Problem → demo → dogfood story. Length/tone matches homepage voice.

### Claude's Discretion

- Exact hero headline copy (voice locked, wording TBD)
- Exact `/connect` runbook copy + inline workspace-token-generation UX
- Blog post exact title + paragraph structure
- Tweet thread exact wording + image assets
- Rollback plan if homepage rewrite tanks (feature-flag old hero? one-commit revert?)
- Launch-window telemetry instrumentation (Vercel analytics check-in, Discord alert on new `/connect` completions, "verified integrations" counter for MON-01)
- `/pricing` page structure and copy (one-paragraph trigger commitment is required; visual presentation open)
- Exact demo video edit cuts (≤3:00, raw, no slides — locked; post-production choices open)

### Deferred Ideas (OUT OF SCOPE)

- Live sandbox / no-install demo — backlog
- Pro-tier paywall actually shipping — PAY-01, fires when MON-01 fires
- Phase 4 growth flywheel agents (research + content + public status page)
- Cursor / Aider / Devin integrations — Pro territory, post-MON-01
- Enterprise compliance content (SOC 2 explainer, audit-trail whitepaper) — Pro marketing after MON-01
- Content-agent-drafted HN reply queue — Phase 4
- `/pricing` structured Free $0 / Pro $X table — waits for PAY-01
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **DOG-02** | Flagship ≤3-minute demo video showing real Claude Code → Discord approval flow end-to-end, raw, published publicly | §Phase 2 carryover; §Loom/YouTube hosting; §CSP frame-src for embed; §Pitfall: Loom captcha default |
| **DOG-03** | Homepage hero rewrite (Claude-Code-first, rejected framings removed) + `/connect` single-page copy-paste runbook | §Homepage patterns 2026; §Existing `app/page.js` hero structure; §`/connect` current file tree; §`docs/homepage-draft-claude-code.md` 806-word raw material |
| **DOG-04** | Launch content: Show HN post + tweet thread + blog post on `dashclaw.io`, coordinated same-day | §Show HN 2026 mechanics; §Title format; §Reply cadence; §Blog post structure |
| **MON-01** | Specific monetization trigger defined + publicly committed in 4 locations; SQL-measurable "50 verified Claude Code integrations in the wild" | §Verified-integration counter SQL; §`organizations.plan` existing column; §Pricing page patterns for "committed-not-billing" products |
| **MON-02** | Pro tier feature boundaries designed + code architected for split — without shipping paywall; `requireTier('pro')` helper | §Existing admin-gate pattern; §`organizations.plan` default `'free'`; §Feature-flag middleware; §Test patterns (mirror `keys.route.test.js`) |
</phase_requirements>

## Summary

Phase 3 is almost entirely **composition of already-shipped infrastructure**, not new systems. Five concrete composition axes:

1. **The demo video is already a Phase 2 carryover.** `<SCREENCAST_URL>` placeholders are staged in 4 locations (3 raw + 1 HTML-entity-encoded). Recording the video + backfilling the URL + wrapping the video in an iframe on the homepage hero = three composition tasks, not "design a video from scratch."

2. **The monetization trigger needs zero schema change.** `organizations.plan text default 'free'` already exists in `schema/schema.js:23`. `getOrgPlan()` already queries it. Phase 3 extends `PLAN_LIMITS.pro` vocabulary (already present at `app/lib/usage.js:38–47` with all-Infinity limits) — the tier column is there, the query helper is there, and the pro value is a legitimate value per the schema's `text` column (no CHECK constraint pins it to 'free').

3. **`requireTier('pro')` mirrors an existing admin-gate pattern that ships at 15+ call sites.** The canonical pattern is `if (getOrgRole(request) !== 'admin') return 403`. We add a sibling `requireTier` helper in `app/lib/org.js` that reads `organizations.plan` (cached, same shape as `apiKeyCache`) and returns 403 with a distinctive `code: 'COMING_SOON'` payload (not a buy-CTA — paywall is explicitly deferred). Because `PLAN_LIMITS.pro` already has unlimited quotas, and no org has `plan='pro'` today, the gate is functionally dormant until MON-01 fires and a seed-data update flips specific orgs.

4. **The `/pricing` surface is a one-paragraph public commitment page, not a SaaS pricing table.** No Stripe. No price. Just the 50-integration trigger, what Free includes, what Pro will include when the trigger fires, and a live "N / 50 verified integrations" counter. This is the unusual part — there's no great precedent for "pricing page before there's a price" — so we lean on the `.impeccable.md` design language (terse, token-first, evidence over decoration) and make the page read like a README section rather than a PostHog/Linear/Vercel pricing table.

5. **The launch is a single 2-hour window, Tue–Thu 8–11am ET, Wes-authored only.** Show HN title, homepage, tweet thread, blog post, README, /pricing all ship their "50-integration trigger" paragraph inside that window. HN URL-change after submission is a ranking killer — homepage flip MUST be live and verified-in-incognito **before** the Show HN post.

**Primary recommendation:** Structure Phase 3 as three plans — `03-01` builds the asset bundle (video recording + placeholder backfill + homepage rewrite + /connect runbook, all sharing `.impeccable.md` voice); `03-02` ships launch-day content + instrumentation (HN post, tweet thread, blog post, Discord alert on new `/connect` completions, verified-integrations counter); `03-03` adds the `requireTier('pro')` middleware + `/pricing` commitment page. The three are mostly parallelizable, with one hard ordering constraint: `03-01` homepage must be live and incognito-verified before `03-02` publishes the Show HN post.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Demo video asset | CDN / Static (Loom or YouTube) | — | Third-party CDN owns hosting; we own the embed frame only [VERIFIED: `docs/homepage-draft-claude-code.md:17–20`] |
| Homepage hero rewrite | Frontend Server (SSR) | Browser (hydration) | `app/page.js` is a Next.js Server Component [VERIFIED: `app/page.js:24`]; video iframe renders server-side, player JS hydrates client-side |
| `/connect` runbook page | Frontend Server (SSR) | Browser (token-reveal interaction) | `app/connect/page.js` is `export const dynamic = 'force-dynamic'` SSR [VERIFIED: `app/connect/page.js:11`]; inline workspace-token reveal is a small client island |
| `/pricing` commitment page | Frontend Server (SSR) | Database (for live counter) | Static-mostly server component + one server-side `/api/monetization/verified-integrations-count` call every page request (or ISR every 10 min — design-time tradeoff for the planner) |
| `requireTier('pro')` gate | API / Backend | Database (plan lookup via `organizations.plan`) | Handler-level middleware helper composed on top of existing `getOrgRole` pattern [VERIFIED: `app/lib/org.js`, `app/api/keys/route.js:58`] |
| Verified-integrations counter | API / Backend | Database (SQL over `action_records`) | SQL-measurable per D-01; server-only; no PII leaked to client |
| Discord alert on new `/connect` completion | API / Backend | Third-party (Discord Webhook) | Mirrors existing `fireDiscordApproval` + `notification-adapters/discord.js` pattern |
| Launch-window Vercel Analytics | Browser | CDN (Vercel edge) | Already wired at `app/layout.js:69` conditional on `VERCEL === '1'` or `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === 'true'` [VERIFIED] |
| Show HN post | External (news.ycombinator.com) | — | No code — Wes posts manually |
| Tweet thread | External (x.com) | — | No code — Wes posts manually |
| Blog post | CDN / Static (dashclaw.io) | — | Markdown in the `dashclaw-website` repo (assumption — see Assumptions Log A1) or MDX in this repo's `app/blog/` (needs verification at plan time) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@vercel/analytics` | 2.0.1 | Launch-window telemetry — already wired | [VERIFIED: `package.json:72` + `app/layout.js:4,69`]. No new dep. |
| Next.js App Router | 16 | SSR hero + `/pricing` + `/connect` | [VERIFIED: `CLAUDE.md` tech stack]. No new dep. |
| Drizzle ORM | current | `organizations.plan` column read path | [VERIFIED: `schema/schema.js:23` plan column already exists]. No new dep. |
| `lucide-react` | current | Icon language per `.impeccable.md` | [VERIFIED: `.impeccable.md` — "Iconography: lucide-react only. Never mix icon libraries."]. No new dep. |
| Tailwind + CSS tokens | current | Design tokens from `app/globals.css` | [VERIFIED: `.impeccable.md` tiebreaker #4]. No new dep. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Loom embed iframe (no npm dep) | — | Hero video embed | When `<SCREENCAST_URL>` points at Loom. Use `https://www.loom.com/embed/<id>` form, not the `/share/` form. |
| YouTube embed iframe (no npm dep) | — | Hero video embed alternative | When `<SCREENCAST_URL>` points at YouTube. Use `https://www.youtube-nocookie.com/embed/<id>` for GDPR-friendly cookieless variant [CITED: developer.mozilla.org MDN + youtube.com privacy-enhanced mode docs]. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline Loom embed | Self-host MP4 in `public/videos/` | Loses Loom's adaptive bitrate + viewer analytics. Also blows past Vercel's static-file bandwidth budget on the free tier with 100 launch-day viewers. **Loom/YouTube wins.** |
| `@vercel/flags` SDK for Pro tier gate | Plain `organizations.plan` read | `@vercel/flags` is a new dep with its own Edge Config requirement. We already have `plan` column + `getOrgPlan()`. **Plain read wins** — no new infra, no new vendor lock. [CITED: vercel.com/templates/next.js/vercel-flags-with-flags-sdk-and-next-js] |
| Static `/pricing` HTML with build-time counter | SSR page with live counter | Live counter = newer = creates narrative urgency. Build-time is stale by next deploy. **SSR wins.** |
| Next.js ISR (revalidate every N seconds) | Force-dynamic | For `/pricing` counter, ISR with `revalidate: 300` (5 min) is acceptable — the number changes slowly and the savings on $0-budget infra matter. Planner's call. |

**Installation:** Zero new npm deps. Phase 3 is a composition phase.

**Version verification:**

```bash
npm view @vercel/analytics version
# Expected: 2.0.1 matches installed; upgrade is orthogonal to Phase 3 scope.
```

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─────────────────────────────────┐
                       │ LAUNCH-DAY 2-HOUR WINDOW        │
                       │ (Tue–Thu 8–11am ET)             │
                       └───────────────┬─────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
  ┌───────────┐                 ┌───────────┐                  ┌───────────┐
  │ Twitter/X │                 │ Hacker    │                  │ dashclaw  │
  │ thread    │                 │ News      │                  │ .io blog  │
  │ (Wes)     │                 │ Show HN   │                  │ post      │
  └─────┬─────┘                 └─────┬─────┘                  └─────┬─────┘
        │                             │                              │
        │      All three link at dashclaw.io homepage                │
        └──────────────────────────────┼──────────────────────────────┘
                                       │
                                       ▼
                       ┌─────────────────────────────────┐
                       │ dashclaw.io homepage (SSR)      │
                       │ ≤3:00 Loom/YouTube demo embed   │
                       │ CTA: Watch → Install → Star     │
                       │ Links to: /connect, /pricing,    │
                       │           /guides/claude-code    │
                       └───────────────┬─────────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
                ▼                      ▼                      ▼
        ┌────────────┐         ┌────────────┐         ┌────────────┐
        │ /connect   │         │ /pricing   │         │ /guides/   │
        │ single-page│         │ (MON-01    │         │ claude-code│
        │ runbook    │         │  commit)   │         │  docs      │
        │            │         │ live N/50  │         │            │
        │ ──────────►│         │ counter    │         │            │
        │  Discord   │         │            │         │            │
        │  alert on  │         │            │         │            │
        │  completion│         │            │         │            │
        └─────┬──────┘         └──────┬─────┘         └────────────┘
              │                       │
              ▼                       ▼
       ┌──────────────┐       ┌────────────────────┐
       │ /api/setup/* │       │ SQL: count distinct│
       │ provision    │       │ orgs with ≥1       │
       │ workspace    │       │ action_record      │
       │ token        │       │ AND agent_id LIKE  │
       └──────┬───────┘       │ claude-code-style  │
              │               └──────────┬─────────┘
              ▼                          │
       ┌──────────────┐                  │
       │ Discord      │                  ▼
       │ webhook      │          ┌────────────────┐
       │ ──►  "New    │          │ /api/monetiz…/ │
       │     connect  │          │ verified-      │
       │     complete"│          │ integrations-  │
       └──────────────┘          │ count          │
                                 └────────────────┘

                       ┌─────────────────────────────────┐
                       │ Pro-tier request at /api/*      │
                       │ (hits requireTier('pro') helper)│
                       └───────────────┬─────────────────┘
                                       │
                                       ▼
                       ┌─────────────────────────────────┐
                       │ Lookup organizations.plan       │
                       │ (cached, mirror apiKeyCache)    │
                       └───────────────┬─────────────────┘
                                       │
                       ┌───────────────┴───────────────┐
                       │                               │
                       ▼                               ▼
                 plan === 'pro'                 plan === 'free'
                       │                               │
                       ▼                               ▼
                 Proceed to                    403 + JSON
                 route handler                 { error: 'Coming soon',
                                                 code: 'COMING_SOON',
                                                 reason: 'Pro features
                                                  unlock when we hit
                                                  50 verified integrations.
                                                  See /pricing.' }
                                                 (NOT a buy-CTA)
```

### Recommended Project Structure

```
app/
├── page.js                    # MODIFY: Hero rewrite — Claude Code lead, video hero, CTA reorder, rejected framings removed
├── connect/
│   ├── page.js                # MODIFY: Single-page runbook rewrite (currently 210 lines of wizard-adjacent sections)
│   ├── ConnectGuideClient.js  # LIKELY-REMOVE or heavy-trim: the wizard split is antithetical to D-15
│   ├── HostedProvisionClient.jsx  # KEEP: inline workspace-token generation UI
│   ├── HostedProvisionSection.js  # KEEP: server-side provisioning section
│   └── hostedTemplates.js     # KEEP: provisioning templates
├── pricing/
│   └── page.js                # CREATE: Monetization trigger commitment page (new surface)
├── lib/
│   └── org.js                 # EXTEND: Add `requireTier(request, sql, minTier)` helper alongside getOrgRole
├── api/
│   └── monetization/
│       └── verified-integrations-count/
│           └── route.js       # CREATE: Public GET — returns `{ count, target: 50 }`
├── layout.js                  # NO CHANGE: @vercel/analytics already wired
└── components/
    └── VideoHero.js           # CREATE: <iframe> embed wrapper (Loom + YouTube)

app/blog/
    └── claude-code-beachhead.mdx  # CREATE: Blog post (location per assumption A1 — planner verifies)

PROJECT.md (canonical at .planning/PROJECT.md, NOT repo root)  # MODIFY: add MON-01 trigger paragraph
README.md                      # MODIFY: backfill 4 <SCREENCAST_URL> placeholders + add monetization trigger paragraph

next.config.js                 # MODIFY: add frame-src CSP directive for loom.com + youtube-nocookie.com (IF embedding via iframe)
```

### Pattern 1: Admin-gate → Tier-gate middleware helper

**What:** Handler-level gate that mirrors the existing admin-gate and extends `app/lib/org.js`.

**When to use:** Any Pro-only route Phase 3 designs (none ship this phase, but the helper is the MON-02 deliverable).

**Existing admin-gate at 15+ call sites** [VERIFIED: grep on 2026-04-22]:

```javascript
// Source: app/api/keys/route.js:58 + app/api/settings/route.js:91,143 + app/api/webhooks/route.js:47,100 + app/api/team/[userId]/route.js:23,102 + ...
// 15+ routes. Canonical. Mirror exactly.
if (getOrgRole(request) !== 'admin') {
  return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
}
```

**New tier-gate helper** (add to `app/lib/org.js`):

```javascript
// app/lib/org.js
import { getSql } from './db.js';
import { getOrgPlan } from './usage.js';  // already exists — queries organizations.plan

const TIER_RANK = { free: 0, pro: 1 };

/**
 * Returns null if caller's org meets minTier, or a 403 NextResponse if not.
 *
 * Usage in a route handler:
 *
 *   const tierBlock = await requireTier(request, 'pro');
 *   if (tierBlock) return tierBlock;
 *
 * Response shape on failure (deliberately NOT a buy-CTA — paywall is
 * deferred to PAY-01 per MON-02 / D-07):
 *
 *   { error: 'Coming soon',
 *     code: 'COMING_SOON',
 *     reason: 'Pro features unlock when we hit 50 verified integrations.
 *              See /pricing.',
 *     current_tier: 'free',
 *     required_tier: 'pro' }
 *
 * Runs at ~1 SQL query per request UNTIL a planTierCache (mirror apiKeyCache
 * shape from middleware.js:265) is added. Planner MAY add that cache in this
 * phase or defer to PAY-01 — low-risk either way because no Pro route ships.
 */
export async function requireTier(request, minTier) {
  const orgId = getOrgId(request);
  const sql = getSql();
  const currentTier = await getOrgPlan(orgId, sql);
  const currentRank = TIER_RANK[currentTier] ?? 0;
  const requiredRank = TIER_RANK[minTier] ?? 0;
  if (currentRank >= requiredRank) return null;
  return NextResponse.json({
    error: 'Coming soon',
    code: 'COMING_SOON',
    reason: `Pro features unlock when DashClaw hits 50 verified Claude Code integrations in the wild. See /pricing for progress.`,
    current_tier: currentTier,
    required_tier: minTier,
  }, { status: 403 });
}
```

**Paywall-flip is a SEED-DATA change, not code:**

```sql
-- When MON-01 fires, one row update promotes an org to Pro:
UPDATE organizations SET plan = 'pro' WHERE id = 'org_<customer>';
```

No code deploys. No migrations. The gate is built once and stays dormant until SQL flips `plan` for individual paying customers. This is the canonical "flip-to-paid = config, not refactor" per D-07.

### Pattern 2: Video hero iframe embed

**What:** Above-the-fold `<iframe>` pointing at Loom or YouTube.

**When to use:** Homepage hero (primary), `/guides/claude-code` (already has placeholder), README (via markdown — GitHub already renders Loom/YouTube links as click-through).

**CSP requirement:** `next.config.js:20-35` currently has NO `frame-src` directive. Embedding Loom or YouTube will be blocked by `default-src 'self'` cascade. Planner MUST add:

```javascript
// next.config.js — inside the csp array, after "frame-ancestors 'none'"
"frame-src 'self' https://www.loom.com https://www.youtube-nocookie.com",
```

[CITED: developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-src — `frame-src` controls iframe-src URLs; the `frame-ancestors` directive is about who can frame YOU, not who YOU can frame.]

[CITED: nextjs.org/docs/pages/guides/content-security-policy — standard Next.js CSP-in-headers pattern matches the existing `headers()` function in `next.config.js`.]

**Loom embed URL shape** (Loom's "public" sharing mode):

```html
<iframe src="https://www.loom.com/embed/<VIDEO_ID>"
        allowFullScreen
        allow="autoplay; fullscreen"
        title="DashClaw Claude Code walkthrough" />
```

**YouTube embed URL shape** (cookieless privacy-enhanced variant — GDPR-friendly, standard for dev-tool sites per MDN):

```html
<iframe src="https://www.youtube-nocookie.com/embed/<VIDEO_ID>"
        allowFullScreen
        allow="autoplay; encrypted-media; fullscreen"
        title="DashClaw Claude Code walkthrough" />
```

**Autoplay policy (research):** [CITED: blog.messagear.com/product-launch-video — "Autoplay with muted audio is acceptable and increases play rates"]. Chrome + Safari + Firefox all silently drop autoplay if audio is unmuted; adding `muted` to the iframe URL (`?autoplay=1&mute=1` for YouTube, `?autoplay=1&hideEmbedTopBar=true&muted=1` for Loom) is the pattern that actually plays. **Recommendation:** click-to-play (no autoplay) is more in the `.impeccable.md` voice (no movement unless it earns its pixels). Autoplay-muted is a fallback. Planner decides.

### Pattern 3: Pricing-page-without-a-price

**What:** `app/pricing/page.js` — a one-paragraph public commitment page, not a Stripe-integrated pricing table.

**When to use:** Phase 3 ships the commitment surface. PAY-01 later adds the Stripe card.

**Reference patterns scanned:**

| Project | Pricing surface 2026 | What Phase 3 borrows |
|---------|---------------------|----------------------|
| **PostHog** | Usage-based table with generous free tier [CITED: posthog.com/pricing] | Free-is-powerful framing. "Usage-based" language not relevant here. |
| **Plausible** | Fixed monthly tiers, 30-day free trial | Clarity of what free includes. |
| **Cal.com** | Free + Teams/Organizations + Enterprise | 3-column layout conventional for mature products. Skip — we're pre-pricing. |
| **Linear** | Free up to 250 issues / Standard / Plus / Enterprise | Mature pricing. Not relevant. |
| **Vercel** | Hobby (free) / Pro ($20/user/mo) / Enterprise | Mature. Not relevant. |

**Common structural elements on "committed-not-billing" pages** (scanned for in each of above — not all present anywhere):

- ✓ A single concrete trigger commitment (rare — no clear precedent)
- ✓ Free tier list in plain text (universal)
- ✓ Pro tier "teaser" (Linear does this with "Coming soon" on upcoming features in Plus tier)
- ✓ Link to roadmap / public commitment doc (common on open-source projects; e.g., Plausible links their roadmap)
- ✓ Live signal of progress toward a commitment (RARE — closest analog is Kickstarter progress bars, which is consumer not dev-tool)

**Phase 3's `/pricing` page structure (recommended):**

```
────────────────────────────────────────────────────────────
DashClaw is free while we grow.

The runtime — hook, policy pack, Discord approvals, activity
timeline, semantic guard — is free forever. We commit:

    Pro tier launches when DashClaw hits
    50 verified Claude Code integrations in the wild.

                        N / 50
                  [ live counter, SSR ]

Free forever:
  • Solo-dev Claude Code integration
  • Discord + Telegram approval flow
  • /decisions ledger + audit trail
  • Semantic guard (bring your own LLM key)
  • /activity + /my-agent timelines

When we cross 50, Pro launches:
  • Multi-user orgs + SSO + role-based policies
  • Custom policy pack authoring + versioning
  • Audit export + SOC-2-friendly reporting
  • Integrations beyond Claude Code
                        (Cursor, Aider, Devin, custom SDK)

This commitment also lives in our PROJECT.md, our README,
and our launch tweet + HN post. If we renege, it costs
reputation, not just a private retro.
────────────────────────────────────────────────────────────
```

Single-column. Token-based. Terse. No orange except on the live counter number itself ("signal, not noise" — `.impeccable.md` tiebreaker #2).

### Pattern 4: Verified-integrations counter query

**What:** `/api/monetization/verified-integrations-count` endpoint (public GET, no auth) that returns `{ count, target: 50 }` for the `/pricing` live counter.

**The D-01 SQL** (planner to refine — this is the spec):

```sql
-- "Verified integration" = org with ≥1 action_record whose agent_id looks like
-- a Claude Code agent. Founder-verifiable: Wes can eyeball the org list
-- before MON-01 fires.
--
-- Phase 3 planner should confirm exact agent_id prefix/pattern for Claude Code
-- agents. Dogfood inspection suggests the hook uses a default agent_id like
-- 'claude-code' or '<session-id>', but this varies.
--
-- An alternative: count distinct org_id from action_records filtered by a
-- known tool_name list (Bash, Edit, Write) that the hook emits.

SELECT COUNT(DISTINCT org_id) AS verified_integrations
FROM action_records
WHERE agent_id ILIKE '%claude-code%'  -- refine at plan time
  AND org_id != 'org_default'         -- exclude founder's own instance
  AND org_id != 'org_demo'            -- exclude demo sandbox
  AND timestamp_start::timestamptz > NOW() - INTERVAL '90 days';  -- recency
```

**Route file** (mirror `app/api/health/route.js` structure — no auth needed, in PUBLIC_ROUTES):

```javascript
// app/api/monetization/verified-integrations-count/route.js
// NEW PUBLIC ROUTE — must be added to PUBLIC_ROUTES in middleware.js:27-42

export const dynamic = 'force-dynamic';
export const revalidate = 300;  // 5-minute cache OK for counter

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';

export async function GET() {
  try {
    const sql = getSql();
    const [row] = await sql`
      SELECT COUNT(DISTINCT org_id)::int AS count
      FROM action_records
      WHERE agent_id ILIKE '%claude-code%'
        AND org_id NOT IN ('org_default', 'org_demo')
        AND timestamp_start::timestamptz > NOW() - INTERVAL '90 days'
    `;
    return NextResponse.json({ count: row?.count ?? 0, target: 50 });
  } catch (e) {
    // Fail graceful — the counter is a signal, not critical infra.
    return NextResponse.json({ count: null, target: 50, error: 'unavailable' }, { status: 200 });
  }
}
```

**Middleware update** (`middleware.js:27-42` PUBLIC_ROUTES array):

```javascript
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/setup/status',
  // ... existing ...
  '/api/monetization/verified-integrations-count',  // ADD: public counter for /pricing
];
```

### Pattern 5: Discord alert on new `/connect` completion (Phase 3 telemetry)

**What:** After a new org completes `/connect` — i.e., first `action_record` lands — fire a Discord DM to `DASHCLAW_ALERTS_DISCORD`.

**Mirror the existing pattern:** `fireDiscordApproval` at `app/lib/discordApprovals.js` + the notification adapter at `app/lib/notification-adapters/discord.js`.

**Hook site:** `app/api/actions/route.js` POST handler, after `createAction()`, detect `is_first_action_for_org === true` and emit. Needs a `repositories/actions.repository.js` change to return that boolean (or a cheap `SELECT 1 FROM action_records WHERE org_id = ? LIMIT 1` sidecar query before insert — acceptable given writes are rare vs reads).

**Or cheaper alternative:** Counter-increment pattern. Track an in-memory "orgs seen today" set and emit when a new org appears. Not durable across serverless invocations, but cheap and adequate for a launch-day signal.

**Planner chooses at plan time. Neither is new infra.**

### Anti-Patterns to Avoid

- **Orange as ambient wallpaper on `/pricing`.** Tempting to make the whole counter orange. DON'T — per `.impeccable.md` tiebreaker #2, orange is a SIGNAL. Only the live counter NUMBER uses `text-brand`; everything else is `text-primary`/`text-secondary`.
- **Video autoplay with audio.** Breaks every browser's autoplay policy and jump-scares the visitor. Use `muted` + click-to-play or autoplay-muted. Better: click-to-play only — matches `.impeccable.md` "calm under pressure" (tiebreaker #3).
- **Hero headline that says "AI governance"** — D-13 rejected framing. Also "control plane for agents", "policy-as-code for AI", "your compliance team will love you", "homelab", "works with any agent framework". These are DEAD on arrival.
- **A `/pro/*` route tree.** D-07 explicitly rejects this. Gate at handler level via `requireTier`.
- **A new `@dashclaw/pro` npm package.** D-07 explicitly rejects this.
- **"Upgrade to Pro" buy-CTA in the 403 response.** No paywall is shipping. Response must say "Coming soon" and link to `/pricing`, NOT "buy now". [LOCKED: D-04 / D-07].
- **HN post URL pointing at a half-flipped homepage.** Changing the post URL after submission kills ranking. Homepage MUST be live + incognito-verified before Show HN submission. [VERIFIED: Multiple sources in web research including dev.to/dfarrell/how-to-crush-your-hacker-news-launch — "Small timing shifts won't overcome weak content"; but the inverse — weak content / broken link — kills launches fast.]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Video player | Custom `<video>` element loading MP4 from `/public/videos/` | Loom embed or YouTube embed | Adaptive bitrate + viewer analytics + Vercel free-tier bandwidth headroom. Self-hosted MP4 at launch-day scale burns through Vercel's 100 GB free tier. |
| Feature flag SDK | Bring in `@vercel/flags` or `unleash` | Plain `organizations.plan` + `requireTier` helper | [VERIFIED: `getOrgPlan` already exists at `app/lib/usage.js:81`]. Adding a flag SDK is net-new infra for zero benefit given we have 1 flag (pro). |
| Launch-window analytics | Custom analytics events table | `@vercel/analytics` already wired | `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS` is documented in `.env.example:108`; `app/layout.js:4,69` ships it conditionally. [VERIFIED: 2026-04-22] |
| SSO / RBAC for Pro tier | Shipping SSO this phase | Defer to PAY-01 | D-06 lists SSO as a Pro feature; D-07 explicitly says Phase 3 DESIGNS boundaries but doesn't SHIP the paywall. No SSO code lands in Phase 3. |
| Stripe integration | Wire Stripe into `/pricing` | Do nothing — MON-01 trigger hasn't fired | `organizations.stripeCustomerId` + `organizations.stripeSubscriptionId` columns already exist [VERIFIED: `schema/schema.js:25-26`]. PAY-01 lights them up when MON-01 fires. |
| HN submission automation | Cron job that posts Show HN | Wes posts manually | D-19 locks "Wes-authored only". Automation would be a Phase-4 flywheel feature. |
| Blog post CMS | Import Contentful / Sanity | Plain MDX in the repo | One blog post. Overhead of a CMS kills the 2-hour launch window. |

**Key insight:** Phase 3 is a composition phase. Almost every "new" thing is actually "compose two existing things differently". The only true net-new code is `requireTier` (15 lines), `/pricing/page.js` (a static page with one SSR data call), `/api/monetization/verified-integrations-count` (a 20-line handler), and a CSP frame-src entry (one line in next.config.js).

## Runtime State Inventory

Phase 3 touches 2 of the 5 state categories. The other 3 are empty.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `organizations.plan` column exists, default `'free'` [VERIFIED: schema/schema.js:23]. No row in production has `plan='pro'` today. | None for Phase 3 — `requireTier` reads `plan`; the value 'pro' is only ever set post-MON-01 via seed-data update per D-07. Planner confirms: no schema migration needed. |
| **Live service config** | 4 `<SCREENCAST_URL>` placeholders [VERIFIED: Phase 2 VERIFICATION `app/guides/claude-code/page.js:104,249` + `README.md:8,19`]. One is HTML-entity-encoded (`&lt;SCREENCAST_URL&gt;`) — naive single-form grep misses it. | Backfill with real video URL after recording; use grep pattern from `02-01-SUMMARY.md` section 3 that catches both forms. |
| **OS-registered state** | None — verified by absence of Windows Task Scheduler / pm2 / launchd artifacts in a 2026-04-22 scan of the repo and prior plan summaries. | None. |
| **Secrets / env vars** | None rename. New optional env var: `DASHCLAW_ALERTS_DISCORD` (already documented in `.env.example` per Phase 2 — used for the launch-day new-connect alert). | None — env var already exists in `.env.example`; no new secrets introduced by Phase 3. |
| **Build artifacts / installed packages** | Pre-commit livingcode auto-regen touches `app/lib/doctor/generated/*` + `public/livingcode/*` + `docs/api-inventory.md` whenever `app/api/*`, `app/lib/*`, `middleware.js`, or `schema/schema.js` change [VERIFIED: CLAUDE.md §Generated Artifacts]. Phase 3 adds `/api/monetization/verified-integrations-count/route.js` + modifies `middleware.js` PUBLIC_ROUTES + extends `app/lib/org.js` — so **livingcode will regenerate on the commits that touch these**. | Expected — plan must commit the regenerated artifacts alongside the code change, per established CLAUDE.md policy. NEVER hand-edit them. |

**Nothing found in OS-registered state:** Verified by absence of any references to OS-level scheduling in `.planning/phases/*/` summaries, nor in any `scripts/` directory artifacts. Phase 3 is all-in-repo code + markdown.

## Common Pitfalls

### Pitfall 1: HN URL change after submission kills ranking

**What goes wrong:** You submit Show HN at dashclaw.io, then 10 minutes later push a homepage fix. HN's ranking algorithm treats the URL as canonical and de-prioritizes submissions whose content changed after first votes.

**Why it happens:** HN is optimized against content-swap manipulation. This is a well-known community norm, not a documented algorithm detail.

**How to avoid:**
1. Homepage MUST be live on `dashclaw.io` AND verified in an incognito browser from a fresh IP BEFORE the Show HN submission.
2. Same for `/pricing` and `/connect` — both linked from the homepage, both MUST be live.
3. Screencast URL MUST resolve incognito (Pitfall 8 from Phase 2 research — Loom captcha default).
4. Run `curl -sI https://dashclaw.io | head -1` and verify HTTP 200 before submitting.

**Warning signs:** Multiple "link is broken" comments in the first 10 minutes → demoralizing and rank-killing.

[CITED: dev.to/dfarrell/how-to-crush-your-hacker-news-launch + indiehackers.com post cited in web research]

### Pitfall 2: Loom "anyone with link" default gates behind captcha

**What goes wrong:** Loom's default sharing is "anyone in your workspace"; even switching to "anyone with link" may trigger a captcha for unauthenticated viewers from some IPs.

**Why it happens:** Loom's default workspace-scoping hasn't changed in several years; the toggle to "public" is one click but easy to miss.

**How to avoid:**
1. After upload, explicitly toggle Loom to "Public" (not the default "anyone with link").
2. Verify via incognito browser from phone hotspot (different IP from your dev machine).
3. If Loom still gates, fall back to YouTube Unlisted (D-10 allows both).

**Warning signs:** A reviewer says "the video won't load" or "I got a captcha."

[VERIFIED: Phase 2 RESEARCH §Pitfall 8 (`02-RESEARCH.md:895-900`). Already encoded in D-10.]

### Pitfall 3: CSP `default-src 'self'` blocks Loom/YouTube iframes

**What goes wrong:** Homepage renders, video iframe is `Refused to frame` by browser CSP.

**Why it happens:** `next.config.js:20-35` CSP has `default-src 'self'` + `frame-ancestors 'none'` but no explicit `frame-src` directive. Without `frame-src`, `default-src` is the fallback — blocks any cross-origin iframe including loom.com and youtube-nocookie.com.

**How to avoid:**

```javascript
// next.config.js — inside the csp array:
"frame-src 'self' https://www.loom.com https://www.youtube-nocookie.com",
```

Then `curl -I https://dashclaw.io/ | grep Content-Security-Policy` to verify.

**Warning signs:** DevTools console shows "Refused to frame ... because it violates the Content Security Policy directive" on the homepage.

[CITED: developer.mozilla.org MDN frame-src docs; nextjs.org/docs/pages/guides/content-security-policy]

### Pitfall 4: `.env.local` env-var hijack (Phase 1.5 BUG-04 lesson)

**What goes wrong:** Wes has `DASHCLAW_BASE_URL=http://localhost:3000` in a shell/env var that points at his local `dashclaw-demo` Docker container. The hook reads `.env` correctly, but the shell-level override wins (env precedence). Every tool call gets governed by DEMO policies instead of his real prod instance. Wes sees "Demo Production Guard" blocks during a live-recording session and thinks his prod policies are broken.

**Why it happens:** Env precedence — process env wins over `.env` file. Hook has no sanity check (BUG-04 context).

**How to avoid:**
1. Before the demo recording session: explicitly `echo $DASHCLAW_BASE_URL` and confirm it points at the real prod instance (or is unset, so `.env` wins).
2. Run `curl -s $DASHCLAW_BASE_URL/api/health | jq .version` and verify it's not "demo".
3. Close any `dashclaw-demo` Docker containers before recording.
4. If Phase 1.5 BUG-04 landed, the hook now has `DASHCLAW_GUARD_UNAVAILABLE_POLICY` + startup log showing `base_url`. Eyeball that during the recording setup.

**Warning signs:** `matched_policy: "Demo Production Guard"` in the decision ledger during the recording.

[VERIFIED: Phase 1.5 BUG-04 validation at `.planning/phases/01.5-governance-bugfix/01.5-BUG04-VALIDATION.md:14-24`, plus MEMORY.md §Critical Rules entry.]

### Pitfall 5: Livingcode auto-regen surprises planner

**What goes wrong:** Plan commits `/api/monetization/verified-integrations-count/route.js`. Pre-commit hook fires `npm run livingcode:refresh`, regenerating `app/lib/doctor/generated/*`, `public/livingcode/*`, `docs/api-inventory.md`, `docs/api-inventory.json`, and potentially `docs/openapi/critical-stable.openapi.json`. Planner thinks "I didn't touch these, why are they staged?".

**Why it happens:** `CLAUDE.md` §Generated Artifacts explicitly lists these directories as auto-regenerated whenever `app/api/`, `app/lib/`, `middleware.js`, or `schema/schema.js` changes. Our Phase 3 changes touch 3 of 4 trigger paths.

**How to avoid:**
1. Expect and commit the generated deltas intentionally alongside the code change.
2. NEVER hand-edit any of the listed generated paths.
3. Plan's per-task DONE state should explicitly mention "livingcode auto-regen artifacts included in this commit".

**Warning signs:** `git status` shows 6+ unexpected files after a small `app/api/*` addition.

[VERIFIED: `CLAUDE.md` §Generated Artifacts; Phase 2 03-02 plan commit `1fdf0199` did exactly this and it worked fine.]

### Pitfall 6: Route SQL guardrail trips on new `/api/monetization/*` route

**What goes wrong:** The counter route uses raw SQL via `sql\`SELECT COUNT(DISTINCT org_id)…\``. `npm run route-sql:check` logs an increase in direct-SQL sites from the baseline 85.

**Why it happens:** Project policy (`CLAUDE.md` + PROJECT_DETAILS.md) requires repository pattern — route files call `app/lib/repositories/*.repository.js`, not raw `sql`.

**How to avoid:**
1. Create `app/lib/repositories/monetization.repository.js` with a `countVerifiedIntegrations(sql, options)` function.
2. Route handler imports `countVerifiedIntegrations` from the repository. Zero raw-SQL call in the route file.
3. Confirm `npm run route-sql:check` stays at baseline 85 (or drops — never rises).

**Warning signs:** `route-sql:check` fails with "new direct-SQL site introduced at app/api/monetization/…".

[VERIFIED: Phase 2 02-01 SUMMARY confirms baseline 85 at `d3e96819`. Phase 2 02-02 and 02-03 both held it.]

### Pitfall 7: Pre-existing hardcoded hex at app/guides/claude-code/page.js:204

**What goes wrong:** Phase 3 touches `app/guides/claude-code/page.js` (D-11 — backfill screencast URL at lines 104 + 249). Pre-existing `bg-[#0a0a0a]` at line 204 (from Phase 2-inherited commit `936a2030`). Plan checker flags a hex violation on the diff because the line stays in the file.

**Why it happens:** Tailwind arbitrary-value `bg-[#0a0a0a]` is a `.impeccable.md` tiebreaker #4 violation (token-first, never hardcoded). Phase 2 explicitly did NOT fix it per surgical-change rule.

**How to avoid:** Do NOT fix it in Phase 3 either — surgical-change rule still applies. If the plan checker or verification flags it, cite this carryover note + Phase 2 VERIFICATION.md §Pre-Existing Note (line 271-272) as the acknowledged pre-existing state. File a separate token-migration task if the design team wants cleanup.

**Warning signs:** Plan-checker or verification flags a hex violation on `page.js:204` even though Phase 3's edits are only at lines 104 + 249.

[VERIFIED: `.planning/phases/02-claude-code-beachhead/02-VERIFICATION.md` lines 269-272; Phase 2 03-01 SUMMARY explicitly calls it out.]

### Pitfall 8: Homepage dev-draft in `docs/homepage-draft-claude-code.md` drifts from actual `app/page.js`

**What goes wrong:** Plan 02-03 shipped 806 words of homepage draft at `docs/homepage-draft-claude-code.md`. Phase 3 plan author starts implementing and realizes the draft's "3-step install block" doesn't match the actual shipped install path; or the draft references `/my-agent` narrative structure that changed.

**Why it happens:** The draft was written 2026-04-22 against the shipped state of that day. Between then and Phase 3 execution, hook changes / copy tweaks / BUG-04 fix landed that may have shifted the canonical install path.

**How to avoid:**
1. Before Phase 3 plan kickoff: re-read `docs/homepage-draft-claude-code.md` + verify each concrete claim against the currently-shipped code.
2. Re-verify the 3-step install block matches `README.md:11-14` exactly.
3. Re-verify `/guides/claude-code/page.js` step count matches the draft's description.
4. Re-verify `/my-agent` narrative copy aligns with the hero direction in the draft.

**Warning signs:** Plan implements the draft verbatim and ships — then a reader points out the shipped install command doesn't match what the homepage says.

[VERIFIED: Handoff checklist at `docs/homepage-draft-claude-code.md` lines 102-114 explicitly flags this as "Phase 3 must re-verify". Section explicitly named "Handoff checklist for Phase 3".]

### Pitfall 9: `/connect` rewrite sweeps past the existing hosted provisioning

**What goes wrong:** Plan reads D-15 ("single-page copy-paste runbook") and deletes `HostedProvisionClient.jsx` + `HostedProvisionSection.js`. Breaks the hosted `/connect` provisioning path that mints workspace tokens for visitors on `dashclaw.io`.

**Why it happens:** `app/connect/ConnectGuideClient.js` (247 lines) IS the wizard-flavored path that D-15 rejects. `app/connect/HostedProvisionClient.jsx` (149 lines) + `HostedProvisionSection.js` (40 lines) are the SSR + inline-token-generation pieces the new runbook WANTS. Confusing them at plan time is easy.

**How to avoid:**
1. Plan must explicitly enumerate what each current `app/connect/*` file does before proposing deletes.
2. `HostedProvisionSection.js` + `HostedProvisionClient.jsx` = KEEP (provides D-15's inline workspace-token-generation UX).
3. `ConnectGuideClient.js` = likely REWRITE or TRIM (currently wizard-adjacent; D-15 wants linear).
4. `hostedTemplates.js` = KEEP (provides the template strings for the runbook).

**Warning signs:** Post-rewrite `/connect` returns a white page because the workspace-token UI was removed with the wizard.

### Pitfall 10: Show HN post title format drift

**What goes wrong:** Wes posts `"Show HN: DashClaw – The approval layer for Claude Code (govern rm -rf before it runs)"` and the 80-character limit truncates the punchline to `"(govern rm -rf before it"`.

**Why it happens:** HN title max is 80 characters [CITED: news.ycombinator.com/item?id=40677110]. The UI doesn't always warn cleanly; long titles get truncated mid-word.

**How to avoid:**
1. Count title characters before posting. Target 60–75 for visual buffer.
2. Use the title formulation `"Show HN: <Product> – <one-line value prop>"` (32 + formula + value prop must stay under 80).
3. Test title in a plain text editor with a character counter.

**Warning signs:** Title wraps mid-word on HN front page.

[CITED: news.ycombinator.com/showhn.html (official Show HN guidelines) + news.ycombinator.com/item?id=40677110 (80-char limit thread)]

### Pitfall 11: Tweet thread first tweet misses the hook

**What goes wrong:** Thread opens with company intro: "Hi! I'm Wes, building DashClaw…". First tweet dies at 200 impressions because nothing in it triggers curiosity.

**Why it happens:** X's algorithm ranks first-tweet engagement heavily. A tweet that reads like a press release gets low engagement → low distribution → no thread.

**How to avoid:**
1. First tweet MUST be the concrete problem statement, not the company intro. D-18 matches this: "I got tired of Claude Code running rm -rf. Built DashClaw."
2. Lead with the moment of pain (`rm -rf`, force-push to main) — concrete, relatable, specific.
3. Link only in the last tweet. The thread pulls readers down; the link converts them.
4. Founder-voice, not brand-voice. Per D-18.

**Warning signs:** First tweet impressions < 500 after 30 minutes on a launch day.

### Pitfall 12: Vercel Web Analytics shows noise, not launch-window signal

**What goes wrong:** Plan wires "launch-window analytics" expecting a clean funnel. Vercel Analytics delivers page views by path with bot-stripping — NOT a funnel view, NOT per-user conversion, NOT per-session.

**Why it happens:** `@vercel/analytics` is a page-view package. For funnel / conversion, need events. Vercel events tier requires Pro plan [CITED: vercel.com/pricing Hobby vs Pro].

**How to avoid:**
1. Treat launch-window telemetry as "page view deltas on hero/connect/pricing" only.
2. For conversion to signup, rely on the Discord alert (Pattern 5) + periodic `SELECT COUNT` of recent `/api/setup/*` completions.
3. Don't promise the planner a "conversion rate dashboard". Promise a counter and a Discord ping.

**Warning signs:** Plan includes `analytics.track('launch_cta_click', ...)` calls. Strip them.

[VERIFIED: `package.json:72` ships `@vercel/analytics@2.0.1` — the page-view-only variant. Events would need `@vercel/analytics/events` + Pro plan.]

## Code Examples

### `requireTier` helper (MON-02)

```javascript
// app/lib/org.js — add to the existing file, alongside getOrgRole
// Source: composes existing patterns from app/api/keys/route.js:58 + app/lib/usage.js:81

import { NextResponse } from 'next/server';
import { getSql } from './db.js';
import { getOrgPlan } from './usage.js';

const TIER_RANK = { free: 0, pro: 1 };

export async function requireTier(request, minTier) {
  const orgId = getOrgId(request);
  const sql = getSql();
  const currentTier = await getOrgPlan(orgId, sql);
  const currentRank = TIER_RANK[currentTier] ?? 0;
  const requiredRank = TIER_RANK[minTier] ?? 0;
  if (currentRank >= requiredRank) return null;
  return NextResponse.json({
    error: 'Coming soon',
    code: 'COMING_SOON',
    reason: 'Pro features unlock when DashClaw hits 50 verified Claude Code integrations in the wild. See /pricing for progress.',
    current_tier: currentTier,
    required_tier: minTier,
  }, { status: 403 });
}
```

### Example Pro-gated route (for MON-02 regression test only — no actual Pro feature ships)

```javascript
// __tests__/fixtures/pro-gated-route.js — REGRESSION TEST FIXTURE ONLY
// Wires a route that would be Pro-gated in Phase PAY-01. Ships as a test
// fixture so the requireTier helper has a callsite to exercise against.

import { NextResponse } from 'next/server';
import { requireTier } from '../../app/lib/org.js';

export async function GET(request) {
  const tierBlock = await requireTier(request, 'pro');
  if (tierBlock) return tierBlock;
  return NextResponse.json({ ok: true });
}
```

### Test pattern for `requireTier` (mirror `keys.route.test.js`)

```javascript
// __tests__/unit/require-tier.test.js
// Source: mirror __tests__/unit/keys.route.test.js:62-96 structure

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockSql, mockGetOrgPlan } = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockGetOrgPlan: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/usage.js', () => ({ getOrgPlan: mockGetOrgPlan }));

import { requireTier } from '@/lib/org.js';

describe('requireTier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when org is on required tier', async () => {
    mockGetOrgPlan.mockResolvedValueOnce('pro');
    const result = await requireTier(
      makeRequest('http://localhost/api/any', { headers: { 'x-org-id': 'org_1' } }),
      'pro'
    );
    expect(result).toBeNull();
  });

  it('returns 403 Coming soon when org is free and pro is required', async () => {
    mockGetOrgPlan.mockResolvedValueOnce('free');
    const result = await requireTier(
      makeRequest('http://localhost/api/any', { headers: { 'x-org-id': 'org_1' } }),
      'pro'
    );
    expect(result.status).toBe(403);
    const body = await result.json();
    expect(body.code).toBe('COMING_SOON');
    expect(body.error).toBe('Coming soon');
    expect(body.current_tier).toBe('free');
    expect(body.required_tier).toBe('pro');
    expect(body.reason).toContain('50 verified');
    expect(body.reason).toContain('/pricing');
    // Explicit negative assertions — verifies we're NOT shipping a paywall CTA
    expect(body.reason).not.toMatch(/buy|upgrade|subscribe|pay/i);
  });
});
```

### Homepage hero video embed (DOG-02, DOG-03)

```jsx
// app/components/VideoHero.js — NEW
// Source: composes MDN frame-src + Loom/YouTube embed docs

export default function VideoHero({ src, title }) {
  const isLoom = src.includes('loom.com');
  const isYouTube = src.includes('youtube') || src.includes('youtu.be');
  if (!isLoom && !isYouTube) {
    throw new Error('VideoHero: src must be Loom or YouTube URL');
  }
  return (
    <div className="relative w-full aspect-video overflow-hidden rounded-xl border border-border-hover shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_30px_90px_rgba(0,0,0,0.55)]">
      <iframe
        src={src}
        title={title}
        allow="autoplay; fullscreen; encrypted-media"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}
```

### `next.config.js` CSP addition (for DOG-02 video embed)

```javascript
// next.config.js — add one line inside the csp array, after "frame-ancestors 'none'"
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''}`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://api.dicebear.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.neon.tech https://github.com https://accounts.google.com https://checkout.stripe.com https://billing.stripe.com",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "frame-src 'self' https://www.loom.com https://www.youtube-nocookie.com",   // ADD
  "form-action 'self'",
  ...(isTLS ? ['upgrade-insecure-requests', 'block-all-mixed-content'] : []),
].join('; ');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static `<video>` MP4 hero | Loom / YouTube embed iframe | Industry-standard since ~2020; Loom specifically is Phase 3's primary path | Zero hosting cost, adaptive bitrate, viewer analytics out of the box |
| Pricing page = Stripe-integrated 3-column table | Pricing page = public commitment paragraph + roadmap link (for pre-billing projects) | Unclear standard; DashClaw's case is unusual | Framing it as "roadmap + trigger" rather than "price table" avoids "vapor-tier" criticism in HN comments |
| Feature flag SDK (LaunchDarkly / Optimizely / Unleash) | Plain DB column + server-side helper for single-tier MVPs | Ongoing — SDKs pay off at 10+ flags, not 1 | Avoids new vendor + avoids network hop on every request |
| Autoplay-with-audio hero video | Click-to-play or autoplay-muted | Browser autoplay policies (2018+) | Autoplay-audio silently fails; click-to-play respects visitor agency |

**Deprecated/outdated:**

- **YouTube embeds on `youtube.com`**: Prefer `youtube-nocookie.com` for GDPR-friendly / cookieless embeds. [CITED: developer.mozilla.org + YouTube privacy-enhanced mode docs]
- **Loom's `/share/<id>` URL in iframes**: Doesn't render as embed; use `/embed/<id>`.

## Launch Mechanics Research (D-17, D-18, D-19)

### Show HN — 2026-vintage timing

| Axis | Guidance |
|------|----------|
| **Day** | Tue, Wed, Thu. Monday = post-weekend backlog dominates front page; Friday = dead zone. [CITED: dev.to/dfarrell/how-to-crush-your-hacker-news-launch + myriade.ai/blogs/when-is-it-the-best-time-to-post-on-show-hn + quora] |
| **Time** | 08:00–11:00 ET — HN's algorithm front-loads the day's new posts. D-17 locked. |
| **Specific hour** | 9:00 ET is a common sweet spot — peak coverage of US East coast + West coast waking up + EU still at desk. [MEDIUM confidence; one informed source, no peer-reviewed data.] |
| **Title length** | ≤80 characters hard limit. Target 60–75 for UI buffer. [CITED: news.ycombinator.com/item?id=40677110] |
| **Title format** | `Show HN: <Product> – <one-line value prop>` is the canonical pattern. Avoid ALL CAPS, exclamation marks, emoji. [CITED: news.ycombinator.com/showhn.html] |
| **Post body structure** | Problem → demo link → what makes it different → ask for feedback. 150-300 words. D-18's tone constraint applies. |
| **Reply cadence** | First 30 minutes: reply to every top-level comment. First 2 hours: reply within 5 minutes. Next 4 hours: reply within 30 minutes. After 6 hours: daily. [D-19: within 30 minutes during peak window — tighten to 5 min during first 2 hours per research.] |
| **Early upvotes** | 3–10 seed upvotes from trusted-account friends in the first hour. Do NOT ask for upvotes publicly (HN's anti-vote-ring rules flag this). Just tell friends when the post is live. |
| **Front page threshold** | ~5 votes in 5 minutes typically lands a Show HN on the front page; sustained 10–20 min window keeps it there. [MEDIUM confidence; community-known, not documented.] |

### Tweet thread — "technical + specific + personal" tone

| Pattern | What to do | D-18 alignment |
|---------|-----------|----------------|
| **First tweet** | Problem statement + product mention, NO company intro. "I got tired of Claude Code running rm -rf. Built DashClaw." | ✓ Matches |
| **Second tweet** | 1-sentence "what it does" + screenshot or gif. | — |
| **Middle tweets (3–6)** | One concrete example per tweet. Real command, real block. No hype. | ✓ Matches "technical + specific" |
| **Closing tweet** | Public monetization trigger commitment as the ask. "Free forever until 50 verified Claude Code integrations. Then Pro launches." Link to `dashclaw.io` LAST. | ✓ Matches D-03 |
| **Length** | 6–10 tweets. Too short = feels incomplete; too long = reader drops off. | — |
| **Pinned** | Pin the first tweet of the launch thread for the duration of the launch window. | — |

### Blog post — `dashclaw.io` same-day post

| Structural element | Guidance |
|-------------------|----------|
| **Length** | 600–1200 words. Matches Plausible's self-hosted launch post length (~900 words) + Linear Method posts. |
| **Header structure** | H1 = title / H2 = sections (Problem / Demo / How it works / What's free / The 50-integration commitment / What's next). 5–6 H2s max. |
| **Image ratio** | 1 image per 200-300 words. Include the hero GIF, 1 /decisions screenshot, 1 /my-agent screenshot. All from real dogfood. No stock. |
| **Voice** | Founder-voice first person. "I got tired of…" not "DashClaw addresses…". D-18 tone applies. |
| **CTA placement** | Inline at the end of each section (Links to `/guides/claude-code`, `/pricing`) and one final CTA block. |
| **Timing** | Posted minutes BEFORE the HN submission so the HN post body can link to the blog post. |

### Reddit cross-post (NOT Phase 3 — backlog noted)

- Candidate subs for post-launch: `r/programming`, `r/LocalLLaMA`, `r/ClaudeAI`, `r/experienceddevs`, `r/opensource`.
- Phase 3 scope is HN + Twitter + blog only. Reddit cross-posts are Phase 4 growth-flywheel territory.

## Validation Architecture (Nyquist Dimension 8)

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (existing) + React Testing Library (existing) |
| Config file | `vitest.config.js` (existing, verified at Phase 2 close) |
| Quick run command | `vitest run __tests__/unit/<file>` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| **DOG-02** | `<SCREENCAST_URL>` placeholders are backfilled in all 4 locations (3 raw + 1 HTML-entity-encoded) | integration (script) | `node scripts/check-screencast-backfilled.mjs` (NEW — ❌ Wave 0) | ❌ Wave 0 — create |
| **DOG-02** | Homepage hero renders video embed iframe | React Testing Library | `vitest run __tests__/unit/homepage.test.jsx` — assert `<iframe src=.../(loom|youtube-nocookie).com/...`  | ❌ Wave 0 — create |
| **DOG-03** | Homepage hero headline matches the voice/direction (flexible contains-check) | unit | `vitest run __tests__/unit/homepage.test.jsx` — assert hero contains "Claude Code" | ❌ Wave 0 — create |
| **DOG-03** | Homepage NEGATIVE assertion — 4 rejected framings absent | unit | `vitest run __tests__/unit/homepage-rejected-framings.test.jsx` — assert rendered HTML does NOT contain: "homelab", "SOC 2" in hero, "compliance team", "control plane for agents", "policy-as-code for AI", "works with any agent framework" | ❌ Wave 0 — create |
| **DOG-03** | `/connect` is single-page (no multi-step wizard state machine) | unit | `vitest run __tests__/unit/connect-page.test.jsx` — assert no step-N-of-M UI, no `useState(step, …)` with N > 1 | ❌ Wave 0 — create |
| **DOG-03** | `/connect` workspace-token generation works inline (same as existing HostedProvision) | integration | `vitest run __tests__/unit/hosted-provision.test.jsx` (may already exist per HostedProvisionClient.jsx — planner verifies) | ⚠️ Verify at plan time |
| **DOG-04** | Blog post file exists at expected path + minimum word count | script | `node scripts/check-blog-post.mjs` — assert file exists, ≥600 words, contains `<SCREENCAST_URL>` backfill | ❌ Wave 0 — create |
| **MON-01** | PROJECT.md contains the canonical monetization trigger paragraph | grep | `grep -E "50.*verified Claude Code" .planning/PROJECT.md` | n/a — script |
| **MON-01** | README.md contains the monetization trigger paragraph | grep | `grep -E "50.*verified Claude Code" README.md` | n/a — script |
| **MON-01** | `/pricing` page renders the trigger commitment | unit | `vitest run __tests__/unit/pricing-page.test.jsx` — assert rendered HTML contains "50 verified" + "semantic guard" + "Free forever" + NO paywall/buy CTA | ❌ Wave 0 — create |
| **MON-01** | `/api/monetization/verified-integrations-count` returns `{ count, target: 50 }` | unit | `vitest run __tests__/unit/verified-integrations-count.route.test.js` | ❌ Wave 0 — create |
| **MON-02** | `requireTier('pro')` returns null for pro org | unit | `vitest run __tests__/unit/require-tier.test.js` | ❌ Wave 0 — create |
| **MON-02** | `requireTier('pro')` returns 403 COMING_SOON for free org | unit | same file as above | ❌ Wave 0 — create |
| **MON-02** | `requireTier('pro')` response body contains NO buy/upgrade/subscribe CTA | unit | same file as above; explicit negative regex assert | ❌ Wave 0 — create |
| **MON-02** | Admin-gate at existing 15 routes still works (non-regression) | unit | `npm test` full suite at `20da4798` baseline | ✅ Exists (Phase 2 baseline) |
| **Phase-3 overall** | Manual verification: screencast URL resolves in incognito | manual | Human loads URL on phone hotspot, confirms no captcha | n/a — human |
| **Phase-3 overall** | Manual verification: homepage on dashclaw.io before HN submit | manual | `curl -sI https://dashclaw.io` returns 200 + incognito-loaded hero shows video + CTAs | n/a — human |
| **DOG-04 launch-day** | Discord alert fires on new `/connect` completion | integration | `vitest run __tests__/unit/connect-complete-discord-alert.test.js` — mock `fetch` to Discord webhook, assert POST with embed body | ❌ Wave 0 — create |
| **Phase-3 overall** | `check-readme-lead.mjs` still exits 0 (non-regression) | script | `node scripts/check-readme-lead.mjs` | ✅ Exists |
| **Phase-3 overall** | Static guardrails — lint, route-sql:check, openapi:check, api-inventory:check, docs:check | script | chain of existing npm scripts | ✅ Exists |

### Sampling Rate

- **Per task commit:** `npm test __tests__/unit/<relevant-file>` + `node scripts/check-readme-lead.mjs`
- **Per wave merge:** `npm test` full suite + all static guardrails
- **Phase gate:** Full suite green + manual incognito-verify of homepage + manual screencast URL check + curl dashclaw.io = 200, before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `__tests__/unit/homepage.test.jsx` — DOG-03 hero assertion
- [ ] `__tests__/unit/homepage-rejected-framings.test.jsx` — DOG-03 negative assertion
- [ ] `__tests__/unit/connect-page.test.jsx` — DOG-03 single-page structure
- [ ] `__tests__/unit/pricing-page.test.jsx` — MON-01 commitment text
- [ ] `__tests__/unit/verified-integrations-count.route.test.js` — MON-01 API route
- [ ] `__tests__/unit/require-tier.test.js` — MON-02 tier-gate helper
- [ ] `__tests__/unit/connect-complete-discord-alert.test.js` — DOG-04 launch-day alert
- [ ] `scripts/check-screencast-backfilled.mjs` — DOG-02 placeholder-verified script
- [ ] `scripts/check-blog-post.mjs` — DOG-04 blog post existence + structure script

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | Partial | `/api/monetization/verified-integrations-count` is PUBLIC_ROUTES + unauthenticated (intentional; counter is public). No auth change needed elsewhere. |
| V3 Session Management | No | No session work in Phase 3 |
| V4 Access Control | **Yes** | `requireTier` handler-level gate mirrors the existing `getOrgRole !== 'admin'` pattern — enforced server-side, consistent with the 15-route admin-gate baseline |
| V5 Input Validation | Partial | `/api/monetization/verified-integrations-count` has no inputs (GET-only, no params). `/pricing` + homepage are static SSR. |
| V6 Cryptography | No | No new crypto — iframe embed is URL-based, signed-URL not applicable |
| V7 Error Handling & Logging | **Yes** | `requireTier` response is `{ error: 'Coming soon', code: 'COMING_SOON' }` — no stack traces, no internal structure leaked |
| V11 Business Logic | **Yes** | MON-01 trigger counter is a public metric — must be accurate but not privileged; public exposure is intentional per D-03 |

### Known Threat Patterns for Phase 3 stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Clickjacking on homepage (video frame manipulated into a login page) | Tampering | `X-Frame-Options: DENY` already set + `frame-ancestors 'none'` in CSP [VERIFIED: `next.config.js:42-44` + `middleware.js:72`] |
| SSRF via video embed URL | Tampering | `VideoHero` component's URL allowlist check for loom.com + youtube-nocookie.com only (see Code Example above — throws on non-allowed host) |
| Information disclosure via verified-integrations-count (leaking customer org IDs) | Information Disclosure | Route returns only `{ count: int, target: 50 }` — no org IDs, no per-org data. Explicitly tested. |
| `requireTier` bypass via header injection (`x-org-role: admin` in request) | Spoofing | `middleware.js:1076` strips `x-org-id` / `x-org-role` / `x-user-id` headers from inbound API requests — only middleware-injected values reach handlers [VERIFIED] |
| Discord webhook URL hijack (if new-connect alert webhook URL leaks) | Information Disclosure | Webhook URL lives in `DASHCLAW_ALERTS_DISCORD` env var — never in code, never in git, never in logs. Mirror `.env.example` pattern. |
| HN / Twitter / blog content links → malicious URL | Tampering (social) | Wes-authored only (D-19); no auto-drafted replies (explicit deferral to Phase 4). Human-in-the-loop mitigates. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 20+ | Everything | ✓ | assumed | — |
| `@vercel/analytics` | Launch-window telemetry | ✓ | 2.0.1 [VERIFIED: package.json:72] | — |
| `organizations.plan` DB column | `requireTier` | ✓ | present, `text default 'free'` [VERIFIED: schema/schema.js:23] | — |
| Discord webhook URL (`DASHCLAW_ALERTS_DISCORD`) | Launch-window new-connect alert | ⚠️ — documented in `.env.example` per Phase 2, must be populated | — | Skip Discord alert entirely; Phase 3 still ships. |
| Loom account for video upload | DOG-02 hosting | ⚠️ — operator-side (Wes) | — | YouTube Unlisted (D-10 allows both) |
| Incognito-capable browser + mobile hotspot | DOG-02 URL verify | ✓ | — | — |
| `dashclaw.io` domain | Launch surface | ✓ | production deployment assumed | Launch targets the `.vercel.app` URL (acceptable fallback, lower trust) |
| Hacker News account with ≥500 karma | Optional for post promotion | ⚠️ — operator-side | — | Any HN account works; karma just weights vote impact |
| X / Twitter account for tweet thread | DOG-04 | ⚠️ — operator-side (Wes) | — | Blog post + HN post only if X unavailable (degrades D-16 reach) |

**Missing dependencies with no fallback:**
- None that block Phase 3 execution. Everything has a degrade path.

**Missing dependencies with fallback:**
- Loom → YouTube Unlisted (D-10 already allows both).
- Discord alert → Plain log statement (acceptable for dogfood launch; can backfill alert later).

## Sources

### Primary (HIGH confidence — verified via code read or tool)

- `schema/schema.js:23` — `organizations.plan` column exists with `text default 'free'` [VERIFIED 2026-04-22]
- `app/lib/usage.js:81` — `getOrgPlan()` helper already queries the plan column [VERIFIED]
- `app/lib/usage.js:38-47` — `PLAN_LIMITS.pro` exists with all-Infinity values [VERIFIED]
- `app/lib/org.js:10` — `getOrgRole()` existing helper [VERIFIED]
- `app/api/keys/route.js:58` + `app/api/settings/route.js:91,143` + `app/api/webhooks/route.js:47,100` + 11 more — canonical admin-gate pattern at 15+ sites [VERIFIED via grep]
- `next.config.js:20-35` — current CSP has no `frame-src`, needs addition for video embed [VERIFIED]
- `middleware.js:27-42` — `PUBLIC_ROUTES` array, new counter route must be added here [VERIFIED]
- `middleware.js:1071-1078` — header-stripping for `x-org-id`/`x-org-role`/`x-user-id` on inbound API requests [VERIFIED]
- `middleware.js:265` — `apiKeyCache` pattern to mirror for `planTierCache` if added [VERIFIED]
- `app/page.js` (932 lines) — current homepage, hero at lines 38-50 [VERIFIED]
- `app/connect/` (5 files, 743 lines total) — current `/connect` structure [VERIFIED]
- `app/layout.js:4,69` — `@vercel/analytics` conditional wiring [VERIFIED]
- `package.json:72` — `@vercel/analytics@2.0.1` installed [VERIFIED]
- `docs/homepage-draft-claude-code.md` — 806-word Phase 2 handoff artifact with hero draft, voice notes, anti-references guardrail [VERIFIED]
- `README.md:8,19` + `app/guides/claude-code/page.js:104,249` — 4 `<SCREENCAST_URL>` placeholders [VERIFIED via grep]
- `__tests__/unit/keys.route.test.js:62-96` — test pattern to mirror for `requireTier` [VERIFIED]
- `__tests__/unit/approvals.page.test.jsx` — admin-gate UI test pattern [VERIFIED]
- `.planning/phases/02-claude-code-beachhead/02-RESEARCH.md:895-900` — Pitfall 8 Loom captcha default [VERIFIED]
- `.planning/phases/01.5-governance-bugfix/01.5-BUG04-VALIDATION.md:14-24` — env-var hijack precedent [VERIFIED]
- `.planning/phases/02-claude-code-beachhead/02-VERIFICATION.md:269-272` — pre-existing hex at `page.js:204` acknowledged [VERIFIED]
- `CLAUDE.md` §Generated Artifacts + §Design Context + §SDK Docs Checklist [VERIFIED]
- `.impeccable.md` — 7 tiebreakers, 4 anti-references, token layer [VERIFIED]

### Secondary (MEDIUM confidence — web research verified against at least one additional source)

- [Show HN Guidelines](https://news.ycombinator.com/showhn.html) — official format rules
- [HN 80-char title limit](https://news.ycombinator.com/item?id=40677110) — community-confirmed
- [MDN `frame-src` directive](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-src) — CSP behavior
- [Next.js CSP guide](https://nextjs.org/docs/pages/guides/content-security-policy) — Next.js-specific implementation
- [YouTube-nocookie MDN + docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy) — privacy-enhanced variant
- [Hero section design 2026 guide](https://contentmation.com/conversion/hero-section-design-guide) — above-fold video patterns
- [Launch video for AI tools 2026](https://www.flowjam.com/blog/launch-video-for-ai-tools-ship-faster-2026) — autoplay-muted pattern
- [How to crush Hacker News launch](https://dev.to/dfarrell/how-to-crush-your-hacker-news-launch-10jk) — reply cadence + early upvote strategy
- [When to post Show HN](https://www.myriade.ai/blogs/when-is-it-the-best-time-to-post-on-show-hn) — Tue-Thu 8-11am ET
- [Vercel pricing page](https://vercel.com/pricing) — Hobby vs Pro (reference for non-applicability)
- [PostHog pricing](https://posthog.com/pricing) — generous-free-tier framing
- [Flags SDK template](https://vercel.com/templates/next.js/vercel-flags-with-flags-sdk-and-next-js) — alternative considered, rejected
- [SaaS feature flags guide](https://designrevision.com/blog/saas-feature-flags-guide) — tier-flag pattern

### Tertiary (LOW confidence — single source, needs validation at plan time)

- [Best time to post on HN](https://www.quora.com/When-is-the-best-time-to-post-on-Hacker-News-to-get-and-stay-long-on-the-front-page) — single-source timing
- "9am ET is the sweet spot within the 8-11am window" — inferred from multiple informal sources, no documented algorithm

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `dashclaw.io` blog post lives in a separate `dashclaw-website` repo (marketing site), not in this monorepo's `app/blog/` | Architecture — blog post artifact | MEDIUM. If blog actually lives in this repo, Phase 3 plan adds a `app/blog/claude-code-beachhead.mdx` surface + likely a new `/blog/[slug]/page.js` route. If it lives in a separate repo, Phase 3 plan needs a cross-repo coordination step. Planner MUST verify location at plan kickoff. |
| A2 | HN's 8-11am ET window is still the right window in 2026 | Launch timing (D-17) | LOW. D-17 is locked and aligns with current research. Minor drift in exact hour is acceptable. |
| A3 | Loom "public" setting currently exists and behaves as documented | DOG-02 hosting | LOW. D-10 explicitly allows YouTube fallback. Verify at upload time via incognito. |
| A4 | Vercel free-tier bandwidth can absorb a launch-day spike without throttling | Budget | MEDIUM. Vercel Hobby tier has 100 GB/month bandwidth. 10,000 visitors × 2 MB homepage = 20 GB. Acceptable. Spikes above 5× expected traffic could throttle. Mitigation: Loom/YouTube embeds offload video bandwidth from our budget. |
| A5 | Launching without SSO is acceptable to Pro-tier HN readers | DOG-04 narrative | LOW. SSO is explicitly a Pro feature (D-06). Free tier is solo-dev; HN audience understands this. |
| A6 | Wes's X / Twitter account has enough reach for the thread to matter | DOG-04 | MEDIUM. Founder has 207-star repo — follower count on X unknown. If <500 followers, tweet thread plays a supporting role to HN, not primary. Acceptable. |
| A7 | The Phase 2 homepage draft (806 words) accurately reflects the currently-shipped integration path | DOG-03 | MEDIUM. Draft was written 2026-04-22; Phase 3 executes later. Handoff checklist in draft line 104-114 explicitly flags this. Plan MUST re-verify. |
| A8 | `action_records.agent_id` contains a pattern that uniquely identifies Claude Code agents (e.g., "claude-code" prefix) | MON-01 counter SQL | HIGH. D-01 says SQL-measurable. If Claude Code hook emits a generic agent_id (e.g., session ID, user-configured name), the counter query is ambiguous. Planner MUST inspect real dogfood data at plan time and lock the exact WHERE clause. |
| A9 | Blog post can be posted minutes before HN (no scheduling issues) | DOG-04 timing | LOW. Only a timing concern; worst case blog posts 5 min after HN and we live. |
| A10 | The CSP `frame-src` addition doesn't break any existing embed in the app | DOG-02 CSP change | LOW. Current CSP has no embedded external iframes (verified — only img-src hosts). Adding `frame-src` only permits, never denies. Safe. |
| A11 | Adding `plan` values beyond 'free'/'pro' stays compatible with the existing `getOrgPlan` fallback (`return rows.length > 0 ? (rows[0].plan || 'free') : 'free'`) | MON-02 | LOW. `app/lib/usage.js:81` falls back to 'free' on any missing/null value. Safe for any `text` value in the column. |

**11 items flagged. The planner and discuss-phase should confirm A8 in particular before locking the MON-01 counter SQL.**

## Open Questions (RESOLVED)

All 5 questions below were resolved during planning (2026-04-22). Left in place as a traceability audit trail — the "RESOLVED" markers encode where each answer landed in the plan set.

1. **Where does `dashclaw.io` blog live — this repo or a separate `dashclaw-website` repo?** *(A1)*
   - What we know: No `app/blog/` in this repo. `dashclaw.io` links to `/guides/claude-code` from the marketing site.
   - What's unclear: Whether the blog post ships as MDX in this repo (and dashclaw.io pulls it) or as a separate markdown file in a sibling marketing repo.
   - **RESOLVED: in-monorepo.** Planner verified 2026-04-22 that no `app/blog/` segment exists and no `../dashclaw-website` sibling repo exists. Plan 03-02 Task 2 creates `app/blog/claude-code-beachhead/page.js` as a simple SSR segment route (mirrors `app/guides/claude-code/page.js` pattern — no MDX dependency). See `<assumption_resolution>` in Plans 03-01 and 03-02.

2. **What's the exact `agent_id` pattern that identifies a Claude Code integration?** *(A8)*
   - What we know: D-01 says SQL-measurable. `action_records.agent_id` column exists.
   - What's unclear: Whether the Claude Code hook sets `agent_id = 'claude-code'`, `agent_id = <session-id>`, or something user-configured.
   - **RESOLVED: `agent_id ILIKE 'claude-code%'`** grounded in `hooks/dashclaw_pretool.py:75` where `AGENT_ID = os.environ.get("DASHCLAW_AGENT_ID") or "claude-code"`. The ILIKE prefix pattern catches the default and user overrides like `claude-code-wes-laptop`. Repository at `app/lib/repositories/monetization.repository.js` also excludes `org_default` + `org_demo` and enforces a 90-day recency window. See Plan 03-03 Task 2 `<assumption_resolution>`.

3. **Does Vercel Web Analytics respect `DASHCLAW_MODE=demo` instances, or will demo page views pollute launch-window numbers?**
   - What we know: `app/layout.js:55-59` enables Analytics on any `VERCEL === '1'` or explicit opt-in.
   - What's unclear: Whether demo cookie visits land in the same Analytics bucket as prod visits.
   - **RESOLVED: deferred to PAY-01.** Acceptable pollution for launch day; comes out in the wash. Not a Phase 3 blocker — explicitly scoped out.

4. **Click-to-play vs autoplay-muted for the hero video?**
   - What we know: `.impeccable.md` tiebreaker #3 = calm under pressure; autoplay is movement.
   - What's unclear: Whether click-to-play kills conversion vs. autoplay-muted.
   - **RESOLVED: click-to-play.** Matches `.impeccable.md` tiebreaker #3 (calm under pressure) and the token-first VideoHero shape in Plan 03-01 Task 1. If conversion tanks post-launch, iterate — MINOR.

5. **Should the 4 `<SCREENCAST_URL>` locations be backfilled in a single commit or a single PR?**
   - What we know: Phase 2 02-01-SUMMARY section 3 specifies a single commit `docs(02): backfill CCI-05 screencast URL after walkthrough recording`.
   - What's unclear: Whether Phase 3's hero embed should also land in that commit, or a subsequent one.
   - **RESOLVED: single commit.** Plan 03-01 Task 4 is an atomic task that flips the VideoHero src + backfills all 4 `<SCREENCAST_URL>` placeholders (2 README.md + 1 raw + 1 HTML-entity-encoded in app/guides/claude-code/page.js) in one commit: `docs(03-01): backfill CCI-05 screencast URLs + flip VideoHero to live video (DOG-02)`.

## What the Planner Should NOT Research Further

**These 20 locked decisions are from CONTEXT.md. Do not second-guess. Do not research alternatives.**

| Locked | Do not research |
|--------|-----------------|
| **D-01** | Alternative monetization triggers (500 WAU / founder-time / inbound). Locked: 50 verified Claude Code integrations. |
| **D-02** | Time-backstops on the trigger. Locked: no backstop. |
| **D-03** | Fewer than 4 public locations. Locked: PROJECT.md + README.md + /pricing + launch tweet/HN. |
| **D-04** | Multi-tier (Team / Enterprise). Locked: Free + Pro only. |
| **D-05** | Moving semantic guard / audit ledger / Discord approvals to Pro. Locked: all free forever. |
| **D-06** | Adding/removing Pro features. Locked: orgs+SSO, custom pack authoring, audit export, non-Claude-Code integrations. |
| **D-07** | `/pro/*` route tree or `@dashclaw/pro` npm package. Locked: handler-level `requireTier` middleware only. |
| **D-08** | Recording a new video distinct from Phase 2's walkthrough. Locked: same recording serves both. |
| **D-09** | Longer than 3:00 or shorter than current state. Locked: ≤3:00, raw, no slides. |
| **D-10** | Self-hosted MP4 or Vimeo or any host other than Loom/YouTube. Locked: Loom public OR YouTube Unlisted. |
| **D-11** | Fewer than 3 embed locations. Locked: homepage hero + `/guides/claude-code` + README. |
| **D-12** | Voice other than "technical + terse". Locked. |
| **D-13** | Reintroducing any of the 4 rejected framings. Locked: homelab, enterprise compliance, generic governance abstractions, multi-agent positioning all removed. |
| **D-14** | Different CTA ordering (e.g., Install first, Watch second). Locked: Watch demo → Install → Star. |
| **D-15** | Multi-step `/connect` wizard. Locked: single-page copy-paste runbook. |
| **D-16** | Staggered or phased launch. Locked: same-day 2-hour blitz. |
| **D-17** | Monday, Friday, evening, weekend HN posts. Locked: Tue–Thu 8–11am ET. |
| **D-18** | Marketing-voice or brand-voice tweet thread. Locked: technical + specific + personal, founder-voice. |
| **D-19** | Automated/content-agent HN reply queue. Locked: Wes-authored only, fast + honest, 30-min peak window. |
| **D-20** | Multi-post blog series or long-form think-piece. Locked: one post, problem → demo → dogfood story, same voice as homepage. |

**Plus the 4 OUT-OF-SCOPE / deferred items from the deferred list:** live sandbox, actual paywall, Phase 4 flywheel agents, Cursor/Aider/Devin integrations.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all-existing, zero-new-dep phase; libraries verified against `package.json`
- Architecture (requireTier, /pricing, counter): HIGH — composed from existing patterns at verified file:line locations
- Launch mechanics (Show HN, tweet thread, blog): MEDIUM — web sources are community-informed, not documented algorithm behavior
- Pitfalls: HIGH — 8 of 12 directly carried from verified Phase 1.5 / Phase 2 close states
- CSP frame-src: HIGH — MDN + Next.js docs + existing next.config.js read all align
- Blog location (A1): MEDIUM — explicit open question for plan time
- Monetization counter SQL (A8): MEDIUM — depends on `agent_id` pattern inspection at plan time

**Research date:** 2026-04-22

**Valid until:** 2026-05-22 (30 days — dev-tool ecosystem stable; Show HN timing may drift in 3-6 month cycles, so re-verify D-17 at launch-ready time if delayed beyond 30 days)

---

## RESEARCH COMPLETE

**Phase:** 03 — Public Launch
**Confidence:** HIGH (architecture + stack) / MEDIUM (launch mechanics)

### Key Findings

- **Zero schema migration, zero new npm deps.** `organizations.plan` column + `getOrgPlan()` + `PLAN_LIMITS.pro` all already exist. `requireTier('pro')` is ~15 lines of composition in `app/lib/org.js`.
- **MON-02 flip-to-paid is a SQL seed-data update, not a refactor.** `UPDATE organizations SET plan='pro' WHERE id = 'org_<customer>'`. No code deploy when MON-01 fires.
- **Phase 2 left 4 `<SCREENCAST_URL>` placeholders (3 raw + 1 HTML-entity-encoded) that Phase 3 backfills in a single commit — closing Phase 2 gaps and landing Phase 3 hero in one atomic move.**
- **CSP needs a single `frame-src` addition (one line in `next.config.js`) to permit Loom/YouTube iframes. Currently blocked by `default-src 'self'`.**
- **`/pricing` is a public-commitment page, not a Stripe-integrated pricing table. No precedent — lean on `.impeccable.md` design language.**
- **12 pitfalls catalogued, 8 carrying forward from verified Phase 1.5/Phase 2 close states. HN URL-change after submission is the highest-impact new risk.**
- **11 assumptions flagged, 1 high-risk (A8 — `agent_id` pattern for counter SQL) that needs plan-time verification against real dogfood data.**

### File Created

`.planning/phases/03-public-launch/03-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard stack | HIGH | All-existing libs verified against package.json + file reads |
| `requireTier` pattern | HIGH | Mirrors 15-call-site admin-gate; existing `plan` column + helper |
| `/pricing` structure | MEDIUM | No direct precedent for "committed-not-billing"; design language carries it |
| CSP frame-src addition | HIGH | MDN + Next.js docs + existing next.config.js read align |
| Show HN timing | MEDIUM | Community-informed, not documented algorithm |
| Blog post location (A1) | LOW | Explicit open question — plan must verify |
| Counter SQL (A8) | MEDIUM | Depends on agent_id pattern — plan must verify |
| Pitfalls | HIGH | Most carry forward from verified prior-phase close states |

### Open Questions

- A1: Blog post repo location (this monorepo `app/blog/` vs sibling `dashclaw-website` repo)
- A8: `agent_id` pattern for MON-01 counter SQL (inspect real dogfood data at plan time)
- Click-to-play vs autoplay-muted for hero video (recommendation: click-to-play, matches `.impeccable.md`)

### Ready for Planning

Research complete. Planner can now create PLAN.md files for Phase 3. Recommended plan split:
- **03-01:** Flagship video + homepage rewrite + `/connect` runbook (DOG-02, DOG-03) — single atomic deliverable because all share voice + video URL
- **03-02:** Launch content bundle + launch-window telemetry + Discord alert (DOG-04)
- **03-03:** `/pricing` page + `requireTier('pro')` helper + verified-integrations counter + canonical monetization commitment in PROJECT.md/README.md (MON-01, MON-02)

Hard ordering constraint: 03-01 homepage MUST be live + incognito-verified before 03-02 publishes the Show HN post.
