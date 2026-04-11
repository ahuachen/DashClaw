# Phase 1: Foundation — Research

**Researched:** 2026-04-11
**Scope:** Activation fixes (FIX-01..04) + first-ever user research pass (USR-01..03) + founder dogfood commitment (DOG-01)
**Sources:** Local repo (verified), `gh api` commit fetches from RyanTJoy/DashClaw and elpolini/DashClaw forks, SIGNAL.md

---

## 01-01 Activation Fixes — Findings

### A. lucide-react Github icon (#71) — FIX-01

**Current state: ALREADY FIXED. No code change needed.**

- `package.json` pins `"lucide-react": "^0.577.0"` [VERIFIED: package.json line 69]
- Installed version in `node_modules` is `0.577.0` [VERIFIED: node_modules/lucide-react/package.json]
- `Github` is exported from 0.577.0 — confirmed via `require('lucide-react').Github` → `object` [VERIFIED: runtime check]
- `Github` is imported in 5 files: `PublicFooter.js`, `PublicNavbar.js`, `LoginClient.js`, `self-host/SetupTabs.js`, `toolkit/page.js` [VERIFIED: grep]
- Wes's own close comment on issue #71 (2026-04-07) confirms: "current lucide-react version is 0.577.0, Github is still exported, local production build passes, latest main build is green" [VERIFIED: gh issue view 71]

**What the reporter saw:** krimsonzcv-rgb cloned the repo when lucide-react was at an older version that dropped `Github`. The `^` range in package.json allowed an older installed version. Since then, either the package was updated or the range pinned to a working version.

**Planner action for 01-01:** Regression guard only. Add a `npm run build` smoke test on a clean Node 20 machine (or CI step) that catches missing lucide-react exports before they reach production. No icon swap needed.

**Risk:** The `^0.577.0` range could resolve to a future version that drops `Github` again. Pinning to `0.577.0` exactly would eliminate the risk, but that's a minor tradeoff against security patch reception.

---

### B. 502 on docs / broken API key retrieval (#31) — FIX-02

**Root cause: Two separate issues at the time of the report (2026-03-04), both now partially addressed but worth validating end-to-end.**

**Issue 1 — The 502 on `/docs`:**
- `/docs` maps to `app/docs/page.js`, a large server component (1999 lines) with no DB calls at render time [VERIFIED: grep for getSql/sql in docs page returns only code-sample text, not live calls]
- Most likely cause: Vercel serverless function timeout or cold-start timeout on that large page, OR a dependency that was missing at the time. The page itself does not query the database, so it should not 502 from a DB error.
- The page has `export const dynamic` not set, meaning it renders on-demand. With 1999 lines of JSX, a slow cold start could produce a timeout 502 on Vercel free tier.
- The 502 was reported on the *hosted* dashclaw.io site, not a local clone.
- No commit explicitly fixing `/docs` 502 exists in the log [VERIFIED: git log search].
- **Current status:** Unknown whether the 502 is still reproducible on the hosted site. Likely self-healed if it was a cold-start issue.

**Issue 2 — "get API key doesn't work":**
- Wes's own comment on issue #31 says he saw this himself when visiting the site. At the time, the hosted instance likely had a misconfigured `DASHCLAW_API_KEY_ORG` or the `api_keys` route was blocking `org_default`.
- Commit `b0e1913a` (2026-03-09, "missing DASHCLAW_API_KEY_ORG") patched `app/api/keys/route.js` — extended key prefix length from 8 to 16 chars. This is a cosmetic fix, not the root cause of "key doesn't work" [VERIFIED: git show b0e1913a].
- Commit `6bb2a16d` (2026-04-10, "feat(onboarding): unmask the bootstrap API key for admins") added `app/api/keys/reveal/route.js` which now exposes the bootstrap API key to signed-in admins — explicitly fixing the "user can't find their API key after setup" pain [VERIFIED: git show 6bb2a16d, file exists].
- Current `app/api/keys/route.js` GET handler: no `org_default` guard — it queries `api_keys WHERE org_id = ${orgId}` directly, so any authenticated session gets their keys [VERIFIED: keys/route.js lines 25-43].
- `app/api/keys/reveal/route.js` returns `process.env.DASHCLAW_API_KEY` for signed-in admins [VERIFIED: file content].

