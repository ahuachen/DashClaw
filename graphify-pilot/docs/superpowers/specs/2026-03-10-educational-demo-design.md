# Educational Demo Site Design

**Date:** 2026-03-10
**Status:** Approved
**Goal:** Transform the DashClaw demo from generic fake data into a self-guided learning experience where browsing the demo teaches users how to use DashClaw.

---

## Overview

Three layers of education work together:

1. **Fixture content** — Teaching agents with actions as tutorial steps, message threads as mini-lessons, handoffs as chapter summaries, assumptions as learning moments.
2. **HelpIcon component** — Contextual `(?)` icons on every dashboard section with short explanations. Available in all modes. Dismissible, resettable.
3. **Narrative structure** — Progressive journey (main story), feature deep-dives (per surface), persona agents (role perspectives), realistic agents (what a real deployment looks like).

---

## Agent Categories

Total: ~75 agents (uncapped — use as many as needed to cover all concepts).

### Progressive Journey (10)

Sequential storyline from zero to mastery. Each agent represents a time period, actions are ordered steps.

| Agent ID | Topic |
|---|---|
| `day-1-what-is-dashclaw` | Platform overview, core concepts |
| `day-1-install-sdk` | SDK installation, env vars, API key setup |
| `day-1-first-agent` | Registering an agent, agent ID, agent name |
| `day-2-recording-actions` | Creating actions, action types, declared goals |
| `day-2-outcomes-and-costs` | Updating outcomes, cost estimates, token tracking |
| `day-3-guard-policies` | Guard modes, creating policies, testing them |
| `week-1-workspace-setup` | Handoffs, snippets, memory, preferences |
| `week-2-compliance-mapping` | Frameworks, controls, evidence, gap analysis |
| `week-3-team-and-routing` | Team management, task routing, agent registry |
| `month-1-production-mastery` | Scaling, webhooks, workflows, evaluation, advanced patterns |

### Feature Deep-Dive (25+)

Multiple agents per complex feature area. Each agent covers one focused topic with 3-8 step actions.

**Actions:**
- `actions-basics` — Creating and listing actions, action fields
- `actions-risk-scoring` — Risk scores 0-100, what triggers higher scores
- `actions-cost-tracking` — Cost estimates, token in/out, budget awareness

**Guard:**
- `guard-policies` — Policy types: risk threshold, rate limit, blocklist, approval
- `guard-decisions` — Allow/block/warn/require_approval, decision reasoning
- `guard-semantic-rules` — Content-based guard checks, semantic evaluation

**Workspace:**
- `workspace-handoffs` — Session summaries, open tasks, decisions made
- `workspace-snippets` — Saving reusable code/templates, tags, use counts
- `workspace-memory` — Memory health, entity extraction, staleness detection
- `workspace-preferences` — Agent preferences, observations, moods, approaches
- `workspace-context-threads` — Threaded observations, importance scores

**Compliance:**
- `compliance-frameworks` — SOC 2, ISO 27001, NIST AI RMF, EU AI Act, GDPR
- `compliance-controls` — Per-framework controls, coverage status
- `compliance-evidence` — Evidence collection, policy-to-control mapping
- `compliance-gap-analysis` — Identifying gaps, remediation paths

**Security:**
- `security-signals` — Red/amber signals, pattern detection
- `security-agent-pairing` — Key exchange, RSASSA-PKCS1-v1_5, pairing flow
- `security-signatures` — Agent signature enforcement, verification

**Routing:**
- `routing-agent-registry` — Agent capabilities, status, max concurrent
- `routing-task-queue` — Task creation, required skills, urgency levels
- `routing-health` — Health monitoring, load balancing

**Learning:**
- `learning-decisions` — Recording decisions, confidence, outcomes
- `learning-recommendations` — Action-type recommendations, adoption tracking
- `learning-episodes` — Learning curves, agent maturity, velocity

