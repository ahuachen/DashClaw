# Design Spec: fixitfor-me DashClaw Integration

**Date:** 2026-04-06
**Status:** Approved
**Scope:** Replace fixitfor-me's local solver pipeline with DashClaw workflow execution. fixitfor-me becomes a thin frontend proving DashClaw can power consumer products.

---

## 1. Overview

fixitfor-me is a no-code solution platform where users describe problems and receive working solutions. Currently it runs a 5-stage solver pipeline locally. This spec replaces that pipeline with a DashClaw workflow — every stage becomes a governed workflow step, the research stage uses DashClaw's research agent capability, and the full execution is auditable in DashClaw's Mission Control.

**Goal:** "Describe your problem. DashClaw's governed agents research, plan, build, and deliver a solution — every step auditable, human-approved."

---

## 2. Architecture

```
User submits problem on fixitfor.me
    |
    v
fixitfor-me creates problem in SQLite (status: "clarifying")
    |
    v
User answers clarifying questions
    |
    v
fixitfor-me calls POST /api/workflows/templates/:id/execute on DashClaw
    |  variables: { description, category, answers, complexity }
    |
    v
DashClaw Workflow Executor runs 5 steps:
    Step 1: prompt (understand) - categorize + extract requirements
    Step 2: capability_invoke (research) - research agent investigates
    Step 3: prompt (plan) - create execution plan from research
    Step 4: prompt (execute) - generate solution artifacts
    Step 5: prompt (package) - format user-friendly summary
    |
    v
fixitfor-me receives result, stores in SQLite (status: "review")
    |  Saves dashclaw_action_id for audit trail link
    |  Telegram notification to admin
    |
    v
Admin reviews in fixitfor-me dashboard
    |  Can view full audit trail via DashClaw link
    |
    v
Admin approves -> fixitfor-me records approval action in DashClaw
    |  Problem status -> "delivered"
    |
    v
User sees solution with walkthrough steps
```

**Key decisions:**
- fixitfor-me is a thin frontend; DashClaw runs the entire pipeline
- SQLite for user-facing state (problems, revisions, events), DashClaw for execution/governance
- One workflow template with 5 sequential steps (4 prompt + 1 capability_invoke)
- Delivery gated by admin approval in fixitfor-me (not workflow-level HITL)
- Approval recorded as separate governed action in DashClaw for audit trail
- `dashclaw_action_id` column on problems table links problem to full execution trace

---

## 3. Workflow Template

A "FixItFor.me Solver" workflow template seeded in DashClaw with 5 steps:

### Step 1: Understand (prompt)
```json
{
  "id": "understand",
  "type": "prompt",
  "name": "Understand Problem",
  "config": {
    "system_prompt": "You are a problem analyst. Categorize the user's problem, extract requirements, and determine complexity. Output JSON with: category (spreadsheet|website|automation|integration|custom), requirements (array of strings), complexity (simple|medium|complex), summary (one sentence).",
    "prompt_template": "Problem: ${variables.description}\n\nCategory hint: ${variables.category}\n\nUser's answers to clarifying questions:\n${variables.answers}",
    "max_tokens": 1024,
    "temperature": 0.3
  }
}
```

### Step 2: Research (capability_invoke)
```json
{
  "id": "research",
  "type": "capability_invoke",
  "name": "Research Approach",
  "config": {
    "capability_id": "${variables.research_capability_id}",
    "body": {
      "query": "How to build a ${variables.category} solution for: ${variables.description}",
      "budget": 0.25
    }
  }
}
```

### Step 3: Plan (prompt)
```json
{
  "id": "plan",
  "type": "prompt",
  "name": "Create Execution Plan",
  "config": {
    "system_prompt": "You are a solution planner. Based on the problem analysis and research, create a concrete execution plan. Output JSON with: steps (array of {title, description}), deliverables (array of strings), estimated_time (string), approach (string).",
    "prompt_template": "Problem: ${variables.description}\n\nAnalysis: ${steps.understand.output.text}\n\nResearch findings: ${steps.research.output.answer}\n\nSources: ${steps.research.output.sources}",
    "max_tokens": 1024,
    "temperature": 0.3
  }
}
```

