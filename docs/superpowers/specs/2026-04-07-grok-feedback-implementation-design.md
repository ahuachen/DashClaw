# DashClaw — Grok Feedback Implementation Design

> **Source:** Grok codebase review (2026-04-07) with user-prioritized scope.
> **Scope:** Quick wins (SDK polish, docs, roadmap) + AI features (policy generator, predictive risk).

---

## Phase 1: Quick Wins

### 1.1 Python SDK → `pyproject.toml`

**Goal:** Replace the legacy `sdk-python/setup.py` with a modern `pyproject.toml`.

**What changes:**
- Delete `sdk-python/setup.py`.
- Create `sdk-python/pyproject.toml` with:
  - `[build-system]` using `setuptools` + `setuptools-scm`.
  - `[project]` metadata mirroring current setup.py values (name=dashclaw, version=2.10.0, python_requires>=3.7, zero runtime deps).
  - `[project.optional-dependencies]` for `langchain` extra (`langchain-core>=0.1.0`).
  - `[project.urls]` with GitHub and docs links.
- No functional changes to the SDK itself.

**Validation:** `pip install -e ./sdk-python` still works. `pip install -e "./sdk-python[langchain]"` pulls langchain-core.

---

### 1.2 Document SDK Asymmetry

**Goal:** Clearly explain why the Node and Python SDKs differ in scope, so users don't wonder "why is Python bigger?"

**What changes:**
- Add an "SDK Tiers" section to `sdk/README.md` (the file that powers the "Copy as Markdown" button on `/docs`) after the governance loop examples and before the method listing.

**Content:**

> ### SDK Tiers
>
> | | Node SDK | Python SDK |
> |---|---|---|
> | **Focus** | Lightweight governance loop | Full platform surface |
> | **Methods** | 67 | 185+ |
> | **Core governance** | ✅ | ✅ |
> | **Scoring profiles** | ✅ | ✅ |
> | **Learning loop** | ✅ | ✅ |
> | **Framework integrations** | — | LangChain, CrewAI, AutoGen |
> | **Compliance engine** | — | ✅ |
> | **Execution graphs** | — | ✅ |
> | **Webhooks management** | — | ✅ |
>
> **Node** is designed for most agents — fast, minimal, covers the governance loop and common workflows. **Python** is the enterprise/power-user surface with compliance reporting, execution graph traversal, and framework-native integrations.

---

### 1.3 Public ROADMAP.md

**Goal:** Give the community visibility into where DashClaw is headed.

**What changes:**
- Create `ROADMAP.md` at repo root.
- Add a link from `README.md` (in the "Documentation" or links section).

**Structure:**

```
# DashClaw Roadmap

## Recently Shipped
- v2.8: Agent Intel hooks, session lifecycle, 3 policy types, 4 signal types, recovery engine
- v2.3: Cost dashboard, policy template gallery, approval webhooks
- v2.2: CLI approval client, Claude Code hooks, npx dashclaw-demo

## In Progress
- AI Policy Generator — paste natural language → guard rules + recovery recipes
- Predictive risk scoring — LLM-enhanced risk for high-stakes actions
- SSE real-time events — replace polling with server-sent events (both SDKs)

## Exploring
- Fleet & enterprise — team invites, role-based policy inheritance, SSO, audit export
- Framework templates — CrewAI, AutoGen, LangGraph full examples
- Hosted free tier — 3 agents / 500 actions/month with Pro subscription
- DashClaw Certified — badge program for agent builders
- Cost optimization engine — auto-suggest cheaper model routing
```

---

### 1.4 Surface Hidden Features in README

**Goal:** New users currently don't discover drift detection, recovery recipes, scoring profiles, or the learning loop from the README alone.

**What changes:**
- Add a "Beyond the Basics" section to `README.md` after the quickstart / integration section.

**Content (brief descriptions with SDK doc links):**
- **Drift Detection** — Monitors reasoning and metric drift across agent sessions. Surfaces signals when an agent's behavior deviates from its baseline.
- **Recovery Recipes** — 6 built-in recipes that map signals to suggested remediations and auto-actions. Guard responses include a `recovery` field when applicable.
- **Scoring Profiles** — Multi-dimensional evaluation with weighted composite scores, auto-calibration, and batch scoring.
- **Learning Loop** — Guard responses include historical learning context (recent score averages, drift status, behavioral patterns) that feed back into future decisions.
- **Prompt Injection Scanning** — On by default for all guard evaluations. Detects and blocks injection patterns in declared goals.

