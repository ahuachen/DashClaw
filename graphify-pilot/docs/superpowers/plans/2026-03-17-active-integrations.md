# Active Integrations Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform DashClaw's passive integration credential store into an active governance fabric that validates integration health and delivers governance events natively through connected services.

**Architecture:** Two phases built on existing infrastructure. Phase 1 adds a cron-driven health check system that validates stored credentials periodically and surfaces status on the integrations page. Phase 2 adds notification adapters that use stored credentials to deliver governance alerts natively through Slack, Discord, Linear, GitHub, and email providers — replacing generic webhook configuration with one-click "enable alerts" per integration.

**Tech Stack:** Next.js API routes, existing `settings.repository.js` for credential access, existing `signals.js` cron pipeline, existing `webhooks.js` delivery patterns, existing `safeFetch()` for SSRF-safe HTTP calls.

---

## Phase 1: Integration Health Checks

### Task 1: Health Check Library

**Files:**
- Create: `app/lib/integration-health.js`
- Modify: `app/api/settings/test/route.js` (extract reusable test functions)

This task extracts the existing per-integration test functions from the settings test route into a shared library, then adds a `checkAllIntegrations(orgId, sql)` function that iterates configured integrations and returns health status for each.

- [ ] **Step 1: Create `app/lib/integration-health.js` with extracted test functions**

The settings test route (`app/api/settings/test/route.js`) already has `testNeon()`, `testOpenai()`, `testSlack()`, etc. Extract them into a shared module. The new module imports `safeFetch` and `validateUrl` from the test route (which should also be extracted to a shared util, or duplicated minimally).

```js
// app/lib/integration-health.js
import { getSql } from './db.js';
import { getSettings } from './repositories/settings.repository.js';

const HTTPS_TIMEOUT = 8000;

async function safeFetchHealth(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HTTPS_TIMEOUT);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal, redirect: 'manual' });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Each checker returns { status: 'healthy'|'degraded'|'error', message: string, checked_at: ISO string }
const HEALTH_CHECKERS = {
  openai: async (creds) => {
    const key = creds.OPENAI_API_KEY;
    if (!key) return { status: 'not_configured', message: 'No API key' };
    const res = await safeFetchHealth('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) return { status: 'healthy', message: 'API key valid' };
    if (res.status === 401) return { status: 'error', message: 'Invalid or expired API key' };
    return { status: 'degraded', message: `Unexpected status ${res.status}` };
  },

  anthropic: async (creds) => {
    const key = creds.ANTHROPIC_API_KEY;
    if (!key) return { status: 'not_configured', message: 'No API key' };
    const res = await safeFetchHealth('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
    });
    if (res.ok || res.status === 400) return { status: 'healthy', message: 'API key valid' };
    if (res.status === 401) return { status: 'error', message: 'Invalid or expired API key' };
    return { status: 'degraded', message: `Unexpected status ${res.status}` };
  },

  slack: async (creds) => {
    const token = creds.SLACK_BOT_TOKEN;
    if (!token) return { status: 'not_configured', message: 'No bot token' };
    const res = await safeFetchHealth('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` };
    const data = await res.json();
    if (data.ok) return { status: 'healthy', message: `Connected as ${data.user || 'bot'}` };
    return { status: 'error', message: data.error || 'Auth failed' };
  },

  discord: async (creds) => {
    const url = creds.DISCORD_WEBHOOK_URL;
    if (!url) return { status: 'not_configured', message: 'No webhook URL' };
    // Discord GET on webhook URL returns webhook info without sending a message
    const res = await safeFetchHealth(url);
    if (res.ok) return { status: 'healthy', message: 'Webhook URL valid' };
    return { status: 'error', message: `Webhook returned ${res.status}` };
  },

  linear: async (creds) => {
    const key = creds.LINEAR_API_KEY;
    if (!key) return { status: 'not_configured', message: 'No API key' };
    const res = await safeFetchHealth('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ viewer { id } }' }),
    });
    if (res.ok) return { status: 'healthy', message: 'API key valid' };
    if (res.status === 401) return { status: 'error', message: 'Invalid API key' };
    return { status: 'degraded', message: `Unexpected status ${res.status}` };
  },

  github: async (creds) => {
    const token = creds.GITHUB_TOKEN;
    if (!token) return { status: 'not_configured', message: 'No token' };
    const res = await safeFetchHealth('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'DashClaw-Health' },
    });
    if (res.ok) return { status: 'healthy', message: 'Token valid' };
    if (res.status === 401) return { status: 'error', message: 'Invalid or expired token' };
    return { status: 'degraded', message: `Unexpected status ${res.status}` };
  },

  neon: async (creds) => {
    const key = creds.NEON_API_KEY;
    if (!key) return { status: 'not_configured', message: 'No API key' };
    const res = await safeFetchHealth('https://console.neon.tech/api/v2/projects', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) return { status: 'healthy', message: 'API key valid' };
    if (res.status === 401) return { status: 'error', message: 'Invalid API key' };
    return { status: 'degraded', message: `Unexpected status ${res.status}` };
  },

  resend: async (creds) => {
    const key = creds.RESEND_API_KEY;
    if (!key) return { status: 'not_configured', message: 'No API key' };
    const res = await safeFetchHealth('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) return { status: 'healthy', message: 'API key valid' };
    if (res.status === 401) return { status: 'error', message: 'Invalid API key' };
    return { status: 'degraded', message: `Unexpected status ${res.status}` };
  },

  stripe: async (creds) => {
    const key = creds.STRIPE_SECRET_KEY;
    if (!key) return { status: 'not_configured', message: 'No secret key' };
    const res = await safeFetchHealth('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Basic ${Buffer.from(key + ':').toString('base64')}` },
    });
    if (res.ok) return { status: 'healthy', message: 'Key valid' };
    if (res.status === 401) return { status: 'error', message: 'Invalid key' };
    return { status: 'degraded', message: `Unexpected status ${res.status}` };
  },
};

