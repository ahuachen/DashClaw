# Workflow Executor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sequential workflow executor to DashClaw so Execution Studio workflows can actually run, with each step creating a governed action record.

**Architecture:** New execute route loads template, guards the launch, then passes to a workflow executor that iterates steps_json sequentially. Each step resolves variables from a rolling context, dispatches to a type-specific handler (prompt, capability_invoke, knowledge_search), creates a child action record, and feeds output to the next step.

**Tech Stack:** Next.js 15 App Router, existing DashClaw libraries (providers.js, capability-invoke.js, knowledge-ingest.js), Vitest

**Spec:** `docs/superpowers/specs/2026-04-06-workflow-executor-design.md`

**Working directory:** `C:\Projects\DashClaw`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/lib/template-vars.js` | Create | Variable substitution — resolves `${variables.x}` and `${steps.step_1.output.y}` |
| `app/lib/step-handlers.js` | Create | Step type handlers — knowledge_search, capability_invoke, prompt |
| `app/lib/workflow-executor.js` | Create | Core executor — iterates steps, manages context, dispatches handlers, tracks outcomes |
| `app/api/workflows/templates/[templateId]/execute/route.js` | Create | Execute endpoint — guard, parent action, call executor, return result |
| `__tests__/unit/template-vars.test.js` | Create | Tests for variable substitution |
| `__tests__/unit/workflow-executor.test.js` | Create | Tests for executor with mocked handlers |

---

## Task 1: Variable Substitution Engine

**Files:**
- Create: `app/lib/template-vars.js`
- Create: `__tests__/unit/template-vars.test.js`

- [ ] **Step 1: Write tests**

Create `__tests__/unit/template-vars.test.js`:

```javascript
import { describe, expect, it } from 'vitest';
import { resolveVars } from '../../app/lib/template-vars.js';

