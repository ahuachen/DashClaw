# DashClaw Platform Restructure — v2 SDK, Dashboard Nav, Agent Integrations

**Date:** 2026-03-18
**Status:** Approved
**Scope:** v2 SDK method surface, dashboard sidebar, agent detail page, skill docs

---

## Problem

The v2 SDK (Gemini refactor) stripped too aggressively. Key agent-runtime methods (messaging, handoffs, security scanning, feedback, context threads) were moved to v1-only, breaking the agent lifecycle. Meanwhile, admin-only methods (webhooks, activity logs, compliance reporting) stayed in v2 where they don't belong.

The dashboard sidebar has 20 items across 4 groups with overlapping entries (Activity vs Audit Log), missing features (Drift, Feedback), and a "Labs" section that buries production-ready features (Learning, Evaluations, Scoring).

## Design

### Part 1: v2 SDK Refactor

**Principle:** v2 = agent runtime methods. v1 = full platform surface including admin/operator tooling.

**Add to v2 (10 methods):**

```
sendMessage(msg)               POST /api/messages             Multi-agent coordination
getInbox(filters)              GET  /api/messages             Check for instructions
createHandoff(handoff)         POST /api/handoffs             Session continuity
getLatestHandoff()             GET  /api/handoffs?latest=true Resume from last session
scanPromptInjection(text,opts) POST /api/security/prompt-injection  Input security
submitFeedback(feedback)       POST /api/feedback             Learning flywheel
createThread(thread)           POST /api/context/threads      Reasoning trails
addThreadEntry(id,content,type)POST /api/context/threads/:id/entries  Append reasoning
closeThread(id,summary)        PATCH /api/context/threads/:id Close reasoning
syncState(state)               POST /api/sync                 Bulk state sync
```

**Remove from v2 (4 methods):**

```
createWebhook(url, events)     Admin configuration — move to v1 only
getActivityLogs(filters)       Operator audit browsing — move to v1 only
mapCompliance(framework)       Quarterly admin task — move to v1 only
getProofReport(format)         Auditor reporting — move to v1 only
```

**Result:** 38 → 44 methods. Every method passes the test: "an agent calls this during its job."

**Method signatures** (copied from v1 legacy, adapted to v2 `_request` pattern):

```javascript
// Messaging
async sendMessage({ to, type, subject, body, threadId, urgent }) {
  return this._request('/api/messages', 'POST', {
    from_agent_id: this.agentId, to_agent_id: to,
    message_type: type, subject, body, thread_id: threadId, urgent
  });
}

async getInbox({ type, unread, limit } = {}) {
  return this._request('/api/messages', 'GET', null, {
    agent_id: this.agentId, direction: 'inbox', type, unread, limit
  });
}

// Handoffs
async createHandoff(handoff) {
  return this._request('/api/handoffs', 'POST', { agent_id: this.agentId, ...handoff });
}

async getLatestHandoff() {
  return this._request('/api/handoffs', 'GET', null, {
    agent_id: this.agentId, latest: 'true'
  });
}

// Security
async scanPromptInjection(text, { source } = {}) {
  return this._request('/api/security/prompt-injection', 'POST', {
    text, source, agent_id: this.agentId
  });
}

// Feedback
async submitFeedback({ action_id, rating, comment, category, tags, metadata }) {
  return this._request('/api/feedback', 'POST', {
    action_id, agent_id: this.agentId, rating, comment, category, tags, metadata
  });
}

// Context Threads
async createThread(thread) {
  return this._request('/api/context/threads', 'POST', {
    agent_id: this.agentId, ...thread
  });
}

async addThreadEntry(threadId, content, entryType) {
  return this._request(`/api/context/threads/${threadId}/entries`, 'POST', {
    content, entry_type: entryType
  });
}

async closeThread(threadId, summary) {
  return this._request(`/api/context/threads/${threadId}`, 'PATCH', {
    status: 'closed', ...(summary ? { summary } : {})
  });
}

// Bulk Sync
async syncState(state) {
  return this._request('/api/sync', 'POST', { agent_id: this.agentId, ...state });
}
```

