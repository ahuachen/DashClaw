# Educational Demo Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform DashClaw demo fixtures into a self-guided learning experience with educational agents, tutorial conversations, and contextual help icons.

**Architecture:** Split the monolithic `demoFixtures.js` (1691 lines) into modular fixture files under `app/lib/demo/fixtures/`. Create a `HelpIcon` component for contextual tips. The orchestrator (`demoFixtures.js`) imports and merges all modules, preserving the existing `getDemoFixtures()` contract so no middleware changes are needed.

**Tech Stack:** Next.js 15 (App Router), JavaScript, Tailwind CSS, Lucide icons (already in use)

**Spec:** `docs/superpowers/specs/2026-03-10-educational-demo-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|---|---|
| `app/lib/demo/fixtures/shared-utils.js` | Seeded RNG, timestamp helpers, ID generators (extracted from demoFixtures.js) |
| `app/lib/demo/fixtures/journey-agents.js` | 10 progressive journey agents + ~50 tutorial actions |
| `app/lib/demo/fixtures/feature-agents.js` | 25+ feature deep-dive agents + ~150 tutorial actions |
| `app/lib/demo/fixtures/persona-agents.js` | 8 persona agents + ~50 tutorial actions |
| `app/lib/demo/fixtures/realistic-agents.js` | 15 realistic agents + ~120 actions (similar to current style) |
| `app/lib/demo/fixtures/background-agents.js` | ~10 supporting agents + ~30 minimal actions |
| `app/lib/demo/fixtures/tutorial-threads.js` | 12-15 educational message threads + ~80-100 messages |
| `app/lib/demo/fixtures/tutorial-handoffs.js` | ~20 chapter summary handoffs |
| `app/lib/demo/fixtures/tutorial-assumptions.js` | ~30 learning-moment assumptions |
| `app/lib/demo/fixtures/guard-fixtures.js` | Policies + guard decisions (educational + realistic) |
| `app/lib/demo/fixtures/compliance-fixtures.js` | Frameworks, controls, evidence |
| `app/lib/demo/fixtures/help-tips.js` | Centralized HelpIcon tip text for all sections |
| `app/components/HelpIcon.js` | Contextual help icon component |

### Modified Files

| File | Change |
|---|---|
| `app/lib/demo/demoFixtures.js` | Rewrite as thin orchestrator importing from `fixtures/` modules |
| Dashboard card components (18+) | Add `HelpIcon` next to section headers |
| Page-level components (workspace, security, compliance, routing) | Add `HelpIcon` to page headers |
| `app/components/UserMenu.js` | Add "Reset Tips" option |

---

## Chunk 1: Foundation — Shared Utils & HelpIcon Component

### Task 1: Extract shared utilities

**Files:**
- Create: `app/lib/demo/fixtures/shared-utils.js`

- [ ] **Step 1: Create shared-utils.js with extracted helpers**

Extract `lcg`, `pick`, `int`, `isoFromNow`, `isoInFuture`, `stableId`, and `BASE_NOW` from `demoFixtures.js`:

```javascript
// app/lib/demo/fixtures/shared-utils.js
export const BASE_NOW = Date.now();

export function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function pick(rnd, items) {
  return items[Math.floor(rnd() * items.length)];
}

export function int(rnd, min, max) {
  return min + Math.floor(rnd() * (max - min + 1));
}

export function isoFromNow(msAgo) {
  return new Date(BASE_NOW - msAgo).toISOString();
}

export function isoInFuture(msAhead) {
  return new Date(BASE_NOW + msAhead).toISOString();
}

export function stableId(prefix, n) {
  return `${prefix}_${String(n).padStart(3, '0')}`;
}