describe('resolveVars', () => {
  const context = {
    variables: { query: 'What is x402?', budget: 0.25 },
    steps: {
      step_1: { output: { chunks: [{ content: 'chunk text' }], query: 'x402' } },
      step_2: { output: { answer: 'x402 is a protocol', sources: ['a', 'b'] } },
    },
  };

  it('resolves ${variables.x} in strings', () => {
    expect(resolveVars('Search for: ${variables.query}', context)).toBe(
      'Search for: What is x402?',
    );
  });

  it('resolves ${steps.step_id.output.field} in strings', () => {
    expect(resolveVars('Answer: ${steps.step_2.output.answer}', context)).toBe(
      'Answer: x402 is a protocol',
    );
  });

  it('resolves array index access ${steps.step_1.output.chunks[0].content}', () => {
    expect(resolveVars('${steps.step_1.output.chunks[0].content}', context)).toBe('chunk text');
  });

  it('returns original type when entire string is a variable', () => {
    expect(resolveVars('${variables.budget}', context)).toBe(0.25);
    expect(typeof resolveVars('${variables.budget}', context)).toBe('number');
  });

  it('leaves unresolved placeholders as-is', () => {
    expect(resolveVars('${variables.missing}', context)).toBe('${variables.missing}');
  });

  it('handles non-string values (passthrough)', () => {
    expect(resolveVars(42, context)).toBe(42);
    expect(resolveVars(true, context)).toBe(true);
    expect(resolveVars(null, context)).toBe(null);
  });

  it('resolves variables in object values recursively', () => {
    const config = {
      query: '${variables.query}',
      nested: { budget: '${variables.budget}' },
    };
    expect(resolveVars(config, context)).toEqual({
      query: 'What is x402?',
      nested: { budget: 0.25 },
    });
  });

  it('resolves variables in array elements', () => {
    const arr = ['${variables.query}', 'literal'];
    expect(resolveVars(arr, context)).toEqual(['What is x402?', 'literal']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:\Projects\DashClaw" && npx vitest run __tests__/unit/template-vars.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement template-vars.js**

Create `app/lib/template-vars.js`:

```javascript
/**
 * Variable substitution engine for workflow step configs.
 *
 * Resolves patterns like:
 *   ${variables.query}
 *   ${steps.step_1.output.answer}
 *   ${steps.step_1.output.chunks[0].content}
 */

function resolvePath(obj, path) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function resolveString(str, context) {
  // Check if entire string is a single variable — return original type
  const singleVarMatch = str.match(/^\$\{([^}]+)\}$/);
  if (singleVarMatch) {
    const resolved = resolvePath(context, singleVarMatch[1]);
    return resolved !== undefined ? resolved : str;
  }

  // Mixed string — replace all ${...} with string values
  return str.replace(/\$\{([^}]+)\}/g, (match, varPath) => {
    const resolved = resolvePath(context, varPath);
    return resolved !== undefined ? String(resolved) : match;
  });
}

export function resolveVars(value, context) {
  if (typeof value === 'string') {
    return resolveString(value, context);
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveVars(item, context));
  }
  if (value && typeof value === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = resolveVars(v, context);
    }
    return result;
  }
  return value;
}
```

- [ ] **Step 4: Run tests**

Run: `cd "C:\Projects\DashClaw" && npx vitest run __tests__/unit/template-vars.test.js`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
cd "C:\Projects\DashClaw"
git add app/lib/template-vars.js __tests__/unit/template-vars.test.js
git commit -m "feat(workflows): add variable substitution engine

Resolves \${variables.x} and \${steps.step_id.output.y} patterns.
Supports dot-path traversal, array index access, type preservation,
and recursive resolution in objects/arrays."
```

---

## Task 2: Step Handlers

**Files:**
- Create: `app/lib/step-handlers.js`

- [ ] **Step 1: Create step-handlers.js**

Create `app/lib/step-handlers.js`:

```javascript
/**
 * Step type handlers for workflow execution.
 * Each handler takes (sql, orgId, stepConfig, context, workflowContext) and returns an output object.
 */

import { searchCollection } from './knowledge-ingest.js';
import { executeCompletion } from './providers.js';
import { invokeCapability, resolveAuth } from './capability-invoke.js';
import { resolveEndpointUrl } from './mapping.js';
import { getCapability } from './repositories/capabilities.repository.js';
import { getSettings } from './repositories/settings.repository.js';

/**
 * knowledge_search — search a linked knowledge collection.
 * Config: { collection_id, query, top_k? }
 * Output: { chunks: [...], query }
 */
export async function handleKnowledgeSearch(sql, orgId, config) {
  const { collection_id, query, top_k = 5 } = config;

  if (!collection_id || !query) {
    throw new Error('knowledge_search requires collection_id and query');
  }

  const chunks = await searchCollection(sql, orgId, collection_id, query, {
    limit: top_k,
  });

  return {
    chunks: chunks.map((c) => ({
      content: c.content,
      score: c.score,
      source_uri: c.source_uri,
      title: c.title,
    })),
    query,
  };
}

/**
 * capability_invoke — invoke an HTTP capability.
 * Config: { capability_id, body }
 * Output: whatever the capability returns after response mapping
 */
export async function handleCapabilityInvoke(sql, orgId, config) {
  const { capability_id, body = {} } = config;

  if (!capability_id) {
    throw new Error('capability_invoke requires capability_id');
  }

  const capability = await getCapability(sql, orgId, capability_id);
  if (!capability) {
    throw new Error(`Capability not found: ${capability_id}`);
  }

  if (capability.source_type !== 'http_api') {
    throw new Error(`Capability ${capability_id} is not an http_api type`);
  }

  const schema = capability.invocation_schema || {};

  // Resolve org settings for auth and endpoint
  let orgSettings = {};
  try {
    const rows = await getSettings(sql, orgId);
    for (const row of rows) {
      orgSettings[row.key] = row.value;
    }
  } catch {
    // Settings table may not exist
  }

  const authHeaders = resolveAuth(schema.auth, orgSettings);
  const endpoint = resolveEndpointUrl(schema.endpoint, orgSettings);

  const result = await invokeCapability({
    endpoint,
    method: schema.method || 'POST',
    authHeaders,
    body,
    requestMapping: schema.request_mapping,
    responseMapping: schema.response_mapping,
    timeoutMs: schema.timeout_ms || 60000,
  });

  if (!result.success) {
    throw new Error(`Capability invocation failed: ${result.error} — ${result.message || ''}`);
  }

  return { ...result.data, elapsed_ms: result.elapsed_ms };
}

/**
 * prompt — call an LLM via the workflow's linked model strategy.
 * Config: { prompt_template, system_prompt?, max_tokens?, temperature? }
 * workflowContext: { strategyConfig } — resolved model strategy
 * Output: { text, tokens_in, tokens_out }
 */
export async function handlePrompt(sql, orgId, config, workflowContext) {
  const {
    prompt_template,
    system_prompt,
    max_tokens = 1024,
    temperature = 0.3,
  } = config;

  if (!prompt_template) {
    throw new Error('prompt step requires prompt_template');
  }

  if (!workflowContext.strategyConfig) {
    throw new Error('prompt step requires a linked model strategy on the workflow');
  }

  const messages = [];
  if (system_prompt) {
    messages.push({ role: 'system', content: system_prompt });
  }
  messages.push({ role: 'user', content: prompt_template });

  const result = await executeCompletion(
    sql,
    orgId,
    workflowContext.strategyConfig,
    messages,
    { max_tokens, temperature },
  );

  return {
    text: result.content,
    tokens_in: result.usage?.input_tokens || 0,
    tokens_out: result.usage?.output_tokens || 0,
  };
}
```

- [ ] **Step 2: Verify it parses**

Run: `cd "C:\Projects\DashClaw" && node -e "import('./app/lib/step-handlers.js').then(() => console.log('OK')).catch(e => console.log('Import needs runtime - expected'))"`

- [ ] **Step 3: Commit**

```bash
cd "C:\Projects\DashClaw"
git add app/lib/step-handlers.js
git commit -m "feat(workflows): add step type handlers

Three handlers: knowledge_search (semantic search via pgvector),
capability_invoke (HTTP capability via invoke engine),
prompt (LLM completion via model strategy)."
```

---

## Task 3: Workflow Executor

**Files:**
- Create: `app/lib/workflow-executor.js`
- Create: `__tests__/unit/workflow-executor.test.js`

- [ ] **Step 1: Write tests**

Create `__tests__/unit/workflow-executor.test.js`:

```javascript
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { executeWorkflow } from '../../app/lib/workflow-executor.js';

// Mock step handlers
vi.mock('../../app/lib/step-handlers.js', () => ({
  handleKnowledgeSearch: vi.fn(),
  handleCapabilityInvoke: vi.fn(),
  handlePrompt: vi.fn(),
}));

// Mock action repository
vi.mock('../../app/lib/repositories/actions.repository.js', () => ({
  createActionRecord: vi.fn().mockResolvedValue({ action_id: 'act_child' }),
}));

import { handleKnowledgeSearch, handleCapabilityInvoke, handlePrompt } from '../../app/lib/step-handlers.js';
import { createActionRecord } from '../../app/lib/repositories/actions.repository.js';

const mockSql = Object.assign(
  vi.fn().mockResolvedValue([]),
  { query: vi.fn().mockResolvedValue([]) },
);

describe('executeWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes steps sequentially and returns final output', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [{ content: 'doc text' }], query: 'test' });
    handlePrompt.mockResolvedValueOnce({ text: 'synthesized answer', tokens_in: 100, tokens_out: 50 });

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
      { id: 'step_2', type: 'prompt', name: 'Synthesize', config: { prompt_template: 'Answer based on: ${steps.step_1.output.chunks[0].content}' } },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, { query: 'test' }, { strategyConfig: {} });

    expect(result.success).toBe(true);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('completed');
    expect(result.result.text).toBe('synthesized answer');
  });

  it('stops on first failed step and reports partial results', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });
    handleCapabilityInvoke.mockRejectedValueOnce(new Error('capability_timeout'));

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
      { id: 'step_2', type: 'capability_invoke', name: 'Research', config: { capability_id: 'cap_1', body: {} } },
      { id: 'step_3', type: 'prompt', name: 'Synthesize', config: { prompt_template: 'test' } },
    ];

    const result = await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

    expect(result.success).toBe(false);
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].status).toBe('completed');
    expect(result.steps[1].status).toBe('failed');
    expect(result.error).toContain('capability_timeout');
    // step_3 should not have been attempted
    expect(handlePrompt).not.toHaveBeenCalled();
  });

  it('creates child action records for each step', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [], query: 'test' });

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: 'test' } },
    ];

    await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, {}, { strategyConfig: {} });

    expect(createActionRecord).toHaveBeenCalledWith(
      mockSql,
      expect.objectContaining({
        orgId: 'org_1',
        data: expect.objectContaining({
          action_type: 'workflow_step:knowledge_search',
          parent_action_id: 'act_parent',
        }),
      }),
    );
  });

  it('passes rolling context between steps', async () => {
    handleKnowledgeSearch.mockResolvedValueOnce({ chunks: [{ content: 'found data' }], query: 'q' });
    handlePrompt.mockResolvedValueOnce({ text: 'done', tokens_in: 10, tokens_out: 5 });

    const steps = [
      { id: 'step_1', type: 'knowledge_search', name: 'Search', config: { collection_id: 'kc_1', query: '${variables.q}' } },
      { id: 'step_2', type: 'prompt', name: 'Synthesize', config: { prompt_template: 'Context: ${steps.step_1.output.chunks[0].content}' } },
    ];

    await executeWorkflow(mockSql, 'org_1', 'act_parent', steps, { q: 'test' }, { strategyConfig: {} });

    // Verify prompt was called with resolved variable
    expect(handlePrompt).toHaveBeenCalledWith(
      mockSql,
      'org_1',
      expect.objectContaining({
        prompt_template: 'Context: found data',
      }),
      expect.any(Object),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "C:\Projects\DashClaw" && npx vitest run __tests__/unit/workflow-executor.test.js`
Expected: FAIL — module not found

- [ ] **Step 3: Implement workflow-executor.js**

Create `app/lib/workflow-executor.js`:

```javascript
/**
 * Sequential workflow executor.
 * Iterates steps, manages rolling context, dispatches to type-specific handlers,
 * creates child action records for each step.
 */

import crypto from 'crypto';
import { resolveVars } from './template-vars.js';
import {
  handleKnowledgeSearch,
  handleCapabilityInvoke,
  handlePrompt,
} from './step-handlers.js';
import { createActionRecord } from './repositories/actions.repository.js';

const STEP_RISK_SCORES = {
  knowledge_search: 10,
  capability_invoke: 20,
  prompt: 20,
};

async function executeStep(sql, orgId, step, context, workflowContext) {
  const resolvedConfig = resolveVars(step.config || {}, context);

  switch (step.type) {
    case 'knowledge_search':
      return handleKnowledgeSearch(sql, orgId, resolvedConfig);
    case 'capability_invoke':
      return handleCapabilityInvoke(sql, orgId, resolvedConfig);
    case 'prompt':
      return handlePrompt(sql, orgId, resolvedConfig, workflowContext);
    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

export async function executeWorkflow(
  sql,
  orgId,
  parentActionId,
  steps,
  variables,
  workflowContext,
) {
  const context = { variables: variables || {}, steps: {} };
  const stepResults = [];
  const start = Date.now();

  for (const step of steps) {
    const stepStart = Date.now();
    const stepActionId = `act_${crypto.randomUUID()}`;

    // Create child action record
    await createActionRecord(sql, {
      orgId,
      action_id: stepActionId,
      data: {
        agent_id: workflowContext.agentId || 'anonymous',
        action_type: `workflow_step:${step.type}`,
        declared_goal: `Step: ${step.name || step.id}`,
        parent_action_id: parentActionId,
        risk_score: STEP_RISK_SCORES[step.type] || 20,
        confidence: 50,
        systems_touched: [`workflow_step:${step.type}`],
        reversible: true,
        input_summary: JSON.stringify(resolveVars(step.config || {}, context)).slice(0, 500),
      },
      actionStatus: 'running',
      costEstimate: 0,
      signature: null,
      verified: false,
      timestamp_start: new Date().toISOString(),
    });

    try {
      const output = await executeStep(sql, orgId, step, context, workflowContext);
      const stepElapsed = Date.now() - stepStart;

      // Update child action to completed
      await sql`
        UPDATE action_records
        SET status = 'completed',
            output_summary = ${JSON.stringify(output).slice(0, 500)},
            timestamp_end = ${new Date().toISOString()},
            duration_ms = ${stepElapsed}
        WHERE action_id = ${stepActionId} AND org_id = ${orgId}
      `;

      // Add to rolling context
      context.steps[step.id] = { output };

      stepResults.push({
        step_id: step.id,
        type: step.type,
        status: 'completed',
        elapsed_ms: stepElapsed,
      });
    } catch (err) {
      const stepElapsed = Date.now() - stepStart;

      // Update child action to failed
      await sql`
        UPDATE action_records
        SET status = 'failed',
            error_message = ${err.message.slice(0, 500)},
            timestamp_end = ${new Date().toISOString()},
            duration_ms = ${stepElapsed}
        WHERE action_id = ${stepActionId} AND org_id = ${orgId}
      `;

      stepResults.push({
        step_id: step.id,
        type: step.type,
        status: 'failed',
        error: err.message,
        elapsed_ms: stepElapsed,
      });

      // Stop on first failure
      return {
        success: false,
        steps: stepResults,
        error: `Step ${step.id} failed: ${err.message}`,
        total_elapsed_ms: Date.now() - start,
      };
    }
  }

  // All steps completed — return final step output as result
  const lastStepId = steps[steps.length - 1].id;
  const result = context.steps[lastStepId]?.output || {};

  return {
    success: true,
    steps: stepResults,
    result,
    total_elapsed_ms: Date.now() - start,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd "C:\Projects\DashClaw" && npx vitest run __tests__/unit/workflow-executor.test.js`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
cd "C:\Projects\DashClaw"
git add app/lib/workflow-executor.js __tests__/unit/workflow-executor.test.js
git commit -m "feat(workflows): add sequential workflow executor

Iterates steps, manages rolling context, dispatches to type handlers,
creates child action records per step. Stops on first failure with
partial results preserved."
```

---

## Task 4: Execute API Route

**Files:**
- Create: `app/api/workflows/templates/[templateId]/execute/route.js`

- [ ] **Step 1: Create the execute route**

Create `app/api/workflows/templates/[templateId]/execute/route.js`:

```javascript
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSql } from '../../../../../lib/db.js';
import { getOrgId } from '../../../../../lib/org.js';
import { apiErrorResponse } from '../../../../../lib/apiErrors.js';
import { evaluateGuard } from '../../../../../lib/guard.js';
import { getWorkflowTemplate } from '../../../../../lib/repositories/workflow-templates.repository.js';
import { getModelStrategy } from '../../../../../lib/repositories/model-strategies.repository.js';
import {
  createActionRecord,
  createBlockedActionRecord,
} from '../../../../../lib/repositories/actions.repository.js';
import { scanSensitiveData } from '../../../../../lib/security.js';
import { executeWorkflow } from '../../../../../lib/workflow-executor.js';

function redactAny(value, findings) {
  if (typeof value === 'string') {
    const scan = scanSensitiveData(value);
    if (!scan.clean) findings.push(...scan.findings);
    return scan.redacted;
  }
  if (Array.isArray(value)) return value.map((v) => redactAny(v, findings));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactAny(v, findings);
    return out;
  }
  return value;
}

export async function POST(request, { params }) {
  try {
    const { templateId } = await params;
    const sql = getSql();
    const orgId = getOrgId(request);
    const body = await request.json();

    // 1. Load workflow template
    const template = await getWorkflowTemplate(sql, orgId, templateId);
    if (!template) {
      return NextResponse.json(
        { success: false, error: 'workflow_not_found' },
        { status: 404 },
      );
    }

    const steps = template.steps || [];
    if (steps.length === 0) {
      return NextResponse.json(
        { success: false, error: 'workflow_has_no_steps' },
        { status: 400 },
      );
    }

    const action_id = `act_${crypto.randomUUID()}`;
    const timestamp_start = new Date().toISOString();
    const variables = body.variables || {};
    const agentId = body.agent_id || 'anonymous';

    // 2. Guard evaluation
    const guardDecision = await evaluateGuard(
      orgId,
      {
        action_type: 'workflow_execute',
        risk_score: 50,
        agent_id: agentId,
        systems_touched: [`workflow:${template.slug}`],
        reversible: true,
        declared_goal: body.declared_goal || `Execute workflow: ${template.name}`,
      },
      sql,
    );

    // 3. DLP scan
    const dlpFindings = [];
    const inputSummary = redactAny(
      JSON.stringify(variables).slice(0, 500),
      dlpFindings,
    );

    const actionData = {
      agent_id: agentId,
      action_type: 'workflow_execute',
      declared_goal: body.declared_goal || `Execute workflow: ${template.name}`,
      systems_touched: [`workflow:${template.slug}`],
      reversible: true,
      risk_score: 50,
      confidence: 50,
      input_summary: inputSummary,
      trigger: `workflow:${template.template_id}`,
    };

    // 4. Handle guard blocked
    if (guardDecision.decision === 'block') {
      await createBlockedActionRecord(sql, {
        orgId,
        action_id,
        data: actionData,
        guardDecision,
        signature: null,
        verified: false,
        timestamp_start,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'blocked_by_policy',
          guard_decision: {
            decision: guardDecision.decision,
            reasons: guardDecision.reasons || [],
            matched_policies: guardDecision.matched_policies || [],
          },
        },
        { status: 403 },
      );
    }

    // 5. Resolve model strategy (snapshot at launch)
    let strategyConfig = null;
    if (template.model_strategy_id) {
      const strategy = await getModelStrategy(sql, orgId, template.model_strategy_id);
      if (strategy) {
        strategyConfig = strategy.config;
      }
    }

    // 6. Create parent action record
    await createActionRecord(sql, {
      orgId,
      action_id,
      data: actionData,
      actionStatus: 'running',
      costEstimate: 0,
      signature: null,
      verified: false,
      timestamp_start,
    });

    // 7. Execute workflow
    const result = await executeWorkflow(
      sql,
      orgId,
      action_id,
      steps,
      variables,
      { strategyConfig, agentId },
    );

    // 8. Update parent action outcome
    const timestamp_end = new Date().toISOString();
    const reasoning = JSON.stringify({
      template_id: template.template_id,
      template_name: template.name,
      steps: result.steps,
    });
    const outputSummary = result.success
      ? JSON.stringify(result.result).slice(0, 500)
      : result.error;

    await sql`
      UPDATE action_records
      SET status = ${result.success ? 'completed' : 'failed'},
          output_summary = ${outputSummary},
          error_message = ${result.success ? null : result.error},
          reasoning = ${reasoning},
          timestamp_end = ${timestamp_end},
          duration_ms = ${result.total_elapsed_ms || 0}
      WHERE action_id = ${action_id} AND org_id = ${orgId}
    `;

    // 9. Return response
    const status = result.success ? 200 : 500;
    return NextResponse.json(
      {
        success: result.success,
        action_id,
        steps: result.steps,
        result: result.result || undefined,
        error: result.error || undefined,
        total_elapsed_ms: result.total_elapsed_ms,
        governed: true,
        security: {
          clean: dlpFindings.length === 0,
          findings_count: dlpFindings.length,
          critical_count: dlpFindings.filter((f) => f.severity === 'critical').length,
          categories: [...new Set(dlpFindings.map((f) => f.category))],
        },
      },
      { status },
    );
  } catch (error) {
    return apiErrorResponse(error, 'WORKFLOW_EXECUTE');
  }
}
```

- [ ] **Step 2: Verify lint**

Run: `cd "C:\Projects\DashClaw" && npm run lint`
Expected: No new errors (pre-existing warnings OK)

- [ ] **Step 3: Commit**

```bash
cd "C:\Projects\DashClaw"
git add "app/api/workflows/templates/[templateId]/execute/route.js"
git commit -m "feat(workflows): add POST /api/workflows/templates/:id/execute endpoint

Synchronous workflow execution with 120s max duration. Guard on launch,
parent/child action records, model strategy snapshot, DLP scanning.
Returns step-by-step results with governed audit trail."
```

---

## Task 5: Integration Verification

- [ ] **Step 1: Run all new tests**

Run: `cd "C:\Projects\DashClaw" && npx vitest run __tests__/unit/template-vars.test.js __tests__/unit/workflow-executor.test.js __tests__/unit/mapping.test.js __tests__/unit/capability-invoke.test.js`
Expected: All tests pass (template-vars + workflow-executor + mapping + capability-invoke)

- [ ] **Step 2: Run lint**

Run: `cd "C:\Projects\DashClaw" && npm run lint`
Expected: No new errors

- [ ] **Step 3: Verify commit history**

Run: `cd "C:\Projects\DashClaw" && git log --oneline -5`
Expected: 4 new commits (Tasks 1-4)

- [ ] **Step 4: Verify working tree is clean**

Run: `cd "C:\Projects\DashClaw" && git status --short`

---

## Summary

| Task | What | Files | Commits |
|------|------|-------|---------|
| 1 | Variable substitution engine | 2 (impl + test) | 1 |
| 2 | Step handlers | 1 | 1 |
| 3 | Workflow executor | 2 (impl + test) | 1 |
| 4 | Execute API route | 1 | 1 |
| 5 | Integration verification | 0 | 0 |
| **Total** | | **6 files** | **4 commits** |