**Planner action for 01-01:** Do a fresh Vercel deploy smoke test: sign up → `/connect` → can I see and copy an API key in ≤ 2 minutes? The code path exists now. The risk is configuration drift on the live Vercel deployment (stale env vars). The plan should include: (a) verify live deployment has all required env vars set, (b) test the `/connect` → API key retrieval path end-to-end on the hosted site, (c) if the `/docs` 502 is still reproducible, investigate Vercel function size limits and consider splitting the page or adding `export const dynamic = 'force-static'` where safe.

---

### C. Lief's LAN/CSP/HSTS fixes — FIX-03

**Current state: NONE of Lief's three fixes are in upstream main. All three are needed.**

Lief pushed 3 commits to `RyanTJoy/DashClaw` that are NOT in upstream. Verified by diffing the fork patches against the current upstream files.

#### Commit `fa268c3` — CSP upgrade-insecure-requests + HSTS conditional on HTTPS

**What it does:** In `next.config.js`, adds `const isTLS = (process.env.NEXTAUTH_URL || '').startsWith('https')` and wraps `upgrade-insecure-requests`, `block-all-mixed-content`, and `Strict-Transport-Security` header in `if (isTLS)` guards.

**Current upstream `next.config.js`:** Sends `upgrade-insecure-requests`, `block-all-mixed-content`, and `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` unconditionally to ALL requests — even plain-HTTP LAN instances [VERIFIED: next.config.js lines 29-32, 66-69].

