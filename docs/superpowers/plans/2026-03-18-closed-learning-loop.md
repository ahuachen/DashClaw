# Closed Learning Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close DashClaw's learning loop so agents receive actionable learning context at decision time, can fetch consolidated lessons, and the platform auto-suggests policy tightening from negative feedback trends.

**Architecture:** Phase 1 enriches the existing `POST /api/guard` response with learning context pulled from learning_recommendations, drift_alerts, and feedback tables — one extra query per guard call. Phase 2 adds a new `GET /api/learning/lessons` endpoint + v2 SDK method. Phase 3 adds a cron-triggered policy suggestion engine that reads feedback trends and proposes guard policy changes. All three phases build on existing repository functions and table schemas — no new migrations needed.

**Tech Stack:** Next.js 15 route handlers, existing Postgres tables (learning_recommendations, learning_episodes, drift_alerts, feedback, guard_policies), DashClaw v2 SDK.

---

## File Map

| File | Phase | Change |
|------|-------|--------|
| `app/lib/guard.js` | 1 | Add `getLearningContext()` call, include in response |
| `app/lib/learning-context.js` | 1 | **Create** — query learning data for guard enrichment |
| `app/api/guard/route.js` | 1 | Pass learning context through to response |
| `__tests__/unit/learning-context.test.js` | 1 | **Create** — unit tests |
| `sdk/dashclaw.js` | 2 | Add `getLessons()` method |
| `app/api/learning/lessons/route.js` | 2 | **Create** — GET endpoint |
| `app/lib/learning-lessons.js` | 2 | **Create** — lesson consolidation logic |
| `__tests__/unit/sdk-v2.test.js` | 2 | Add getLessons test |
| `app/lib/policy-suggestions.js` | 3 | **Create** — feedback-to-policy suggestion engine |
| `app/api/cron/policy-suggestions/route.js` | 3 | **Create** — cron endpoint |
| `app/api/learning/suggestions/route.js` | 3 | **Create** — GET suggestions, POST accept/dismiss |

---

### Task 1: Build learning context query module

**Files:**
- Create: `app/lib/learning-context.js`
- Create: `__tests__/unit/learning-context.test.js`

This module queries recent scores, drift status, recommendations, and feedback for a given agent_id + action_type, returning a compact learning context object.

- [ ] **Step 1: Create learning-context.js**

```javascript
// app/lib/learning-context.js
import { listLearningRecommendations } from './repositories/learningLoop.repository.js';

/**
 * Build learning context for a guard decision.
 * Queries are cheap — all indexed by org_id + agent_id.
 */
export async function getLearningContext(sql, orgId, { agentId, actionType }) {
  if (!agentId) return null;

  const context = { recent_score_avg: null, baseline_score_avg: null, drift_status: null, patterns: [], feedback_summary: null };

  try {
    // 1. Recent scores for this action type (last 10 episodes)
    const recentEpisodes = await sql`
      SELECT score FROM learning_episodes
      WHERE org_id = ${orgId} AND agent_id = ${agentId}
        AND action_type = ${actionType || 'unknown'}
      ORDER BY created_at DESC LIMIT 10
    `;
    if (recentEpisodes.length > 0) {
      context.recent_score_avg = Math.round(
        recentEpisodes.reduce((s, e) => s + (e.score || 0), 0) / recentEpisodes.length
      );
    }

    // 2. Baseline score (all-time for this action type)
    const baseline = await sql`
      SELECT AVG(score) as avg_score FROM learning_episodes
      WHERE org_id = ${orgId} AND agent_id = ${agentId}
        AND action_type = ${actionType || 'unknown'}
    `;
    if (baseline[0]?.avg_score != null) {
      context.baseline_score_avg = Math.round(baseline[0].avg_score);
    }

    // 3. Active drift alerts for this agent
    const driftAlerts = await sql`
      SELECT severity, metric FROM drift_alerts
      WHERE org_id = ${orgId} AND agent_id = ${agentId}
        AND acknowledged = false
      ORDER BY severity DESC LIMIT 3
    `;
    if (driftAlerts.length > 0) {
      const worst = driftAlerts[0].severity;
      context.drift_status = worst; // 'critical' | 'warning' | 'info'
    }

    // 4. Recommendations (patterns from successful actions)
    const recs = await listLearningRecommendations(sql, orgId, {
      agentId, actionType, limit: 3
    });
    if (recs && recs.length > 0) {
      context.patterns = recs.map(r => r.guidance || r.hints?.summary || '').filter(Boolean);
    }

    // 5. Recent negative feedback
    const negativeFb = await sql`
      SELECT COUNT(*) as count,
             AVG(rating) as avg_rating
      FROM feedback
      WHERE org_id = ${orgId} AND agent_id = ${agentId}
        AND sentiment = 'negative'
        AND created_at > NOW() - INTERVAL '7 days'
    `;
    if (negativeFb[0]?.count > 0) {
      context.feedback_summary = `${negativeFb[0].count} negative rating(s) in last 7 days (avg ${Number(negativeFb[0].avg_rating).toFixed(1)})`;
    }
  } catch (err) {
    // Learning context is best-effort — never block guard decisions
    console.error('[learning-context] Error building context:', err.message);
  }

  // Return null if nothing useful was found
  const hasData = context.recent_score_avg != null || context.drift_status || context.patterns.length > 0 || context.feedback_summary;
  return hasData ? context : null;
}
```