**Messaging:**
- `messaging-threads` — Creating threads, participants, message types
- `messaging-shared-docs` — Collaborative documents, version tracking

**Automation:**
- `webhooks-setup` — Event subscriptions, delivery tracking, retry logic
- `workflows-and-schedules` — Workflow chains, cron schedules, execution tracking

**Evaluation:**
- `eval-scorers` — Scorer types: regex, numeric, contains
- `eval-runs` — Running evaluations, sampling, results
- `eval-profiles` — Scoring profiles, composite methods, risk templates

**Prompts:**
- `prompt-templates` — Creating templates, parameters, categories
- `prompt-versioning` — Version history, comparing versions, token metrics

### Persona (8)

Role-specific perspectives showing how different team members use DashClaw.

| Agent ID | Role | Focus |
|---|---|---|
| `new-operator` | First-time user | Getting oriented, basic workflows |
| `security-lead` | Security team | Guard policies, signals, pairing, signatures |
| `compliance-officer` | Compliance team | Frameworks, controls, evidence, reports |
| `platform-engineer` | Engineering | SDK integration, webhooks, workflows, routing |
| `team-admin` | Admin | Team management, settings, integrations, invites |
| `sdk-developer` | Developer | SDK usage patterns, client code, API calls |
| `incident-responder` | Ops | Debugging blocked actions, troubleshooting, signals |
| `auditor` | External auditor | Compliance review, evidence gathering, reports |

### Realistic (15)

Pure realistic agents that look like a real deployment. No educational annotations. Demonstrate what a user's own dashboard would look like.

Examples: `deploy-bot`, `code-reviewer`, `security-scanner`, `docs-writer`, `test-runner`, `data-analyst`, `refactor-agent`, `migration-assistant`, `api-monitor`, `dependency-checker`, `perf-profiler`, `release-manager`, `db-optimizer`, `log-analyzer`, `config-validator`

### Supporting/Background (remaining ~7-10)

Fill out the dashboard naturally with minimal data. Low action counts, varied statuses.

---

## Educational Content in Fixture Fields

Each tutorial agent's actions use existing fields educationally:

| Field | Educational Use |
|---|---|
| `declaredGoal` | What the user is trying to learn |
| `actionType` | The DashClaw concept being demonstrated |
| `outputSummary` | Instructional content / explanation |
| `metadata` | Code snippets, config examples, related agent references |
| `riskScore` | Demonstrates real risk scoring with meaningful values |
| `costEstimate` | Shows cost tracking with realistic numbers |
| `status` | Shows variety: completed, running, failed, pending_approval |

### Example: `guard-policies` agent

1. **"Understanding Guard Modes"** — `outputSummary` explains off/warn/enforce modes and when to use each
2. **"Creating a Risk Threshold Policy"** — walks through setup, `metadata` contains policy config example
3. **"Testing a Policy Before Deploying"** — shows the policy test flow, expected results
4. **"What Happens When Guard Blocks an Action"** — demonstrates a blocked decision with reasoning
5. **"Tuning False Positives"** — adjusting thresholds based on guard decision history

---

## Tutorial Message Threads (12-15)

Full tutorial conversations between teaching agents. Natural back-and-forth format.

| Thread | Participants | Topic |
|---|---|---|
| "Getting Started with DashClaw" | `new-operator`, `platform-engineer` | Platform overview, first steps |
| "Setting Up Your First Guard Policy" | `security-lead`, `new-operator` | Policy creation walkthrough |
| "Mapping SOC 2 Controls" | `compliance-officer`, `auditor` | Framework mapping process |
| "Debugging a Blocked Action" | `incident-responder`, `security-lead` | Troubleshooting guard blocks |
| "Integrating the SDK" | `sdk-developer`, `platform-engineer` | Node/Python SDK setup |
| "Setting Up Task Routing" | `platform-engineer`, `team-admin` | Agent registry, task queue |
| "Managing Your Team" | `team-admin`, `new-operator` | Invites, roles, permissions |
| "Understanding Security Signals" | `security-lead`, `incident-responder` | Signal types, response patterns |
| "Workspace Best Practices" | `platform-engineer`, `new-operator` | Handoffs, snippets, memory |
| "Compliance Evidence Collection" | `compliance-officer`, `auditor` | Evidence gathering, reports |
| "Webhooks and Automation" | `sdk-developer`, `platform-engineer` | Event subscriptions, workflows |
| "Learning From Agent Decisions" | `new-operator`, `platform-engineer` | Decision tracking, recommendations |