Each item is 1-2 sentences + a pointer to the relevant SDK README section.

---

## Phase 2: AI Features

### 2.1 AI Policy Generator (Hybrid with Preview)

**Goal:** Let users paste natural language company policies and have DashClaw generate enforceable guard rules + recovery recipes, with a review step before committing.

#### Architecture

**New files:**
- `app/lib/policy-generator.js` — LLM prompt construction, response parsing, validation.
- `app/api/policies/generate/route.js` — `POST` endpoint (Tier 1 extension, behind governance allowlist).
- `app/policies/generate/page.js` — UI: textarea input → preview table → confirm button.

**Modified files:**
- `scripts/check-api-boundary.mjs` — No change needed. The boundary check validates top-level route names, and `policies` is already in `ALLOWED_RUNTIME_ROUTES`. Sub-routes like `policies/generate` are allowed automatically.

**No new database tables.** Reuses `guard_policies` and existing recovery recipe storage.

#### API Contract

```
POST /api/policies/generate
Content-Type: application/json

Request:
{
  "input_text": "Agents must never deploy to production after 5pm EST without VP approval. All database migrations require a backup first.",
  "dry_run": true  // default true — preview only
}

Response (dry_run=true):
{
  "generated_policies": [
    {
      "name": "No late deploys without VP approval",
      "policy_type": "require_approval",
      "rules": {
        "action_types": ["deploy"],
        "conditions": {
          "time_after": "17:00",
          "timezone": "America/New_York"
        },
        "approval_roles": ["vp"]
      },
      "recovery_recipe": {
        "signal": "late_deploy_attempt",
        "suggestion": "Schedule deployment for next business day or escalate to VP",
        "auto_action": null
      },
      "confidence": 0.92
    },
    {
      "name": "Database migration requires backup",
      "policy_type": "require_approval",
      "rules": {
        "action_types": ["migrate"],
        "systems": ["database", "postgres"],
        "prerequisite": "backup_confirmed"
      },
      "recovery_recipe": {
        "signal": "migration_without_backup",
        "suggestion": "Run database backup before proceeding",
        "auto_action": null
      },
      "confidence": 0.88
    }
  ],
  "warnings": [],
  "input_hash": "abc123"  // for idempotent confirm
}

Response (dry_run=false, with input_hash):
{
  "created_policies": ["pol_xxx", "pol_yyy"],
  "created_recipes": ["rec_xxx", "rec_yyy"]
}
```

#### LLM Integration

- Reuses the BYOK model strategy completion pattern from `POST /api/model-strategies/:id/complete`.
- The org must have an LLM provider configured (OpenAI or Anthropic key in org settings). If not, return 422 with a message pointing to `/setup`.
- System prompt includes:
  1. The full schema of valid `policy_type` values and their `rules` JSON shapes.
  2. 2-3 few-shot examples per policy type (sourced from the policy template gallery).
  3. The list of valid `action_types` from `ACTION_TYPE_BASE_SCORES` in `guard.js`.
  4. Instruction to return a JSON array with confidence scores per policy.
- Response is validated against `validatePolicy()` before returning the preview. Invalid policies are included in a `warnings` array with the parse error.

#### UI Flow

1. User navigates to `/policies/generate` (linked from the policies page).
2. Textarea with placeholder: "Paste your company policy, Slack message, or compliance requirement..."
3. "Generate Preview" button → calls API with `dry_run: true`.
4. Results displayed as editable cards — each card shows name, type, rules (JSON editor), confidence badge, and a toggle to include/exclude.
5. "Create Policies" button → calls API with `dry_run: false` + `input_hash` for the selected policies.
6. Success → redirect to `/policies` with a toast showing count created.

#### Edge Cases

- Empty input or gibberish → LLM returns empty array → UI shows "No policies could be generated. Try rephrasing."
- LLM returns invalid policy types → caught by `validatePolicy()`, moved to warnings.
- BYOK key missing → 422 response, UI shows setup link.
- Partial generation (some valid, some not) → show valid as cards, warnings in a collapsible section.

---

### 2.2 Predictive Risk Scoring (Statistical + LLM for High-Stakes)

**Goal:** Enhance the guard's risk scoring with historical behavior analysis (always) and LLM-powered assessment (for high-risk actions, opt-in).

#### Architecture

**New files:**
- `app/lib/predictive-risk.js` — Historical query functions + LLM risk assessment.
- `__tests__/unit/predictive-risk.test.js` — Unit tests for statistical scoring and LLM integration.

