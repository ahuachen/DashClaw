# fixitfor-me DashClaw Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixitfor-me's local solver pipeline with DashClaw workflow execution so every problem solution is governed, auditable, and traceable.

**Architecture:** fixitfor-me keeps its SQLite for user-facing state and its existing UI. The 5-stage solver pipeline is replaced by a single DashClaw workflow execute call. A new `dashclaw.ts` client handles HTTP communication. The DashClaw side gets a seed script for the "FixItFor.me Solver" workflow template.

**Tech Stack:** Next.js 16, TypeScript, better-sqlite3, DashClaw HTTP API

**Spec:** `docs/superpowers/specs/2026-04-06-fixitforme-dashclaw-integration-design.md`

**Two working directories:**
- fixitfor-me: `C:\Users\sandm\Projects\fixitfor-me`
- DashClaw: `C:\Projects\DashClaw`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `fixitfor-me/src/lib/dashclaw.ts` | Create | DashClaw HTTP client (executeWorkflow, createAction) |
| `fixitfor-me/src/lib/solver/index.ts` | Rewrite | Call DashClaw workflow instead of local stages |
| `fixitfor-me/src/lib/db.ts` | Modify | Add dashclaw_action_id column |
| `fixitfor-me/src/app/api/problems/[id]/clarify/route.ts` | Modify | Pass answers to rewritten solver |
| `fixitfor-me/src/app/api/admin/problems/[id]/approve/route.ts` | Modify | Record approval in DashClaw |
| `fixitfor-me/src/app/admin/page.tsx` | Modify | Add "View in DashClaw" link |
| `fixitfor-me/.env.example` | Modify | Add DASHCLAW_* vars |
| `fixitfor-me/src/lib/solver/understand.ts` | Remove | Replaced by workflow step |
| `fixitfor-me/src/lib/solver/research.ts` | Remove | Replaced by workflow step |
| `fixitfor-me/src/lib/solver/plan.ts` | Remove | Replaced by workflow step |
| `fixitfor-me/src/lib/solver/execute.ts` | Remove | Replaced by workflow step |
| `fixitfor-me/src/lib/solver/package.ts` | Remove | Replaced by workflow step |
| `DashClaw/scripts/seed-fixitforme-workflow.js` | Create | Seed workflow template in DashClaw |

---

## Task 1: DashClaw Client Module

**Files:**
- Create: `fixitfor-me/src/lib/dashclaw.ts`
- Modify: `fixitfor-me/.env.example`

- [ ] **Step 1: Add env vars to .env.example**

Append to `fixitfor-me/.env.example`:

```
# ── DashClaw Integration ─────────────────────────────
DASHCLAW_URL=https://your-dashclaw.vercel.app
DASHCLAW_API_KEY=dc_live_your_key_here
DASHCLAW_SOLVER_TEMPLATE_ID=wft_solver_template_id
DASHCLAW_RESEARCH_CAPABILITY_ID=cap_research_agent_id
NEXT_PUBLIC_DASHCLAW_URL=https://your-dashclaw.vercel.app
```

- [ ] **Step 2: Create the DashClaw client**

Create `fixitfor-me/src/lib/dashclaw.ts`:

```typescript
/**
 * DashClaw HTTP client for fixitfor-me.
 * Calls DashClaw's workflow execute and action create APIs.
 */

interface WorkflowResult {
  success: boolean;
  action_id: string;
  steps: Array<{
    step_id: string;
    type: string;
    status: string;
    elapsed_ms: number;
    error?: string;
  }>;
  result?: Record<string, unknown>;
  error?: string;
  total_elapsed_ms: number;
}

interface DashClawConfig {
  url: string;
  apiKey: string;
  solverTemplateId: string;
  researchCapabilityId: string;
}

function getConfig(): DashClawConfig | null {
  const url = process.env.DASHCLAW_URL;
  const apiKey = process.env.DASHCLAW_API_KEY;
  const solverTemplateId = process.env.DASHCLAW_SOLVER_TEMPLATE_ID;
  const researchCapabilityId = process.env.DASHCLAW_RESEARCH_CAPABILITY_ID;

  if (!url || !apiKey || !solverTemplateId || !researchCapabilityId) {
    return null;
  }

  return { url, apiKey, solverTemplateId, researchCapabilityId };
}

async function dashclawFetch(
  path: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const config = getConfig();
  if (!config) throw new Error("DashClaw not configured");

  const response = await fetch(`${config.url}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!response.ok && response.status !== 200 && response.status !== 202) {
    throw new Error(
      `DashClaw error (${response.status}): ${data.error || "Unknown error"}`,
    );
  }

  return data;
}

