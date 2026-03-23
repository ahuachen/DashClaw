---
phase: 03-integration-guides
plan: "01"
subsystem: guides
tags: [guides, integration, claude-code, openai-agents-sdk, server-components]
dependency_graph:
  requires: []
  provides: [GuideClient, getGuideBaseUrl, /guides/claude-code, /guides/openai-agents-sdk]
  affects: [/connect, app/lib]
tech_stack:
  added: []
  patterns: [Next.js server component with host URL injection, shared client component for guide pages]
key_files:
  created:
    - app/guides/GuideClient.js
    - app/lib/guideContent.js
    - app/guides/claude-code/page.js
    - app/guides/openai-agents-sdk/page.js
  modified:
    - .husky/pre-commit
decisions:
  - "GuideClient accepts steps array with optional codeTitle/codeBody/note per step — flexible enough for all 4 framework guides"
  - "getGuideBaseUrl() duplicates connectGuide.js logic rather than importing it — avoids coupling guide infrastructure to connect-specific code"
  - "framework emoji icon passed as prop (optional) — adds visual accent without requiring icons library additions"
metrics:
  duration: "~7 minutes"
  completed: "2026-03-23"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 03 Plan 01: Integration Guide Infrastructure and First Two Guides Summary

**One-liner:** Shared GuideClient component + guideContent URL helper delivering Claude Code hook-based guide and OpenAI Agents SDK annotated governance loop walkthrough.

## What Was Built

### Task 1: Shared Infrastructure

**`app/lib/guideContent.js`** — Exports `getGuideBaseUrl(host)` replicating the host-resolution logic from `connectGuide.js`:
- Returns placeholder URL for null/empty host or marketing hosts (dashclaw.io)
- Returns `http://` for localhost/127.0.0.1
- Returns `https://` for all other production hosts

**`app/guides/GuideClient.js`** — `'use client'` component that renders any framework integration guide:
- Props: `{ frameworkName, frameworkIcon, steps, proofMoment, guardrailsYaml, baseUrl }`
- Sub-components: `CopyButton`, `CodeCard`, `StepSection` — visually identical to ConnectGuideClient
- Hero section with framework name, "Integration Guide" label, detected instance URL
- Proof moment section with emerald accent border
- Governance-as-code section with guardrails.yml CodeCard
- Dark theme: `bg-[#0a0a0a]`, `bg-[#111]`, `text-zinc-*` throughout

### Task 2: Claude Code Guide (`/guides/claude-code`)

6-step guide covering:
1. Deploy DashClaw
2. Copy `dashclaw_pretool.py` and `dashclaw_posttool.py` into `.claude/hooks/`
3. Set `DASHCLAW_BASE_URL`, `DASHCLAW_API_KEY`, `DASHCLAW_HOOK_MODE=enforce` — live URL injected
4. Merge hooks/settings.json (`PreToolUse` + `PostToolUse` matchers)
5. Test prompt that triggers a governed tool call
6. Proof moment: /decisions ledger with `action_type` and `agent_id 'claude-code'`

guardrails.yml: `block_destructive_shell` (rm -rf, drop table) + `warn_on_deploy` (git push, vercel deploy)

### Task 3: OpenAI Agents SDK Guide (`/guides/openai-agents-sdk`)

6-step guide covering:
1. Deploy DashClaw
2. `npm install dashclaw dotenv`
3. Set `DASHCLAW_BASE_URL`, `DASHCLAW_API_KEY` — live URL injected
4. Annotated guard-record-outcome governance loop (GUIDE-02 deliverable) — inline ~40-line walkthrough with step-by-step comments
5. `node --env-file=.env governed-agent.js`
6. Proof moment: /decisions with `action_type 'data_export'`, `agent_id 'my-openai-agent'`

guardrails.yml: `approve_deletions` (require: approval for delete_records, drop_table) + `auto_allow_reads` (allow: true for scan_for_pii, list_records)

Links to `examples/openai-agents-governed/` for full production-scale example.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed pre-commit hook missing shebang line**
- **Found during:** Task 1 first commit attempt
- **Issue:** `.husky/pre-commit` lacked `#!/bin/sh` shebang, causing "Exec format error" on Windows
- **Fix:** Added `#!/bin/sh` as first line of `.husky/pre-commit`
- **Files modified:** `.husky/pre-commit`
- **Commit:** c88d892

## Verification Results

- `npm run lint` — 0 errors (1 pre-existing warning in app/page.js unrelated to new files)
- `npm run build` — `/guides/claude-code` and `/guides/openai-agents-sdk` both compile as dynamic (ƒ) routes
- `npm run governance:boundary:check` — PASSED, boundary is clean
- All 4 required files exist

## Known Stubs

None. Both guide pages render complete content with live URL injection. No placeholder data flows to UI.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | c88d892 | feat(03-01): add shared GuideClient component and guideContent URL helper |
| Task 2 | 936a203 | feat(03-01): add Claude Code integration guide page at /guides/claude-code |
| Task 3 | 1d50d33 | feat(03-01): add OpenAI Agents SDK integration guide page at /guides/openai-agents-sdk |

## Self-Check: PASSED
