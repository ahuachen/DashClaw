# Workflow Run Persistence + Run Detail Page — Design Spec

Date: 2026-04-08
Status: Approved
Wave: Workflow Runtime V2 — Wave A

## Goal

Persist workflow step results durably and surface them through a run detail page so operators can diagnose workflow executions without reading server logs.

## Problem

Today, workflow execution is in-memory only. Step outputs are stored in a rolling context object during execution, then discarded. The parent action_record is created at launch but never updated to completed/failed. The only trace is truncated (500-char) output_summary fields on child action_records. Operators cannot inspect full step inputs, outputs, or errors after execution.

## Approach: Hybrid — Fix Parent Action + One New Table

Use the existing parent action_record (action_type='workflow_launch') as the run record. Add one new `workflow_step_results` table for full step input/output storage. No parallel run tracking system — action_records stays the primary governance surface.

### Why not a dedicated workflow_runs table?

The parent action_record already has: action_id (unique run identifier), org_id, agent_id, status, timestamp_start, timestamp_end, duration_ms, trigger (encodes template_id), and reasoning (encodes launch metadata). Creating a second run record would be redundant. The only missing piece is full step outputs, which workflow_step_results provides.

## Database Schema

One new table appended to `drizzle/0000_clammy_falcon.sql`:

```sql
CREATE TABLE IF NOT EXISTS workflow_step_results (
  id SERIAL PRIMARY KEY,
  step_result_id TEXT UNIQUE NOT NULL,
  run_action_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  step_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  input_json TEXT,
  output_json TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  started_at TEXT,
  finished_at TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

Column notes:
- `run_action_id` references the parent action_record's action_id. This is the de facto run ID.
- `step_id` matches the step's `id` field from the template's steps_json.
- `step_index` is the ordinal position (0-based) for ordering.
- `input_json` stores the full resolved step config after variable interpolation. No truncation.
- `output_json` stores the full step output. No truncation.
- `status` values: pending, running, completed, failed, skipped.
- `error_message` is the full error string. No truncation.

No foreign keys — follows existing DashClaw convention where action_records and related tables use text IDs without enforced FK constraints.

## Executor Changes

### workflow-executor.js

Current signature: `executeWorkflow(template, variables, options)`

New parameters added via options:
- `options.sql` — database connection (passed from execute route)
- `options.runActionId` — parent action_id (passed from execute route)
- `options.orgId` — org scope
- `options.templateId` — for step_result records

Execution flow changes:

1. Before each step: insert workflow_step_results row with status='running', started_at, resolved input_json.
2. After successful step: update row with status='completed', output_json, duration_ms, finished_at, retry_count.
3. After failed step: update row with status='failed', error_message, duration_ms, finished_at, retry_count.
4. Remaining steps after a hard failure: not inserted (they never ran).

The executor does NOT update the parent action — that responsibility stays in the execute route, which already creates the parent action and has the sql connection.

### Execute route changes

In `app/api/workflows/templates/[templateId]/execute/route.js`:

After executeWorkflow returns:
- If success: update parent action_record to status='completed', set output_summary, timestamp_end, duration_ms.
- If failure: update parent action_record to status='failed', set error_message, timestamp_end, duration_ms.

This is a targeted fix — the parent action is currently created with status='running' and never updated.

### Graceful degradation

If sql is not provided to the executor (e.g., in tests or standalone usage), step_results writes are skipped. The executor must remain functional without a database connection.

## Repository

New file: `app/lib/repositories/workflow-runs.repository.js`

Exports:

### listWorkflowRuns(sql, orgId, templateId, filters)

Queries action_records where:
- org_id matches
- action_type = 'workflow_launch'
- trigger LIKE 'workflow:{templateId}%'

Filters: status, agent_id, limit (default 20), offset (default 0).

Returns: `{ runs: [...], total: number }`

Each run shaped as:
```javascript
{
  run_action_id,    // action_id of the parent action
  template_id,      // extracted from trigger field
  status,           // completed|failed|running
  agent_id,
  declared_goal,
  duration_ms,
  started_at,       // timestamp_start
  finished_at,      // timestamp_end
  error_message,
  step_count,       // from subquery on workflow_step_results
  steps_completed,  // from subquery
  steps_failed,     // from subquery
}
```

### getWorkflowRun(sql, orgId, runActionId)

Returns: parent action metadata + step_results array.

```javascript
{
  run_action_id,
  template_id,
  template_name,
  status,
  agent_id,
  declared_goal,
  duration_ms,
  started_at,
  finished_at,
  error_message,
  steps: [
    {
      step_result_id,
      step_id,
      step_index,
      step_type,
      step_name,
      status,
      input_json,     // parsed back to object
      output_json,    // parsed back to object
      error_message,
      retry_count,
      duration_ms,
      started_at,
      finished_at,
    }
  ]
}
```

Steps ordered by step_index ascending.

## API Routes

### GET /api/workflows/templates/[templateId]/runs

List runs for a template.

Query params: status, agent_id, limit, offset.

Response:
```json
{
  "template_id": "wft_abc",
  "runs": [...],
  "total": 42
}
```

### GET /api/workflows/templates/[templateId]/runs/[runActionId]

Run detail with all step results.

Response:
```json
{
  "run_action_id": "act_xyz",
  "template_id": "wft_abc",
  "template_name": "Research Pipeline",
  "status": "completed",
  "agent_id": "research-agent",
  "declared_goal": "Research x402 protocol",
  "duration_ms": 4523,
  "started_at": "2026-04-08T12:00:00Z",
  "finished_at": "2026-04-08T12:00:04Z",
  "steps": [
    {
      "step_id": "search",
      "step_index": 0,
      "step_type": "knowledge_search",
      "step_name": "Find policy context",
      "status": "completed",
      "input": { "collection_id": "kc_1", "query": "x402", "top_k": 5 },
      "output": { "chunks": [...], "query": "x402" },
      "duration_ms": 312,
      "retry_count": 0
    }
  ]
}
```

## UI

### Template detail page modification

In `app/workflows/[templateId]/page.jsx`, add a "Runs" tab that fetches `/api/workflows/templates/{id}/runs` and shows a compact table:

| Status | Agent | Goal | Duration | Steps | When |
|--------|-------|------|----------|-------|------|
| completed | research-agent | Research x402 | 4.5s | 3/3 | 2m ago |
| failed | ops-agent | Deploy check | 12.1s | 2/4 | 1h ago |

Each row links to the run detail page.

### New run detail page

Path: `app/workflows/[templateId]/runs/[runActionId]/page.jsx`

Layout:
- **Header**: template name, run status badge (green/red/yellow), total duration, agent, timestamp, link to governance trace at `/decisions/[runActionId]`
- **Step timeline**: vertical ordered list of steps
- **Each step card**: status badge, step name, type pill, duration, retry count if > 0, expandable input/output JSON panels, error message if failed

Components (colocated under the run detail page):
- `WorkflowRunHeader.jsx` — run metadata and status
- `WorkflowRunTimeline.jsx` — ordered step list
- `WorkflowRunStepCard.jsx` — one step with expand/collapse

Uses existing Card, Badge, PageLayout primitives. No new UI framework additions.

### Empty states

- No runs yet: "This workflow hasn't been executed yet. Use the SDK or API to run it."
- Run not found: "Run not found" with link back to template.
- Step with no output: Show "No output recorded" instead of empty panel.

## Testing

### Unit tests

- `__tests__/unit/workflow-runs.repository.test.js` — repository list/get with mock SQL
- `__tests__/unit/workflow-run-detail.page.test.jsx` — page render with mocked fetch, step expansion, status badges, error display, empty states
- Extend `__tests__/unit/workflow-executor.test.js` — verify step_results insert/update calls when sql is provided, verify graceful skip when sql is not provided

### Verification commands

```bash
npx vitest run __tests__/unit/workflow-runs.repository.test.js
npx vitest run __tests__/unit/workflow-run-detail.page.test.jsx
npx vitest run __tests__/unit/workflow-executor.test.js
npm run docs:check
npm run contracts:check
npm run lint
```

## Scope boundaries

### In scope
- workflow_step_results table
- Executor writes step results when sql available
- Execute route updates parent action to completed/failed
- Repository for listing runs and getting run detail
- Two new API routes (list runs, get run)
- Run history tab on template detail page
- Run detail page with step timeline

### Out of scope
- Conditional branching or skip logic (Wave B)
- Resume from checkpoint (Wave C)
- Async execution or job queue
- Workflow run deletion or archival
- SDK methods for run queries
- Step output diffing or comparison