/**
 * Check health of all configured integrations for an org.
 * Returns: { [provider]: { status, message, checked_at } }
 */
export async function checkAllIntegrations(orgId, sql) {
  const settings = await getSettings(sql, orgId, { category: 'integration', decrypt: true });

  // Build a credential map: { OPENAI_API_KEY: 'sk-...', SLACK_BOT_TOKEN: '...' }
  const creds = {};
  for (const s of settings) {
    creds[s.key] = s.value;
  }

  const results = {};
  for (const [provider, checker] of Object.entries(HEALTH_CHECKERS)) {
    try {
      results[provider] = { ...await checker(creds), checked_at: new Date().toISOString() };
    } catch (err) {
      results[provider] = { status: 'error', message: err.message || 'Check failed', checked_at: new Date().toISOString() };
    }
  }

  return results;
}

export { HEALTH_CHECKERS };
```

- [ ] **Step 2: Verify the module parses cleanly**

Run: `node --check app/lib/integration-health.js`
Expected: no output (clean parse)

- [ ] **Step 3: Commit**

```bash
git add app/lib/integration-health.js
git commit -m "feat: add integration health check library"
```

---

### Task 2: Health Check Cron Route

**Files:**
- Create: `app/api/cron/integration-health/route.js`
- Create: `app/lib/repositories/integration-health.repository.js`

A cron endpoint that runs health checks for all orgs and stores results. Uses the same `CRON_SECRET` auth pattern as the existing signals cron.

- [ ] **Step 1: Create the repository with table auto-creation**

```js
// app/lib/repositories/integration-health.repository.js
let _tableChecked = false;

async function ensureTable(sql) {
  if (_tableChecked) return;
  await sql`
    CREATE TABLE IF NOT EXISTS integration_health (
      id SERIAL PRIMARY KEY,
      org_id TEXT NOT NULL DEFAULT 'org_default',
      provider TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'unknown',
      message TEXT DEFAULT '',
      checked_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (org_id, provider)
    )
  `;
  _tableChecked = true;
}