**Impact on LAN users:** On `http://192.168.x.x:3000`, these headers cause the browser to silently upgrade all fetches to HTTPS (which doesn't exist), breaking `useSession()`, making the login page render a white screen, and blocking all client-side API calls.

**Files to change:** `next.config.js` — the `headers()` async function. Exact patch from Lief's fork:
```javascript
const isTLS = (process.env.NEXTAUTH_URL || '').startsWith('https');
// in CSP array:
...(isTLS ? ['upgrade-insecure-requests', 'block-all-mixed-content'] : []),
// in headers array (conditional push):
if (isTLS) { securityHeaders.push({ key: 'Strict-Transport-Security', ... }); }
```

#### Commit `108be08` — Secure cookie flag conditional on HTTPS

**What it does:** In `app/api/auth/local/route.js`, changes `secure: process.env.NODE_ENV === 'production'` to `secure: isHTTPS` (derived from `(process.env.NEXTAUTH_URL || '').startsWith('https')`).

**Current upstream `app/api/auth/local/route.js`:** Sets `secure: process.env.NODE_ENV === 'production'` on `dashclaw-local-session` cookie — both in POST (login) and DELETE (logout) [VERIFIED: local/route.js lines 48, 59]. In `NODE_ENV=production` on a plain-HTTP LAN instance, the browser silently drops this Secure cookie, making local password login appear completely broken.

**Files to change:** `app/api/auth/local/route.js` — both POST and DELETE handlers. The fix is two 1-line changes.

#### Commit `49c8ae3` — Cookie auth for API routes + hard redirect after login

**What it does:** Three sub-fixes:
1. `app/login/LocalPasswordForm.js`: replace `router.push('/dashboard')` with `window.location.href = '/dashboard'` so the browser includes the fresh cookie on the initial dashboard request.
2. `app/api/auth/local/route.js`: change hardcoded `orgId: 'org_default'` in JWT payload to `orgId: process.env.DASHCLAW_API_KEY_ORG || 'org_default'`.
3. `middleware.js`: adds non-Neon self-host bypass in `verifyOrgExists()` — checks `!isNeon && process.env.DASHCLAW_MODE === 'self_host'` and trusts org exists (migration already created it).

**Current upstream:** `app/login/LocalPasswordForm.js` uses `router.push` (Next.js client router, which does not force a full cookie re-send). `app/api/auth/local/route.js` hardcodes `orgId: 'org_default'`. The `verifyOrgExists()` function in middleware doesn't have the non-Neon self-host bypass [VERIFIED: local/route.js line 39, middleware.js verifyOrgExists search].

**Files to change:** `app/login/LocalPasswordForm.js` (1 line), `app/api/auth/local/route.js` (1 line in POST), `middleware.js` (add non-Neon bypass block, ~10 lines).

**Attribution plan:** Co-author commit as `Lief <RyanTJoy@users.noreply.github.com>` using git `Co-Authored-By:` trailer. Add a comment in the changed sections: `// Fix contributed by Lief (RyanTJoy) — see GitHub: RyanTJoy/DashClaw`.

**Upstream middleware note:** The current upstream middleware already has partial self-host logic (line 50 shows `DASHCLAW_MODE || 'self_host'` default, line 241 has a local-Postgres self-host bypass) but NOT Lief's specific non-Neon `verifyOrgExists` bypass [VERIFIED: middleware.js grep]. Elpolini's fork also made a nearly identical change — the two forks converged on this fix independently.

---

### D. Elpolini's migration compat — FIX-04

**What Elpolini's 4 commits add:**

#### `dbf5463` — feat(compat): harden self-host + legacy schema migrations

This is the most important commit. It adds compat shims in 7 files:

1. **`app/api/guard/route.js`**: Adds column introspection before querying `guard_decisions` — checks `information_schema.columns` for `reasons` vs `reason` column (legacy schema used singular `reason`), then builds the SELECT dynamically. Also catches `42P01` (table not found) and returns empty results instead of 500.

2. **`app/api/keys/route.js`**: Adds `DASHCLAW_MODE` self-host bypass (skip `org_default` block for self-host mode). Adds full column-introspection fallback for `api_keys` — if column names differ from expected schema, builds a dynamic SELECT from `information_schema.columns`. This is the fix for "get API key doesn't work" when upgrading from old schema.

3. **`app/api/team/route.js`**: Adds `DASHCLAW_MODE` self-host bypass on `org_default` block.

4. **`app/api/usage/route.js`**: Same self-host bypass.

5. **`app/lib/db.js`**: Adds `buildMockSql()` — an in-memory SQL mock for environments with no real database (used for dev/test without Postgres). This is substantial (~120 lines).

6. **`docker-compose.yml`**: Adds `env_file: .env.local`, explicit build args, changes Postgres port from 5432 to 5433 (avoids conflict with system Postgres).

7. **`middleware.js`**: Adds `isSelfHostModeEnabled()` helper, uses it in `verifyOrgExists()` short-circuit, and in org_default access check. Also improves rate limiting to use `ip:pathname` key instead of IP alone.

8. **`scripts/migrate-action-records-compat.mjs`**: Adds `created_at` and `updated_at` column migrations, changes `process.exit(1)` to `process.exitCode = 1` + `finally` block for clean connection teardown.

9. **`scripts/migrate-api-keys-compat.mjs`**: ENTIRELY NEW file — a compat migration for `api_keys` table that does `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS` for every expected column, backfills nulls, and creates indexes. **This file does not exist in upstream** [VERIFIED: ls check].

10. **`scripts/migrate-multi-tenant.mjs`**: Adds `ADD COLUMN IF NOT EXISTS` guards for all `api_keys` columns (so upgrading from old schema doesn't crash). Fixes `org_default` key ownership query.

11. **`scripts/migrate-identity-binding.mjs`**: Removes outer try/catch that was swallowing migration errors, making failures visible.

#### `dfcf560` — chore(paths): decouple docs/prompts paths via env overrides

Adds `DASHCLAW_DOCS_DIR`, `DASHCLAW_PROMPT_AGENT_CONNECT_PATH`, `DASHCLAW_PROMPT_SERVER_SETUP_PATH`, `DASHCLAW_SDK_CONTRACT_FIXTURE_PATH` env overrides for users running DashClaw with non-standard directory layouts. Affects 6 script files.

**Current upstream status:** None of these env overrides exist in upstream scripts [VERIFIED: grep for DASHCLAW_DOCS_DIR returns nothing].

#### `072350e` — chore(lockfile): sync package metadata to v1.9.0

Only modifies `package-lock.json` (4 lines). **Not needed upstream** — version numbers differ. This was Elpolini syncing their fork's metadata, not a meaningful upstream fix.

#### `5c4d90a` — feat(bootstrap): enrich sync payload and diagnostics

Modifies `scripts/bootstrap-agent.mjs` to (a) convert capabilities into context points (truncated to 2000 chars each) and add to `payload.context_points` instead of `payload.capabilities`, (b) truncate all context point content/category fields before sync. This is a quality-of-life improvement for bootstrap sync, not a bug fix.

**Assessment of what's needed upstream:**

| Elpolini change | Status | Priority |
|---|---|---|
| `guard/route.js` column compat + 42P01 catch | NOT in upstream | HIGH — prevents crash on legacy schema |
| `keys/route.js` self-host bypass + column compat | NOT in upstream | HIGH — root of "get API key doesn't work" for self-hosters |
| `team/route.js` + `usage/route.js` self-host bypass | NOT in upstream | MEDIUM — org_default blocks on these routes |
| `db.js` MockSql | NOT in upstream | LOW — dev/test quality of life, not prod blocker |
| `docker-compose.yml` env_file + port change | NOT in upstream | MEDIUM — makes Docker self-host work out of box |
| `middleware.js` isSelfHostModeEnabled + rate-limit key | NOT in upstream | HIGH — convergent fix with Lief's commit 49c8ae3 |
| `migrate-action-records-compat.mjs` column adds | Partially in upstream | MEDIUM — upstream has this file, Elpolini adds 2 more columns |
| `migrate-api-keys-compat.mjs` (NEW FILE) | NOT in upstream | HIGH — needed for old-schema upgrades |
| `migrate-multi-tenant.mjs` ADD COLUMN IF NOT EXISTS | NOT in upstream | HIGH — without this, upgrading from old api_keys schema crashes |
| `migrate-identity-binding.mjs` try/catch fix | NOT in upstream | LOW — error visibility improvement |
| `dfcf560` env path overrides | NOT in upstream | LOW — niche (non-standard layout only) |
| `5c4d90a` bootstrap enrich | NOT in upstream | LOW — cosmetic improvement |
| `072350e` lockfile | NOT needed | SKIP |

**Migration path for FIX-04:** The plan needs to:
1. Port the `migrate-api-keys-compat.mjs` (new file) and add it to `SETUP_MIGRATION_SCRIPTS` in `app/lib/setup/runtime-prerequisites.mjs`
2. Update `migrate-multi-tenant.mjs` with ADD COLUMN IF NOT EXISTS guards for `api_keys`
3. Port `middleware.js` `isSelfHostModeEnabled()` + org_default bypass (this overlaps with Lief's commit `49c8ae3` — do them together in one PR to avoid merge conflicts)
4. Port `guard/route.js` column compat + 42P01 catch
5. Port `keys/route.js` self-host bypass + column compat fallback
6. Port `team/route.js` + `usage/route.js` self-host bypasses
7. Port `docker-compose.yml` improvements

**Note:** Elpolini's and Lief's `middleware.js` changes are functionally convergent (both add the same self-host bypass in `verifyOrgExists` and the same org_default access check). Port them together into one combined commit.

---

## 01-02 User Research — Findings

### E. Contact information for 4 users

| User | GitHub login | Public email | Twitter | Blog | Bio | Best contact channel |
|---|---|---|---|---|---|---|
| Lief | RyanTJoy | None | None | None | None in profile | GitHub issue comment on their fork's PR/issue, or comment on upstream issue #71 mentioning their fixes |
| Elpolini | elpolini | None | None | None | None in profile | GitHub issue comment thanking them for fork work; no direct contact surface |
| Jory Irving | joryirving | None | None | None | "SRE/Devops/Kubernetes Jockey. Canada" | GitHub — they filed issues #18 and #26, so commenting on those threads is warm outreach |
| Jasmeet Sidhu | jsidhu | None | None | None | None in profile | GitHub — they submitted PR #21, so a comment on that merged PR is warm outreach |

[VERIFIED: `gh api users/<login>` for all four — all have no public email, no Twitter, no blog URL]

**Practical outreach options:**
- All four have GitHub activity tied to DashClaw specifically, making a GitHub comment the warmest channel (they'll get email notification)
- For Lief and Elpolini (fork-only contributors), the best path is opening a GitHub issue like "Thank you for your fork contributions — would love to chat" and @mentioning them
- For Jory (issue filer), commenting on issue #18 or #26 is warm
- For Jasmeet, commenting on the merged PR #21 is warm
- None of them have public social profiles to fall back to

**No OUTREACH.md exists yet** [VERIFIED: ls .planning/research/]. The planner must create it.

---

### F. Outreach message scaffolding notes

**Tone:** Dev-to-dev. Lead with specific acknowledgment of exactly what they did (quote the commit message or issue title). Thank them before asking anything. Frame the interview as "I want to understand what you were building" not "please give me feedback." Keep it under 100 words. Low pressure: "no worries if you're busy."

**Platform priority:**
- Lief/Elpolini: Open a GitHub issue in the upstream repo titled "Thank you for your fork contributions — Lief / Elpolini" and @mention their handle. This is the only guaranteed delivery channel.
- Jory: Comment on DashClaw issue #18 (Authentik OIDC request they filed), @mention joryirving.
- Jasmeet: Comment on merged PR #21, @mention jsidhu.

**What to ask for:** A 20-30 minute call (Zoom/Discord/whatever). Primary question: "What were you actually trying to do with DashClaw when you ran into [specific thing they fixed/requested]?"

**Do NOT:** Cold DM on platforms they haven't posted on. Don't use email (none available). Don't ask a list of questions in the initial message — just ask for the call.

---

### G. Interview protocol notes

**No existing interview protocol exists** in the codebase or planning docs [VERIFIED: search of .planning/].

**Planner should scaffold a 30-minute protocol in `.planning/research/INTERVIEW-PROTOCOL.md`.** Suggested structure for DashClaw's context:

1. **(5 min)** Warm-up: "What are you building right now? What's your stack?"
2. **(10 min)** The problem: "What made you try DashClaw? Walk me through what you were doing the day you found it."
3. **(10 min)** The experience: "What worked? What broke? What did you end up having to fix yourself?"
4. **(5 min)** Forward: "If DashClaw could do one more thing for you right now, what would it be?"

For Lief and Elpolini specifically: ask what their self-host setup looks like (hardware, other services, Tailscale/Authentik presence) — this validates the homelab positioning hypothesis.

For Jory specifically: Authentik OIDC is a known homelab signal. Ask what else they run alongside DashClaw.

**Key extraction targets:** What agents are they running? What commands are they governing? What does "success" look like to them day-to-day?

---

## 01-03 Founder Dogfood + Weekly Ritual — Findings

### H. Claude Code → DashClaw wiring

**How it works today:**

The wiring is complete and production-ready. Here is the exact mechanism [VERIFIED: all files in .claude/]:

1. **`app/.claude/settings.json`** — Claude Code hook config (wired to DashClaw hooks for PreToolUse and PostToolUse):
   - `PreToolUse` matches `Bash|Edit|Write|MultiEdit` → runs `python .claude/hooks/dashclaw_pretool.py`
   - `PostToolUse` matches `Bash|Edit|Write|MultiEdit` → runs `python .claude/hooks/dashclaw_posttool.py`

2. **`app/.claude/hooks/dashclaw_pretool.py`** — The interception layer:
   - Reads `DASHCLAW_BASE_URL`, `DASHCLAW_API_KEY`, `DASHCLAW_AGENT_ID`, `DASHCLAW_HOOK_MODE`, `DASHCLAW_RISK_THRESHOLD` from env
   - Calls `POST /api/guard` before every governed tool call
   - On `require_approval` decision: creates a pending action via `POST /api/actions`, then polls `GET /api/actions/<id>` every 3 seconds for up to 30 seconds
   - Blocks tool execution (exit code 2) if denied or timeout
   - Allows if approved (`approved_by` set) or `status === 'running'`

3. **Discord notification path:** When an action is created with `status: 'pending_approval'`, the existing `app/lib/actionAlerts.js` fires a Discord webhook embed to `DISCORD_WEBHOOK_URL` if configured in org settings. This is the "ping on Discord" Wes described in issue #46 comment. [VERIFIED: app/lib/actionAlerts.js]

**Shortest daily path for Wes:**
- `DASHCLAW_BASE_URL` must point to his live DashClaw instance (e.g., `https://dashclaw-xyz.vercel.app`)
- `DASHCLAW_API_KEY` must be set in the Claude Code environment (can be done via `claude config set env.DASHCLAW_API_KEY <key>` or shell profile)
- `DASHCLAW_HOOK_MODE=enforce` for real blocking, `observe` for logging-only
- Discord webhook configured in DashClaw settings → notifications fire automatically when approval is needed

**What's missing:** The `.env.example` only shows `DASHCLAW_API_KEY` for the server. The hook env vars (`DASHCLAW_BASE_URL`, `DASHCLAW_HOOK_MODE`, `DASHCLAW_RISK_THRESHOLD`) are documented in the hook file but not in `.env.example` or README for end-user Claude Code setup. Plan 01-03 should document the exact shell config or Claude Code config command Wes uses daily.

---

### I. Dogfood instrumentation — proving the commitment

**Existing data surface:**

- `GET /api/guard?org_id=<orgId>` returns `guard_decisions` with `created_at`, filterable by date range [VERIFIED: guard/route.js]
- The guard stats block returns `total_24h`, `blocks_24h`, `warns_24h`, `approvals_24h` for the last 24 hours [VERIFIED: guard/route.js lines 107-116]
- `GET /api/analytics?days=7` returns daily aggregates from the analytics repository [VERIFIED: analytics/route.js]
- `GET /api/guard?from=<iso>&to=<iso>` supports date filtering (conditions array in guard route)

**Proof mechanism options:**

1. **Existing dashboard query:** `GET /api/guard?days=7` on Wes's personal org ID returns guard decision counts per day. If ≥1 decision exists for ≥5 of 7 days, the commitment is met. This is checkable without new code.

2. **Simple weekly report script:** A small `scripts/dogfood-report.mjs` that queries `/api/guard` for the past 7 days, counts days with activity, and prints pass/fail. Can be run by Wes or by a cron to post to Discord.

3. **Mission Control display:** Mission Control (`/mission-control`) already shows a decision stream. No new UI needed — Wes just needs to share a screenshot of it weekly to prove the flywheel is running.

**Planner note:** The plan for 01-03 should NOT build new instrumentation from scratch — the data is already there. The plan is to (a) verify `DASHCLAW_BASE_URL` + `DASHCLAW_API_KEY` are set in Wes's Claude Code environment, (b) run one real governed command through the hook to confirm end-to-end flow, (c) set up the Discord webhook in his personal DashClaw instance, and (d) define the weekly check ritual using the existing `/api/guard` data.

---

### J. Weekly user-research ritual options

**Option 1 — Discord presence (lowest friction):**
Create a `#user-feedback` channel in Wes's personal Discord server (the same one used for approvals). Each Friday, spend 20 minutes in the DashClaw GitHub Discussions (currently empty — enable and seed it) or relevant Discords (Authentik, homelab communities). Log one interaction per week in `.planning/research/WEEKLY-LOG.md`. Wes already has Discord open for approvals — adding a Friday ritual to an existing habit is sustainable.

**Option 2 — Scheduled GitHub outreach slot:**
Every Monday, post one GitHub comment to a user who has interacted with DashClaw (existing issues, PRs, forks). Requires no new tooling. The 4 identified users are first; then expand to fork owners who haven't been contacted. Calendar a recurring 30-minute Monday slot.

**Option 3 — Rotating interview queue (higher commitment):**
Build a list of 10-15 potential users (GitHub fork owners, stars-with-comments, community members). Schedule one 30-minute interview per week on a rotating basis. Track status in `.planning/research/INTERVIEW-QUEUE.md`. This is the highest-signal but highest-time-cost option. Appropriate once Phase 1's initial 4 users are done.

**Recommendation for planner:** Start with Option 1 (Friday Discord presence) as the minimum viable ritual — it fits Wes's existing behavior (Discord already open). Combine with Option 2 for the first 4 months while the user base is small. Option 3 when ≥10 real users are identified.

---

## Gotchas / Risks

1. **Lief's and Elpolini's middleware.js patches overlap.** Both add nearly identical `isSelfHostModeEnabled()` + `verifyOrgExists()` bypass logic. Port them as ONE combined edit, not two sequential edits, to avoid merge conflict or duplicate code.

2. **`migrate-api-keys-compat.mjs` must be added to `SETUP_MIGRATION_SCRIPTS`.** Elpolini wrote the file but it's only useful if it actually runs during setup. Check `app/lib/setup/runtime-prerequisites.mjs` — it currently has `migrate-action-records-compat.mjs` but not `migrate-api-keys-compat.mjs`. Add it.

3. **FIX-02 (502 on docs) may be a live-only issue, not reproducible locally.** The `/docs` page does not query the database. The 502 was on the hosted Vercel deployment, likely a cold-start timeout on a 1999-line server component. Validation must happen on the live deployment, not just `npm run dev`.

4. **All 4 user contacts are GitHub-only.** There is no email, Twitter, or other fallback. If GitHub notifications are off for any of them, outreach may not land. The plan should acknowledge this and set a 2-week response window before marking outreach as sent-no-reply.

5. **The dogfood hook env vars are not documented for the end-user use case.** The hook reads `DASHCLAW_BASE_URL` from the Claude Code process environment, but there is no README section or `.env.example` entry explaining how to set this up. Plan 01-03 should produce this documentation as a side effect (it's also the CCI-05 precursor for Phase 2).

6. **`window.location.href` change in Lief's commit `49c8ae3` (LocalPasswordForm).** This is the correct fix, but it will cause a full page reload on login. Test that the redirect destination (`/dashboard`) loads correctly after the forced reload on both Vercel and Docker self-host paths.

7. **Elpolini's MockSql (`db.js` change) is substantial.** ~120 lines of in-memory SQL simulation. If ported, it needs careful testing to ensure it doesn't shadow the real SQL driver in production. May be better as a separate test-only import rather than a runtime addition to `db.js`.

---

## Summary for the planner

**FIX-01 (lucide-react):** Already fixed — closed issue, verified locally. Plan should add a CI smoke test to prevent regression, no code change needed.

**FIX-02 (docs 502 / API key):** The API key path is fixed (`keys/reveal/route.js` now exists, keys route works for authenticated sessions). The docs 502 needs end-to-end validation on the live Vercel deployment — most likely a cold-start timeout, not a code bug. Plan should include a live smoke test.

**FIX-03 (Lief's LAN fixes):** Three commits, three files to change (`next.config.js`, `app/api/auth/local/route.js`, `app/login/LocalPasswordForm.js`), plus a small `middleware.js` addition. All changes are surgical (1-10 lines each). Port with co-author credit.

**FIX-04 (Elpolini's migration compat):** Highest effort fix. Core items are: (1) new file `migrate-api-keys-compat.mjs` + wire into setup, (2) `migrate-multi-tenant.mjs` ADD COLUMN IF NOT EXISTS guards, (3) `middleware.js` self-host bypass (overlaps with Lief's fix — do together), (4) `guard/route.js` and `keys/route.js` column compat + self-host bypass. Port the same `isSelfHostModeEnabled()` logic for `team` and `usage` routes.

**USR-01/02:** All 4 users are GitHub-only. Outreach via GitHub comments on their existing activity (issue threads, merged PRs). No OUTREACH.md template exists — plan must create it. No interview protocol exists — plan must scaffold one.

**DOG-01:** The hook infrastructure is fully built and wired (`settings.json` + `dashclaw_pretool.py`). What's missing is (a) documentation of the env var setup for Wes's personal use, (b) a Discord webhook configured in his personal DashClaw instance, and (c) a simple proof mechanism using the existing `/api/guard?days=7` endpoint.