- [ ] **Step 2: Verify lint passes**

Run: `cd "C:/Projects/DashClaw" && npm run lint`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/lib/learning-context.js
git commit -m "feat: add learning context query module for guard enrichment"
```

---

### Task 2: Inject learning context into guard response

**Files:**
- Modify: `app/lib/guard.js` (~line 199, before response construction)
- Modify: `app/api/guard/route.js` (pass through learning field)

- [ ] **Step 1: Import and call getLearningContext in guard.js**

In `app/lib/guard.js`, import `getLearningContext` from `./learning-context.js`.

In the `evaluateGuard()` function, after all policy evaluation is complete (around line 195, before the guard_decisions insert), add:

```javascript
// Learning context — best-effort enrichment
const learningContext = await getLearningContext(sql, orgId, {
  agentId: data.agent_id,
  actionType: data.action_type,
});
```

Then add `learning: learningContext || undefined` to the returned object (around line 233 where the response is constructed). The response shape becomes:

```javascript
return {
  decision,
  action_id: decisionId,
  reason,
  matched_policies: matchedPolicyIds,
  risk_score: effectiveRisk,
  agent_risk_score: agentRisk,
  signals: allSignals,
  evaluated_at: new Date().toISOString(),
  learning: learningContext || undefined,
};
```

- [ ] **Step 2: Verify guard route passes through the learning field**

Check `app/api/guard/route.js` — it should already pass through whatever `evaluateGuard()` returns. Verify that `result.learning` will be included in `Response.json(result)`. If the route cherry-picks fields, add `learning` to the response.

- [ ] **Step 3: Lint and test**

Run: `cd "C:/Projects/DashClaw" && npm run lint`
Run: `cd "C:/Projects/DashClaw" && npx vitest run __tests__/unit/sdk-v2.test.js`
Expected: All pass (guard tests shouldn't break — learning is additive)

- [ ] **Step 4: Commit**

```bash
git add app/lib/guard.js app/api/guard/route.js
git commit -m "feat: enrich guard response with learning context (Phase 1)"
```

---

### Task 3: Add getLessons SDK method and API endpoint (Phase 2)

**Files:**
- Create: `app/lib/learning-lessons.js`
- Create: `app/api/learning/lessons/route.js`
- Modify: `sdk/dashclaw.js`
- Modify: `__tests__/unit/sdk-v2.test.js`

- [ ] **Step 1: Create the lessons consolidation module**

```javascript
// app/lib/learning-lessons.js
import { listLearningRecommendations } from './repositories/learningLoop.repository.js';

