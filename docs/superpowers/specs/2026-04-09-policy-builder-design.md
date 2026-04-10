# Policy Builder Design Spec

**Date:** 2026-04-09
**Status:** Approved
**Scope:** Replace the existing `/policies` page with a shields-first policy experience.

## Problem

The existing policies page is a 900-line monolith that treats policy creation as form-filling. Even the founder doesn't use it. The policy system is powerful (10 policy types, simulation, AI generation, templates, YAML import) but the UX makes it feel like work instead of power. Users don't understand what policies do, how risk scores are calculated, or whether their policies are actually working.

## Goal

Make policies feel like **safety switches you flip on** — not configuration you author. The value of DashClaw should be obvious within 5 seconds of landing on this page: "Oh, I just turn this on and my agents can't deploy without my approval?"

## Design Decisions

- **Approach:** Shields-first grid with instant toggles. Power user tools (custom builder, YAML, AI generator) move to a secondary tab.
- **Pre-built shields:** Curated set of common protections that ship inactive on every instance. Toggle on = instant protection with sensible defaults.
- **Risk transparency:** Risk score calculation is explained inline — base scores, modifiers, examples. No more mysterious numbers.
- **No new API endpoints.** Everything uses existing policy CRUD, simulate, generate, import, and template routes.
- **Page replacement:** The current `app/policies/page.jsx` is replaced entirely.

## Page Structure

### URL: `/policies` (replaces current page)

### Top Stats Bar

Compact horizontal strip above tabs:
```
12 active shields  ·  47 blocks this week  ·  8 approvals pending  ·  3 agents governed
```

Data source: `GET /api/policies` (count active) + guard_decisions aggregate query (blocks/approvals this week). This can be a lightweight new query added to the existing policies GET response, or a separate fetch to the guard decisions endpoint.

### Three Tabs

```
[Shields]  [Custom]  [Activity]
```

- **Shields** (default) — safety switches grid
- **Custom** — full policy list, custom builder, import, AI generator, templates
- **Activity** — guard decisions feed with risk breakdowns

---

## Tab 1: Shields Grid

### Shield Card Anatomy

Each card in a responsive 2-column grid (1 column on mobile):

**Inactive state:** Muted card, toggle off, no stats. Visible but dimmed.

**Active state:** Subtle brand-color border glow (`border-brand/30`). Toggle on. Live stats strip visible.

Card contents:
- **Icon** — per-shield Lucide icon (e.g., Rocket for Deploy Gate, Shield for Risk Threshold)
- **Name** — plain English (e.g., "Deploy Gate", not "require_approval policy")
- **Toggle** — on/off, instant. No confirmation dialog.
- **Description** — one line explaining what this protects you from
- **Stats strip** — only when active + has data: "7 blocked · 3 approvals · 14d" (since activation)
- **Agent scope** — "All agents" or "3 agents"
- **Configure link** — expands card inline to show tunable parameters

### Pre-Built Shield Definitions

Defined in `app/policies/lib/shields.js` as a static array. Each entry:

```js
{
  id: 'deploy_gate',           // matches _shield tag in rules JSON
  name: 'Deploy Gate',
  description: 'Require approval before any deploy or migration',
  icon: 'Rocket',              // Lucide icon name
  policyType: 'require_approval',
  defaultRules: { action_types: ['deploy', 'migrate'] },
  category: 'access',          // for optional grouping
}
```

**Shield set (v1):**

| ID | Name | Type | Default Rules | Icon |
|----|------|------|--------------|------|
| `deploy_gate` | Deploy Gate | require_approval | action_types: [deploy, migrate] | Rocket |
| `risk_high` | High Risk Review | risk_threshold | threshold: 70, action: require_approval | AlertTriangle |
| `risk_critical` | Critical Risk Block | risk_threshold | threshold: 90, action: block | ShieldAlert |
| `destructive_block` | Destructive Ops Block | block_action_type | action_types: [apply, migrate, sync] | Ban |
| `rate_limiter` | Rate Limiter | rate_limit | max_actions: 30, window_minutes: 60, action: warn | Timer |
| `api_review` | API Call Review | require_approval | action_types: [api] | Globe |
| `secret_guard` | Secret Exposure Guard | semantic_check | instruction: "Block actions that might expose API keys, passwords, tokens, or credentials", fallback: block | Lock |
| `outbound_gate` | Outbound Message Gate | require_approval | action_types: [message, post] | MessageSquare |

### Shield ↔ Policy Mapping

When a shield is toggled on, it creates a policy via `POST /api/policies` with:
- `name`: shield name (e.g., "Deploy Gate")
- `policy_type`: from shield definition
- `rules`: `JSON.stringify({ ...defaultRules, _shield: shield.id })`
- `active`: 1