### Part 2: Dashboard Sidebar

**New structure (16 items, 5 groups):**

```
GOVERNANCE
  Mission Control     /mission-control    Shield icon
  Decisions           /decisions          GitBranch icon
  Approvals           /approvals          CheckCircle icon
  Policies            /policies           Lock icon
  Assumptions         /drift              Brain icon

OBSERVE
  Fleet               /agents             Users icon
  Signals             /security           AlertTriangle icon
  Drift               /drift/detection    TrendingUp icon
  Learning            /learning           GraduationCap icon

MEASURE
  Quality             /quality            BarChart icon
  Prompts             /prompts            FileText icon
  Feedback            /feedback           MessageSquare icon

COMPLIANCE
  Activity            /activity           Activity icon
  Exports             /compliance/exports Download icon

CONFIGURE
  API Keys            /api-keys           Key icon
  Settings            /setup              Settings icon
```

**Removed:** Swarm Intel, Integrations (→ agent detail tab), Audit Log (→ merged into Activity), Webhooks (→ Settings sub-section), Usage (→ Settings sub-section), Compliance top-level (→ Activity + Exports split)

### Part 3: Agent Detail — Integrations Tab

Add 5th tab to `app/agents/[agentId]/page.js`:

```
Governance Profile | Enforced Policies | Authorized Scopes | Integrations | Decisions Ledger
```

**Integrations tab content:**
- Fetch from `/api/integrations?agent_id={agentId}`
- Show connected services with status badges (connected/disconnected/error)
- Add integration button → modal to configure new integration
- Remove integration with confirmation
- Last-seen timestamp per integration

The existing "CONNECTED INTEGRATIONS" card in the Governance Profile right sidebar becomes a summary linking to this tab.

### Part 4: Drift Detection Page

**New page:** `app/drift/detection/page.js`

Routing:
- `/drift` = Assumptions page (existing, no changes)
- `/drift/detection` = Drift Detection page (new)

**Content:**
- Active alerts table with severity badges (info/warning/critical)
- Baseline status (last computed, metrics tracked)
- Z-score trend charts per metric
- Acknowledge/dismiss alert actions
- "Compute Baselines" button (triggers POST /api/drift/alerts with action=compute_baselines)

### Part 5: Quality Page (merged Evaluations + Scoring)

**New page:** `app/quality/page.js`

Merges content from `/evaluations` and `/scoring` into one unified view with tabs:
- **Scoring Profiles** — profiles, dimensions, risk templates (from /scoring)
- **Evaluations** — scorers, eval runs, scores (from /evaluations)
- **Calibration** — auto-calibrate UI

Old routes `/scoring` and `/evaluations` redirect to `/quality`.

### Part 6: Skill Update

Update `public/downloads/dashclaw-platform-intelligence/SKILL.md`:
- Add new v2 methods to "Instrument My Agent" section
- Add `> Requires v1 SDK` callouts to sections using v1-only methods
- Fix method name mismatches in api-surface.md
- Update platform-knowledge.md SDK method count
- Fix troubleshooting.md guardMode reference

---

## Files Changed

| File | Change |
|------|--------|
| `sdk/dashclaw.js` | Add 10 methods, remove 4 |
| `app/components/Sidebar.js` | Rewrite navGroups to 5-group structure |
| `app/agents/[agentId]/page.js` | Add Integrations tab |
| `app/drift/detection/page.js` | New page — drift alerts & baselines |
| `app/quality/page.js` | New page — merged evaluations + scoring |
| `public/downloads/.../SKILL.md` | Update v2 method docs |
| `public/downloads/.../references/api-surface.md` | Fix v1/v2 method name mismatches |
| `public/downloads/.../references/platform-knowledge.md` | Fix SDK method count, add CLI/hooks section |
| `public/downloads/.../references/troubleshooting.md` | Fix guardMode reference |

## Non-Goals

- No changes to v1 legacy SDK (it keeps all 188 methods)
- No changes to API routes (all endpoints already exist)
- No changes to Mission Control page
- No changes to auth, middleware, or database
