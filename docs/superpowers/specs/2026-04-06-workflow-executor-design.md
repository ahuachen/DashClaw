# Design Spec: Workflow Execution Engine

**Date:** 2026-04-06
**Status:** Approved
**Scope:** Sequential workflow executor for DashClaw Execution Studio — takes a workflow template's steps_json and runs each step as a governed action.

---

## 1. Overview

DashClaw's Execution Studio has workflow templates with visual authoring and step definitions, but no execution engine. This spec adds a sequential executor that runs workflow steps end-to-end, with each step creating a governed child action record. Three step types are supported: `prompt` (LLM completion via model strategy), `capability_invoke` (call an HTTP capability), and `knowledge_search` (search a knowledge collection).

**Goal:** `POST /api/workflows/templates/:templateId/execute` takes variables, runs all steps sequentially, and returns the final result — fully governed, every step auditable.

---

## 2. Architecture

```
Caller (SDK / API / UI)
    |
    |  POST /api/workflows/templates/:templateId/execute
    |  { "agent_id": "...", "variables": { "query": "..." } }
    |
    v
Execute Route
    |
    |-- 1. Load workflow template
    |-- 2. Guard evaluation (action_type: "workflow_execute")
    |-- 3. Create parent action record (status: "running")
    |-- 4. Resolve linked model strategy (snapshot at launch)
    |-- 5. Pass to Workflow Executor
    |
    v
Workflow Executor
    |
    |-- For each step in steps_json (sequential):
    |     |
    |     |-- Resolve variables in step config
    |     |-- Build step context (variables + previous outputs)
    |     |-- Create child action record (parent_action_id = workflow action)
    |     |-- Execute step by type:
    |     |     |-- "prompt" -> call executeCompletion with model strategy
    |     |     |-- "capability_invoke" -> call invokeCapability
    |     |     |-- "knowledge_search" -> call knowledge search
    |     |-- Update child action outcome
    |     |-- Add output to rolling context
    |     |-- If failed -> stop, mark workflow failed
    |
    |-- Update parent action outcome (completed/failed)
    |-- Return result
```

**Key design decisions:**
- Sequential execution — steps run one at a time, each building on previous output
- Rolling context — each step's output is accumulated and available to subsequent steps
- Parent/child actions — workflow is the parent, each step is a child linked via `parent_action_id`
- Guard on launch only — capability_invoke steps get guarded automatically via the invoke endpoint
- Synchronous — blocks until complete, 120s max timeout on the route
- Stop on first failure — partial results preserved in child action records
- Internal calls — executor calls existing library functions directly, except capability_invoke which goes through the invoke engine (already has guard built in)
- No database schema changes — uses existing action_records table

---

## 3. Execute Endpoint

**Route:** `POST /api/workflows/templates/:templateId/execute`

**Max duration:** 120 seconds (set via `export const maxDuration = 120`)

### Request

```json
{
  "agent_id": "my-agent",
  "variables": {
    "query": "What is x402 and how does it work?",
    "budget": 0.25
  }
}
```

`variables` is free-form JSON injected into step configs via variable substitution. `agent_id` is optional (defaults to "anonymous").

### Response: Success (200)

```json
{
  "success": true,
  "action_id": "act_abc123",
  "steps": [
    { "step_id": "step_1", "type": "knowledge_search", "status": "completed", "elapsed_ms": 200 },
    { "step_id": "step_2", "type": "capability_invoke", "status": "completed", "elapsed_ms": 4100 },
    { "step_id": "step_3", "type": "prompt", "status": "completed", "elapsed_ms": 1800 }
  ],
  "result": { "synthesis": "x402 is a payment protocol..." },
  "total_elapsed_ms": 6100,
  "governed": true
}
```

`result` is the output of the final step. `steps` shows execution summary per step.

### Response: Partial Failure (500)

```json
{
  "success": false,
  "action_id": "act_abc123",
  "steps": [
    { "step_id": "step_1", "type": "knowledge_search", "status": "completed", "elapsed_ms": 200 },
    { "step_id": "step_2", "type": "capability_invoke", "status": "failed", "error": "capability_timeout" }
  ],
  "error": "Step step_2 failed: capability_timeout",
  "total_elapsed_ms": 60200,
  "governed": true
}
```