### Step 4: Execute (prompt)
```json
{
  "id": "execute",
  "type": "prompt",
  "name": "Build Solution",
  "config": {
    "system_prompt": "You are a solution builder. Based on the plan, generate the actual solution artifacts. For spreadsheets: output column definitions and formulas. For websites: output HTML/CSS. For automation: output workflow steps. For integrations: output API configuration. Output JSON with: artifacts (array of {type, name, content}), instructions (array of strings).",
    "prompt_template": "Problem: ${variables.description}\nCategory: ${variables.category}\n\nPlan: ${steps.plan.output.text}\n\nResearch: ${steps.research.output.answer}\n\nBuild the solution now.",
    "max_tokens": 2048,
    "temperature": 0.2
  }
}
```

### Step 5: Package (prompt)
```json
{
  "id": "package",
  "type": "prompt",
  "name": "Package for Delivery",
  "config": {
    "system_prompt": "You are a delivery specialist. Package the solution for a non-technical user. No jargon, no AI terminology. Output JSON with: summary (friendly 2-3 sentence description), walkthrough (array of {title, description} steps the user follows), deliverable_descriptions (array of {name, description} explaining each artifact).",
    "prompt_template": "Original problem: ${variables.description}\n\nSolution artifacts: ${steps.execute.output.text}\n\nInstructions: ${steps.execute.output.text}\n\nPackage this for a non-technical user who just wants their problem solved.",
    "max_tokens": 1024,
    "temperature": 0.4
  }
}
```

---

## 4. fixitfor-me Changes

### Files Removed
- `src/lib/solver/understand.ts` — replaced by workflow step 1
- `src/lib/solver/research.ts` — replaced by workflow step 2
- `src/lib/solver/plan.ts` — replaced by workflow step 3
- `src/lib/solver/execute.ts` — replaced by workflow step 4
- `src/lib/solver/package.ts` — replaced by workflow step 5

### Files Modified

**`src/lib/solver/index.ts`** — Complete rewrite. Instead of running 5 local stages, calls DashClaw:

```typescript
export async function solveProblem(problem: Problem, answers: string): Promise<SolveResult> {
  const dashclaw = getDashClawClient();
  
  const result = await dashclaw.executeWorkflow(SOLVER_TEMPLATE_ID, {
    description: problem.description,
    category: problem.category || 'custom',
    answers: answers,
    complexity: problem.complexity || 'medium',
    research_capability_id: RESEARCH_CAPABILITY_ID,
  });

  return {
    dashclaw_action_id: result.action_id,
    understand: parseJSON(result.steps[0]),
    research: result.steps[1],
    plan: parseJSON(result.steps[2]),
    execute: parseJSON(result.steps[3]),
    package: parseJSON(result.steps[4]),
    success: result.success,
  };
}
```

**`src/lib/db.ts`** — Add `dashclaw_action_id` column to problems table:
```sql
ALTER TABLE problems ADD COLUMN dashclaw_action_id TEXT;
```

**`src/app/api/problems/[id]/clarify/route.ts`** — After saving answers, trigger DashClaw workflow instead of local pipeline. Update problem with `dashclaw_action_id`.

**`src/app/api/admin/problems/[id]/approve/route.ts`** — On approval, also record a governed action in DashClaw:
```typescript
await dashclaw.createAction({
  action_type: 'fixitforme_approve',
  declared_goal: `Approve solution for problem ${problemId}`,
  risk_score: 30,
});
```

**`src/app/admin/page.tsx`** — Add "View in DashClaw" link next to each problem that has a `dashclaw_action_id`, linking to DashClaw's Decision Replay.