/**
 * Consolidate lessons for an agent — what DashClaw has learned from scored outcomes.
 * Returns actionable patterns the agent can use to improve.
 */
export async function consolidateLessons(sql, orgId, { agentId, actionType, limit = 10 }) {
  const lessons = [];

  // 1. Top recommendations by confidence
  const recs = await listLearningRecommendations(sql, orgId, {
    agentId,
    actionType,
    limit,
  });

  for (const rec of recs || []) {
    const hints = typeof rec.hints === 'string' ? JSON.parse(rec.hints) : rec.hints || {};
    const guidance = typeof rec.guidance === 'string' ? JSON.parse(rec.guidance) : rec.guidance || {};

    lessons.push({
      action_type: rec.action_type,
      confidence: rec.confidence,
      success_rate: rec.success_rate,
      hints: {
        risk_cap: hints.risk_cap,
        prefer_reversible: hints.prefer_reversible,
        confidence_floor: hints.confidence_floor,
        expected_duration: hints.expected_duration,
        expected_cost: hints.expected_cost,
      },
      guidance: guidance.text || guidance.summary || null,
      sample_size: rec.sample_size,
    });
  }

  // 2. Recent drift warnings
  const driftAlerts = await sql`
    SELECT metric, severity, z_score, direction, agent_id, action_type
    FROM drift_alerts
    WHERE org_id = ${orgId}
      AND (${agentId ? sql`agent_id = ${agentId}` : sql`TRUE`})
      AND acknowledged = false
      AND severity IN ('warning', 'critical')
    ORDER BY created_at DESC LIMIT 5
  `;

  const drift_warnings = driftAlerts.map(a => ({
    metric: a.metric,
    severity: a.severity,
    z_score: Number(a.z_score).toFixed(1),
    direction: a.direction,
  }));

  return { lessons, drift_warnings, agent_id: agentId };
}
```

- [ ] **Step 2: Create the API route**

```javascript
// app/api/learning/lessons/route.js
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { consolidateLessons } from '../../../lib/learning-lessons.js';

