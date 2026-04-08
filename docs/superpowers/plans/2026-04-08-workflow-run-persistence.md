# Workflow Run Persistence + Run Detail Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist full workflow step results and build a run detail page so operators can inspect workflow executions with complete step inputs, outputs, and errors.

**Architecture:** Add one `workflow_step_results` table for full step data. Modify the executor to write step results alongside existing action_records. Add a repository, two API routes, and a run detail page. The parent action_record (action_type='workflow_execute') already gets updated to completed/failed by the execute route — no change needed there.

**Tech Stack:** Next.js 15 App Router, Postgres via postgres.js tagged templates, Vitest + jsdom, existing DashClaw UI primitives

---

## File Map

### Existing files to modify

- `drizzle/0000_clammy_falcon.sql` — append workflow_step_results table
- `app/lib/workflow-executor.js` — add step_result insert/update calls
- `app/workflows/[templateId]/page.jsx` — add Runs tab
- `__tests__/unit/workflow-executor.test.js` — add step_result write assertions

### New files to create

- `app/lib/repositories/workflow-runs.repository.js` — list runs, get run detail
- `app/api/workflows/templates/[templateId]/runs/route.js` — GET list runs
- `app/api/workflows/templates/[templateId]/runs/[runActionId]/route.js` — GET run detail
- `app/workflows/[templateId]/runs/[runActionId]/page.jsx` — run detail page
- `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunHeader.jsx`
- `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunTimeline.jsx`
- `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunStepCard.jsx`
- `__tests__/unit/workflow-runs.repository.test.js`
- `__tests__/unit/workflow-run-detail.page.test.jsx`

### Existing files to leave alone

- `app/api/workflows/templates/[templateId]/execute/route.js` — already updates parent action
- `app/lib/step-handlers.js` — step execution logic unchanged
- `app/lib/template-vars.js` — variable resolution unchanged

---

## Chunk 1: Schema + Step Result Persistence

### Task 1: Add the workflow_step_results table

**Files:**
- Modify: `drizzle/0000_clammy_falcon.sql` (append at end)

- [ ] **Step 1: Append the new table definition**

Add to the end of `drizzle/0000_clammy_falcon.sql`:

```sql
-- Workflow step results: full input/output for each step execution
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

- [ ] **Step 2: Commit**

```bash
git add drizzle/0000_clammy_falcon.sql
git commit -m "feat: add workflow_step_results table"
```

---

### Task 2: Write step results from the executor

**Files:**
- Modify: `app/lib/workflow-executor.js`
- Modify: `__tests__/unit/workflow-executor.test.js`

- [ ] **Step 1: Write failing tests for step result persistence**

Add these tests to `__tests__/unit/workflow-executor.test.js`:

```javascript
it('writes step_result records when persistStepResult is provided', async () => {
  handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });

  const persistStepResult = vi.fn().mockResolvedValue(undefined);

  const steps = [
    { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
  ];

  const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {}, persistStepResult });

  expect(result.success).toBe(true);
  // Called twice: once for 'running', once for 'completed'
  expect(persistStepResult).toHaveBeenCalledTimes(2);
  expect(persistStepResult).toHaveBeenCalledWith(
    expect.objectContaining({
      step_id: 'step_1',
      step_index: 0,
      step_type: 'knowledge_search',
      step_name: 'Search',
      status: 'running',
    }),
  );
  expect(persistStepResult).toHaveBeenCalledWith(
    expect.objectContaining({
      step_id: 'step_1',
      status: 'completed',
      output_json: expect.any(Object),
      duration_ms: expect.any(Number),
    }),
  );
});

it('writes failed step_result on step failure', async () => {
  handleCapabilityInvoke.mockRejectedValue(new Error('timeout'));

  const persistStepResult = vi.fn().mockResolvedValue(undefined);

  const steps = [
    { id: 'step_1', type: 'capability_invoke', name: 'Call API', config: { capability_id: 'cap_1', body: {} } },
  ];

  const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {}, persistStepResult });

  expect(result.success).toBe(false);
  expect(persistStepResult).toHaveBeenCalledWith(
    expect.objectContaining({
      step_id: 'step_1',
      status: 'failed',
      error_message: 'timeout',
    }),
  );
});

