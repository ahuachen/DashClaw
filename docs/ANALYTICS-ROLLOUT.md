# Analytics Token + Cost Rollout — Step-by-Step Guide

**Date:** 2026-04-14 (initial) · 2026-04-17 (post-audit hardening)
**Status of code:** committed to `main`, deployed to `www.dashclaw.io` and `my-dashclaw.vercel.app`.
**What's left for you:** publish the OpenClaw plugin, update it on your codex-auth host, verify, then decide on optional cleanups.

---

## What changed

### Server
- `POST /api/actions` and `PATCH /api/actions/:id` now accept `tokens_in`, `tokens_out`, `model`. Cost is derived from the pricing table (`app/lib/billing.js`) when tokens + model are supplied without an explicit `cost_estimate`. If `model` is missing (null/undefined/empty), `estimateCost` returns `0` — we refuse to guess, which means historical rows with `model=NULL` stay at `$0` instead of being retroactively priced as Opus.
- **Per-action cost alerts.** Set the `DASHCLAW_ACTION_COST_THRESHOLD` setting (USD, e.g. `"1.50"`) to fire the `action.cost_exceeded` event whenever a PATCH resolves with `cost_estimate > threshold`. Breach delivery flows through the same pipeline as `integration_mismatch` signals: registered webhooks receive the signal and the native notification adapters (Slack/Discord/Linear/GitHub/Email) post a message. Delivery is fire-and-forget so the PATCH response never blocks. The response body also carries `{ cost_alert: { threshold, severity } }` when a breach fires (severity is `red` once cost ≥ 2× threshold, `amber` below that).
- **Health state-change alerts.** When a provider's health flips (e.g. `healthy → error` after an API key is revoked, or `error → healthy` after a rotation), the integration-health cron and the admin Refresh button both emit an `integration_health_changed` signal through the same webhook + adapter pipeline. First observations never alert (we don't know the prior state). Severity: any `→ error` is red, any `→ degraded` or recovery `→ healthy` is amber. Both the cron and refresh responses now include an `alerts` count.
- `action_records` gained a `model` column. Both INSERT and UPDATE paths persist it.
- `updateActionOutcome` now writes `tokens_in`, `tokens_out`, `model` alongside existing outcome fields.
- `PATCH /api/actions/:id` accepts an optional `close_if_running: true` flag (hook-internal contract — the Stop hook sends it). When set, close fields (`status`, `output_summary`, `timestamp_end`) apply atomically only when the row is still `running`; token fields always apply. This closes the TOCTOU race between Stop and PostToolUse.

### Claude Code hooks (`hooks/`)
- `dashclaw_pretool.py` appends each new action_id to a per-session turn log.
- `dashclaw_stop.py` reads the session transcript, sums usage across assistant messages since its cursor, and PATCHes `tokens_in/tokens_out/model` across the turn's action_ids.
- Stop hook auto-closes any action still in `status='running'` at turn end. The close happens atomically server-side: each PATCH carries `close_if_running: true` and the server applies close fields only when the row is still `running`, so a concurrent PostToolUse PATCH with a real outcome is never clobbered (no TOCTOU window between a GET and a PATCH). Tokens always apply.
- Cache-read tokens are weighted 0.1× before being summed so attributed cost matches real Anthropic billing. Python rounding uses half-away-from-zero (`int(x + 0.5)`) so the totals match the JS Math.round used in the OpenClaw plugin on `.5` boundaries.
- `session_id` is sanitized (allow-list: `[A-Za-z0-9._-]`) before it's used as a tempfile suffix, so a crafted stdin cannot escape the tempdir via path traversal.
- Text-only assistant turns (no tool calls → no action_ids) log an `orphan_tokens` line to the drift log (see below) instead of silently dropping the usage.
- HTTP and disk-I/O failures in both hooks append a one-line breadcrumb to `<tempdir>/dashclaw_hook_errors.log` so ops can notice token-attribution drift (key rotation, base-URL typo, disk full) instead of watching analytics silently drop to zero.
- **Install:** `npm run hooks:install` (or `node /path/to/DashClaw/scripts/install-hooks.mjs --target=.` from any project). Idempotent — re-run after `git pull` to upgrade. The installer removes only the exact managed hook filenames (`dashclaw_pretool.py`, `dashclaw_posttool.py`, `dashclaw_stop.py`); user-authored wrappers with similar names survive re-install.