export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent_id');
    const actionType = searchParams.get('action_type');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const result = await consolidateLessons(sql, orgId, { agentId, actionType, limit });
    return Response.json(result);
  } catch (err) {
    console.error('[learning/lessons] GET error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Add getLessons to v2 SDK**

In `sdk/dashclaw.js`, add after the `getLearningCurves` method:

```javascript
  /**
   * GET /api/learning/lessons — Fetch consolidated lessons from scored outcomes.
   */
  async getLessons({ actionType, limit } = {}) {
    return this._request('/api/learning/lessons', 'GET', null, {
      agent_id: this.agentId,
      ...(actionType && { action_type: actionType }),
      ...(limit && { limit }),
    });
  }
```

- [ ] **Step 4: Add SDK test**

In `__tests__/unit/sdk-v2.test.js`, add:

```javascript
  describe('getLessons', () => {
    it('GETs /api/learning/lessons with agent_id', async () => {
      await claw.getLessons({ actionType: 'deploy', limit: 5 });
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toContain('/api/learning/lessons');
      expect(url).toContain('agent_id=test-agent');
      expect(url).toContain('action_type=deploy');
      expect(url).toContain('limit=5');
      expect(opts.method).toBe('GET');
    });
  });
```

- [ ] **Step 5: Lint and test**

Run: `cd "C:/Projects/DashClaw" && npm run lint`
Run: `cd "C:/Projects/DashClaw" && npx vitest run __tests__/unit/sdk-v2.test.js`
Expected: All pass (now 46 tests — 44 existing + 1 new + the test runner counts)

- [ ] **Step 6: Commit**

```bash
git add app/lib/learning-lessons.js app/api/learning/lessons/route.js sdk/dashclaw.js __tests__/unit/sdk-v2.test.js
git commit -m "feat: add getLessons SDK method and /api/learning/lessons endpoint (Phase 2)"
```

---

### Task 4: Build policy suggestion engine (Phase 3)

**Files:**
- Create: `app/lib/policy-suggestions.js`

- [ ] **Step 1: Create the suggestion engine**

```javascript
// app/lib/policy-suggestions.js
/**
 * Analyze feedback trends and suggest policy changes.
 * Runs on a schedule (cron) or on-demand.
 */
export async function generatePolicySuggestions(sql, orgId, { lookbackDays = 14, minFeedbackCount = 3 } = {}) {
  const suggestions = [];

  // 1. Find action types with trending negative feedback
  const negativeTrends = await sql`
    SELECT
      f.agent_id,
      a.action_type,
      COUNT(*) as negative_count,
      AVG(f.rating) as avg_rating,
      MAX(f.created_at) as latest_feedback
    FROM feedback f
    JOIN actions a ON f.action_id = a.action_id AND a.org_id = f.org_id
    WHERE f.org_id = ${orgId}
      AND f.sentiment = 'negative'
      AND f.created_at > NOW() - ${lookbackDays + ' days'}::interval
    GROUP BY f.agent_id, a.action_type
    HAVING COUNT(*) >= ${minFeedbackCount}
    ORDER BY COUNT(*) DESC
    LIMIT 20
  `;

  for (const trend of negativeTrends) {
    // Check if a matching policy already exists
    const existingPolicy = await sql`
      SELECT id FROM guard_policies
      WHERE org_id = ${orgId}
        AND active = 1
        AND (
          rules::text LIKE ${`%${trend.action_type}%`}
          OR (agent_ids IS NOT NULL AND agent_ids::text LIKE ${`%${trend.agent_id}%`})
        )
      LIMIT 1
    `;

    if (existingPolicy.length > 0) continue; // Already governed

    suggestions.push({
      type: 'require_approval',
      trigger: 'negative_feedback_trend',
      agent_id: trend.agent_id,
      action_type: trend.action_type,
      evidence: {
        negative_count: Number(trend.negative_count),
        avg_rating: Number(Number(trend.avg_rating).toFixed(1)),
        period_days: lookbackDays,
      },
      suggested_policy: {
        name: `auto-review-${trend.action_type}-${trend.agent_id}`,
        policy_type: 'require_approval',
        rules: JSON.stringify({
          action_types: [trend.action_type],
          reason: `${trend.negative_count} negative feedback items (avg rating ${Number(trend.avg_rating).toFixed(1)}) in the last ${lookbackDays} days`,
        }),
        agent_ids: JSON.stringify([trend.agent_id]),
      },
      severity: Number(trend.negative_count) >= 5 ? 'high' : 'medium',
    });
  }

  // 2. Find agents with high drift that don't have tightened policies
  const criticalDrift = await sql`
    SELECT agent_id, metric, z_score
    FROM drift_alerts
    WHERE org_id = ${orgId}
      AND severity = 'critical'
      AND acknowledged = false
    ORDER BY created_at DESC
    LIMIT 10
  `;

  for (const alert of criticalDrift) {
    if (alert.metric === 'risk_score') {
      suggestions.push({
        type: 'risk_threshold',
        trigger: 'critical_drift',
        agent_id: alert.agent_id,
        action_type: '*',
        evidence: {
          metric: alert.metric,
          z_score: Number(Number(alert.z_score).toFixed(1)),
        },
        suggested_policy: {
          name: `drift-guard-${alert.agent_id}`,
          policy_type: 'risk_threshold',
          rules: JSON.stringify({
            threshold: 50,
            action: 'require_approval',
            reason: `Critical risk score drift detected (z=${Number(alert.z_score).toFixed(1)})`,
          }),
          agent_ids: JSON.stringify([alert.agent_id]),
        },
        severity: 'high',
      });
    }
  }

  return suggestions;
}
```

- [ ] **Step 2: Lint**

Run: `cd "C:/Projects/DashClaw" && npm run lint`

- [ ] **Step 3: Commit**

```bash
git add app/lib/policy-suggestions.js
git commit -m "feat: add policy suggestion engine — feedback trends to policy proposals (Phase 3)"
```

---

### Task 5: Create policy suggestions API routes and cron

**Files:**
- Create: `app/api/learning/suggestions/route.js`
- Create: `app/api/cron/policy-suggestions/route.js`

- [ ] **Step 1: Create the suggestions API route**

```javascript
// app/api/learning/suggestions/route.js
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { generatePolicySuggestions } from '../../../lib/policy-suggestions.js';
import { insertPolicy } from '../../../lib/repositories/guardrails.repository.js';

export async function GET(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const suggestions = await generatePolicySuggestions(sql, orgId);
    return Response.json({ suggestions });
  } catch (err) {
    console.error('[learning/suggestions] GET error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const body = await request.json();
    const { action, suggestion_index } = body;

    if (action === 'accept') {
      const suggestions = await generatePolicySuggestions(sql, orgId);
      const suggestion = suggestions[suggestion_index];
      if (!suggestion) {
        return Response.json({ error: 'Suggestion not found' }, { status: 404 });
      }
      const policy = await insertPolicy(sql, orgId, {
        name: suggestion.suggested_policy.name,
        policy_type: suggestion.suggested_policy.policy_type,
        rules: suggestion.suggested_policy.rules,
        agent_ids: suggestion.suggested_policy.agent_ids,
        active: 1,
      });
      return Response.json({ accepted: true, policy });
    }

    return Response.json({ error: 'Invalid action. Use "accept".' }, { status: 400 });
  } catch (err) {
    console.error('[learning/suggestions] POST error:', err.message);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create the cron endpoint**

```javascript
// app/api/cron/policy-suggestions/route.js
import { getSql } from '../../../lib/db.js';
import { generatePolicySuggestions } from '../../../lib/policy-suggestions.js';

export async function GET(request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getSql();
    // Run for all orgs
    const orgs = await sql`SELECT DISTINCT org_id FROM organizations`;
    const results = [];
    for (const org of orgs) {
      const suggestions = await generatePolicySuggestions(sql, org.org_id);
      results.push({ org_id: org.org_id, suggestion_count: suggestions.length });
    }
    return Response.json({ ok: true, results });
  } catch (err) {
    console.error('[cron/policy-suggestions] Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Lint**

Run: `cd "C:/Projects/DashClaw" && npm run lint`

- [ ] **Step 4: Commit**

```bash
git add app/api/learning/suggestions/route.js app/api/cron/policy-suggestions/route.js
git commit -m "feat: add policy suggestions API and cron endpoint (Phase 3)"
```

---

### Task 6: Update SDK, docs, and skill

**Files:**
- Modify: `sdk/dashclaw.js` (already done in Task 3 for getLessons)
- Modify: `public/downloads/dashclaw-platform-intelligence/SKILL.md`

- [ ] **Step 1: Add getLessons to the skill SKILL.md**

In the "Track Learning" section, add after the existing content:

```markdown
**Fetch consolidated lessons (v2 SDK):**
```javascript
const { lessons, drift_warnings } = await dc.getLessons({ actionType: 'deploy' });
// lessons = [{ action_type, confidence, success_rate, hints, guidance, sample_size }]
// drift_warnings = [{ metric, severity, z_score, direction }]
```

- [ ] **Step 2: Add note about guard learning context to "Instrument My Agent"**

After the guard check example, add:

```markdown
The guard response includes a `learning` field when DashClaw has relevant context:
```javascript
const decision = await dc.guard({ action_type: 'deploy', risk_score: 60 });
if (decision.learning) {
  console.log(`Recent score avg: ${decision.learning.recent_score_avg}`);
  console.log(`Drift status: ${decision.learning.drift_status}`);
  console.log(`Patterns: ${decision.learning.patterns.join(', ')}`);
}
```

- [ ] **Step 3: Commit and push**

```bash
git add sdk/dashclaw.js public/downloads/dashclaw-platform-intelligence/SKILL.md __tests__/unit/sdk-v2.test.js
git commit -m "docs: update skill and SDK docs for closed learning loop"
git push origin main
```