When toggled off: `PATCH /api/policies` with `active: 0`.

On page load, `GET /api/policies` is fetched. Each policy with a `_shield` tag in its rules JSON is matched to the corresponding shield definition. Shields without a matching policy are shown as inactive/available.

If a user creates a custom policy that happens to match a shield's type and config, it won't appear as a shield — only policies with the `_shield` tag are matched. This prevents confusion.

### Shield Configure Expansion

Clicking "Configure" expands the card inline (no modal). Each shield type gets tailored controls:

**Risk Threshold shields (risk_high, risk_critical):**
- Threshold slider (0-100) with colored zones:
  - Green zone: 0-29 (low risk)
  - Amber zone: 30-69 (medium)
  - Red zone: 70-100 (high)
- Action dropdown: Block / Require Approval / Warn
- Collapsible "How are risk scores calculated?" section (Risk Explainer)

**Risk Explainer contents:**
- Base score table: action_type → score (security: 80, deploy: 75, migrate: 70, etc.)
- Modifiers list: irreversible +15, touches production/DB +10, destructive goal +20, deployment goal +10, references secrets +15
- Formula: `score = min(base + modifiers, 100)`
- Example: "deploy (75) + irreversible (+15) = 90"

**Require Approval / Block shields (deploy_gate, api_review, outbound_gate, destructive_block):**
- Action type pill toggles — visual grid of toggleable pills
- Active pills highlighted in brand color
- Each pill labeled with action type name

**Rate Limiter:**
- Max actions: number stepper
- Time window: dropdown with human-friendly options (15 min / 1 hour / 4 hours / 24 hours) mapping to minutes internally
- Action: Block / Warn / Require Approval

**Semantic Check (secret_guard):**
- Instruction textarea showing current rule
- Fallback: Fail Open / Fail Closed toggle
- Helper text: "Requires GUARD_LLM_KEY or OPENAI_API_KEY environment variable"

**All config panels share:**
- Agent scope selector: "All agents" default button, expandable multi-select for specific agents
- "Reset to defaults" link
- Auto-save on change (no save button — feels like settings, not a form). Debounced PATCH to `/api/policies` with 500ms delay after last change. Brief "Saved" toast confirmation.

---

## Tab 2: Custom

### Actions Bar

```
[+ New Policy]  [Import YAML]  [AI Generator]  [Browse Templates]
```

### Policy List

Full list of all org policies (shields + custom). Each row shows:
- Policy name
- Type badge
- Active/inactive badge
- Agent scope (All agents / N agents)
- Created date
- Action links: Edit, Simulate, Export JSON, Delete

**Search** by name. **Filter** by type and active status.

**Edit** opens an inline form with all fields editable (same config fields as shield expansion, plus name and type for custom policies). Policy type is locked when editing (same as current behavior).

**Simulate** calls `POST /api/policies/simulate` with the policy config. Shows results: "This policy would have blocked 12 / warned 5 / approved 3 actions in the last 7 days."

**Export JSON** copies the policy definition as JSON to clipboard.

**Delete** with inline confirmation (same pattern as capabilities page: "Delete? Yes / No").

### New Policy Creation

"+ New Policy" opens a guided form:
1. **Type selector** — cards for each policy type with icon, name, and one-line description of what it does
2. **Config fields** — type-specific (same components used by shield expansion)
3. **Name** — text input
4. **Agent scope** — All agents or specific
5. **Save**

### Import YAML

Panel with:
- Textarea for pasting YAML or JSON
- Preview before import (shows what will be created, flags name conflicts)
- Uses existing `POST /api/policies/import` endpoint

### AI Generator

The existing natural language → policy feature. Text input, generates structured policy, preview card, save. Uses existing `POST /api/policies/generate` endpoint.

### Browse Templates

Existing policy pack gallery (enterprise-strict, smb-safe, startup-growth, development, layered-intelligence). Install preview shows conflicts. Uses existing `GET /api/policies/templates` and `POST /api/policies/import` endpoints.

---

## Tab 3: Activity

### Stats Strip

```
47 blocks (7d)  ·  23 approvals (7d)  ·  12 warns (7d)
```

### Guard Decision Feed

Filterable feed of recent guard decisions.

**Filters:** Decision type (block/allow/warn/require_approval), Agent, Policy name.

**Each entry shows:**
- Decision color dot: red (block), amber (require_approval), yellow (warn), green (allow)
- Decision label
- Action type + agent name + relative time
- Policy name that triggered the decision (if any)
- Risk score with breakdown: "90 (deploy 75 + irreversible +15)"
- Goal text (truncated)
- Click to navigate to full action in Decisions Ledger