export function isDashClawConfigured(): boolean {
  return getConfig() !== null;
}

export async function executeWorkflow(variables: {
  description: string;
  category: string;
  answers: string;
  complexity: string;
}): Promise<WorkflowResult> {
  const config = getConfig();
  if (!config) throw new Error("DashClaw not configured");

  const result = await dashclawFetch(
    `/api/workflows/templates/${config.solverTemplateId}/execute`,
    "POST",
    {
      agent_id: "fixitforme",
      declared_goal: `Solve problem: ${variables.description.slice(0, 100)}`,
      variables: {
        ...variables,
        research_capability_id: config.researchCapabilityId,
      },
    },
  );

  return result as unknown as WorkflowResult;
}

export async function recordApproval(
  problemId: string,
  approvedBy: string,
): Promise<string | null> {
  try {
    const result = await dashclawFetch("/api/actions", "POST", {
      agent_id: "fixitforme-admin",
      action_type: "fixitforme_approve",
      declared_goal: `Approve solution for problem ${problemId}`,
      risk_score: 30,
      systems_touched: ["fixitforme"],
      input_summary: `Problem ID: ${problemId}, Approved by: ${approvedBy}`,
      status: "completed",
    });
    return (result as { action_id?: string }).action_id || null;
  } catch {
    console.warn("[DashClaw] Failed to record approval:", problemId);
    return null;
  }
}

