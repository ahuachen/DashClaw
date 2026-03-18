# Integrations: Org Defaults + Agent Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split integrations UX into org-level defaults (main page) and per-agent overrides (agent detail tab), removing the confusing dual-dropdown pattern.

**Architecture:** The backend already supports org defaults + agent overrides via nullable `agent_id` in the `settings` table and `DISTINCT ON (key)` merge queries. This is purely a frontend restructure. Extract the integration grid into a shared component, then use it in two modes: org-default mode on `/integrations` and agent-override mode on the agent detail page's Integrations tab.

**Tech Stack:** Next.js 15, React client components, existing `/api/settings` and `/api/agents/connections` endpoints.

---

### Task 1: Extract Integration Grid into Shared Component

**Files:**
- Create: `app/components/IntegrationGrid.js`
- Modify: `app/integrations/page.js`

This extracts the integration card grid, search, category filters, and configure modal into a reusable component that accepts a `mode` prop.

- [ ] **Step 1: Create `IntegrationGrid.js`**

Extract from `app/integrations/page.js` lines 18-346 (INTEGRATION_CONFIGS) and the grid rendering logic into a standalone component.

Props:
```javascript
IntegrationGrid({
  mode,            // 'org' | 'agent'
  agentId,         // null for org mode, agent_id for agent mode
  settings,        // settings map from parent
  connections,     // connections array from parent
  onConfigure,     // callback when user clicks Configure
  isAdmin,         // whether user can edit
})
```

The component renders:
- Search bar
- Category filter pills
- 3-column card grid with status badges
- For agent mode: "Inherited from org" badge on inherited integrations, "Override" button

- [ ] **Step 2: Extract INTEGRATION_CONFIGS to its own file**

Create `app/lib/integrationConfigs.js` with the full configs object exported. Both `IntegrationGrid.js` and the configure modal will import from here.

- [ ] **Step 3: Verify integrations page still renders**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add app/components/IntegrationGrid.js app/lib/integrationConfigs.js app/integrations/page.js
git commit -m "refactor: extract IntegrationGrid into shared component"
```

---

### Task 2: Simplify `/integrations` Page to Org-Only Mode

**Files:**
- Modify: `app/integrations/page.js`

- [ ] **Step 1: Remove the "Viewing settings for" agent dropdown**

Delete the agent dropdown state (`selectedAgentId`, `agentDropdownOpen`, `fetchAgents`), the dropdown UI (lines ~641-696), and the "Viewing settings for" label above it. The page now ALWAYS fetches org-level defaults (no `agent_id` param).

- [ ] **Step 2: Update page title and subtitle**

Change from "Integrations & Settings" / "Configure your connected services" to:
- Title: "Integrations"
- Subtitle: "Org-wide service connections — override per agent from Fleet > Agent > Integrations"

- [ ] **Step 3: Add "Agents using this" indicator to integration cards**

For each connected integration, show a small count badge: "3 agents" or "org-wide". Fetch agent connections from `/api/agents/connections` (no agent_id filter = all connections) and count per provider.

- [ ] **Step 4: Update configure modal**

Remove agent_id from save payload since this page only saves org-level settings. Add a note in the modal: "This sets the org-wide default. Agents can override from their profile."

- [ ] **Step 5: Verify page works**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add app/integrations/page.js
git commit -m "feat: simplify integrations page to org-level defaults only"
```

---

### Task 3: Build Full Integrations Tab on Agent Detail Page

**Files:**
- Modify: `app/agents/[agentId]/page.js`

- [ ] **Step 1: Replace placeholder Integrations tab with full grid**

Replace the current simple Integrations tab content with the `IntegrationGrid` component in agent mode. This shows:
- All available integrations (same grid as main page)
- Status per integration: "Inherited from org" (muted green), "Agent override" (bright green), "Not configured" (grey)
- "Override" button on inherited integrations
- "Remove override" button on agent-specific overrides (reverts to org default)

- [ ] **Step 2: Add integration settings fetch for this agent**

Add `fetchIntegrationSettings` that calls `/api/settings?category=integration&agent_id={agentId}`. The response already includes `is_inherited` flags. Wire this into the IntegrationGrid props.

- [ ] **Step 3: Add configure modal for agent overrides**

When user clicks "Override" on an inherited integration or "Configure" on an unconfigured one, show the configure modal with:
- Pre-filled values from org default (read-only display)
- Editable fields for the agent-specific override
- Save calls POST `/api/settings` with `agent_id` in payload
- "Remove Override" button calls DELETE `/api/settings?key=X&agent_id=Y` for each field

- [ ] **Step 4: Verify agent detail page works**

Run: `npm run lint`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add app/agents/[agentId]/page.js
git commit -m "feat: full integration grid with org/agent override on agent detail page"
```

---

### Task 4: Update Stat Cards on `/integrations` Page

**Files:**
- Modify: `app/integrations/page.js`

- [ ] **Step 1: Update stat card meanings**

The 4 stat cards should reflect org-level scope:
- **Available**: Total integration slots (count of INTEGRATION_CONFIGS)
- **Connected**: Org-level connected count (settings with required fields filled, agent_id IS NULL)
- **Agent Overrides**: Count of integrations that have at least one agent-specific override
- **Not Configured**: Available minus Connected

Remove the old "Agent Connected" and "Partial" cards which depended on the per-agent dropdown.

- [ ] **Step 2: Fetch override counts**

Add a fetch to `/api/settings?category=integration&count_overrides=true` or compute from connections data: count distinct (provider, agent_id) pairs in agent_connections table.

- [ ] **Step 3: Commit**

```bash
git add app/integrations/page.js
git commit -m "feat: update integration stat cards for org-level view"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: 0 errors (or only pre-existing warnings)

- [ ] **Step 2: Manual smoke test**

1. Open `/integrations` — should show org-level defaults, NO agent dropdown
2. Configure an integration — should save without agent_id
3. Open `/agents/{agentId}` → Integrations tab — should show grid with "Inherited from org" badges
4. Override an integration for the agent — should save with agent_id
5. Back to `/integrations` — "Agent Overrides" count should reflect the change
6. Remove the override from the agent detail page — should revert to inherited

- [ ] **Step 3: Commit any final fixes**

```bash
git commit -m "fix: integration org/agent split polish"
```