---

## Tutorial Handoffs (~20)

Each progressive journey agent gets a handoff that serves as a chapter summary.

**Format:**
- `summary`: Key takeaways from this stage
- `openTasks`: "Try this next" suggestions
- `decisions`: Concepts covered, patterns learned

**Example — `day-1-what-is-dashclaw` handoff:**
```
summary: "Today you learned: DashClaw is a decision infrastructure platform that records agent actions, enforces policies, tracks assumptions, and provides compliance mapping. Key concepts: actions, agents, guard, org context, API keys."
openTasks: ["Install the SDK", "Get your API key", "Record your first action"]
decisions: ["DashClaw is not a framework — it's infrastructure your existing agents connect to"]
```

---

## Tutorial Assumptions (~30)

Assumptions that teach by example — showing what assumption tracking looks like and common misconceptions:

- "User assumed all actions need guard checks — actually, guard mode can be set to 'off' for low-risk operations" (invalidated)
- "User assumed compliance mapping requires manual entry — DashClaw auto-maps policies to framework controls" (invalidated)
- "Agent assumed risk_score above 70 always blocks — depends on policy config, could warn or require approval" (invalidated)
- "Assumed SDK requires API key for all endpoints — some endpoints like /api/health are public" (validated)
- "Assumed handoffs are automatic — they require explicit creation at session boundaries" (validated)

---

## HelpIcon Component

### Component: `app/components/HelpIcon.js`

**Props:**
- `sectionKey` (string) — unique key for localStorage dismissal tracking
- `tip` (string) — the help text to display

**Behavior:**
- Renders a small `(?)` icon inline next to section headers
- Click opens a tooltip/popover with the tip text
- "Got it" button dismisses, stores `dashclaw_help_dismissed_{sectionKey}` in localStorage
- If dismissed, icon renders with reduced opacity or hides entirely
- Available in all modes (demo + self-hosted)

**Reset mechanism:**
- "Reset all tips" option in user menu or settings
- Clears all `dashclaw_help_dismissed_*` localStorage keys

### Help Tips (centralized in `fixtures/help-tips.js`)

| Section Key | Tip |
|---|---|
| `actions` | "Actions are the decisions and operations your agents perform. Each one is recorded with a risk score, cost, and outcome." |
| `guard-decisions` | "The guard evaluates every action against your policies and decides to allow, block, warn, or require approval." |
| `policies` | "Policies define the rules your guard enforces — risk thresholds, rate limits, action blocklists, and approval requirements." |
| `workspace-digest` | "The digest is your agent's daily summary — recent actions, open loops, assumptions, and handoff notes." |
| `context-threads` | "Context threads organize workspace observations into threaded discussions your agents can reference." |
| `handoffs` | "Handoffs capture what happened in a session — decisions made, open tasks, and context for the next session." |
| `snippets` | "Snippets are reusable code blocks and templates your agents save and share." |
| `compliance` | "Compliance mapping connects your guard policies to framework controls (SOC 2, ISO 27001, etc.) and tracks coverage." |
| `security-signals` | "Security signals flag concerning patterns — high-impact actions with low oversight, repeated failures, stale loops." |
| `routing` | "Task routing assigns work to agents based on their capabilities, availability, and the task's required skills." |
| `messages` | "Messages are how agents and operators communicate — threaded conversations with shared documents." |
| `learning` | "Learning tracks your agents' decisions, lessons, and recommendations over time to improve outcomes." |
| `webhooks` | "Webhooks notify external services when important events happen in your DashClaw workspace." |
| `workflows` | "Workflows chain multiple steps into automated sequences — deploys, audits, digest generation." |
| `prompts` | "Prompt templates let you version and track the prompts your agents use, with run history and token metrics." |
| `evaluation` | "Evaluation scorers measure action quality — goal completion, risk thresholds, safety checks." |
| `memory` | "Memory health tracks your agent's context files — size, duplicates, staleness, and entity extraction." |
| `team` | "Team management controls who has access, their roles, and integration settings for your workspace." |