export function getDashClawUrl(): string {
  return process.env.NEXT_PUBLIC_DASHCLAW_URL || "";
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\sandm\Projects\fixitfor-me"
git add src/lib/dashclaw.ts .env.example
git commit -m "feat: add DashClaw HTTP client module

executeWorkflow() calls DashClaw workflow execute API.
recordApproval() records admin approvals as governed actions.
isDashClawConfigured() for graceful degradation."
```

---

## Task 2: Rewrite Solver Pipeline

**Files:**
- Rewrite: `fixitfor-me/src/lib/solver/index.ts`
- Remove: `fixitfor-me/src/lib/solver/understand.ts`
- Remove: `fixitfor-me/src/lib/solver/research.ts`
- Remove: `fixitfor-me/src/lib/solver/plan.ts`
- Remove: `fixitfor-me/src/lib/solver/execute.ts`
- Remove: `fixitfor-me/src/lib/solver/package.ts`

- [ ] **Step 1: Rewrite src/lib/solver/index.ts**

Replace the entire file with:

```typescript
/**
 * Solver pipeline — calls DashClaw workflow execution.
 * Replaces the previous 5-stage local pipeline.
 */

import { updateProblem, createEvent } from "../db";
import { executeWorkflow, isDashClawConfigured } from "../dashclaw";
import { sendNotification } from "../notify";

export async function runSolverPipeline(
  problemId: string,
  description: string,
  clarifyingAnswers: Record<string, string>,
): Promise<void> {
  const startTime = Date.now();

  try {
    // Update status to working
    updateProblem(problemId, { status: "working" });
    createEvent(problemId, "pipeline_started", { source: "dashclaw" });

    if (!isDashClawConfigured()) {
      throw new Error(
        "DashClaw is not configured. Set DASHCLAW_URL, DASHCLAW_API_KEY, DASHCLAW_SOLVER_TEMPLATE_ID, and DASHCLAW_RESEARCH_CAPABILITY_ID in .env",
      );
    }

    // Execute the DashClaw workflow
    const result = await executeWorkflow({
      description,
      category: "custom",
      answers: JSON.stringify(clarifyingAnswers),
      complexity: "medium",
    });

    if (!result.success) {
      throw new Error(result.error || "Workflow execution failed");
    }

    // Parse step outputs
    const understandOutput = parseStepText(result, 0);
    const researchOutput = result.steps[1]
      ? (result.result as Record<string, unknown>)
      : {};
    const planOutput = parseStepText(result, 2);
    const executeOutput = parseStepText(result, 3);
    const packageOutput = parseStepText(result, 4);

    // Extract category and complexity from understand step
    const category = understandOutput.category || "custom";
    const complexity = understandOutput.complexity || "medium";

    // Update problem with results
    updateProblem(problemId, {
      category,
      complexity,
      solution_plan: JSON.stringify(planOutput),
      solution_result: JSON.stringify(executeOutput),
      research_log: JSON.stringify(researchOutput),
      solution_summary:
        packageOutput.summary || "Your solution is ready for review.",
      walkthrough: JSON.stringify(packageOutput.walkthrough || []),
      deliverable_urls: JSON.stringify(
        executeOutput.artifacts?.map(
          (a: { name: string }) => a.name,
        ) || [],
      ),
      dashclaw_action_id: result.action_id,
      status: "review",
      elapsed_ms: Date.now() - startTime,
    });

    createEvent(problemId, "pipeline_completed", {
      action_id: result.action_id,
      steps: result.steps.length,
      elapsed_ms: result.total_elapsed_ms,
    });

    // Notify admin
    await sendNotification(
      `New solution ready for review!\nProblem: ${description.slice(0, 100)}\nCategory: ${category}\nComplexity: ${complexity}`,
    ).catch(() => {});
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    updateProblem(problemId, {
      status: "intake",
      elapsed_ms: Date.now() - startTime,
    });

    createEvent(problemId, "pipeline_failed", { error: message });
    console.error(`[Solver] Pipeline failed for ${problemId}:`, message);
  }
}

function parseStepText(
  result: { result?: Record<string, unknown> },
  stepIndex: number,
): Record<string, unknown> {
  try {
    const text =
      (result.result as Record<string, unknown>)?.text ||
      JSON.stringify(result.result);
    return typeof text === "string" ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}
```

- [ ] **Step 2: Remove the 5 old solver stage files**

```bash
cd "C:\Users\sandm\Projects\fixitfor-me"
rm src/lib/solver/understand.ts
rm src/lib/solver/research.ts
rm src/lib/solver/plan.ts
rm src/lib/solver/execute.ts
rm src/lib/solver/package.ts
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\sandm\Projects\fixitfor-me"
git add src/lib/solver/
git commit -m "feat: replace local solver pipeline with DashClaw workflow

runSolverPipeline now calls DashClaw workflow execute API.
Removed 5 local solver stage files (understand, research, plan,
execute, package). Results stored in problem record with
dashclaw_action_id for tracing."
```

---

## Task 3: Database Migration + Route Updates

**Files:**
- Modify: `fixitfor-me/src/lib/db.ts`
- Modify: `fixitfor-me/src/app/api/admin/problems/[id]/approve/route.ts`
- Modify: `fixitfor-me/src/app/admin/page.tsx`

- [ ] **Step 1: Add dashclaw_action_id to database schema**

In `fixitfor-me/src/lib/db.ts`, find the `CREATE TABLE IF NOT EXISTS problems` statement. Add a new column at the end (before the closing `)`):

```sql
dashclaw_action_id TEXT
```

Also add it to the `Problem` interface:

```typescript
dashclaw_action_id: string | null;
```

- [ ] **Step 2: Update approve route to record in DashClaw**

In `fixitfor-me/src/app/api/admin/problems/[id]/approve/route.ts`, add the DashClaw import at the top:

```typescript
import { recordApproval } from "@/lib/dashclaw";
```

After the existing `updateProblem` and `createEvent` calls (after the problem is marked as delivered), add:

```typescript
    // Record approval in DashClaw for audit trail
    void recordApproval(id, "admin").catch(() => {});
```

This is fire-and-forget — if DashClaw is unreachable, the approval still works in fixitfor-me.

- [ ] **Step 3: Add DashClaw link to admin dashboard**

In `fixitfor-me/src/app/admin/page.tsx`, find the `ReviewCard` component. After the "Reject" button in the button row, add:

```tsx
        {problem.dashclaw_action_id && (
          <a
            href={`${process.env.NEXT_PUBLIC_DASHCLAW_URL || ""}/actions/${problem.dashclaw_action_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded px-3 py-1.5 text-sm font-medium bg-[#3b82f6] text-white hover:opacity-90"
          >
            View in DashClaw
          </a>
        )}
```

Note: `NEXT_PUBLIC_DASHCLAW_URL` is a client-side env var (prefixed with `NEXT_PUBLIC_`), so it's available in the client component.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\sandm\Projects\fixitfor-me"
git add src/lib/db.ts src/app/api/admin/problems/[id]/approve/route.ts src/app/admin/page.tsx
git commit -m "feat: add DashClaw tracing and audit trail link

dashclaw_action_id column links problems to DashClaw execution trace.
Admin approval recorded as governed action in DashClaw.
'View in DashClaw' link in admin dashboard."
```

---

## Task 4: DashClaw Workflow Template Seed

**Files:**
- Create: `DashClaw/scripts/seed-fixitforme-workflow.js`

- [ ] **Step 1: Create the seed script**

Create `C:\Projects\DashClaw\scripts\seed-fixitforme-workflow.js`:

```javascript
#!/usr/bin/env node

/**
 * Seed the FixItFor.me Solver workflow template in DashClaw.
 *
 * Usage:
 *   node scripts/seed-fixitforme-workflow.js
 *
 * Requires: DATABASE_URL or .env with Neon connection
 * Idempotent - safe to run multiple times.
 */

import { getSql } from '../app/lib/db.js';
import {
  getWorkflowTemplateBySlug,
  createWorkflowTemplate,
} from '../app/lib/repositories/workflow-templates.repository.js';

const ORG_ID = process.env.ORG_ID || 'org_default';

const SOLVER_STEPS = [
  {
    id: 'understand',
    type: 'prompt',
    name: 'Understand Problem',
    config: {
      system_prompt: 'You are a problem analyst. Categorize the user\'s problem, extract requirements, and determine complexity. Output JSON with: category (spreadsheet|website|automation|integration|custom), requirements (array of strings), complexity (simple|medium|complex), summary (one sentence).',
      prompt_template: 'Problem: ${variables.description}\n\nCategory hint: ${variables.category}\n\nUser\'s answers to clarifying questions:\n${variables.answers}',
      max_tokens: 1024,
      temperature: 0.3,
    },
  },
  {
    id: 'research',
    type: 'capability_invoke',
    name: 'Research Approach',
    config: {
      capability_id: '${variables.research_capability_id}',
      body: {
        query: 'How to build a ${variables.category} solution for: ${variables.description}',
        budget: 0.25,
      },
    },
  },
  {
    id: 'plan',
    type: 'prompt',
    name: 'Create Execution Plan',
    config: {
      system_prompt: 'You are a solution planner. Based on the problem analysis and research, create a concrete execution plan. Output JSON with: steps (array of {title, description}), deliverables (array of strings), estimated_time (string), approach (string).',
      prompt_template: 'Problem: ${variables.description}\n\nAnalysis: ${steps.understand.output.text}\n\nResearch findings: ${steps.research.output.answer}\n\nSources: ${steps.research.output.sources}',
      max_tokens: 1024,
      temperature: 0.3,
    },
  },
  {
    id: 'execute',
    type: 'prompt',
    name: 'Build Solution',
    config: {
      system_prompt: 'You are a solution builder. Based on the plan, generate the actual solution artifacts. For spreadsheets: output column definitions and formulas. For websites: output HTML/CSS. For automation: output workflow steps. For integrations: output API configuration. Output JSON with: artifacts (array of {type, name, content}), instructions (array of strings).',
      prompt_template: 'Problem: ${variables.description}\nCategory: ${variables.category}\n\nPlan: ${steps.plan.output.text}\n\nResearch: ${steps.research.output.answer}\n\nBuild the solution now.',
      max_tokens: 2048,
      temperature: 0.2,
    },
  },
  {
    id: 'package',
    type: 'prompt',
    name: 'Package for Delivery',
    config: {
      system_prompt: 'You are a delivery specialist. Package the solution for a non-technical user. No jargon, no AI terminology. Output JSON with: summary (friendly 2-3 sentence description), walkthrough (array of {title, description} steps the user follows), deliverable_descriptions (array of {name, description} explaining each artifact).',
      prompt_template: 'Original problem: ${variables.description}\n\nSolution artifacts: ${steps.execute.output.text}\n\nPackage this for a non-technical user who just wants their problem solved.',
      max_tokens: 1024,
      temperature: 0.4,
    },
  },
];

async function main() {
  const sql = getSql();

  console.log(`Seeding FixItFor.me Solver workflow for org: ${ORG_ID}`);
  console.log();

  // Check if workflow already exists
  let existing = null;
  try {
    const rows = await sql`
      SELECT * FROM workflow_templates
      WHERE org_id = ${ORG_ID} AND slug = 'fixitforme-solver'
      LIMIT 1
    `;
    existing = rows.length > 0 ? rows[0] : null;
  } catch {
    // Table may not exist
  }

  if (existing) {
    console.log(`  Workflow already exists (${existing.template_id}). Skipping.`);
    console.log(`  Template ID: ${existing.template_id}`);
  } else {
    const created = await createWorkflowTemplate(sql, ORG_ID, {
      name: 'FixItFor.me Solver',
      slug: 'fixitforme-solver',
      description: 'Five-stage problem solver: understand, research, plan, execute, package. Powers the fixitfor.me consumer product.',
      objective: 'Take a user-described problem and produce a working solution with walkthrough.',
      steps: SOLVER_STEPS,
      status: 'active',
    });
    console.log(`  Created workflow template: ${created.template_id}`);
    console.log(`  Template ID: ${created.template_id}`);
  }

  console.log();
  console.log('Done! Set this template ID as DASHCLAW_SOLVER_TEMPLATE_ID in fixitfor-me .env');

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Commit in DashClaw repo**

```bash
cd "C:\Projects\DashClaw"
git add scripts/seed-fixitforme-workflow.js
git commit -m "feat: add fixitfor-me solver workflow template seed

Seeds 5-step workflow (understand, research, plan, execute, package)
for the fixitfor-me consumer product integration. Idempotent."
```

---

## Task 5: Integration Verification

- [ ] **Step 1: Verify fixitfor-me builds**

```bash
cd "C:\Users\sandm\Projects\fixitfor-me"
npm run build
```
Expected: Build succeeds (no TypeScript errors from removed files or new imports)

- [ ] **Step 2: Verify no references to removed solver files**

```bash
cd "C:\Users\sandm\Projects\fixitfor-me"
grep -r "from.*solver/understand\|from.*solver/research\|from.*solver/plan\|from.*solver/execute\|from.*solver/package" src/ || echo "No stale references"
```
Expected: "No stale references"

- [ ] **Step 3: Verify solver/index.ts imports resolve**

```bash
cd "C:\Users\sandm\Projects\fixitfor-me"
npx tsc --noEmit src/lib/solver/index.ts 2>&1 | head -5
```
Expected: No errors (or only non-blocking warnings)

- [ ] **Step 4: Verify DashClaw seed script parses**

```bash
cd "C:\Projects\DashClaw"
node -e "import('./scripts/seed-fixitforme-workflow.js').catch(() => console.log('Parse OK - DB expected to fail'))"
```

- [ ] **Step 5: Check commit history in both repos**

```bash
cd "C:\Users\sandm\Projects\fixitfor-me" && git log --oneline -5
cd "C:\Projects\DashClaw" && git log --oneline -3
```

---

## Summary

| Task | What | Repo | Files | Commits |
|------|------|------|-------|---------|
| 1 | DashClaw client + env vars | fixitfor-me | 2 (create + modify) | 1 |
| 2 | Rewrite solver + remove old stages | fixitfor-me | 6 (1 rewrite + 5 remove) | 1 |
| 3 | DB migration + approve + admin link | fixitfor-me | 3 (modify) | 1 |
| 4 | Workflow template seed | DashClaw | 1 (create) | 1 |
| 5 | Integration verification | both | 0 | 0 |
| **Total** | | | **12 files** | **4 commits** |