**Modified files:**
- `app/lib/guard.js` — Call predictive risk from `evaluateGuard()`, merge results into response.
- `app/lib/repositories/settings.repository.js` — Add `predictive_risk_enabled` and `predictive_risk_threshold` to org settings (if not already a generic settings pattern).

**No new database tables.** Queries existing `action_records`.

#### Statistical Component (Always On)

For every guard call, `predictive-risk.js` runs a fast query against `action_records`:

```sql
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'failed') as failures,
  AVG(risk_score) as avg_risk,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as recent_count
FROM action_records
WHERE org_id = $1
  AND agent_id = $2
  AND action_type = $3
  AND created_at > NOW() - INTERVAL '30 days'
```

Statistical adjustments to `computeRiskScore()`:
- Failure rate > 50% for this (agent, action_type): +15
- Failure rate > 25%: +10
- More than 5 actions in the last hour (velocity spike): +5
- Agent has zero history for this action type (unknown territory): +5

These adjustments are deterministic, free, and add no latency beyond the DB query.

#### LLM Component (Opt-In, High-Stakes Only)

**Trigger:** When the computed risk score (base + statistical) is ≥ threshold (default 60, configurable per org via settings).

**Flow:**
1. Fetch the last 10 similar actions for this (agent_id, action_type) with outcomes, assumptions, and timestamps.
2. Construct a prompt: "Given this agent's history of [action_type] actions, assess the risk of the proposed action. Return a JSON object with `adjustment` (-20 to +20) and `reasoning` (1-2 sentences)."
3. Call LLM via BYOK key (same pattern as policy generator).
4. Parse response, clamp adjustment to [-20, +20], apply to risk score.
5. If LLM call fails (timeout, bad key, parse error): proceed with statistical score only. Never block on LLM failure.

**Guard response additions:**
```json
{
  "risk_score": 78,
  "predictive_risk": {
    "statistical": {
      "failure_rate": 0.35,
      "total_actions": 23,
      "avg_historical_risk": 62,
      "velocity": 3,
      "adjustment": 10
    },
    "llm": {
      "adjustment": 8,
      "reasoning": "This agent has failed 3 of the last 5 deploys after 4pm. Current time is 5:30pm EST.",
      "model": "claude-sonnet-4-5-20250514"
    }
  }
}
```

When LLM is not triggered (score < threshold or feature disabled), `predictive_risk.llm` is `null`.

#### Org Settings

- `predictive_risk_enabled`: boolean, default `false`. Must be explicitly enabled.
- `predictive_risk_threshold`: integer 0-100, default `60`. Score at which LLM kicks in.
- Configurable via existing org settings API/UI.

#### Performance Budget

- Statistical query: target < 20ms (indexed on `(org_id, agent_id, action_type, created_at)`).
- LLM call: 1-3 seconds. Guard response time goes from ~50ms to ~2s for high-risk actions. Acceptable since high-risk actions already involve human review.
- The LLM call is fire-and-wait, not background — the guard must return the complete risk assessment.

#### Index Requirement

Add a composite index to `action_records` if not already present:
```sql
CREATE INDEX IF NOT EXISTS idx_action_records_predictive
ON action_records (org_id, agent_id, action_type, created_at DESC);
```

This goes into `drizzle/0000_clammy_falcon.sql` and is picked up by `scripts/auto-migrate.mjs`.

---

## Implementation Order

1. **Phase 1.1** — pyproject.toml (standalone, no deps)
2. **Phase 1.2** — SDK asymmetry docs (standalone)
3. **Phase 1.3** — ROADMAP.md (standalone)
4. **Phase 1.4** — Surface hidden features in README (standalone)
5. **Phase 2.1** — AI Policy Generator (depends on BYOK pattern existing — it does)
6. **Phase 2.2** — Predictive Risk Scoring (depends on policy generator only for shared LLM calling pattern — can be parallelized)

Phase 1 items are fully independent and can be done in any order or parallel.
Phase 2 items are independent of each other but both depend on Phase 1 being done (for roadmap accuracy).

---

## Out of Scope

- SSE real-time events (moved to future — needs new server endpoint + both SDKs)
- Fleet/enterprise features (team invites, SSO, audit export)
- Hosted free tier / pricing
- DashClaw Certified marketplace
- Cost optimization / model downgrading engine
- Additional framework templates (CrewAI, AutoGen, LangGraph)

These are documented in ROADMAP.md as "In Progress" or "Exploring."