it('skips step_result writes when persistStepResult is not provided', async () => {
  handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });

  const steps = [
    { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
  ];

  // No persistStepResult — should not throw
  const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });
  expect(result.success).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/workflow-executor.test.js`
Expected: FAIL on persistStepResult assertions

- [ ] **Step 3: Add step result persistence to the executor**

In `app/lib/workflow-executor.js`, modify `executeWorkflow` to accept `persistStepResult` from the `workflowContext` parameter and call it at appropriate points.

After line 46 (`const context = ...`), extract the callback:

```javascript
const persistStepResult = workflowContext.persistStepResult || null;
```

Inside the step loop, before the retry loop (after line 52 `const stepActionId = ...`), add:

```javascript
const stepIndex = steps.indexOf(step);

if (persistStepResult) {
  await persistStepResult({
    step_id: step.id,
    step_index: stepIndex,
    step_type: step.type,
    step_name: step.name || step.id,
    status: 'running',
    input_json: resolveVars(step.config || {}, context),
    started_at: new Date().toISOString(),
  }).catch((err) => console.warn('[Executor] Step result write failed:', err.message));
}
```

After the successful step update (after line 98 `context.steps[step.id] = { output }`), add:

```javascript
if (persistStepResult) {
  await persistStepResult({
    step_id: step.id,
    step_index: stepIndex,
    step_type: step.type,
    step_name: step.name || step.id,
    status: 'completed',
    output_json: output,
    retry_count: attempt,
    duration_ms: stepElapsed,
    finished_at: new Date().toISOString(),
  }).catch((err) => console.warn('[Executor] Step result write failed:', err.message));
}
```

After the failed step update (after `stepResults.push(...)` in the `if (!succeeded)` block), add:

```javascript
if (persistStepResult) {
  await persistStepResult({
    step_id: step.id,
    step_index: stepIndex,
    step_type: step.type,
    step_name: step.name || step.id,
    status: 'failed',
    error_message: lastError.message,
    retry_count: maxRetries,
    duration_ms: stepElapsed,
    finished_at: new Date().toISOString(),
  }).catch((err) => console.warn('[Executor] Step result write failed:', err.message));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/workflow-executor.test.js`
Expected: PASS (all existing + 3 new tests)

- [ ] **Step 5: Commit**

```bash
git add app/lib/workflow-executor.js __tests__/unit/workflow-executor.test.js
git commit -m "feat: persist workflow step results via callback"
```

---

### Task 3: Wire persistence callback in the execute route

**Files:**
- Modify: `app/api/workflows/templates/[templateId]/execute/route.js`

- [ ] **Step 1: Add the persistStepResult callback**

In the execute route, after the parent action record is created (after line 162), before `executeWorkflow` is called, add:

```javascript
// Build step result persistence callback
const persistStepResult = async (stepData) => {
  const stepResultId = `sr_${crypto.randomUUID()}`;
  if (stepData.status === 'running') {
    await sql`
      INSERT INTO workflow_step_results (
        step_result_id, run_action_id, org_id, template_id,
        step_id, step_index, step_type, step_name,
        status, input_json, started_at
      ) VALUES (
        ${stepResultId}, ${action_id}, ${orgId}, ${templateId},
        ${stepData.step_id}, ${stepData.step_index}, ${stepData.step_type}, ${stepData.step_name},
        'running', ${JSON.stringify(stepData.input_json)}, ${stepData.started_at}
      )
    `;
  } else {
    await sql`
      UPDATE workflow_step_results
      SET status = ${stepData.status},
          output_json = ${stepData.output_json ? JSON.stringify(stepData.output_json) : null},
          error_message = ${stepData.error_message || null},
          retry_count = ${stepData.retry_count || 0},
          duration_ms = ${stepData.duration_ms || null},
          finished_at = ${stepData.finished_at || null}
      WHERE run_action_id = ${action_id}
        AND org_id = ${orgId}
        AND step_id = ${stepData.step_id}
    `;
  }
};
```

Then modify the `executeWorkflow` call to pass the callback:

```javascript
const result = await executeWorkflow(
  sql,
  orgId,
  action_id,
  steps,
  variables,
  { strategyConfig, agentId, persistStepResult },
);
```

- [ ] **Step 2: Commit**

```bash
git add "app/api/workflows/templates/[templateId]/execute/route.js"
git commit -m "feat: wire step result persistence into workflow execute route"
```

---

## Chunk 2: Repository + API Routes

### Task 4: Add the workflow runs repository

**Files:**
- Create: `app/lib/repositories/workflow-runs.repository.js`
- Create: `__tests__/unit/workflow-runs.repository.test.js`

- [ ] **Step 1: Write failing repository tests**

Create `__tests__/unit/workflow-runs.repository.test.js`:

```javascript
import { describe, expect, it, vi } from 'vitest';
import { listWorkflowRuns, getWorkflowRun, shapeRun, shapeStepResult } from '../../app/lib/repositories/workflow-runs.repository.js';

describe('shapeRun', () => {
  it('shapes a raw action_record row into a run object', () => {
    const row = {
      action_id: 'act_1',
      status: 'completed',
      agent_id: 'agent_1',
      declared_goal: 'Test run',
      trigger: 'workflow:wft_abc',
      duration_ms: 4500,
      timestamp_start: '2026-04-08T12:00:00Z',
      timestamp_end: '2026-04-08T12:00:04Z',
      error_message: null,
      step_count: '3',
      steps_completed: '3',
      steps_failed: '0',
    };

    const run = shapeRun(row);
    expect(run.run_action_id).toBe('act_1');
    expect(run.template_id).toBe('wft_abc');
    expect(run.status).toBe('completed');
    expect(run.step_count).toBe(3);
    expect(run.steps_completed).toBe(3);
    expect(run.steps_failed).toBe(0);
  });

  it('extracts template_id from trigger field', () => {
    const row = {
      action_id: 'act_2',
      trigger: 'workflow:wft_xyz_123',
      status: 'failed',
      step_count: '0',
      steps_completed: '0',
      steps_failed: '0',
    };

    const run = shapeRun(row);
    expect(run.template_id).toBe('wft_xyz_123');
  });
});

describe('shapeStepResult', () => {
  it('shapes a raw step result row', () => {
    const row = {
      step_result_id: 'sr_1',
      step_id: 'search',
      step_index: 0,
      step_type: 'knowledge_search',
      step_name: 'Find docs',
      status: 'completed',
      input_json: '{"collection_id":"kc_1","query":"test"}',
      output_json: '{"chunks":[]}',
      error_message: null,
      retry_count: 0,
      duration_ms: 312,
      started_at: '2026-04-08T12:00:00Z',
      finished_at: '2026-04-08T12:00:00Z',
    };

    const step = shapeStepResult(row);
    expect(step.step_id).toBe('search');
    expect(step.input).toEqual({ collection_id: 'kc_1', query: 'test' });
    expect(step.output).toEqual({ chunks: [] });
    expect(step.duration_ms).toBe(312);
  });

  it('returns null for unparseable JSON fields', () => {
    const row = {
      step_result_id: 'sr_2',
      step_id: 'broken',
      step_index: 0,
      step_type: 'prompt',
      status: 'failed',
      input_json: 'not-json',
      output_json: null,
      error_message: 'crash',
      retry_count: 0,
    };

    const step = shapeStepResult(row);
    expect(step.input).toBeNull();
    expect(step.output).toBeNull();
    expect(step.error_message).toBe('crash');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/workflow-runs.repository.test.js`
Expected: FAIL because module does not exist

- [ ] **Step 3: Implement the repository**

Create `app/lib/repositories/workflow-runs.repository.js`:

```javascript
function safeJsonParse(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function shapeRun(row) {
  if (!row) return null;
  const trigger = row.trigger || '';
  const templateId = trigger.startsWith('workflow:') ? trigger.slice('workflow:'.length) : null;

  return {
    run_action_id: row.action_id,
    template_id: templateId,
    status: row.status || 'unknown',
    agent_id: row.agent_id || null,
    declared_goal: row.declared_goal || null,
    duration_ms: row.duration_ms || null,
    started_at: row.timestamp_start || null,
    finished_at: row.timestamp_end || null,
    error_message: row.error_message || null,
    step_count: parseInt(row.step_count, 10) || 0,
    steps_completed: parseInt(row.steps_completed, 10) || 0,
    steps_failed: parseInt(row.steps_failed, 10) || 0,
  };
}

export function shapeStepResult(row) {
  if (!row) return null;
  return {
    step_result_id: row.step_result_id,
    step_id: row.step_id,
    step_index: row.step_index,
    step_type: row.step_type,
    step_name: row.step_name || row.step_id,
    status: row.status,
    input: safeJsonParse(row.input_json),
    output: safeJsonParse(row.output_json),
    error_message: row.error_message || null,
    retry_count: row.retry_count || 0,
    duration_ms: row.duration_ms || null,
    started_at: row.started_at || null,
    finished_at: row.finished_at || null,
  };
}

export async function listWorkflowRuns(sql, orgId, templateId, filters = {}) {
  const { status, agent_id, limit = 20, offset = 0 } = filters;
  const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
  const parsedOffset = parseInt(offset, 10) || 0;
  const triggerMatch = `workflow:${templateId}`;

  const rows = await sql`
    SELECT
      a.action_id,
      a.status,
      a.agent_id,
      a.declared_goal,
      a.trigger,
      a.duration_ms,
      a.timestamp_start,
      a.timestamp_end,
      a.error_message,
      COALESCE(s.step_count, 0) AS step_count,
      COALESCE(s.steps_completed, 0) AS steps_completed,
      COALESCE(s.steps_failed, 0) AS steps_failed
    FROM action_records a
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS step_count,
        COUNT(*) FILTER (WHERE status = 'completed')::int AS steps_completed,
        COUNT(*) FILTER (WHERE status = 'failed')::int AS steps_failed
      FROM workflow_step_results
      WHERE run_action_id = a.action_id AND org_id = ${orgId}
    ) s ON true
    WHERE a.org_id = ${orgId}
      AND a.action_type = 'workflow_execute'
      AND a.trigger = ${triggerMatch}
      ${status ? sql`AND a.status = ${status}` : sql``}
      ${agent_id ? sql`AND a.agent_id = ${agent_id}` : sql``}
    ORDER BY a.timestamp_start::timestamptz DESC
    LIMIT ${parsedLimit}
    OFFSET ${parsedOffset}
  `;

  const countRows = await sql`
    SELECT COUNT(*)::int AS total
    FROM action_records
    WHERE org_id = ${orgId}
      AND action_type = 'workflow_execute'
      AND trigger = ${triggerMatch}
      ${status ? sql`AND status = ${status}` : sql``}
      ${agent_id ? sql`AND agent_id = ${agent_id}` : sql``}
  `;

  return {
    runs: rows.map(shapeRun),
    total: countRows[0]?.total || 0,
  };
}

export async function getWorkflowRun(sql, orgId, runActionId) {
  const actionRows = await sql`
    SELECT
      action_id, status, agent_id, declared_goal, trigger,
      duration_ms, timestamp_start, timestamp_end, error_message, reasoning
    FROM action_records
    WHERE org_id = ${orgId}
      AND action_id = ${runActionId}
      AND action_type = 'workflow_execute'
    LIMIT 1
  `;

  if (actionRows.length === 0) return null;

  const run = shapeRun(actionRows[0]);

  // Parse reasoning for template metadata
  const reasoning = safeJsonParse(actionRows[0].reasoning);
  run.template_name = reasoning?.template_name || null;

  const stepRows = await sql`
    SELECT
      step_result_id, step_id, step_index, step_type, step_name,
      status, input_json, output_json, error_message,
      retry_count, duration_ms, started_at, finished_at
    FROM workflow_step_results
    WHERE run_action_id = ${runActionId}
      AND org_id = ${orgId}
    ORDER BY step_index ASC
  `;

  run.steps = stepRows.map(shapeStepResult);
  run.step_count = run.steps.length;
  run.steps_completed = run.steps.filter((s) => s.status === 'completed').length;
  run.steps_failed = run.steps.filter((s) => s.status === 'failed').length;

  return run;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/workflow-runs.repository.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/lib/repositories/workflow-runs.repository.js __tests__/unit/workflow-runs.repository.test.js
git commit -m "feat: add workflow runs repository"
```

---

### Task 5: Add the API routes for listing and viewing runs

**Files:**
- Create: `app/api/workflows/templates/[templateId]/runs/route.js`
- Create: `app/api/workflows/templates/[templateId]/runs/[runActionId]/route.js`

- [ ] **Step 1: Create the list runs route**

Create `app/api/workflows/templates/[templateId]/runs/route.js`:

```javascript
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSql } from '../../../../../../lib/db.js';
import { getOrgId } from '../../../../../../lib/org.js';
import { apiErrorResponse } from '../../../../../../lib/apiErrors.js';
import { listWorkflowRuns } from '../../../../../../lib/repositories/workflow-runs.repository.js';

export async function GET(request, { params }) {
  try {
    const { templateId } = await params;
    const sql = getSql();
    const orgId = getOrgId(request);
    const { searchParams } = new URL(request.url);

    const filters = {
      status: searchParams.get('status') || undefined,
      agent_id: searchParams.get('agent_id') || undefined,
      limit: searchParams.get('limit') || 20,
      offset: searchParams.get('offset') || 0,
    };

    const result = await listWorkflowRuns(sql, orgId, templateId, filters);

    return NextResponse.json({
      template_id: templateId,
      ...result,
    });
  } catch (error) {
    return apiErrorResponse(error, 'WORKFLOW_RUNS_LIST');
  }
}
```

- [ ] **Step 2: Create the run detail route**

Create `app/api/workflows/templates/[templateId]/runs/[runActionId]/route.js`:

```javascript
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSql } from '../../../../../../../lib/db.js';
import { getOrgId } from '../../../../../../../lib/org.js';
import { apiErrorResponse } from '../../../../../../../lib/apiErrors.js';
import { getWorkflowRun } from '../../../../../../../lib/repositories/workflow-runs.repository.js';

export async function GET(request, { params }) {
  try {
    const { templateId, runActionId } = await params;
    const sql = getSql();
    const orgId = getOrgId(request);

    const run = await getWorkflowRun(sql, orgId, runActionId);

    if (!run) {
      return NextResponse.json(
        { error: 'run_not_found' },
        { status: 404 },
      );
    }

    return NextResponse.json(run);
  } catch (error) {
    return apiErrorResponse(error, 'WORKFLOW_RUN_DETAIL');
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/workflows/templates/[templateId]/runs/route.js" "app/api/workflows/templates/[templateId]/runs/[runActionId]/route.js"
git commit -m "feat: add workflow run list and detail API routes"
```

---

## Chunk 3: Run Detail UI

### Task 6: Build the run detail page with components

**Files:**
- Create: `app/workflows/[templateId]/runs/[runActionId]/page.jsx`
- Create: `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunHeader.jsx`
- Create: `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunTimeline.jsx`
- Create: `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunStepCard.jsx`
- Create: `__tests__/unit/workflow-run-detail.page.test.jsx`

- [ ] **Step 1: Write failing page tests**

Create `__tests__/unit/workflow-run-detail.page.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import WorkflowRunDetailPage from '../../app/workflows/[templateId]/runs/[runActionId]/page.jsx';

function okJson(data) {
  return { ok: true, status: 200, json: async () => data };
}

function notFoundJson() {
  return { ok: false, status: 404, json: async () => ({ error: 'run_not_found' }) };
}

const mockRun = {
  run_action_id: 'act_1',
  template_id: 'wft_abc',
  template_name: 'Research Pipeline',
  status: 'completed',
  agent_id: 'research-agent',
  declared_goal: 'Research x402 protocol',
  duration_ms: 4523,
  started_at: '2026-04-08T12:00:00Z',
  finished_at: '2026-04-08T12:00:04Z',
  error_message: null,
  step_count: 2,
  steps_completed: 2,
  steps_failed: 0,
  steps: [
    {
      step_result_id: 'sr_1',
      step_id: 'search',
      step_index: 0,
      step_type: 'knowledge_search',
      step_name: 'Find docs',
      status: 'completed',
      input: { collection_id: 'kc_1', query: 'x402' },
      output: { chunks: [{ content: 'x402 is a payment protocol' }] },
      error_message: null,
      retry_count: 0,
      duration_ms: 312,
    },
    {
      step_result_id: 'sr_2',
      step_id: 'synthesize',
      step_index: 1,
      step_type: 'prompt',
      step_name: 'Synthesize answer',
      status: 'completed',
      input: { prompt_template: 'Based on: ...' },
      output: { text: 'x402 enables micropayments' },
      error_message: null,
      retry_count: 0,
      duration_ms: 4211,
    },
  ],
};

describe('WorkflowRunDetailPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders run metadata and step timeline', async () => {
    global.fetch.mockResolvedValueOnce(okJson(mockRun));

    render(<WorkflowRunDetailPage params={{ templateId: 'wft_abc', runActionId: 'act_1' }} />);

    expect(await screen.findByText('Research Pipeline')).toBeInTheDocument();
    expect(await screen.findByText(/completed/i)).toBeInTheDocument();
    expect(await screen.findByText('Find docs')).toBeInTheDocument();
    expect(await screen.findByText('Synthesize answer')).toBeInTheDocument();
  });

  it('shows error state for failed runs', async () => {
    const failedRun = {
      ...mockRun,
      status: 'failed',
      error_message: 'Step search failed: timeout',
      steps: [
        { ...mockRun.steps[0], status: 'failed', error_message: 'timeout' },
      ],
    };
    global.fetch.mockResolvedValueOnce(okJson(failedRun));

    render(<WorkflowRunDetailPage params={{ templateId: 'wft_abc', runActionId: 'act_1' }} />);

    expect(await screen.findByText(/failed/i)).toBeInTheDocument();
    expect(await screen.findByText(/timeout/i)).toBeInTheDocument();
  });

  it('shows not-found state', async () => {
    global.fetch.mockResolvedValueOnce(notFoundJson());

    render(<WorkflowRunDetailPage params={{ templateId: 'wft_abc', runActionId: 'act_1' }} />);

    expect(await screen.findByText(/not found/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/workflow-run-detail.page.test.jsx`
Expected: FAIL because page does not exist

- [ ] **Step 3: Implement the step card component**

Create `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunStepCard.jsx`:

```jsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, SkipForward } from 'lucide-react';

const STATUS_CONFIG = {
  completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
  running: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  skipped: { icon: SkipForward, color: 'text-zinc-500', bg: 'bg-zinc-500/10' },
  pending: { icon: Loader2, color: 'text-zinc-500', bg: 'bg-zinc-500/10' },
};

const TYPE_LABELS = {
  knowledge_search: 'Knowledge',
  capability_invoke: 'Capability',
  prompt: 'Prompt',
};

export default function WorkflowRunStepCard({ step }) {
  const [expanded, setExpanded] = useState(step.status === 'failed');
  const config = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border border-[rgba(255,255,255,0.06)] ${config.bg}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <Icon className={`w-4 h-4 ${config.color} flex-shrink-0`} />
        <span className="font-medium text-sm text-zinc-200 flex-1">{step.step_name}</span>
        <span className="text-[10px] font-mono text-zinc-500 uppercase">{TYPE_LABELS[step.step_type] || step.step_type}</span>
        {step.retry_count > 0 && (
          <span className="text-[10px] font-mono text-amber-400">{step.retry_count + 1} attempts</span>
        )}
        {step.duration_ms != null && (
          <span className="text-xs font-mono text-zinc-500">{(step.duration_ms / 1000).toFixed(1)}s</span>
        )}
        {expanded ? <ChevronDown className="w-3 h-3 text-zinc-500" /> : <ChevronRight className="w-3 h-3 text-zinc-500" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[rgba(255,255,255,0.04)]">
          {step.error_message && (
            <div className="mt-3 p-2 rounded bg-red-400/10 text-red-300 text-xs font-mono">{step.error_message}</div>
          )}
          {step.input && (
            <div className="mt-3">
              <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Input</div>
              <pre className="text-xs text-zinc-400 bg-black/30 rounded p-2 overflow-auto max-h-48">{JSON.stringify(step.input, null, 2)}</pre>
            </div>
          )}
          {step.output && (
            <div>
              <div className="text-[10px] font-mono text-zinc-500 uppercase mb-1">Output</div>
              <pre className="text-xs text-zinc-400 bg-black/30 rounded p-2 overflow-auto max-h-48">{JSON.stringify(step.output, null, 2)}</pre>
            </div>
          )}
          {!step.input && !step.output && !step.error_message && (
            <div className="mt-3 text-xs text-zinc-600">No data recorded</div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement the timeline component**

Create `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunTimeline.jsx`:

```jsx
'use client';

import WorkflowRunStepCard from './WorkflowRunStepCard.jsx';

export default function WorkflowRunTimeline({ steps }) {
  if (!steps || steps.length === 0) {
    return <div className="text-sm text-zinc-500">No steps recorded for this run.</div>;
  }

  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <WorkflowRunStepCard key={step.step_result_id || step.step_id} step={step} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Implement the header component**

Create `app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunHeader.jsx`:

```jsx
'use client';

import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2, ArrowLeft, ExternalLink } from 'lucide-react';

const STATUS_BADGE = {
  completed: { label: 'Completed', color: 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' },
  failed: { label: 'Failed', color: 'bg-red-400/10 text-red-400 border-red-400/20' },
  running: { label: 'Running', color: 'bg-blue-400/10 text-blue-400 border-blue-400/20' },
};

export default function WorkflowRunHeader({ run, templateId }) {
  const badge = STATUS_BADGE[run.status] || STATUS_BADGE.running;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href={`/workflows/${templateId}`} className="hover:text-zinc-300 flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" />
          {run.template_name || 'Workflow'}
        </Link>
        <span>/</span>
        <span className="text-zinc-400">Run</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">{run.template_name || 'Workflow Run'}</h1>
          {run.declared_goal && (
            <p className="text-sm text-zinc-400 mt-1">{run.declared_goal}</p>
          )}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
        {run.agent_id && <span>Agent: <span className="text-zinc-400">{run.agent_id}</span></span>}
        {run.duration_ms != null && <span>Duration: <span className="text-zinc-400">{(run.duration_ms / 1000).toFixed(1)}s</span></span>}
        <span>Steps: <span className="text-zinc-400">{run.steps_completed}/{run.step_count}</span></span>
        {run.started_at && <span>Started: <span className="text-zinc-400">{new Date(run.started_at).toLocaleString()}</span></span>}
        <Link href={`/decisions/${run.run_action_id}`} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
          Governance trace <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {run.error_message && (
        <div className="p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-sm text-red-300 font-mono">
          {run.error_message}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Implement the run detail page**

Create `app/workflows/[templateId]/runs/[runActionId]/page.jsx`:

```jsx
'use client';

import { useState, useEffect, use } from 'react';
import PageLayout from '../../../../components/PageLayout.js';
import WorkflowRunHeader from './components/WorkflowRunHeader.jsx';
import WorkflowRunTimeline from './components/WorkflowRunTimeline.jsx';
import Link from 'next/link';

export default function WorkflowRunDetailPage({ params }) {
  const { templateId, runActionId } = use(params);
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadRun() {
      try {
        const res = await fetch(`/api/workflows/templates/${templateId}/runs/${runActionId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('not_found');
          } else {
            setError('fetch_failed');
          }
          return;
        }
        const data = await res.json();
        setRun(data);
      } catch {
        setError('fetch_failed');
      } finally {
        setLoading(false);
      }
    }
    loadRun();
  }, [templateId, runActionId]);

  if (loading) {
    return (
      <PageLayout title="Loading run...">
        <div className="animate-pulse text-zinc-500 text-sm">Loading workflow run...</div>
      </PageLayout>
    );
  }

  if (error === 'not_found') {
    return (
      <PageLayout title="Run not found">
        <div className="text-center py-12">
          <p className="text-zinc-400 mb-4">This workflow run was not found.</p>
          <Link href={`/workflows/${templateId}`} className="text-blue-400 hover:text-blue-300 text-sm">
            Back to workflow
          </Link>
        </div>
      </PageLayout>
    );
  }

  if (error || !run) {
    return (
      <PageLayout title="Error">
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">Failed to load workflow run.</p>
          <button onClick={() => window.location.reload()} className="text-blue-400 hover:text-blue-300 text-sm">
            Retry
          </button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={run.template_name || 'Workflow Run'}>
      <div className="space-y-8">
        <WorkflowRunHeader run={run} templateId={templateId} />
        <div>
          <h2 className="text-sm font-medium text-zinc-300 mb-3">Steps</h2>
          <WorkflowRunTimeline steps={run.steps} />
        </div>
      </div>
    </PageLayout>
  );
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run __tests__/unit/workflow-run-detail.page.test.jsx`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add "app/workflows/[templateId]/runs/[runActionId]/page.jsx" "app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunHeader.jsx" "app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunTimeline.jsx" "app/workflows/[templateId]/runs/[runActionId]/components/WorkflowRunStepCard.jsx" "__tests__/unit/workflow-run-detail.page.test.jsx"
git commit -m "feat: add workflow run detail page"
```

---

### Task 7: Add run history tab to the template detail page

**Files:**
- Modify: `app/workflows/[templateId]/page.jsx`

- [ ] **Step 1: Add a Runs tab that fetches and displays recent runs**

In `app/workflows/[templateId]/page.jsx`, add state and fetch logic for runs. Add a tab that shows a compact table of recent executions.

Add state variables:

```javascript
const [runs, setRuns] = useState([]);
const [runsLoading, setRunsLoading] = useState(false);
```

Add a fetch function:

```javascript
async function loadRuns() {
  setRunsLoading(true);
  try {
    const res = await fetch(`/api/workflows/templates/${templateId}/runs?limit=10`);
    if (res.ok) {
      const data = await res.json();
      setRuns(data.runs || []);
    }
  } catch { /* ignore */ } finally {
    setRunsLoading(false);
  }
}
```

Call `loadRuns()` alongside the existing template fetch.

Add a "Runs" tab to the existing tab system. The tab content renders a table:

```jsx
{runs.length === 0 ? (
  <div className="text-sm text-zinc-500 py-8 text-center">
    No runs yet. Use the SDK or API to execute this workflow.
  </div>
) : (
  <div className="space-y-2">
    {runs.map((run) => (
      <Link
        key={run.run_action_id}
        href={`/workflows/${templateId}/runs/${run.run_action_id}`}
        className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[rgba(255,255,255,0.06)] hover:bg-white/[0.02] transition-colors"
      >
        <span className={`w-2 h-2 rounded-full ${run.status === 'completed' ? 'bg-emerald-400' : run.status === 'failed' ? 'bg-red-400' : 'bg-blue-400'}`} />
        <span className="text-sm text-zinc-300 flex-1 truncate">{run.declared_goal || 'Workflow run'}</span>
        <span className="text-xs text-zinc-500">{run.steps_completed}/{run.step_count} steps</span>
        {run.duration_ms != null && <span className="text-xs font-mono text-zinc-500">{(run.duration_ms / 1000).toFixed(1)}s</span>}
        <span className="text-xs text-zinc-600">{run.started_at ? new Date(run.started_at).toLocaleString() : ''}</span>
      </Link>
    ))}
  </div>
)}
```

- [ ] **Step 2: Commit**

```bash
git add "app/workflows/[templateId]/page.jsx"
git commit -m "feat: add workflow run history tab to template detail"
```

---

## Chunk 4: Verification

### Task 8: Final verification and docs sync

- [ ] **Step 1: Run all new and related tests**

Run:

```bash
npx vitest run __tests__/unit/workflow-executor.test.js __tests__/unit/workflow-runs.repository.test.js __tests__/unit/workflow-run-detail.page.test.jsx
```

Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: PASS (all existing + new tests)

- [ ] **Step 3: Run docs and contract checks**

Run:

```bash
npm run lint
npm run docs:check
npm run contracts:check
```

Expected: PASS

- [ ] **Step 4: Run production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 5: Update spec if naming drifted**

If final component or helper names differ from the approved spec, update `docs/superpowers/specs/2026-04-08-workflow-run-persistence-design.md`.

- [ ] **Step 6: Final checkpoint commit**

```bash
git add docs/superpowers/specs/2026-04-08-workflow-run-persistence-design.md docs/superpowers/plans/2026-04-08-workflow-run-persistence.md
git commit -m "docs: align workflow run persistence spec and plan"
```

---

## Notes For Execution

- The executor must remain functional without a database connection (tests pass `persistStepResult` optionally).
- Step result writes use fire-and-forget `.catch()` — a failed DB write should not crash the workflow execution.
- The execute route already updates the parent action to completed/failed (lines 185-194). Do not duplicate this logic.
- Follow existing patterns: repository exports named functions, JSON fields parsed in shape helpers, routes use apiErrorResponse for errors.
- UI components are colocated under the run detail page directory, not in a shared components folder.