Execution stops at the first failed step. Completed steps' action records remain.

### Response: Guard Blocked (403)

```json
{
  "success": false,
  "error": "blocked_by_policy",
  "guard_decision": {
    "decision": "block",
    "reasons": [],
    "matched_policies": []
  }
}
```

### Response: Template Not Found (404)

```json
{
  "success": false,
  "error": "workflow_not_found"
}
```

### Response: No Steps (400)

```json
{
  "success": false,
  "error": "workflow_has_no_steps"
}
```

---

## 4. Step Types

Each step in `steps_json` has this shape:

```json
{
  "id": "step_1",
  "type": "knowledge_search",
  "name": "Search deployment docs",
  "config": {
    "collection_id": "kc_abc123",
    "query": "${variables.query}",
    "top_k": 5
  }
}
```

### 4.1 `knowledge_search`

Searches a linked knowledge collection. Calls the existing knowledge repository search function directly (no HTTP round-trip).

**Config fields:**
- `collection_id` (string, required) — which knowledge collection to search
- `query` (string, required) — search query, supports variable substitution
- `top_k` (number, optional, default 5) — number of chunks to return

**Output shape:**
```json
{
  "chunks": [
    { "content": "...", "similarity": 0.92, "source_uri": "..." },
    { "content": "...", "similarity": 0.87, "source_uri": "..." }
  ],
  "query": "What is x402?"
}
```

**Guard:** None (internal read-only operation).

### 4.2 `capability_invoke`

Invokes an HTTP capability through the invoke engine built in Phase 1B.

**Config fields:**
- `capability_id` (string, required) — which capability to invoke
- `body` (object, required) — request body to send, supports variable substitution in values

**Output shape:** Whatever the capability returns after response_mapping. For the research agent:
```json
{
  "answer": "x402 is a payment protocol...",
  "sources": [...],
  "confidence": 0.85,
  "elapsed_ms": 4100
}
```

**Guard:** Yes — handled automatically by the invoke engine (guard is built into `POST /api/capabilities/:id/invoke`). If the capability is blocked by guard, the step fails and execution stops.

### 4.3 `prompt`

Calls an LLM via the workflow's linked model strategy. Builds prompt from a template with context injection.

**Config fields:**
- `prompt_template` (string, required) — the prompt text with variable/context placeholders
- `system_prompt` (string, optional) — system message
- `max_tokens` (number, optional, default 1024)
- `temperature` (number, optional, default 0.3)

**Output shape:**
```json
{
  "text": "Based on the research and documentation...",
  "tokens_in": 1500,
  "tokens_out": 800
}
```

**Guard:** None (internal LLM call via existing model strategy, no external side effects).

**Context injection:** The `prompt_template` can reference previous step outputs:
```
Based on the following research:
${steps.step_2.output.answer}

And the following documentation:
${steps.step_1.output.chunks[0].content}

Synthesize a comprehensive answer to: ${variables.query}
```

---

## 5. Variable Substitution

A simple template engine resolves `${}` patterns in step config strings before execution.

**Supported patterns:**
- `${variables.query}` — from the execute request's variables object
- `${variables.budget}` — nested variable access
- `${steps.step_1.output.answer}` — output from a previous step
- `${steps.step_1.output.chunks[0].content}` — array index access in step output

**Resolution rules:**
- Dot-path traversal into nested objects
- Array index access via `[N]` syntax
- If a path resolves to `undefined`, the placeholder is left as-is (not replaced with empty string) — this helps catch config errors
- Substitution happens on string values only. Non-string config values (numbers, booleans, objects) are passed through as-is.
- Entire string is a variable (e.g., `"${variables.budget}"` where budget=0.25) → resolved to the original type (number), not stringified

---

## 6. Rolling Context

The executor maintains a context object that grows as steps complete:

```javascript
const context = {
  variables: { query: "What is x402?", budget: 0.25 },
  steps: {}
};

// After step_1 completes:
context.steps.step_1 = { output: { chunks: [...], query: "..." } };

// After step_2 completes:
context.steps.step_2 = { output: { answer: "...", sources: [...] } };

// step_3's config can reference any of the above
```

The context is passed to the variable substitution engine before each step executes. This is how steps chain together — each step can reference any previous step's output.

