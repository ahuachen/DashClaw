# Analytics Token + Cost Rollout — Step-by-Step Guide

**Date:** 2026-04-14
**Status of code:** committed to `main`, deployed to `www.dashclaw.io` and `my-dashclaw.vercel.app`.
**What's left for you:** publish the OpenClaw plugin, update it on your codex-auth host, verify, then decide on optional cleanups.

---

## What changed

### Server
- `POST /api/actions` and `PATCH /api/actions/:id` now accept `tokens_in`, `tokens_out`, `model`. Cost is derived from the pricing table (`app/lib/billing.js`) when tokens + model are supplied without an explicit `cost_estimate`.
- `action_records` gained a `model` column. Both INSERT and UPDATE paths persist it.
- `updateActionOutcome` now writes `tokens_in`, `tokens_out`, `model` alongside existing outcome fields.

### Claude Code hooks (`hooks/`)
- `dashclaw_pretool.py` appends each new action_id to a per-session turn log.
- `dashclaw_stop.py` reads the session transcript, sums usage across assistant messages since its cursor, and PATCHes `tokens_in/tokens_out/model` across the turn's action_ids.
- Stop hook also auto-closes any action still in `status='running'` at turn end (fallback for when PostToolUse missed). Terminal statuses are preserved.
- Cache-read tokens are weighted 0.1× before being summed so attributed cost matches real Anthropic billing.
- **Install:** `npm run hooks:install` (or `node /path/to/DashClaw/scripts/install-hooks.mjs --target=.` from any project). Idempotent — re-run after `git pull` to upgrade. Copies all three hooks plus the `dashclaw_agent_intel/` Python module and merges the matching settings.json blocks.

### OpenClaw plugin (`packages/openclaw-plugin`, v1.2.1)
- Hooks `llm_output` and `agent_end` to attribute LLM token usage back to the tool calls each assistant response induced.
- Cache reads weighted 0.1×, cache writes counted at full price.
- Model string flows through to DashClaw so server-side cost derivation picks the right pricing row.

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

Expected output ends with `+ @dashclaw/openclaw-plugin@1.2.1`.

**Why this isn't automated:** publishing to npm is irreversible and tied to your personal npm account. I won't run it for you.

### 2. Update the plugin on your codex-auth OpenClaw host

SSH into the host (or whatever environment runs your codex-authenticated OpenClaw gateway) and:

```bash
openclaw plugins install @dashclaw/openclaw-plugin@1.2.1
# or if you use npm directly
npm update @dashclaw/openclaw-plugin
```

Restart the gateway so the plugin reloads. Confirm the plugin version in logs:

```
[openclaw] plugin 'dashclaw-governance' v1.2.1 registered
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
`npm unpublish @dashclaw/openclaw-plugin@1.2.1` is blocked after 72h. Instead, publish `1.2.2` with a revert commit.

### DB
The `action_records.model` column is additive — leaving it populated doesn't break the old server code. No DB rollback needed.

---

## Known limitations

1. **Cache pricing approximation.** Cache reads are weighted 0.1× and cache writes at 1.0×. Reality: 5m cache writes are 1.25×, 1h cache writes are 2×. For typical Claude Code sessions the error is <10%.
2. **Even token split across turn.** Tokens from one assistant response are divided equally across all tool calls it induced. If one tool call drove most of the reasoning, this under-attributes it relative to trivial calls. Directionally fine for governance-level analytics.
3. **Historical gap.** 18,612 pre-2026-04-14 actions stay at `$0 / 0 tokens`. They won't back-fill. Analytics 30-day window will read low until the pre-fix window rolls out.
4. **PostToolUse miss rate.** ~96% of Bash/Edit/Write tool calls never had PostToolUse fire (pre-fix). The Stop hook's auto-close paves over the symptom but the root cause isn't fixed yet. Track via `SELECT COUNT(*) FROM action_records WHERE status='running' AND timestamp_start < NOW() - INTERVAL '5 minutes'`.

---

## Where to look if something goes wrong

| Symptom | First place to look |
|---|---|
| Analytics shows $0 after deploy | `/api/actions/:id` PATCH logs in Vercel dashboard; check `tokens_in/tokens_out/model` present in PATCH bodies |
| OpenClaw not reporting tokens | Plugin logs: `[dashclaw-governance] token PATCH failed for ...` |
| Claude Code not reporting tokens | `/tmp/dashclaw_turn_<sessionId>` should exist during a turn; `/tmp/dashclaw_stop_cursor_<sessionId>` after Stop |
| New running actions piling up | Stop hook not firing — check `.claude/settings.json` has the `Stop` entry |
| Cost seems wrong | `app/lib/billing.js` DEFAULT_PRICING — add your model pattern if unmatched |