export async function upsertHealth(sql, orgId, provider, status, message) {
  await ensureTable(sql);
  await sql`
    INSERT INTO integration_health (org_id, provider, status, message, checked_at)
    VALUES (${orgId}, ${provider}, ${status}, ${message}, NOW())
    ON CONFLICT (org_id, provider) DO UPDATE
    SET status = EXCLUDED.status, message = EXCLUDED.message, checked_at = NOW()
  `;
}

export async function getHealthForOrg(sql, orgId) {
  await ensureTable(sql);
  return sql`
    SELECT provider, status, message, checked_at
    FROM integration_health
    WHERE org_id = ${orgId}
    ORDER BY provider
  `;
}
```

- [ ] **Step 2: Create the cron route**

```js
// app/api/cron/integration-health/route.js
import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { checkAllIntegrations } from '../../../lib/integration-health.js';
import { upsertHealth } from '../../../lib/repositories/integration-health.repository.js';
import { timingSafeEqual } from 'crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });

    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token || !timingSafeEqual(Buffer.from(token), Buffer.from(secret))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sql = getSql();

    // Get all active orgs (same pattern as signals cron)
    const orgs = await sql`SELECT DISTINCT org_id AS id FROM settings WHERE org_id != 'org_default'`;

    let totalChecked = 0;
    for (const org of orgs) {
      const results = await checkAllIntegrations(org.id, sql);
      for (const [provider, result] of Object.entries(results)) {
        if (result.status === 'not_configured') continue; // skip unconfigured
        await upsertHealth(sql, org.id, provider, result.status, result.message);
        totalChecked++;
      }
    }

    return NextResponse.json({ ok: true, orgs: orgs.length, checked: totalChecked });
  } catch (err) {
    console.error('[cron/integration-health] Error:', err);
    return NextResponse.json({ error: 'Health check failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify both files parse**

Run: `node --check app/api/cron/integration-health/route.js && node --check app/lib/repositories/integration-health.repository.js`

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/integration-health/route.js app/lib/repositories/integration-health.repository.js
git commit -m "feat: add integration health check cron route and repository"
```

---

### Task 3: Health Status API Endpoint

**Files:**
- Create: `app/api/integrations/health/route.js`

A simple GET endpoint that returns health status for the current org, consumed by the integrations frontend page.

- [ ] **Step 1: Create the health API route**

```js
// app/api/integrations/health/route.js
import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { getHealthForOrg } from '../../../lib/repositories/integration-health.repository.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const orgId = getOrgId(request);
    const sql = getSql();
    const health = await getHealthForOrg(sql, orgId);

    // Convert to map: { openai: { status, message, checked_at }, ... }
    const healthMap = {};
    for (const row of health) {
      healthMap[row.provider] = {
        status: row.status,
        message: row.message,
        checked_at: row.checked_at,
      };
    }

    return NextResponse.json({ health: healthMap });
  } catch (err) {
    console.error('[integrations/health] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch health status' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify parse**

Run: `node --check app/api/integrations/health/route.js`

- [ ] **Step 3: Commit**

```bash
git add app/api/integrations/health/route.js
git commit -m "feat: add GET /api/integrations/health endpoint"
```

---

### Task 4: Integrations Page — Health Status UI

**Files:**
- Modify: `app/integrations/page.js`

Add health status indicators to each integration card. Fetch from `/api/integrations/health` on page load and display a small health badge (green pulse = healthy, yellow = degraded, red = error) next to the existing connection status dot.

- [ ] **Step 1: Add health data fetching**

In the `fetchData` function (or alongside it), add:

```js
const [healthData, setHealthData] = useState({});

// Inside fetchData or a separate useEffect:
fetch('/api/integrations/health')
  .then(r => r.ok ? r.json() : { health: {} })
  .then(d => setHealthData(d.health || {}))
  .catch(() => {});
```

- [ ] **Step 2: Add health indicator to integration cards**

Where the status dot is rendered, add a secondary indicator:

```jsx
{healthData[key]?.status === 'healthy' && (
  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
    Live
  </span>
)}
{healthData[key]?.status === 'error' && (
  <span className="inline-flex items-center gap-1 text-[10px] text-red-400" title={healthData[key]?.message}>
    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
    Error
  </span>
)}
{healthData[key]?.status === 'degraded' && (
  <span className="inline-flex items-center gap-1 text-[10px] text-amber-400" title={healthData[key]?.message}>
    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
    Degraded
  </span>
)}
```

- [ ] **Step 3: Add "Last checked" tooltip with timestamp**

Use `healthData[key]?.checked_at` to show relative time on hover.

- [ ] **Step 4: Verify page renders without errors**

Run: `npm run dev` — visit `/integrations`, confirm health badges appear for configured integrations.

- [ ] **Step 5: Commit**

```bash
git add app/integrations/page.js
git commit -m "feat: show live health status on integration cards"
```

---

### Task 5: Agent Connection Mismatch Signal

**Files:**
- Modify: `app/lib/signals.js`

Add a new signal type `integration_mismatch` that fires when an agent reports using a provider via `reportConnections()` but the org has no configured credentials for that provider, or when credentials are configured but health check shows error.

- [ ] **Step 1: Read `app/lib/signals.js` to find where signals are computed**

Identify the `computeSignals` function and the pattern for adding new signal types.

- [ ] **Step 2: Add `integration_mismatch` signal computation**

After the existing signal computations, add:

```js
// Integration mismatch: agent reports connection but credentials are missing or broken
const connections = await sql`
  SELECT DISTINCT provider, agent_id FROM agent_connections
  WHERE org_id = ${orgId} AND status = 'active'
`;
const health = await sql`
  SELECT provider, status FROM integration_health
  WHERE org_id = ${orgId}
`;
const healthMap = Object.fromEntries(health.map(h => [h.provider, h.status]));

for (const conn of connections) {
  const h = healthMap[conn.provider];
  if (!h || h === 'error') {
    signals.push({
      type: 'integration_mismatch',
      severity: h === 'error' ? 'red' : 'amber',
      label: h === 'error' ? 'Integration Credential Error' : 'Missing Integration Credentials',
      detail: `Agent "${conn.agent_id}" reports using ${conn.provider} but ${h === 'error' ? 'credentials are invalid' : 'no credentials are configured'}`,
      help: 'Configure valid credentials on the Integrations page',
      agent_id: conn.agent_id,
    });
  }
}
```

- [ ] **Step 3: Verify signals cron still works**

Run: `node --check app/lib/signals.js`

- [ ] **Step 4: Commit**

```bash
git add app/lib/signals.js
git commit -m "feat: add integration_mismatch signal for credential gaps"
```

---

## Phase 2: Native Governance Notifications

### Task 6: Notification Adapter Framework

**Files:**
- Create: `app/lib/notification-adapters/index.js`
- Create: `app/lib/notification-adapters/slack.js`
- Create: `app/lib/notification-adapters/discord.js`
- Create: `app/lib/notification-adapters/linear.js`
- Create: `app/lib/notification-adapters/github.js`
- Create: `app/lib/notification-adapters/email.js`

A pluggable adapter system. Each adapter takes signals and org credentials, and delivers alerts through that service's native API. The adapters are called from the signal cron pipeline alongside existing webhooks.

- [ ] **Step 1: Create the adapter interface and registry**

```js
// app/lib/notification-adapters/index.js
import { slackAdapter } from './slack.js';
import { discordAdapter } from './discord.js';
import { linearAdapter } from './linear.js';
import { githubAdapter } from './github.js';
import { emailAdapter } from './email.js';

// Each adapter: { name, settingsKey, send(signals, creds, orgId) → { success, message } }
export const ADAPTERS = [
  slackAdapter,
  discordAdapter,
  linearAdapter,
  githubAdapter,
  emailAdapter,
];

/**
 * Deliver signals through all configured and enabled native adapters.
 * @returns {{ provider: string, success: boolean, message: string }[]}
 */
export async function deliverNativeNotifications(orgId, signals, settings, sql) {
  const creds = {};
  for (const s of settings) creds[s.key] = s.value;

  const results = [];
  for (const adapter of ADAPTERS) {
    // Check if this adapter's required credential is present
    const hasKey = adapter.requiredKeys.some(k => creds[k]);
    if (!hasKey) continue;

    // Check if native alerts are enabled for this provider
    const enabledKey = `DASHCLAW_ALERTS_${adapter.name.toUpperCase()}`;
    if (creds[enabledKey] === 'false') continue;

    try {
      const result = await adapter.send(signals, creds, orgId);
      results.push({ provider: adapter.name, ...result });
    } catch (err) {
      results.push({ provider: adapter.name, success: false, message: err.message });
    }
  }
  return results;
}
```

- [ ] **Step 2: Create the Slack adapter**

```js
// app/lib/notification-adapters/slack.js
export const slackAdapter = {
  name: 'slack',
  requiredKeys: ['SLACK_BOT_TOKEN', 'SLACK_WEBHOOK_URL'],

  async send(signals, creds, orgId) {
    const redCount = signals.filter(s => s.severity === 'red').length;
    const amberCount = signals.filter(s => s.severity === 'amber').length;

    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `🛡️ DashClaw: ${signals.length} governance signal${signals.length > 1 ? 's' : ''}` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*${redCount} critical* · ${amberCount} amber` },
      },
      { type: 'divider' },
      // Top 5 signals as individual sections
      ...signals.slice(0, 5).map(s => ({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${s.severity === 'red' ? '🔴' : '🟡'} *${s.label}*\n${s.detail}${s.agent_id ? `\n_Agent: ${s.agent_id}_` : ''}`,
        },
      })),
      ...(signals.length > 5 ? [{
        type: 'section',
        text: { type: 'mrkdwn', text: `_...and ${signals.length - 5} more_` },
      }] : []),
    ];

    // Prefer webhook URL (simpler, no channel needed), fall back to bot token
    if (creds.SLACK_WEBHOOK_URL) {
      const res = await fetch(creds.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocks }),
      });
      if (!res.ok) return { success: false, message: `Slack webhook returned ${res.status}` };
      return { success: true, message: 'Posted via webhook' };
    }

    // Bot token path — requires SLACK_CHANNEL_ID
    const channel = creds.SLACK_CHANNEL_ID || creds.SLACK_DEFAULT_CHANNEL;
    if (!channel) return { success: false, message: 'No channel configured' };

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, blocks }),
    });
    const data = await res.json();
    if (!data.ok) return { success: false, message: data.error };
    return { success: true, message: `Posted to #${channel}` };
  },
};
```

- [ ] **Step 3: Create the Discord adapter**

```js
// app/lib/notification-adapters/discord.js
export const discordAdapter = {
  name: 'discord',
  requiredKeys: ['DISCORD_WEBHOOK_URL'],

  async send(signals, creds) {
    const redCount = signals.filter(s => s.severity === 'red').length;
    const amberCount = signals.filter(s => s.severity === 'amber').length;

    const fields = signals.slice(0, 10).map(s => ({
      name: `${s.severity === 'red' ? '🔴' : '🟡'} ${s.label}`,
      value: s.detail.slice(0, 200) + (s.agent_id ? `\n*Agent:* ${s.agent_id}` : ''),
      inline: false,
    }));

    const embed = {
      title: `🛡️ DashClaw: ${signals.length} governance signal${signals.length > 1 ? 's' : ''}`,
      description: `**${redCount} critical** · ${amberCount} amber`,
      color: redCount > 0 ? 0xff4444 : 0xffaa00,
      fields,
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(creds.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (res.status === 204 || res.ok) return { success: true, message: 'Posted to Discord' };
    return { success: false, message: `Discord returned ${res.status}` };
  },
};
```

- [ ] **Step 4: Create the Linear adapter**

```js
// app/lib/notification-adapters/linear.js
export const linearAdapter = {
  name: 'linear',
  requiredKeys: ['LINEAR_API_KEY'],

  async send(signals, creds) {
    // Only create issues for red (critical) signals to avoid noise
    const critical = signals.filter(s => s.severity === 'red');
    if (critical.length === 0) return { success: true, message: 'No critical signals, skipped' };

    const teamQuery = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { Authorization: creds.LINEAR_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ teams { nodes { id name } } }' }),
    });
    const teamData = await teamQuery.json();
    const teamId = teamData?.data?.teams?.nodes?.[0]?.id;
    if (!teamId) return { success: false, message: 'No Linear team found' };

    // Create one issue summarizing all critical signals
    const title = `[DashClaw] ${critical.length} critical governance signal${critical.length > 1 ? 's' : ''}`;
    const description = critical.map(s =>
      `### ${s.label}\n${s.detail}${s.agent_id ? `\n**Agent:** ${s.agent_id}` : ''}\n**Action:** ${s.help}`
    ).join('\n\n---\n\n');

    const mutation = `mutation($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }`;
    const res = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { Authorization: creds.LINEAR_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: mutation,
        variables: { input: { teamId, title, description, priority: 1 } },
      }),
    });
    const result = await res.json();
    const issue = result?.data?.issueCreate?.issue;
    if (issue) return { success: true, message: `Created ${issue.identifier}` };
    return { success: false, message: 'Failed to create issue' };
  },
};
```

- [ ] **Step 5: Create the GitHub adapter**

```js
// app/lib/notification-adapters/github.js
export const githubAdapter = {
  name: 'github',
  requiredKeys: ['GITHUB_TOKEN'],

  async send(signals, creds) {
    const critical = signals.filter(s => s.severity === 'red');
    if (critical.length === 0) return { success: true, message: 'No critical signals, skipped' };

    const repo = creds.GITHUB_REPO; // e.g., 'owner/repo'
    if (!repo) return { success: false, message: 'GITHUB_REPO not configured' };

    const title = `[DashClaw] ${critical.length} critical governance signal${critical.length > 1 ? 's' : ''}`;
    const body = critical.map(s =>
      `### ${s.severity === 'red' ? '🔴' : '🟡'} ${s.label}\n${s.detail}${s.agent_id ? `\n**Agent:** ${s.agent_id}` : ''}\n**Action:** ${s.help}`
    ).join('\n\n---\n\n');

    const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.GITHUB_TOKEN}`,
        'User-Agent': 'DashClaw-Governance',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        labels: ['dashclaw', 'governance-signal'],
      }),
    });

    if (res.status === 201) {
      const issue = await res.json();
      return { success: true, message: `Created #${issue.number}` };
    }
    return { success: false, message: `GitHub returned ${res.status}` };
  },
};
```

- [ ] **Step 6: Create the email adapter**

```js
// app/lib/notification-adapters/email.js
export const emailAdapter = {
  name: 'email',
  requiredKeys: ['RESEND_API_KEY', 'SENDGRID_API_KEY'],

  async send(signals, creds, orgId) {
    // Prefer Resend, fall back to SendGrid
    if (creds.RESEND_API_KEY) {
      return sendViaResend(signals, creds, orgId);
    }
    if (creds.SENDGRID_API_KEY) {
      return sendViaSendGrid(signals, creds, orgId);
    }
    return { success: false, message: 'No email provider configured' };
  },
};