### OpenClaw plugin (`packages/openclaw-plugin`, v1.2.2)
- Hooks `llm_output` and `agent_end` to attribute LLM token usage back to the tool calls each assistant response induced.
- Cache reads weighted 0.1×, cache writes counted at full price.
- Model string flows through to DashClaw so server-side cost derivation picks the right pricing row.
- Per-run turn state is capped at 1000 entries with oldest-first eviction, so a long-lived gateway where `agent_end` never fires for some runs cannot leak memory unboundedly (~100 KB worst case at the cap).
- If the DashClaw client becomes unavailable mid-run (key rotation, config error), `llm_output` and `agent_end` log `[dashclaw-governance] … dropped` warnings with the error and dropped-action count instead of silently losing attribution.

### Analytics UI
- `CostTrendChart`, `TokenUsage`, and `HeroStats` Total Cost all render "no data" hints when the cost column is empty — no more misleading `$0.00`.

### One-time cleanup already applied
- Ran `scripts/repair-stale-running-actions.mjs` → 17,926 pre-existing stale `running` rows reclassified to `completed`. Analytics "Other" bucket dropped accordingly.

---

## What you need to do

### 1. Publish the OpenClaw plugin to npm

```bash
cd packages/openclaw-plugin
npm login          # once per machine, skip if already logged in
npm publish --access public
```

Expected output ends with `+ @dashclaw/openclaw-plugin@1.2.2`.

**Why this isn't automated:** publishing to npm is irreversible and tied to your personal npm account. I won't run it for you.

### 2. Update the plugin on your codex-auth OpenClaw host

SSH into the host (or whatever environment runs your codex-authenticated OpenClaw gateway) and:

```bash
openclaw plugins install @dashclaw/openclaw-plugin@1.2.2
# or if you use npm directly
npm update @dashclaw/openclaw-plugin
```

Restart the gateway so the plugin reloads. Confirm the plugin version in logs:

```
[openclaw] plugin 'dashclaw-governance' v1.2.2 registered
```

### 3. Verify tokens are flowing

After at least one LLM turn on your codex host, query:

```bash
# From this repo root
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
(async () => {
  const r = await sql\`SELECT agent_id, COUNT(*) n, SUM(tokens_in) tin, SUM(tokens_out) tout, SUM(cost_estimate) cost
    FROM action_records WHERE updated_at >= NOW() - INTERVAL '1 hour' GROUP BY agent_id ORDER BY n DESC\`;
  console.table(r);
})();
"
```

You should see rows for `openclaw` (or whatever `agentId` you configured) with non-zero `tin`, `tout`, `cost`.

Then refresh the Analytics page at `https://my-dashclaw.vercel.app/analytics` — Total Cost, Cost Trend, Token Usage, and By Agent should populate with the new data.

### 4. (Optional) Clean up stale `running` rows again later

The Stop hook auto-closes at turn end, but if any agent crashes mid-turn you'll still get the occasional orphaned `running`. Re-run:

```bash
node scripts/_run-with-env.mjs scripts/repair-stale-running-actions.mjs --dry-run --older-than-hours 1
# if the preview looks right
node scripts/_run-with-env.mjs scripts/repair-stale-running-actions.mjs --older-than-hours 1
```

Safe to run on a cron — consider adding it to a daily schedule.

### 5. (Optional) Back-fill model on pre-fix rows

All pre-2026-04-14 action_records have `model=NULL` because the column didn't exist. They'll stay that way; there's no reliable way to reconstruct the model retroactively. If this bothers analytics, consider hiding pre-fix rows via a `?since=` filter on the Analytics page (not built yet).

---

## Rollback plan

If something breaks in production:

### Server (Vercel)
```bash
cd C:/Projects/DashClaw
npx vercel rollback --yes                    # dashclaw project (www.dashclaw.io)
# To rollback my-dashclaw: relink first
npx vercel link --yes --scope ucsandmans-projects --project my-dashclaw
npx vercel rollback --yes
# Restore link
cp /tmp/dashclaw-project-backup.json .vercel/project.json
```

### Plugin
`npm unpublish @dashclaw/openclaw-plugin@1.2.2` is blocked after 72h. Instead, publish `1.2.2` with a revert commit.

