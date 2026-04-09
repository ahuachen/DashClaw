# Artifact & Evidence Layer Design Spec

Date: 2026-04-09
Status: Approved
Roadmap: Artifact & Evidence Layer — M1 (Schema) + M2 (Linkage)

## Goal

Reify artifacts from unstructured output text fields into durable, linkable, queryable objects with governance properties. Auto-capture workflow step outputs as artifacts. Provide an evidence bundle endpoint for compliance.

## Problem

DashClaw governance produces valuable outputs — step results, action summaries, compliance records — but they're stored as truncated text fields or ephemeral JSON. There's no way to reference, query, or bundle these outputs as first-class objects. Compliance exports aggregate data at export time with no durable evidence objects.

## Approach

One new `artifacts` table with direct foreign keys to actions and steps (no separate linkage table). A standard repository + CRUD routes. Auto-capture from the workflow executor. An evidence bundle endpoint that composes governance records + artifacts for a given action.

## Database Schema

```sql
CREATE TABLE IF NOT EXISTS artifacts (
  id SERIAL PRIMARY KEY,
  artifact_id TEXT UNIQUE NOT NULL,
  org_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  content_json TEXT,
  content_url TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  source_action_id TEXT,
  source_step_id TEXT,
  source_agent_id TEXT,
  retention_days INTEGER,
  tags_json TEXT DEFAULT '[]',
  metadata_json TEXT DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Column Notes

- `artifact_type`: one of `file`, `json`, `report`, `transcript`, `patch`, `evidence_bundle`
- `content_json`: stores content inline for json/report/transcript types
- `content_url`: external reference for file/patch types (S3 URL, etc.)
- `source_action_id`: the action_record that produced this artifact (nullable)
- `source_step_id`: the workflow step that produced it (nullable, references step_id in workflow_step_results)
- `source_agent_id`: the agent that produced it (nullable)
- `retention_days`: null means keep forever. Enforcement is out of scope for V1.
- `tags_json`: JSON array of string tags for filtering
- `metadata_json`: freeform JSON for type-specific metadata

### Querying Patterns

- All artifacts for an action: `WHERE source_action_id = ?`
- All artifacts for a workflow run: `WHERE source_action_id IN (SELECT action_id FROM action_records WHERE parent_action_id = ?)`
- All artifacts by agent: `WHERE source_agent_id = ?`
- By type: `WHERE artifact_type = ?`
- By tag: `WHERE tags_json::jsonb @> '["tag"]'` (or LIKE-based fallback)

## Repository

`app/lib/repositories/artifacts.repository.js`

### createArtifact(sql, orgId, data)

Creates a new artifact. Generates `art_` prefixed ID. Accepts:
- `artifact_type` (required)
- `name` (required)
- `description`, `content_json`, `content_url`, `mime_type`, `size_bytes`
- `source_action_id`, `source_step_id`, `source_agent_id`
- `retention_days`, `tags`, `metadata`

Returns the created artifact.

### listArtifacts(sql, orgId, filters)

Filters: `action_id`, `step_id`, `agent_id`, `artifact_type`, `limit`, `offset`

Returns `{ artifacts: [...], total }`.

### getArtifact(sql, orgId, artifactId)

Returns single artifact or null.

### deleteArtifact(sql, orgId, artifactId)

Hard delete. Returns `{ deleted: true }` or null if not found.

### buildEvidenceBundle(sql, orgId, actionId)

Composes an evidence bundle for a governed action:
1. Load the action record (metadata, guard decision, status, outcome)
2. Load child action records (workflow steps if applicable)
3. Load linked artifacts
4. Return a structured bundle:

```javascript
{
  artifact_type: 'evidence_bundle',
  action: { action_id, status, declared_goal, agent_id, ... },
  guard_decision: { decision, reasons, matched_policies },
  steps: [{ step_id, status, output_summary }],
  artifacts: [{ artifact_id, name, type, content_json }],
  generated_at: ISO timestamp,
}
```

## API Routes

### `GET /api/artifacts`

List artifacts for the org. Query params: `action_id`, `step_id`, `agent_id`, `type`, `limit`, `offset`.

### `POST /api/artifacts`

Create an artifact. Body: `{ artifact_type, name, description?, content_json?, content_url?, ... }`

### `GET /api/artifacts/[artifactId]`

Get single artifact with full content.

### `DELETE /api/artifacts/[artifactId]`

Delete an artifact.

### `GET /api/actions/[actionId]/artifacts`

List artifacts linked to a specific action (shortcut for `GET /api/artifacts?action_id=X`).

### `POST /api/artifacts/evidence-bundle`

Generate an evidence bundle. Body: `{ action_id }`. Returns the bundle as a JSON artifact and optionally persists it.

## Auto-Capture from Workflow Executor

When the executor writes a completed step result via `persistStepResult`, also create an artifact:

```javascript
{
  artifact_type: 'json',
  name: `Step output: ${step.name}`,
  content_json: JSON.stringify(output),
  source_action_id: parentActionId,
  source_step_id: step.id,
  source_agent_id: agentId,
  tags: ['auto-captured', 'workflow-step-output'],
}
```

This is done in the execute route's `persistStepResult` callback (not in the executor itself) to keep the executor database-agnostic.

The callback is modified to accept a `createArtifactFn` parameter. When provided and the step status is `completed`, it creates the artifact. When not provided (tests, standalone usage), no artifact is created.

## UI

### Decision Detail Page — Artifacts Tab

In `app/decisions/[actionId]/page.js`, add an "Artifacts" tab that:
- Fetches `GET /api/actions/{actionId}/artifacts`
- Shows a list of artifacts with name, type pill, timestamp
- Expandable content for JSON artifacts
- "Generate Evidence Bundle" button that calls `POST /api/artifacts/evidence-bundle`

### Workflow Run Detail Page — Artifacts Section

In the existing run detail page, add an artifacts section below the step timeline:
- Fetches artifacts where `source_action_id` matches the run's child action IDs
- Groups by step
- Same list format as decision detail

## Testing

### `__tests__/unit/artifacts.repository.test.js`

- `shapeArtifact` parses JSON fields correctly
- `shapeArtifact` handles null/malformed JSON
- `buildEvidenceBundle` returns structured bundle shape

### `__tests__/unit/artifacts-api.test.js` (optional)

- Route-level tests if needed

## Scope Boundaries

### In scope
- `artifacts` table
- Repository with CRUD + evidence bundle builder
- 6 API routes (list, create, get, delete, action artifacts, evidence bundle)
- Auto-capture from workflow step outputs
- Artifacts tab on decision detail page
- Artifacts section on run detail page

### Out of scope
- File upload / binary storage
- Artifact preview / diff / search
- Retention enforcement cron
- Artifact permissions / access control
- Artifact versioning