---

## 7. Action Records

### Parent Action (workflow execution)

| Field | Value |
|-------|-------|
| `action_type` | `workflow_execute` |
| `declared_goal` | `Execute workflow: {template.name}` |
| `risk_score` | 50 (medium — workflow execution is a composite action) |
| `systems_touched` | `["workflow:{template.slug}"]` |
| `input_summary` | First 500 chars of variables JSON |
| `status` | `running` → `completed` or `failed` |
| `output_summary` | First 500 chars of final step output |
| `reasoning` | JSON: `{ steps: [{id, type, status, elapsed_ms}], template_id }` |
| `duration_ms` | Total execution time |

### Child Actions (per step)

| Field | Value |
|-------|-------|
| `action_type` | `workflow_step:{step.type}` (e.g., `workflow_step:prompt`) |
| `declared_goal` | `Step: {step.name}` |
| `parent_action_id` | The parent workflow action_id |
| `risk_score` | 10 for knowledge_search, 20 for prompt, inherits from capability for capability_invoke |
| `input_summary` | First 500 chars of resolved step config |
| `status` | `running` → `completed` or `failed` |
| `output_summary` | First 500 chars of step output |
| `duration_ms` | Step execution time |

Child actions with `parent_action_id` set are already visible in DashClaw's Decision Replay execution graph — no UI changes needed.

---

## 8. Error Handling

**Step failure:** If any step fails (capability timeout, LLM error, knowledge search error), execution stops. The failed step's action record is marked `failed` with `error_message`. The parent workflow action is also marked `failed`. Completed steps' records remain intact.

**Variable substitution failure:** If a required variable or step output is missing, the unresolved placeholder is left in the string. The step may then fail naturally (e.g., a prompt with literal `${variables.query}` text, or a capability getting an invalid request). This fails loudly rather than silently.

**Template not found:** 404 before any execution.

**No steps in template:** 400 before any execution.

**Guard blocks workflow:** 403, parent action recorded as blocked, no steps execute.

**Overall timeout:** The route has a 120s maxDuration. If execution exceeds this, Vercel terminates the function. Steps that completed before timeout have their action records. The parent action remains in `running` state (the signals system's "stale running" detection will catch this and fire an alert).

---

## 9. Files Changed

| File | Action | Responsibility |
|------|--------|---------------|
| `app/lib/template-vars.js` | Create | Variable substitution engine — resolves `${variables.x}` and `${steps.step_1.output.y}` |
| `app/lib/step-handlers.js` | Create | Step type handlers — one function per type (knowledge_search, capability_invoke, prompt) |
| `app/lib/workflow-executor.js` | Create | Core executor — iterates steps, manages context, dispatches to handlers, tracks outcomes |
| `app/api/workflows/templates/[templateId]/execute/route.js` | Create | Execute endpoint — guard, parent action, call executor, return result |
| `__tests__/unit/template-vars.test.js` | Create | Tests for variable substitution |
| `__tests__/unit/workflow-executor.test.js` | Create | Tests for executor with mocked step handlers |

**No database schema changes.** Uses existing `action_records` table.

**No changes to existing files.** Calls existing functions from `providers.js`, `capability-invoke.js`, and knowledge repository.

**Estimated scope:** ~350 lines of new code across 6 files.

---

## 10. Success Criteria

- [ ] `POST /api/workflows/templates/:id/execute` runs all steps sequentially
- [ ] Each step creates a child action record with `parent_action_id` linking to the workflow
- [ ] `knowledge_search` steps search collections and return chunks
- [ ] `capability_invoke` steps call the invoke engine (with guard automatically)
- [ ] `prompt` steps call model strategy completion with context injection
- [ ] Variable substitution resolves `${variables.x}` and `${steps.step_id.output.y}`
- [ ] Rolling context passes each step's output to subsequent steps
- [ ] Execution stops on first step failure, partial results preserved
- [ ] Parent workflow action marked completed/failed with step summary in reasoning
- [ ] Guard evaluates workflow launch (action_type: workflow_execute)
- [ ] Guard-blocked workflows return 403 with decision details
- [ ] Decision Replay shows workflow → step parent/child chain (via existing execution graph)
- [ ] Route has 120s maxDuration for Vercel