**Real-time:** Feed updates via existing `useRealtime` hook subscribing to `GUARD_DECISION_CREATED` events.

**Data source:** Guard decisions are queried from `guard_decisions` table. Need a lightweight API endpoint or extend existing one. The current `POST /api/policies/test` route is for test runs, not historical decisions. We may need `GET /api/guard/decisions` or can pull from the existing data via `GET /api/actions` with guard decision data joined.

**Implementation note:** The current policies page already fetches guard decisions inline. We extract that logic into the Activity tab component. If no dedicated guard decisions endpoint exists, we can query `guard_decisions` table via a new lightweight route `GET /api/guard/decisions` with filters for decision type, agent_id, policy_id, and time range.

---

## Components

### New Files

| File | Responsibility |
|------|---------------|
| `app/policies/page.jsx` | Replaced — thin shell with tab state and stats bar |
| `app/policies/components/ShieldsGrid.jsx` | Shields tab — fetches policies, renders grid |
| `app/policies/components/ShieldCard.jsx` | Individual shield — toggle, stats, expand |
| `app/policies/components/ShieldConfig.jsx` | Type-specific config panels (dispatches by policyType) |
| `app/policies/components/RiskExplainer.jsx` | Collapsible risk score breakdown |
| `app/policies/components/CustomTab.jsx` | Custom tab — policy list, actions bar |
| `app/policies/components/PolicyForm.jsx` | Create/edit form (extracted from current monolith) |
| `app/policies/components/ActivityTab.jsx` | Guard decisions feed with risk breakdowns |
| `app/policies/components/AgentScopePicker.jsx` | Reusable agent scope selector (All agents / specific) |
| `app/policies/lib/shields.js` | Shield definitions array |
| `app/api/guard/decisions/route.js` | New lightweight route for guard decision feed |

### Modified Files

| File | Change |
|------|--------|
| `app/policies/page.jsx` | Full replacement |

### Preserved (reused via existing API routes)

- AI generator: `POST /api/policies/generate`
- YAML import: `POST /api/policies/import`
- Templates: `GET /api/policies/templates`
- Simulation: `POST /api/policies/simulate`
- Policy CRUD: `GET/POST/PATCH/DELETE /api/policies`

---

## Styling

Follow existing DashClaw conventions:
- Dark theme: `bg-[#0a0a0a]` page, `bg-[#111]` cards
- Brand orange for active shields: `border-brand/30`, `bg-brand/10`
- Inactive shields: `opacity-60`, `border-[rgba(255,255,255,0.06)]`
- Toggle switch: custom CSS toggle or styled checkbox matching the brand
- Risk zones: green (`text-emerald-400`), amber (`text-amber-400`), red (`text-red-400`)
- Pill toggles for action types: `rounded-full` with brand highlight when active
- Stats strip: `text-xs text-zinc-400` with `text-white font-medium` for numbers
- Cards: `rounded-2xl` consistent with Agent Profiles and capabilities

---

## Non-Goals

- Drag-and-drop policy ordering (policies are evaluated in parallel, order doesn't matter)
- Visual rule builder with condition trees (overkill — the shield configs are sufficient)
- Policy versioning or history (future feature)
- Policy approval workflow (policies are admin-only, no need for approval-on-policy-change)
- Webhook test/debug UI (separate feature)

---

## New API Endpoint

### `GET /api/guard/decisions`

Lightweight endpoint to query guard decision history.

**Query params:**
- `decision` — filter by decision type (block/allow/warn/require_approval)
- `agent_id` — filter by agent
- `policy_id` — filter by policy
- `limit` — default 50, max 200
- `offset` — pagination

**Response:**
```json
{
  "decisions": [
    {
      "id": "gd_123",
      "decision": "block",
      "risk_score": 90,
      "risk_breakdown": { "base": 75, "base_type": "deploy", "modifiers": ["+15 irreversible"] },
      "agent_id": "agent_1",
      "agent_name": "Deploy Bot",
      "action_type": "deploy",
      "declared_goal": "Push v2.4 to production",
      "matched_policies": ["Deploy Gate"],
      "reason": "Action type deploy requires approval",
      "created_at": "2026-04-09T16:00:00Z"
    }
  ],
  "total": 47
}
```

**Implementation:** Query `guard_decisions` table, join with `action_records` for agent name and goal. The `risk_breakdown` field is computed from the stored context JSON (which already contains the risk score inputs).

**Stats query:** The top stats bar needs aggregate counts. This can be a separate `GET /api/guard/decisions/stats` or included as a `stats` field in the decisions response when `offset=0`.