### Files Created

**`src/lib/dashclaw.ts`** — DashClaw HTTP client:
```typescript
export function getDashClawClient() {
  return {
    executeWorkflow: (templateId, variables) => fetch(...),
    createAction: (data) => fetch(...),
  };
}
```

Reads `DASHCLAW_URL` and `DASHCLAW_API_KEY` from environment.

### Environment Variables Added
```
DASHCLAW_URL=https://your-dashclaw.vercel.app
DASHCLAW_API_KEY=dc_live_xxx
DASHCLAW_SOLVER_TEMPLATE_ID=wft_xxx
DASHCLAW_RESEARCH_CAPABILITY_ID=cap_xxx
```

---

## 5. DashClaw Changes

**One new file:** `scripts/seed-fixitforme-workflow.js`

Seeds the "FixItFor.me Solver" workflow template with 5 steps (from Section 3) into DashClaw. Links the workflow to the research agent capability and a model strategy. Idempotent.

No other DashClaw code changes needed — everything uses existing APIs (workflow execute, capability invoke, action create).

---

## 6. Data Flow

**Problem lifecycle with DashClaw:**

| State | fixitfor-me SQLite | DashClaw |
|-------|-------------------|----------|
| User submits | `problems` row created, status=clarifying | Nothing yet |
| User answers | Answers stored on problem | Nothing yet |
| Pipeline starts | status=working | Workflow execute creates parent action (running) + 5 child actions |
| Pipeline completes | status=review, stores result + dashclaw_action_id | Parent action completed, all steps have outputs |
| Admin approves | status=delivered | Approval action created |
| User requests revision | `revisions` row created, status=revision | Revision action created |

**Tracing:** Every problem has a `dashclaw_action_id` that links to the parent workflow action in DashClaw. From there, Decision Replay shows all 5 steps, their inputs/outputs, the research agent's sources, and the approval.

---

## 7. Files Changed Summary

### fixitfor-me (`C:\Users\sandm\Projects\fixitfor-me`)

| File | Action |
|------|--------|
| `src/lib/solver/understand.ts` | Remove |
| `src/lib/solver/research.ts` | Remove |
| `src/lib/solver/plan.ts` | Remove |
| `src/lib/solver/execute.ts` | Remove |
| `src/lib/solver/package.ts` | Remove |
| `src/lib/solver/index.ts` | Rewrite — call DashClaw workflow |
| `src/lib/dashclaw.ts` | Create — DashClaw HTTP client |
| `src/lib/db.ts` | Modify — add dashclaw_action_id column |
| `src/app/api/problems/[id]/clarify/route.ts` | Modify — trigger DashClaw workflow |
| `src/app/api/admin/problems/[id]/approve/route.ts` | Modify — record approval in DashClaw |
| `src/app/admin/page.tsx` | Modify — add DashClaw audit trail link |
| `.env.example` | Modify — add DASHCLAW_* vars |

### DashClaw (`C:\Projects\DashClaw`)

| File | Action |
|------|--------|
| `scripts/seed-fixitforme-workflow.js` | Create — seed workflow template |

---

## 8. Success Criteria

- [ ] fixitfor-me problem submission triggers DashClaw workflow execution
- [ ] All 5 solver stages run as DashClaw workflow steps
- [ ] Research stage invokes the research agent capability through DashClaw
- [ ] Problem records link to DashClaw action_id for audit trail
- [ ] Admin approval recorded as governed action in DashClaw
- [ ] Admin dashboard shows "View in DashClaw" link for each problem
- [ ] Full execution trace visible in DashClaw Decision Replay
- [ ] fixitfor-me works without DashClaw (graceful degradation if DASHCLAW_URL not set — falls back to error message, not local pipeline)
- [ ] No changes to fixitfor-me's user-facing UI (landing page, problem status, admin dashboard look the same)
- [ ] Solver pipeline files removed (no dead code)