---

## Technical Architecture

### Fixture Module Split

```
app/lib/demo/
├── demoFixtures.js              (orchestrator — imports, merges, exports getDemoFixtures())
├── fixtures/
│   ├── journey-agents.js        (10 progressive journey agents + actions)
│   ├── feature-agents.js        (25+ feature deep-dive agents + actions)
│   ├── persona-agents.js        (8 persona agents + actions)
│   ├── realistic-agents.js      (15 realistic agents + actions)
│   ├── background-agents.js     (supporting agents + minimal actions)
│   ├── tutorial-threads.js      (12-15 message threads + ~80-100 messages)
│   ├── tutorial-handoffs.js     (~20 chapter summary handoffs)
│   ├── tutorial-assumptions.js  (~30 learning-moment assumptions)
│   ├── help-tips.js             (HelpIcon tip text, centralized)
│   ├── guard-fixtures.js        (policies + guard decisions, educational + realistic)
│   ├── compliance-fixtures.js   (frameworks, controls, evidence, educational)
│   └── shared-utils.js          (seeded RNG, timestamp helpers, ID generators)
```

### Contract Preservation

`getDemoFixtures()` returns the same shape it does today. The orchestrator merges agent arrays, action arrays, etc. from all modules. No middleware changes needed — all existing demo handlers read from `getDemoFixtures()` as before.

Implementation note added March 11, 2026:

- Internal fixture modules may use more expressive authoring fields for educational content.
- Public demo responses must still match the production dashboard contract.
- Normalize fixture aliases at the demo API boundary, for example:
  - messages: `sender_id` -> `from_agent_id`, `type` -> `message_type`, `content` -> `body`
  - threads: `subject` -> `name`
  - docs: `title` -> `name`
  - policies: `type` -> `policy_type`, `config` -> `rules`
- Do not push this aliasing burden into the user-facing page components as a second long-term schema.

### Scale Changes

| Data | Current | New |
|---|---|---|
| Agents | 50 | ~75 |
| Actions | 220 | ~400-500 |
| Message threads | 6 | 12-15 |
| Messages | 28 | ~80-100 |
| Assumptions | 14 | ~30 |
| Handoffs | — | ~20 |
| Guard decisions | 24 | ~35-40 |

### New Component

- `app/components/HelpIcon.js` — single component, Tailwind-styled
- Integrated into dashboard section headers and page-level components
- No new dependencies

### No Changes To

- Middleware demo handlers
- API response contracts
- Demo mode detection (`isDemoMode()`)
- `SessionWrapper` / `DemoSessionProvider`
- Dashboard layout system
- Any self-hosted functionality

---

## Success Criteria

1. A user browsing the demo for 15 minutes learns the core DashClaw concepts without reading external docs
2. Progressive journey agents tell a coherent story from setup to mastery
3. Feature agents cover every product surface with actionable examples
4. Message threads read naturally as tutorial conversations
5. HelpIcon tips provide quick orientation on every dashboard section
6. Realistic agents demonstrate what a real deployment looks like
7. No regressions — existing middleware, API contracts, and self-hosted functionality unchanged
8. `npm run build` and `npm run lint` pass