### DB
The `action_records.model` column is additive — leaving it populated doesn't break the old server code. No DB rollback needed.

---

## Known limitations

1. **Cache pricing approximation.** Cache reads are weighted 0.1× and cache writes at 1.0×. Reality: 5m cache writes are 1.25×, 1h cache writes are 2×. For typical Claude Code sessions the error is <10%.
2. **Even token split across turn.** Tokens from one assistant response are divided equally across all tool calls it induced. If one tool call drove most of the reasoning, this under-attributes it relative to trivial calls. Directionally fine for governance-level analytics.
3. **Historical gap by design.** Pre-2026-04-14 actions stay at `$0 / 0 tokens / model=NULL`. `estimateCost` returns 0 for null model on purpose — the alternative (defaulting to Opus) would silently price every legacy row as premium, which is worse than a visible zero. Analytics 30-day window will read low until the pre-fix window rolls out; if you need historical pricing, add a backfill that sets `model` from whatever signal you have (e.g. `agent_id → default model at that time`).
4. **PostToolUse miss rate.** ~96% of Bash/Edit/Write tool calls never had PostToolUse fire (pre-fix). The Stop hook's auto-close paves over the symptom but the root cause isn't fixed yet. Track via `SELECT COUNT(*) FROM action_records WHERE status='running' AND timestamp_start < NOW() - INTERVAL '5 minutes'`.
5. **Text-only turns — opt-in attribution via `DASHCLAW_TRACK_TEXT_TURNS=1`.** When an assistant turn produces no tool calls (pure text response), there's no action record to attribute tokens against. Default behavior: the Stop hook writes an `orphan_tokens …` line to `<tempdir>/dashclaw_hook_errors.log` so the spend is visible to ops but doesn't land in analytics. Set `DASHCLAW_TRACK_TEXT_TURNS=1` in `.env` to flip on synthetic-action creation: the Stop hook POSTs a pre-completed `action_type='conversation'` record carrying the tokens, and cost is derived server-side just like tool actions. Trade-off: every text-only turn adds one row to `action_records`, which inflates the ledger for agents that chat a lot. Keep it off if you only care about tool-call governance.

---

## Where to look if something goes wrong

| Symptom | First place to look |
|---|---|
| Analytics shows $0 after deploy | `/api/actions/:id` PATCH logs in Vercel dashboard; check `tokens_in/tokens_out/model` present in PATCH bodies |
| OpenClaw not reporting tokens | Plugin logs: `[dashclaw-governance] token PATCH failed for ...` or `[dashclaw-governance] llm_output dropped — client unavailable: ...` |
| Claude Code not reporting tokens | `<tempdir>/dashclaw_turn_<sessionId>` should exist during a turn; `<tempdir>/dashclaw_stop_cursor_<sessionId>` after Stop. If session_id contained non-`[A-Za-z0-9._-]` chars they're replaced with `_` in the filename. |
| Hook silently producing zero cost | Tail `<tempdir>/dashclaw_hook_errors.log` — Stop and pretool append a line here on HTTP/disk failures, and log `orphan_tokens …` when a text-only turn has no action_ids to attribute against. |
| PostToolUse never closes actions (stuck `running`) | Set `DASHCLAW_HOOK_DEBUG=1` in `.env` and run `npm run hooks:diagnose` (or `npm run hooks:diagnose -- --since=1h --tail=20` for a time-boxed view). The summary shows counts by hook/tag. If `posttool:invoked` is 0, Claude Code isn't firing PostToolUse (see [anthropics/claude-code#6305](https://github.com/anthropics/claude-code/issues/6305)); if it's >0 and `exit_early: no action_id` dominates, PreToolUse failed to record for those tool calls. |
| New running actions piling up | Stop hook not firing — check `.claude/settings.json` has the `Stop` entry. (If it IS firing, the server-side `close_if_running` gate only closes rows that are still `running`; a row stuck on `pending_approval` or similar needs `repair-stale-running-actions.mjs`.) |
| Cost seems wrong | `app/lib/billing.js` DEFAULT_PRICING — add your model pattern if unmatched. Rows with `$0` and `model=NULL` are expected: pre-migration or the hook failed to capture a model; `estimateCost` returns 0 for null model by design. |