// Shared constants for educational agents
export const DEMO_ORG = 'org_demo';
```

- [ ] **Step 2: Verify module exports**

Run: `node -e "import('./app/lib/demo/fixtures/shared-utils.js').then(m => console.log(Object.keys(m)))"`
Expected: `['BASE_NOW', 'lcg', 'pick', 'int', 'isoFromNow', 'isoInFuture', 'stableId', 'DEMO_ORG']`

- [ ] **Step 3: Commit**

```bash
git add app/lib/demo/fixtures/shared-utils.js
git commit -m "feat(demo): extract shared fixture utilities"
```

---

### Task 2: Create HelpIcon component

**Files:**
- Create: `app/components/HelpIcon.js`

- [ ] **Step 1: Create HelpIcon component**

```javascript
// app/components/HelpIcon.js
'use client';

import { useState, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

const STORAGE_PREFIX = 'dashclaw_help_dismissed_';

export function HelpIcon({ sectionKey, tip }) {
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${sectionKey}`);
    setDismissed(stored === '1');
  }, [sectionKey]);

  function dismiss() {
    setOpen(false);
    setDismissed(true);
    localStorage.setItem(`${STORAGE_PREFIX}${sectionKey}`, '1');
  }

  if (dismissed) return null;

  return (
    <span className="relative inline-flex items-center ml-1.5">
      <button
        onClick={() => setOpen(!open)}
        className="text-zinc-400 hover:text-blue-400 transition-colors"
        aria-label={`Help: ${sectionKey}`}
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute left-6 top-0 z-50 w-72 rounded-lg border border-zinc-700 bg-zinc-800 p-3 shadow-xl text-sm text-zinc-300">
          <p>{tip}</p>
          <button
            onClick={dismiss}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300"
          >
            Got it
          </button>
        </div>
      )}
    </span>
  );
}

/** Call this to reset all dismissed tips (e.g. from settings menu). */
export function resetAllTips() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
  }
  keys.forEach(k => localStorage.removeItem(k));
}
```

- [ ] **Step 2: Verify component syntax**

Run: `npx next lint --file app/components/HelpIcon.js`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/components/HelpIcon.js
git commit -m "feat: add HelpIcon component for contextual tips"
```

---

### Task 3: Create centralized help tips

**Files:**
- Create: `app/lib/demo/fixtures/help-tips.js`

- [ ] **Step 1: Create help-tips.js with all section tips**

```javascript
// app/lib/demo/fixtures/help-tips.js

/** Centralized tip text for HelpIcon components across all dashboard sections. */
export const HELP_TIPS = {
  actions: 'Actions are the decisions and operations your agents perform. Each one is recorded with a risk score, cost, and outcome.',
  'guard-decisions': 'The guard evaluates every action against your policies and decides to allow, block, warn, or require approval.',
  policies: 'Policies define the rules your guard enforces — risk thresholds, rate limits, action blocklists, and approval requirements.',
  'workspace-digest': 'The digest is your agent\'s daily summary — recent actions, open loops, assumptions, and handoff notes.',
  'context-threads': 'Context threads organize workspace observations into threaded discussions your agents can reference.',
  handoffs: 'Handoffs capture what happened in a session — decisions made, open tasks, and context for the next session.',
  snippets: 'Snippets are reusable code blocks and templates your agents save and share.',
  compliance: 'Compliance mapping connects your guard policies to framework controls (SOC 2, ISO 27001, etc.) and tracks coverage.',
  'security-signals': 'Security signals flag concerning patterns — high-impact actions with low oversight, repeated failures, stale loops.',
  routing: 'Task routing assigns work to agents based on their capabilities, availability, and the task\'s required skills.',
  messages: 'Messages are how agents and operators communicate — threaded conversations with shared documents.',
  learning: 'Learning tracks your agents\' decisions, lessons, and recommendations over time to improve outcomes.',
  webhooks: 'Webhooks notify external services when important events happen in your DashClaw workspace.',
  workflows: 'Workflows chain multiple steps into automated sequences — deploys, audits, digest generation.',
  prompts: 'Prompt templates let you version and track the prompts your agents use, with run history and token metrics.',
  evaluation: 'Evaluation scorers measure action quality — goal completion, risk thresholds, safety checks.',
  memory: 'Memory health tracks your agent\'s context files — size, duplicates, staleness, and entity extraction.',
  team: 'Team management controls who has access, their roles, and integration settings for your workspace.',
  'risk-signals': 'Risk signals highlight agent actions that may need attention — high risk scores, low oversight, or unusual patterns.',
  'open-loops': 'Open loops are unresolved items from agent actions — pending approvals, follow-ups, and blockers that need attention.',
  'fleet-presence': 'Fleet presence shows which agents are active, idle, or offline across your workspace.',
  'token-budget': 'Token budget tracks how many tokens your agents have used today and over time, with cost estimates.',
  'activity-timeline': 'The activity timeline shows recent events across your workspace — actions, logins, config changes, and more.',
  'eval-scores': 'Evaluation scores rate the quality of your agents\' work based on configurable scoring criteria.',
  'prompt-stats': 'Prompt stats show usage, latency, and token costs for your managed prompt templates.',
  drift: 'Drift detection monitors assumptions that may have become stale or invalid over time.',
  velocity: 'Learning velocity measures how quickly your agents are improving at their tasks.',
  scoring: 'Scoring profiles define how agent performance is measured — combining speed, cost, and reliability.',
  goals: 'Goals track high-level objectives for your workspace, with progress and target metrics.',
  'memory-health': 'Memory health monitors your agent\'s context window — file counts, sizes, duplicates, and staleness.',
};
```

- [ ] **Step 2: Commit**

```bash
git add app/lib/demo/fixtures/help-tips.js
git commit -m "feat(demo): add centralized help tip text for all sections"
```

---

## Chunk 2: Educational Fixture Modules (Agents & Actions)

### Task 4: Create journey agents module

**Files:**
- Create: `app/lib/demo/fixtures/journey-agents.js`

- [ ] **Step 1: Write progressive journey agents + tutorial actions**

Create 10 journey agents with 4-6 sequential tutorial actions each. Each action's `declared_goal` is a learning objective, `output_summary` is the instructional content, and `metadata` contains code/config examples.

Agent list:
1. `day-1-what-is-dashclaw` — Platform overview, core concepts
2. `day-1-install-sdk` — SDK installation, env vars, API key setup
3. `day-1-first-agent` — Registering an agent, agent ID, agent name
4. `day-2-recording-actions` — Creating actions, action types, declared goals
5. `day-2-outcomes-and-costs` — Updating outcomes, cost estimates, token tracking
6. `day-3-guard-policies` — Guard modes, creating policies, testing them
7. `week-1-workspace-setup` — Handoffs, snippets, memory, preferences
8. `week-2-compliance-mapping` — Frameworks, controls, evidence, gap analysis
9. `week-3-team-and-routing` — Team management, task routing, agent registry
10. `month-1-production-mastery` — Scaling, webhooks, workflows, evaluation, advanced patterns

Export shape: `{ agents: [...], actions: [...] }`

Import and use `lcg`, `isoFromNow`, `stableId`, `DEMO_ORG` from `shared-utils.js`. Use a separate RNG seed (e.g., `0xDAY10001`) to avoid collisions with other modules.

Actions should have realistic `risk_score`, `cost_estimate`, `tokens_in`, `tokens_out` values so charts and stats look natural.

- [ ] **Step 2: Verify module loads without error**

Run: `node -e "import('./app/lib/demo/fixtures/journey-agents.js').then(m => console.log(m.agents.length, 'agents,', m.actions.length, 'actions'))"`
Expected: `10 agents, ~50 actions`

- [ ] **Step 3: Commit**

```bash
git add app/lib/demo/fixtures/journey-agents.js
git commit -m "feat(demo): add progressive journey tutorial agents"
```

---

### Task 5: Create feature deep-dive agents module

**Files:**
- Create: `app/lib/demo/fixtures/feature-agents.js`

- [ ] **Step 1: Write feature deep-dive agents + tutorial actions**

Create 25+ feature agents with 3-8 actions each. Each agent focuses on one DashClaw feature. Group by area:

**Actions (3 agents):** `actions-basics`, `actions-risk-scoring`, `actions-cost-tracking`
**Guard (3):** `guard-policies`, `guard-decisions`, `guard-semantic-rules`
**Workspace (5):** `workspace-handoffs`, `workspace-snippets`, `workspace-memory`, `workspace-preferences`, `workspace-context-threads`
**Compliance (4):** `compliance-frameworks`, `compliance-controls`, `compliance-evidence`, `compliance-gap-analysis`
**Security (3):** `security-signals`, `security-agent-pairing`, `security-signatures`
**Routing (3):** `routing-agent-registry`, `routing-task-queue`, `routing-health`
**Learning (3):** `learning-decisions`, `learning-recommendations`, `learning-episodes`
**Messaging (2):** `messaging-threads`, `messaging-shared-docs`
**Automation (2):** `webhooks-setup`, `workflows-and-schedules`
**Evaluation (3):** `eval-scorers`, `eval-runs`, `eval-profiles`
**Prompts (2):** `prompt-templates`, `prompt-versioning`

Export shape: `{ agents: [...], actions: [...] }`

Use separate RNG seed (e.g., `0xFEAT0001`). Each action's `output_summary` should be 1-3 sentences of instructional content explaining the concept.

- [ ] **Step 2: Verify module loads**

Run: `node -e "import('./app/lib/demo/fixtures/feature-agents.js').then(m => console.log(m.agents.length, 'agents,', m.actions.length, 'actions'))"`
Expected: `~28 agents, ~150 actions`

- [ ] **Step 3: Commit**

```bash
git add app/lib/demo/fixtures/feature-agents.js
git commit -m "feat(demo): add feature deep-dive tutorial agents"
```

---

### Task 6: Create persona agents module

**Files:**
- Create: `app/lib/demo/fixtures/persona-agents.js`

- [ ] **Step 1: Write persona agents + role-specific actions**

Create 8 persona agents with 5-8 actions each showing role-specific workflows:

1. `new-operator` — Getting oriented, basic workflows
2. `security-lead` — Guard policies, signals, pairing, signatures
3. `compliance-officer` — Frameworks, controls, evidence, reports
4. `platform-engineer` — SDK integration, webhooks, workflows, routing
5. `team-admin` — Team management, settings, integrations, invites
6. `sdk-developer` — SDK usage patterns, client code, API calls
7. `incident-responder` — Debugging blocked actions, troubleshooting, signals
8. `auditor` — Compliance review, evidence gathering, reports

Export shape: `{ agents: [...], actions: [...] }`

Use separate RNG seed (e.g., `0xPERS0001`).

- [ ] **Step 2: Verify module loads**

Run: `node -e "import('./app/lib/demo/fixtures/persona-agents.js').then(m => console.log(m.agents.length, 'agents,', m.actions.length, 'actions'))"`
Expected: `8 agents, ~50 actions`

- [ ] **Step 3: Commit**

```bash
git add app/lib/demo/fixtures/persona-agents.js
git commit -m "feat(demo): add persona-based tutorial agents"
```

---

### Task 7: Create realistic agents module

**Files:**
- Create: `app/lib/demo/fixtures/realistic-agents.js`

- [ ] **Step 1: Write realistic agents + production-like actions**

Create 15 realistic agents with 6-10 actions each. These use the same generation style as the current `demoFixtures.js` — randomized action types, statuses, risk scores, costs. No educational content — pure realistic deployment data.

Agents: `deploy-bot`, `code-reviewer`, `security-scanner`, `docs-writer`, `test-runner`, `data-analyst`, `refactor-agent`, `migration-assistant`, `api-monitor`, `dependency-checker`, `perf-profiler`, `release-manager`, `db-optimizer`, `log-analyzer`, `config-validator`

Export shape: `{ agents: [...], actions: [...] }`

Use separate RNG seed (e.g., `0xREAL0001`). Preserve the current fixture style: short `output_summary` values like 'OK', 'Deployed', 'Patched', randomized risk/cost, varied statuses.

- [ ] **Step 2: Verify module loads**

Run: `node -e "import('./app/lib/demo/fixtures/realistic-agents.js').then(m => console.log(m.agents.length, 'agents,', m.actions.length, 'actions'))"`
Expected: `15 agents, ~120 actions`

- [ ] **Step 3: Commit**

```bash
git add app/lib/demo/fixtures/realistic-agents.js
git commit -m "feat(demo): add realistic deployment agents"
```

---

### Task 8: Create background agents module

**Files:**
- Create: `app/lib/demo/fixtures/background-agents.js`

- [ ] **Step 1: Write supporting/background agents + minimal actions**

Create ~10 agents with 2-4 actions each. Varied statuses to fill out the dashboard naturally. Use randomized data like realistic agents but with lower action counts.

Export shape: `{ agents: [...], actions: [...] }`

Use separate RNG seed (e.g., `0xBACK0001`).

- [ ] **Step 2: Verify module loads**

Run: `node -e "import('./app/lib/demo/fixtures/background-agents.js').then(m => console.log(m.agents.length, 'agents,', m.actions.length, 'actions'))"`
Expected: `~10 agents, ~30 actions`

- [ ] **Step 3: Commit**

```bash
git add app/lib/demo/fixtures/background-agents.js
git commit -m "feat(demo): add background supporting agents"
```

---

## Chunk 3: Educational Content Modules (Threads, Handoffs, Assumptions, Guard, Compliance)

### Task 9: Create tutorial message threads

**Files:**
- Create: `app/lib/demo/fixtures/tutorial-threads.js`

- [ ] **Step 1: Write educational message threads + messages**

Create 12-15 threads with 5-8 messages each. Messages use natural back-and-forth between teaching agents. Each thread is a mini-lesson.

Threads:
1. "Getting Started with DashClaw" — `new-operator` + `platform-engineer`
2. "Setting Up Your First Guard Policy" — `security-lead` + `new-operator`
3. "Mapping SOC 2 Controls" — `compliance-officer` + `auditor`
4. "Debugging a Blocked Action" — `incident-responder` + `security-lead`
5. "Integrating the SDK" — `sdk-developer` + `platform-engineer`
6. "Setting Up Task Routing" — `platform-engineer` + `team-admin`
7. "Managing Your Team" — `team-admin` + `new-operator`
8. "Understanding Security Signals" — `security-lead` + `incident-responder`
9. "Workspace Best Practices" — `platform-engineer` + `new-operator`
10. "Compliance Evidence Collection" — `compliance-officer` + `auditor`
11. "Webhooks and Automation" — `sdk-developer` + `platform-engineer`
12. "Learning From Agent Decisions" — `new-operator` + `platform-engineer`

Export shape: `{ threads: [...], messages: [...], sharedDocs: [...] }`

Use existing message format: `id`, `org_id`, `thread_id`, `sender_id`, `sender_name`, `type` (info/action/question/status/lesson), `content`, `direction`, `created_at`.

- [ ] **Step 2: Verify module loads**

Run: `node -e "import('./app/lib/demo/fixtures/tutorial-threads.js').then(m => console.log(m.threads.length, 'threads,', m.messages.length, 'messages'))"`
Expected: `12 threads, ~80 messages`

- [ ] **Step 3: Commit**

```bash
git add app/lib/demo/fixtures/tutorial-threads.js
git commit -m "feat(demo): add tutorial message threads"
```

---

### Task 10: Create tutorial handoffs

**Files:**
- Create: `app/lib/demo/fixtures/tutorial-handoffs.js`

- [ ] **Step 1: Write chapter summary handoffs**

Create ~20 handoffs, one for each progressive journey agent and each persona agent. Handoffs use the format: `summary` (key takeaways), `open_tasks` (try-this-next suggestions), `decisions` (concepts covered).

Export shape: `{ handoffs: [...] }`

- [ ] **Step 2: Commit**

```bash
git add app/lib/demo/fixtures/tutorial-handoffs.js
git commit -m "feat(demo): add tutorial handoff summaries"
```

---

### Task 11: Create tutorial assumptions

**Files:**
- Create: `app/lib/demo/fixtures/tutorial-assumptions.js`

- [ ] **Step 1: Write learning-moment assumptions**

Create ~30 assumptions that teach by example. Mix of validated and invalidated assumptions that demonstrate common misconceptions and correct understandings about DashClaw.

Export shape: `{ assumptions: [...] }`

- [ ] **Step 2: Commit**

```bash
git add app/lib/demo/fixtures/tutorial-assumptions.js
git commit -m "feat(demo): add tutorial assumptions"
```

---

### Task 12: Create guard fixtures

**Files:**
- Create: `app/lib/demo/fixtures/guard-fixtures.js`

- [ ] **Step 1: Write educational guard policies + decisions**

Create 6 guard policies (expanding from current 4) and ~35 guard decisions. Some decisions reference tutorial agents with educational reasoning text. Keep the existing policy types (risk_threshold, require_approval, rate_limit, block_action_type) plus add semantic_content and cost_ceiling.

Export shape: `{ policies: [...], guardDecisions: [...] }`

- [ ] **Step 2: Commit**

```bash
git add app/lib/demo/fixtures/guard-fixtures.js
git commit -m "feat(demo): add educational guard fixtures"
```

---

### Task 13: Create compliance fixtures

**Files:**
- Create: `app/lib/demo/fixtures/compliance-fixtures.js`

- [ ] **Step 1: Write educational compliance data**

Recreate the compliance fixtures (5 frameworks, controls, evidence) with educational descriptions that explain what each framework requires and how DashClaw maps to it. Keep the same data contract as current fixtures.

Export shape: `{ frameworks: [...], controls: [...], evidence: {...}, policyTestResults: {...} }`

- [ ] **Step 2: Commit**

```bash
git add app/lib/demo/fixtures/compliance-fixtures.js
git commit -m "feat(demo): add educational compliance fixtures"
```

---

## Chunk 4: Orchestrator Rewrite

### Task 14: Rewrite demoFixtures.js as orchestrator

**Files:**
- Modify: `app/lib/demo/demoFixtures.js`

- [ ] **Step 1: Read the full current demoFixtures.js carefully**

Read the entire file to catalog every fixture property that `getDemoFixtures()` currently returns. The orchestrator must return the exact same property set.

- [ ] **Step 2: Rewrite demoFixtures.js as thin orchestrator**

Replace the monolithic `buildFixtures()` with imports from each module. Merge agent arrays, action arrays, etc. Preserve every property key that the current return object has.

Structure:
```javascript
import { lcg, pick, int, isoFromNow, isoInFuture, stableId, DEMO_ORG } from './fixtures/shared-utils.js';
import { agents as journeyAgents, actions as journeyActions } from './fixtures/journey-agents.js';
import { agents as featureAgents, actions as featureActions } from './fixtures/feature-agents.js';
import { agents as personaAgents, actions as personaActions } from './fixtures/persona-agents.js';
import { agents as realisticAgents, actions as realisticActions } from './fixtures/realistic-agents.js';
import { agents as backgroundAgents, actions as backgroundActions } from './fixtures/background-agents.js';
import { threads, messages, sharedDocs } from './fixtures/tutorial-threads.js';
import { handoffs } from './fixtures/tutorial-handoffs.js';
import { assumptions } from './fixtures/tutorial-assumptions.js';
import { policies, guardDecisions } from './fixtures/guard-fixtures.js';
import { frameworks, controls, evidence, policyTestResults } from './fixtures/compliance-fixtures.js';

// Merge all agents and actions
const allAgents = [...journeyAgents, ...featureAgents, ...personaAgents, ...realisticAgents, ...backgroundAgents];
const allActions = [...journeyActions, ...featureActions, ...personaActions, ...realisticActions, ...backgroundActions];
```

The remaining fixture data that isn't educational (tokens, workflows, schedules, webhooks, routing, learning analytics, eval, prompts, scoring, risk templates, team, integrations, activity logs, interactions, contacts, ideas, events, memory, security signals, agent pairings, context points, context threads, snippets, preferences, swarm graph, loops, decisions, lessons, recommendations, recommendation metrics, goals) can stay in the orchestrator as inline generation (extracted from current code) or be split into additional modules if large.

**Critical: every property key in the current return object must exist in the new return object.** Compare property-by-property.

- [ ] **Step 3: Verify fixture count changes**

Run: `node -e "import('./app/lib/demo/demoFixtures.js').then(m => { const f = m.getDemoFixtures(); console.log('agents:', f.agents.length, 'actions:', f.actions.length, 'threads:', f.messageThreads.length, 'messages:', f.messages.length, 'assumptions:', f.assumptions.length); })"`
Expected: `agents: ~75, actions: ~400+, threads: ~12, messages: ~80, assumptions: ~30`

- [ ] **Step 4: Verify all fixture properties exist**

Run: `node -e "import('./app/lib/demo/demoFixtures.js').then(m => { const f = m.getDemoFixtures(); console.log(Object.keys(f).sort().join('\\n')); })"`
Expected: Same property keys as current fixture output (compare against current).

- [ ] **Step 5: Run build to verify no breakage**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add app/lib/demo/demoFixtures.js app/lib/demo/fixtures/
git commit -m "feat(demo): rewrite fixtures as modular educational content"
```

---

## Chunk 5: HelpIcon Integration

### Task 15: Add HelpIcon to dashboard card components

**Files:**
- Modify: Multiple card components in `app/components/`

- [ ] **Step 1: Identify all card components with section headers**

Cards that need HelpIcon (from `DraggableDashboard.js` CARD_COMPONENTS):
- `RiskSignalsCard.js` → key: `risk-signals`
- `OpenLoopsCard.js` → key: `open-loops`
- `RecentActionsCard.js` → key: `actions`
- `RecentMessagesCard.js` → key: `messages`
- `FleetPresenceCard.js` → key: `fleet-presence`
- `ProjectsCard.js` → key: `goals` (projects)
- `GoalsChart.js` → key: `goals`
- `LearningStatsCard.js` → key: `learning`
- `VelocityCard.js` → key: `velocity`
- `ScoringProfileCard.js` → key: `scoring`
- `FollowUpsCard.js` → key: `open-loops` (follow-ups)
- `CalendarWidget.js` → no tip needed
- `ContextCard.js` → key: `context-threads`
- `TokenBudgetCard.js` → key: `token-budget`
- `MemoryHealthCard.js` → key: `memory-health`
- `TokenChart.js` → key: `token-budget`
- `IntegrationsCard.js` → key: `team` (integrations)
- `ActivityTimeline.js` → key: `activity-timeline`
- `EvalScoreCard.js` → key: `eval-scores`
- `PromptStatsCard.js` → key: `prompt-stats`
- `FeedbackCard.js` → no tip needed
- `DriftCard.js` → key: `drift`

- [ ] **Step 2: Add HelpIcon to each card component**

For each card, import `HelpIcon` and `HELP_TIPS`, add next to the card title. Pattern:

```javascript
import { HelpIcon } from './HelpIcon';
import { HELP_TIPS } from '../lib/demo/fixtures/help-tips.js';

// In the CardHeader or title area:
<span className="flex items-center gap-0">
  <span>Recent Actions</span>
  <HelpIcon sectionKey="actions" tip={HELP_TIPS.actions} />
</span>
```

Do this for each card listed in Step 1. Skip CalendarWidget and FeedbackCard (no meaningful tip).

- [ ] **Step 3: Run lint and build**

Run: `npm run lint && npm run build`
Expected: Both pass.

- [ ] **Step 4: Commit**

```bash
git add app/components/*.js
git commit -m "feat: add HelpIcon tips to dashboard cards"
```

---

### Task 16: Add HelpIcon to page-level components

**Files:**
- Modify: Page components for workspace, security, compliance, routing, messages

- [ ] **Step 1: Identify page-level components that need tips**

Check these pages for section headers:
- `app/workspace/page.js` — digest, context, handoffs, snippets, preferences, memory
- `app/security/page.js` — security signals, guard decisions, policies
- `app/compliance/page.js` — compliance frameworks, controls, evidence
- `app/routing/page.js` — agent registry, task queue, health

- [ ] **Step 2: Add HelpIcon to each page section**

Same pattern as Task 15. Import `HelpIcon` and `HELP_TIPS`, add next to section headers.

- [ ] **Step 3: Run lint and build**

Run: `npm run lint && npm run build`
Expected: Both pass.

- [ ] **Step 4: Commit**

```bash
git add app/workspace/ app/security/ app/compliance/ app/routing/
git commit -m "feat: add HelpIcon tips to workspace, security, compliance, routing pages"
```

---

### Task 17: Add "Reset Tips" to UserMenu

**Files:**
- Modify: `app/components/UserMenu.js`

- [ ] **Step 1: Read current UserMenu.js**

Read the file to understand the existing menu structure.

- [ ] **Step 2: Add Reset Tips menu item**

Import `resetAllTips` from `HelpIcon.js`. Add a menu item that calls `resetAllTips()` and reloads the page (or triggers state refresh).

```javascript
import { resetAllTips } from './HelpIcon';

// In the menu items:
<button
  onClick={() => { resetAllTips(); window.location.reload(); }}
  className="..." // match existing menu item styles
>
  Reset Tips
</button>
```

- [ ] **Step 3: Run lint and build**

Run: `npm run lint && npm run build`
Expected: Both pass.

- [ ] **Step 4: Commit**

```bash
git add app/components/UserMenu.js
git commit -m "feat: add Reset Tips option to user menu"
```

---

## Chunk 6: Verification & Cleanup

### Task 18: Full integration verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 3: Run docs check**

Run: `npm run docs:check`
Expected: Pass (no API route changes).

- [ ] **Step 4: Run route-sql check**

Run: `npm run route-sql:check`
Expected: Pass (no route changes).

- [ ] **Step 5: Start dev server and test demo mode manually**

Run: `npm run dev`

Test in browser:
- Visit `/demo` — should redirect to `/dashboard`
- Dashboard should show ~75 agents in agent filter dropdown
- Actions table should show educational content in tutorial agent actions
- Messages page should show tutorial threads
- HelpIcon (?) should appear on section headers
- Clicking (?) shows tip, "Got it" dismisses
- Realistic agents should show normal-looking data
- All dashboard pages load without errors (workspace, security, compliance, routing)

- [ ] **Step 6: Test Reset Tips**

- Dismiss a few tips
- Go to user menu → "Reset Tips"
- Verify tips reappear

- [ ] **Step 7: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes for educational demo"
```

---

## Task Dependencies

```
Task 1 (shared-utils) ─┬─> Task 4 (journey)    ─┐
                        ├─> Task 5 (feature)     ├─> Task 14 (orchestrator) ─> Task 18 (verify)
                        ├─> Task 6 (persona)     │
                        ├─> Task 7 (realistic)   │
                        ├─> Task 8 (background)  │
                        ├─> Task 9 (threads)     │
                        ├─> Task 10 (handoffs)   │
                        ├─> Task 11 (assumptions)│
                        ├─> Task 12 (guard)      │
                        └─> Task 13 (compliance) ┘

Task 2 (HelpIcon) ──┬─> Task 15 (dashboard cards) ─> Task 18 (verify)
                     ├─> Task 16 (page components) ─> Task 18 (verify)
Task 3 (help-tips) ─┘
                     └─> Task 17 (user menu)       ─> Task 18 (verify)
```

**Parallelizable:** Tasks 4-13 can all run in parallel (independent fixture modules). Tasks 15-17 can run in parallel.

**Sequential gates:** Task 1 before Tasks 4-13. Tasks 4-13 before Task 14. Task 2+3 before Tasks 15-17. Tasks 14-17 before Task 18.