async function sendViaResend(signals, creds, orgId) {
  const { sendSignalAlertEmail } = await import('../notifications.js');
  const to = creds.DASHCLAW_ALERT_EMAIL || creds.RESEND_DEFAULT_TO;
  if (!to) return { success: false, message: 'No alert email configured' };

  const sent = await sendSignalAlertEmail(to, orgId, signals);
  return sent
    ? { success: true, message: `Sent to ${to}` }
    : { success: false, message: 'Email send failed' };
}

async function sendViaSendGrid(signals, creds, orgId) {
  const to = creds.DASHCLAW_ALERT_EMAIL || creds.SENDGRID_DEFAULT_TO;
  if (!to) return { success: false, message: 'No alert email configured' };

  const redCount = signals.filter(s => s.severity === 'red').length;
  const amberCount = signals.filter(s => s.severity === 'amber').length;

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${creds.SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: creds.SENDGRID_FROM_EMAIL || 'alerts@dashclaw.com' },
      subject: `[DashClaw] ${signals.length} signal${signals.length > 1 ? 's' : ''} — ${redCount} critical, ${amberCount} amber`,
      content: [{
        type: 'text/plain',
        value: signals.map(s => `[${s.severity.toUpperCase()}] ${s.label}: ${s.detail}`).join('\n'),
      }],
    }),
  });

  return res.status === 202
    ? { success: true, message: `Sent to ${to}` }
    : { success: false, message: `SendGrid returned ${res.status}` };
}
```

- [ ] **Step 7: Verify all adapters parse**

Run: `for f in app/lib/notification-adapters/*.js; do node --check "$f"; done`

- [ ] **Step 8: Commit**

```bash
git add app/lib/notification-adapters/
git commit -m "feat: add native notification adapters (slack, discord, linear, github, email)"
```

---

### Task 7: Wire Adapters Into Signal Cron

**Files:**
- Modify: `app/api/cron/signals/route.js`
- Modify: `app/lib/repositories/settings.repository.js` (if `decrypt: true` isn't supported on `getSettings`)

Add a call to `deliverNativeNotifications()` in the existing signal cron, right after `fireWebhooksForOrg()`. This means native notifications fire for the same signals that already trigger webhooks — no new detection logic needed.

- [ ] **Step 1: Read `app/api/cron/signals/route.js` lines around webhook firing**

Identify exact insertion point.

- [ ] **Step 2: Add native notification delivery after webhook firing**

After the line that calls `fireWebhooksForOrg(org.id, cleanSignals, sql)`, add:

```js
// Native notifications via configured integrations
try {
  const { deliverNativeNotifications } = await import('../../../lib/notification-adapters/index.js');
  const { getSettings } = await import('../../../lib/repositories/settings.repository.js');
  const settings = await getSettings(sql, org.id, { category: 'integration' });
  const nativeResults = await deliverNativeNotifications(org.id, cleanSignals, settings, sql);
  for (const r of nativeResults) {
    if (r.success) {
      await logActivity(sql, org.id, `notification.${r.provider}.sent`, 'system', 'notification', r.provider, { signals: cleanSignals.length, message: r.message });
    }
  }
} catch (nativeErr) {
  console.error(`[cron/signals] Native notification error for ${org.id}:`, nativeErr.message);
}
```

- [ ] **Step 3: Verify cron route parses**

Run: `node --check app/api/cron/signals/route.js`

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/signals/route.js
git commit -m "feat: wire native notification adapters into signal cron pipeline"
```

---

### Task 8: Settings Keys for Notification Preferences

**Files:**
- Modify: `app/lib/repositories/settings.repository.js`
- Modify: `app/integrations/page.js`

Add new setting keys for alert enablement and channel configuration. These go in the VALID_SETTING_KEYS allowlist and get added as optional fields on the relevant integration config UI.

- [ ] **Step 1: Add new keys to VALID_SETTING_KEYS**

Add to the existing array in `settings.repository.js`:

```js
// Native alert settings
'DASHCLAW_ALERTS_SLACK',        // 'true'/'false' — enable Slack native alerts
'DASHCLAW_ALERTS_DISCORD',      // 'true'/'false' — enable Discord native alerts
'DASHCLAW_ALERTS_LINEAR',       // 'true'/'false' — enable Linear issue creation
'DASHCLAW_ALERTS_GITHUB',       // 'true'/'false' — enable GitHub issue creation
'DASHCLAW_ALERTS_EMAIL',        // 'true'/'false' — enable email alerts via configured provider
'DASHCLAW_ALERT_EMAIL',         // email address to send alerts to
'SLACK_CHANNEL_ID',             // Slack channel for bot-posted alerts
'SLACK_WEBHOOK_URL',            // Slack incoming webhook URL
'GITHUB_REPO',                  // owner/repo for GitHub issue creation
'SENDGRID_DEFAULT_TO',          // default recipient for SendGrid
'SENDGRID_FROM_EMAIL',          // sender address for SendGrid
```

- [ ] **Step 2: Add "Enable DashClaw Alerts" toggle fields to integration configs in the UI**

In `app/integrations/page.js`, add an optional field to Slack, Discord, Linear, GitHub, Resend, and SendGrid configs:

```js
// Example for Slack — add to its fields array:
{ key: 'DASHCLAW_ALERTS_SLACK', label: 'Enable governance alerts', type: 'toggle', required: false },
{ key: 'SLACK_CHANNEL_ID', label: 'Alert channel ID', type: 'text', required: false },
```

Similar pattern for each integration that supports native alerts.

- [ ] **Step 3: Add toggle UI component for settings with `type: 'toggle'`**

In the settings editor modal, render a toggle switch instead of a text input when `field.type === 'toggle'`.

- [ ] **Step 4: Verify page renders**

Run: `npm run dev` — visit `/integrations`, configure Slack, confirm toggle and channel fields appear.

- [ ] **Step 5: Commit**

```bash
git add app/lib/repositories/settings.repository.js app/integrations/page.js
git commit -m "feat: add native alert settings keys and toggle UI on integration cards"
```

---

### Task 9: Vercel Cron Configuration

**Files:**
- Modify: `vercel.json`

Add the integration health check cron to Vercel's cron schedule. Health checks should run less frequently than signals (every 6 hours vs every few minutes).

- [ ] **Step 1: Read `vercel.json` for existing cron entries**

Check how the signals cron is configured and follow the same pattern.

- [ ] **Step 2: Add health check cron**

```json
{
  "path": "/api/cron/integration-health",
  "schedule": "0 */6 * * *"
}
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat: add integration health check to Vercel cron schedule"
```

---

### Task 10: Documentation Updates

**Files:**
- Modify: `sdk/README.md` (document reportConnections health check integration)
- Modify: `PROJECT_DETAILS.md` (add new routes to route list)
- Modify: `docs/api-inventory.md` (add new endpoints)

- [ ] **Step 1: Add `/api/integrations/health` and `/api/cron/integration-health` to docs**

Follow the existing documentation patterns for route documentation.

- [ ] **Step 2: Run doc checks**

```bash
npm run openapi:generate
npm run api:inventory:generate
npm run docs:check
```

- [ ] **Step 3: Commit**

```bash
git add docs/ sdk/README.md PROJECT_DETAILS.md
git commit -m "docs: add active integrations endpoints and adapter documentation"
```

---

## Summary

| Task | Phase | What it does |
|------|-------|-------------|
| 1 | Health | Health check library with per-provider credential validators |
| 2 | Health | Cron route + DB table for periodic health checks |
| 3 | Health | API endpoint for frontend to fetch health status |
| 4 | Health | Integrations page shows live health badges |
| 5 | Health | New signal type for agent/credential mismatches |
| 6 | Notifications | 5 native notification adapters (Slack, Discord, Linear, GitHub, Email) |
| 7 | Notifications | Wire adapters into existing signal cron pipeline |
| 8 | Notifications | Settings keys + UI toggles for enabling native alerts |
| 9 | Deploy | Vercel cron configuration |
| 10 | Docs | Documentation updates |
