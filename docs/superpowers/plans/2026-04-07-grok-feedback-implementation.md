# Grok Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement quick-win polish items (pyproject.toml, SDK asymmetry docs, public roadmap, feature surfacing in README) and two AI-powered features (policy generator with preview, predictive risk scoring) based on the Grok codebase review.

**Architecture:** Phase 1 tasks are doc/config changes only — no new code beyond file creation. Phase 2 adds two new lib modules (`policy-generator.js`, `predictive-risk.js`), one new API route (`/api/policies/generate`), one new UI page (`/policies/generate`), and modifies the guard engine. All follow existing patterns: org-scoped, repository layer, BYOK provider execution via `executeCompletion()`.

**Tech Stack:** Next.js 15 App Router, Postgres (Neon) via `postgres.js`, Vitest + jsdom, Tailwind + existing component library, BYOK LLM via `app/lib/providers.js`.

**Source spec:** `docs/superpowers/specs/2026-04-07-grok-feedback-implementation-design.md`

---

## Complete File Map

### Phase 1 (Quick Wins)

| Action | File | Purpose |
|--------|------|---------|
| Delete | `sdk-python/setup.py` | Replaced by pyproject.toml |
| Create | `sdk-python/pyproject.toml` | Modern Python packaging |
| Modify | `sdk/README.md:71` | Add SDK Tiers section after governance loop examples |
| Create | `ROADMAP.md` | Public community roadmap |
| Modify | `README.md:332-338` | Add roadmap link + "Beyond the Basics" section before "Full SDK Documentation" |

### Phase 2 (AI Features)

| Action | File | Purpose |
|--------|------|---------|
| Create | `app/lib/policy-generator.js` | LLM prompt construction, response parsing, validation |
| Create | `app/api/policies/generate/route.js` | POST endpoint for policy generation |
| Create | `app/policies/generate/page.js` | UI: textarea → preview → confirm |
| Create | `__tests__/unit/policy-generator.test.js` | Unit tests for policy generation lib |
| Create | `__tests__/unit/policy-generate.route.test.js` | Route handler tests |
| Create | `app/lib/predictive-risk.js` | Statistical + LLM risk assessment |
| Create | `__tests__/unit/predictive-risk.test.js` | Unit tests for predictive risk |
| Modify | `app/lib/guard.js:84-281` | Integrate predictive risk into `evaluateGuard()` |
| Modify | `app/lib/repositories/settings.repository.js:7-42` | Add predictive risk keys to `VALID_SETTING_KEYS` |
| Modify | `drizzle/0000_clammy_falcon.sql` (append) | Add composite index for predictive queries |

---

## Phase 1: Quick Wins

### Task 1: Python SDK — Replace setup.py with pyproject.toml

**Files:**
- Delete: `sdk-python/setup.py`
- Create: `sdk-python/pyproject.toml`

- [ ] **Step 1: Create pyproject.toml**

```toml
[build-system]
requires = ["setuptools>=61.0"]
build-backend = "setuptools.backends._legacy:_Backend"

[project]
name = "dashclaw"
version = "2.10.0"
description = "Python SDK for the DashClaw AI agent decision infrastructure platform"
readme = "README.md"
license = "MIT"
requires-python = ">=3.7"
authors = [
    { name = "Wes Sander" }
]
classifiers = [
    "Programming Language :: Python :: 3",
    "License :: OSI Approved :: MIT License",
    "Operating System :: OS Independent",
]
dependencies = []

[project.optional-dependencies]
langchain = ["langchain-core>=0.1.0"]

[project.urls]
Homepage = "https://github.com/ucsandman/DashClaw"
Documentation = "https://dashclaw.io/docs"
Repository = "https://github.com/ucsandman/DashClaw"

[tool.setuptools.packages.find]
include = ["dashclaw*"]
```

- [ ] **Step 2: Delete setup.py**

```bash
rm sdk-python/setup.py
```

- [ ] **Step 3: Verify install still works**

Run: `pip install -e ./sdk-python`
Expected: Successful install with no errors.

- [ ] **Step 4: Commit**

```bash
git add sdk-python/pyproject.toml
git add -u sdk-python/setup.py
git commit -m "chore: migrate Python SDK from setup.py to pyproject.toml"
```

---

### Task 2: Document SDK Asymmetry in SDK README

**Files:**
- Modify: `sdk/README.md:71` — insert after the `---` separator following the Python governance loop example, before the `## SDK Surface Area` heading.

- [ ] **Step 1: Add SDK Tiers section**

Insert the following after line 71 (`---`) and before line 73 (`## SDK Surface Area (v2.10.0)`):

```markdown
## SDK Tiers

DashClaw ships two SDKs with different scope:

| | Node SDK | Python SDK |
|---|---|---|
| **Focus** | Lightweight governance loop | Full platform surface |
| **Methods** | 67 | 185+ |
| **Core governance** | ✅ | ✅ |
| **Scoring profiles** | ✅ | ✅ |
| **Learning loop** | ✅ | ✅ |
| **Framework integrations** | — | LangChain, CrewAI, AutoGen |
| **Compliance engine** | — | ✅ |
| **Execution graphs** | — | ✅ |
| **Webhooks management** | — | ✅ |

**Node** is designed for most agents — fast, minimal, covers the governance loop and common workflows. **Python** is the enterprise/power-user surface with compliance reporting, execution graph traversal, and framework-native integrations.

---
```

- [ ] **Step 2: Commit**

```bash
git add sdk/README.md
git commit -m "docs: add SDK tiers comparison table to SDK README"
```

---

### Task 3: Create Public ROADMAP.md

**Files:**
- Create: `ROADMAP.md`
- Modify: `README.md:334-337` — add roadmap link in the documentation section

- [ ] **Step 1: Create ROADMAP.md at repo root**

```markdown
# DashClaw Roadmap

## Recently Shipped

- **v2.8** — Agent Intel hooks (40+ tool semantic classification), session lifecycle, 3 new policy types (permission_escalation, green_contract, branch_freshness), 4 new signal types, recovery recipe engine
- **v2.3** — Cost dashboard with agent spend tracking, policy template gallery with one-click install, approval webhooks (PagerDuty/Opsgenie compatible)
- **v2.2** — CLI approval client (`@dashclaw/cli`), Claude Code pretool/posttool hooks (zero-code governance), `npx dashclaw-demo` one-command demo, framework starters (Anthropic SDK, OpenAI Agents SDK)

## In Progress

- **AI Policy Generator** — Paste natural language company policies → DashClaw generates enforceable guard rules + recovery recipes with dry-run preview
- **Predictive Risk Scoring** — Statistical behavior analysis on every guard call + LLM-enhanced risk assessment for high-stakes actions
- **SSE Real-Time Events** — Replace polling-based `waitForApproval()` with server-sent events in both SDKs

## Exploring

- **Fleet & Enterprise** — Team invites, role-based policy inheritance, SSO, audit export (CSV/PDF/OpenTelemetry)
- **Framework Templates** — Full CrewAI, AutoGen, and LangGraph governance starters
- **Hosted Free Tier** — Managed DashClaw with 3 agents / 500 actions per month, Pro subscription for scaling
- **DashClaw Certified** — Badge program for agent builders who ship governed agents
- **Cost Optimization Engine** — Auto-suggest cheaper model routing based on action type and historical cost data

## Community

Have a feature request? [Open an issue](https://github.com/ucsandman/DashClaw/issues) or join the conversation in [Discussions](https://github.com/ucsandman/DashClaw/discussions).
```

- [ ] **Step 2: Add roadmap link to README.md**

In `README.md`, modify the "Full SDK Documentation" section (around line 334) to include the roadmap. Replace:

```markdown
## Full SDK Documentation

For the complete API surface, check out the [SDK Reference](./docs/sdk-reference.md).
```

With:

```markdown
## Documentation

- [SDK Reference](./docs/sdk-reference.md) — Complete API surface for Node and Python SDKs
- [Roadmap](./ROADMAP.md) — What's shipped, in progress, and exploring
- [CHANGELOG](./CHANGELOG.md) — Detailed release history
```

- [ ] **Step 3: Commit**

```bash
git add ROADMAP.md README.md
git commit -m "docs: add public ROADMAP.md and documentation links"
```

---

### Task 4: Surface Hidden Features in README

**Files:**
- Modify: `README.md` — add "Beyond the Basics" section before the "Documentation" section (inserted in Task 3)

- [ ] **Step 1: Add "Beyond the Basics" section**

Insert the following before the `## Documentation` section (around line 332, after the "Deploy to Cloud" section's closing `---`):

```markdown
## Beyond the Basics

DashClaw includes advanced governance capabilities beyond the core guard loop:

- **Drift Detection** — Monitors reasoning and metric drift across agent sessions. Surfaces signals when behavior deviates from baselines. See the [drift signals docs](./docs/sdk-reference.md).
- **Recovery Recipes** — 6 built-in recipes map signals to remediations and auto-actions. Guard responses include a `recovery` field when applicable. See [SDK: Recovery](./sdk/README.md#learning-loop).
- **Scoring Profiles** — Multi-dimensional evaluation with weighted composite scores, auto-calibration, and batch scoring. See [SDK: Scoring Profiles](./sdk/README.md#scoring-profiles).
- **Learning Loop** — Guard responses include historical learning context: recent score averages, drift status, and behavioral patterns that feed back into future decisions. See [SDK: Learning Loop](./sdk/README.md#learning-loop).
- **Prompt Injection Scanning** — On by default for all guard evaluations. Detects and blocks injection patterns in declared goals. See [SDK: Security Scanning](./sdk/README.md#security-scanning).
- **Session Lifecycle** — Automatic session tracking with stall detection, recovery recipes, and graduated autonomy levels per agent. See the [v2.8 changelog](./CHANGELOG.md).

---
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: surface drift detection, recovery recipes, scoring profiles in README"
```

---

## Phase 2: AI Features

### Task 5: Policy Generator — Write failing tests for the lib module

**Files:**
- Create: `__tests__/unit/policy-generator.test.js`

- [ ] **Step 1: Write the test file**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecuteCompletion } = vi.hoisted(() => ({
  mockExecuteCompletion: vi.fn(),
}));

vi.mock('@/lib/providers.js', () => ({
  executeCompletion: mockExecuteCompletion,
}));

vi.mock('@/lib/validate.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual };
});

import { generatePolicies, buildSystemPrompt, parseGeneratedPolicies } from '@/lib/policy-generator.js';
import { createSqlMock } from '../helpers.js';

describe('policy-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildSystemPrompt', () => {
    it('includes all valid policy types', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('risk_threshold');
      expect(prompt).toContain('require_approval');
      expect(prompt).toContain('block_action_type');
      expect(prompt).toContain('rate_limit');
    });

    it('includes valid action types', () => {
      const prompt = buildSystemPrompt();
      expect(prompt).toContain('deploy');
      expect(prompt).toContain('migrate');
      expect(prompt).toContain('security');
    });
  });

  describe('parseGeneratedPolicies', () => {
    it('parses valid JSON array of policies', () => {
      const raw = JSON.stringify([
        {
          name: 'Block deploys',
          policy_type: 'block_action_type',
          rules: { action_types: ['deploy'] },
          confidence: 0.9,
        },
      ]);
      const { policies, warnings } = parseGeneratedPolicies(raw);
      expect(policies).toHaveLength(1);
      expect(policies[0].name).toBe('Block deploys');
      expect(warnings).toHaveLength(0);
    });

    it('moves invalid policies to warnings', () => {
      const raw = JSON.stringify([
        {
          name: 'Valid',
          policy_type: 'risk_threshold',
          rules: { threshold: 80 },
          confidence: 0.9,
        },
        {
          name: 'Invalid',
          policy_type: 'nonexistent_type',
          rules: {},
          confidence: 0.5,
        },
      ]);
      const { policies, warnings } = parseGeneratedPolicies(raw);
      expect(policies).toHaveLength(1);
      expect(policies[0].name).toBe('Valid');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('Invalid');
    });

    it('returns empty on unparseable JSON', () => {
      const { policies, warnings } = parseGeneratedPolicies('not json');
      expect(policies).toHaveLength(0);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain('parse');
    });

    it('extracts recovery recipes when present', () => {
      const raw = JSON.stringify([
        {
          name: 'Require backup before migrate',
          policy_type: 'require_approval',
          rules: { action_types: ['migrate'] },
          recovery_recipe: {
            signal: 'migration_without_backup',
            suggestion: 'Run backup first',
            auto_action: null,
          },
          confidence: 0.88,
        },
      ]);
      const { policies } = parseGeneratedPolicies(raw);
      expect(policies[0].recovery_recipe).toBeDefined();
      expect(policies[0].recovery_recipe.signal).toBe('migration_without_backup');
    });
  });

  describe('generatePolicies', () => {
    it('calls LLM and returns parsed policies', async () => {
      const generatedPolicies = [
        {
          name: 'Block deploys after hours',
          policy_type: 'block_action_type',
          rules: { action_types: ['deploy'] },
          confidence: 0.92,
        },
      ];
      mockExecuteCompletion.mockResolvedValue({
        content: JSON.stringify(generatedPolicies),
        provider: 'openai',
        model: 'gpt-4o',
        usage: { input_tokens: 500, output_tokens: 200 },
        cost_usd: 0.005,
      });

      const sql = createSqlMock({
        taggedResponses: [
          // getSettings call for integration credentials
          [{ key: 'OPENAI_API_KEY', value: 'sk-test', encrypted: false }],
        ],
      });

      const result = await generatePolicies(sql, 'org_1', 'No deploys after 5pm');
      expect(result.generated_policies).toHaveLength(1);
      expect(result.generated_policies[0].name).toBe('Block deploys after hours');
      expect(result.warnings).toHaveLength(0);
      expect(mockExecuteCompletion).toHaveBeenCalledOnce();
    });

    it('returns 422-style error when no LLM keys configured', async () => {
      const sql = createSqlMock({
        taggedResponses: [
          // getSettings returns empty — no keys
          [],
        ],
      });

      const result = await generatePolicies(sql, 'org_1', 'Block all deploys');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('provider');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/policy-generator.test.js`
Expected: FAIL — `Cannot find module '@/lib/policy-generator.js'`

- [ ] **Step 3: Commit**

```bash
git add __tests__/unit/policy-generator.test.js
git commit -m "test: add failing tests for AI policy generator lib"
```

---

### Task 6: Policy Generator — Implement the lib module

**Files:**
- Create: `app/lib/policy-generator.js`

- [ ] **Step 1: Implement policy-generator.js**

```javascript
/**
 * AI Policy Generator.
 * Accepts natural language input, calls an LLM to generate guard policies,
 * validates the output, and returns a preview or creates policies.
 */

import { executeCompletion } from './providers.js';
import { validatePolicy, POLICY_TYPES } from './validate.js';
import { createHash } from 'node:crypto';

const ACTION_TYPES = [
  'build', 'deploy', 'post', 'apply', 'security', 'message', 'api',
  'calendar', 'research', 'review', 'fix', 'refactor', 'test', 'config',
  'monitor', 'alert', 'cleanup', 'sync', 'migrate', 'other',
];

const POLICY_TYPE_SCHEMAS = {
  risk_threshold: '{ "threshold": <number 0-100>, "action": "block"|"warn"|"require_approval" }',
  require_approval: '{ "action_types": ["deploy", "migrate", ...] }',
  block_action_type: '{ "action_types": ["deploy", "migrate", ...] }',
  rate_limit: '{ "max_actions": <number>, "window_minutes": <number>, "action": "warn"|"block" }',
  permission_escalation: '{ "enforce": true }',
  green_contract: '{ "action_types": ["deploy"], "required_level": "targeted"|"package"|"workspace"|"merge_ready", "action": "block"|"require_approval" }',
  branch_freshness: '{ "action_types": ["deploy"], "freshness": ["stale", "diverged"], "max_commits_behind": <number>, "action": "block"|"require_approval" }',
};

const FEW_SHOT_EXAMPLES = [
  {
    input: 'Block all production deploys',
    output: {
      name: 'Block production deploys',
      policy_type: 'block_action_type',
      rules: { action_types: ['deploy'] },
      confidence: 0.95,
    },
  },
  {
    input: 'Require human approval for any action with risk above 70',
    output: {
      name: 'High-risk approval gate',
      policy_type: 'risk_threshold',
      rules: { threshold: 70, action: 'require_approval' },
      confidence: 0.93,
    },
  },
  {
    input: 'Limit agents to 10 actions per hour',
    output: {
      name: 'Hourly rate limit',
      policy_type: 'rate_limit',
      rules: { max_actions: 10, window_minutes: 60, action: 'warn' },
      confidence: 0.90,
    },
  },
];

/**
 * Build the system prompt for the policy generator LLM call.
 * @returns {string}
 */
export function buildSystemPrompt() {
  const typeDescriptions = Object.entries(POLICY_TYPE_SCHEMAS)
    .map(([type, schema]) => `- ${type}: ${schema}`)
    .join('\n');

  const examples = FEW_SHOT_EXAMPLES
    .map((ex) => `Input: "${ex.input}"\nOutput: ${JSON.stringify([ex.output], null, 2)}`)
    .join('\n\n');

  return `You are a DashClaw policy generator. Convert natural language company policies into structured guard policies.

## Valid Policy Types and Rules Schemas
${typeDescriptions}

## Valid Action Types
${ACTION_TYPES.join(', ')}

## Examples
${examples}

## Instructions
- Return a JSON array of policy objects.
- Each object must have: name (string), policy_type (one of the valid types above), rules (object matching the schema for that type), confidence (0.0-1.0).
- Optionally include recovery_recipe: { signal: string, suggestion: string, auto_action: string|null }.
- If the input describes multiple policies, generate one object per policy.
- If the input is unclear or cannot be mapped to a valid policy type, return an empty array.
- Return ONLY the JSON array, no markdown fences, no explanation.`;
}

/**
 * Parse and validate the LLM's generated policy output.
 * @param {string} rawContent - Raw LLM response content
 * @returns {{ policies: Array, warnings: string[] }}
 */
export function parseGeneratedPolicies(rawContent) {
  const policies = [];
  const warnings = [];

  // Strip markdown fences if present
  let cleaned = rawContent.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { policies: [], warnings: ['Failed to parse LLM response as JSON'] };
  }

  if (!Array.isArray(parsed)) {
    return { policies: [], warnings: ['LLM response is not a JSON array'] };
  }

  for (const item of parsed) {
    // Validate using the existing validatePolicy function
    const validationInput = {
      name: item.name,
      policy_type: item.policy_type,
      rules: JSON.stringify(item.rules || {}),
    };

    const result = validatePolicy(validationInput);
    if (result.valid) {
      policies.push({
        name: item.name,
        policy_type: item.policy_type,
        rules: item.rules,
        confidence: typeof item.confidence === 'number' ? item.confidence : null,
        recovery_recipe: item.recovery_recipe || null,
      });
    } else {
      warnings.push(`"${item.name || 'unnamed'}": ${result.errors.join(', ')}`);
    }
  }

  return { policies, warnings };
}

/**
 * Default strategy config for policy generation.
 * Uses the cheapest capable model available.
 */
const DEFAULT_STRATEGY_CONFIG = {
  primary: { provider: 'openai', model: 'gpt-4o-mini' },
  fallback: [
    { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  ],
  maxRetries: 1,
  maxBudgetUsd: 0.10,
};

/**
 * Generate guard policies from natural language input.
 *
 * @param {object} sql - Database connection
 * @param {string} orgId - Organization ID
 * @param {string} inputText - Natural language policy description
 * @returns {Promise<{ generated_policies?: Array, warnings?: string[], input_hash?: string, error?: string }>}
 */
export async function generatePolicies(sql, orgId, inputText) {
  // Check that the org has at least one LLM provider configured
  const { getSettings } = await import('./repositories/settings.repository.js');
  const settings = await getSettings(sql, orgId, { category: 'integration' });
  const providerKeys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY', 'TOGETHER_API_KEY', 'PERPLEXITY_API_KEY'];
  const hasProvider = settings.some((s) => providerKeys.includes(s.key) && s.value);

  if (!hasProvider) {
    return { error: 'No LLM provider configured. Add an API key in Settings or /setup.' };
  }

  const systemPrompt = buildSystemPrompt();
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: inputText },
  ];

  const completion = await executeCompletion(sql, orgId, DEFAULT_STRATEGY_CONFIG, messages, {
    max_tokens: 2048,
    temperature: 0.3,
  });

  const { policies, warnings } = parseGeneratedPolicies(completion.content);

  const inputHash = createHash('sha256').update(inputText).digest('hex').slice(0, 16);

  return {
    generated_policies: policies,
    warnings,
    input_hash: inputHash,
    llm_metadata: {
      provider: completion.provider,
      model: completion.model,
      cost_usd: completion.cost_usd,
    },
  };
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run __tests__/unit/policy-generator.test.js`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/lib/policy-generator.js
git commit -m "feat: add AI policy generator lib module"
```

---

### Task 7: Policy Generator — Write failing tests for the route

**Files:**
- Create: `__tests__/unit/policy-generate.route.test.js`

- [ ] **Step 1: Write route tests**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGeneratePolicies, mockGetOrgId, mockGetSql, mockGetOrgRole } = vi.hoisted(() => ({
  mockGeneratePolicies: vi.fn(),
  mockGetOrgId: vi.fn(() => 'org_1'),
  mockGetSql: vi.fn(() => 'mock-sql'),
  mockGetOrgRole: vi.fn(() => 'admin'),
}));

vi.mock('@/lib/policy-generator.js', () => ({ generatePolicies: mockGeneratePolicies }));
vi.mock('@/lib/org', () => ({ getOrgId: mockGetOrgId, getOrgRole: mockGetOrgRole }));
vi.mock('@/lib/db.js', () => ({ getSql: mockGetSql }));

import { POST } from '@/api/policies/generate/route.js';
import { makeRequest } from '../helpers.js';

describe('POST /api/policies/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns generated policies on valid input', async () => {
    mockGeneratePolicies.mockResolvedValue({
      generated_policies: [
        { name: 'Block deploys', policy_type: 'block_action_type', rules: { action_types: ['deploy'] }, confidence: 0.9 },
      ],
      warnings: [],
      input_hash: 'abc123',
    });

    const req = makeRequest('http://localhost/api/policies/generate', {
      body: { input_text: 'Block all deploys', dry_run: true },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.generated_policies).toHaveLength(1);
    expect(data.input_hash).toBe('abc123');
  });

  it('returns 400 when input_text is missing', async () => {
    const req = makeRequest('http://localhost/api/policies/generate', {
      body: {},
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when input_text is empty', async () => {
    const req = makeRequest('http://localhost/api/policies/generate', {
      body: { input_text: '' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 422 when no LLM provider is configured', async () => {
    mockGeneratePolicies.mockResolvedValue({
      error: 'No LLM provider configured. Add an API key in Settings or /setup.',
    });

    const req = makeRequest('http://localhost/api/policies/generate', {
      body: { input_text: 'Block all deploys' },
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('caps input_text at 5000 characters', async () => {
    mockGeneratePolicies.mockResolvedValue({
      generated_policies: [],
      warnings: [],
      input_hash: 'x',
    });

    const req = makeRequest('http://localhost/api/policies/generate', {
      body: { input_text: 'a'.repeat(5001) },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/policy-generate.route.test.js`
Expected: FAIL — `Cannot find module '@/api/policies/generate/route.js'`

- [ ] **Step 3: Commit**

```bash
git add __tests__/unit/policy-generate.route.test.js
git commit -m "test: add failing tests for policy generate route"
```

---

### Task 8: Policy Generator — Implement the route

**Files:**
- Create: `app/api/policies/generate/route.js`

- [ ] **Step 1: Implement the route handler**

```javascript
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getOrgId } from '../../../lib/org';
import { getSql } from '../../../lib/db.js';
import { apiErrorResponse } from '../../../lib/apiErrors.js';
import { generatePolicies } from '../../../lib/policy-generator.js';
import { validatePolicy } from '../../../lib/validate.js';

const MAX_INPUT_LENGTH = 5000;

/**
 * POST /api/policies/generate
 *
 * Generate guard policies from natural language input.
 * Body: { input_text: string, dry_run?: boolean (default true) }
 *
 * dry_run=true: Returns preview of generated policies.
 * dry_run=false: Creates the policies in the database.
 */
export async function POST(request) {
  try {
    const orgId = getOrgId(request);
    const sql = getSql();
    const body = await request.json();

    const { input_text, dry_run = true } = body;

    if (!input_text || typeof input_text !== 'string' || input_text.trim().length === 0) {
      return NextResponse.json(
        { error: 'input_text is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (input_text.length > MAX_INPUT_LENGTH) {
      return NextResponse.json(
        { error: `input_text exceeds maximum length of ${MAX_INPUT_LENGTH} characters` },
        { status: 400 }
      );
    }

    const result = await generatePolicies(sql, orgId, input_text.trim());

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    if (dry_run) {
      return NextResponse.json({
        generated_policies: result.generated_policies,
        warnings: result.warnings,
        input_hash: result.input_hash,
      });
    }

    // dry_run=false — create the policies
    const createdPolicies = [];
    for (const policy of result.generated_policies) {
      const policyId = `gp_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
      await sql`
        INSERT INTO guard_policies (id, org_id, name, policy_type, rules, active, created_at)
        VALUES (
          ${policyId},
          ${orgId},
          ${policy.name},
          ${policy.policy_type},
          ${JSON.stringify(policy.rules)},
          1,
          NOW()
        )
      `;
      createdPolicies.push(policyId);
    }

    return NextResponse.json({
      created_policies: createdPolicies,
      count: createdPolicies.length,
    });
  } catch (err) {
    return apiErrorResponse(err, 'POLICIES GENERATE');
  }
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run __tests__/unit/policy-generate.route.test.js`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/policies/generate/route.js
git commit -m "feat: add POST /api/policies/generate route"
```

---

### Task 9: Policy Generator — Create the UI page

**Files:**
- Create: `app/policies/generate/page.js`

- [ ] **Step 1: Implement the generate page**

```javascript
'use client';

import { useState } from 'react';

export default function PolicyGeneratePage() {
  const [inputText, setInputText] = useState('');
  const [preview, setPreview] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedPolicies, setSelectedPolicies] = useState(new Set());

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setPreview(null);
    setWarnings([]);
    setSuccess(null);

    try {
      const res = await fetch('/api/policies/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_text: inputText, dry_run: true }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to generate policies');
        return;
      }

      if (data.generated_policies.length === 0) {
        setError('No policies could be generated. Try rephrasing your input.');
        return;
      }

      setPreview(data);
      setSelectedPolicies(new Set(data.generated_policies.map((_, i) => i)));
      setWarnings(data.warnings || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!preview) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/policies/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_text: inputText, dry_run: false }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create policies');
        return;
      }

      setSuccess(`Created ${data.count} ${data.count === 1 ? 'policy' : 'policies'}`);
      setPreview(null);
      setInputText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function togglePolicy(index) {
    setSelectedPolicies((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const confidenceColor = (c) => {
    if (c >= 0.9) return 'text-green-400';
    if (c >= 0.7) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">AI Policy Generator</h1>
        <p className="text-zinc-400">
          Paste your company policy, compliance requirement, or Slack message and DashClaw will generate enforceable guard rules.
        </p>
      </div>

      {success && (
        <div className="mb-4 p-3 rounded bg-green-900/30 border border-green-700 text-green-300">
          {success}{' '}
          <a href="/policies" className="underline text-green-200 hover:text-white">
            View policies
          </a>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded bg-red-900/30 border border-red-700 text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste your company policy, Slack message, or compliance requirement..."
          rows={6}
          maxLength={5000}
          className="w-full p-3 rounded bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-y"
        />
        <div className="text-xs text-zinc-500 mt-1 text-right">
          {inputText.length}/5000
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || !inputText.trim()}
        className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Generating...' : 'Generate Preview'}
      </button>

      {preview && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Generated {preview.generated_policies.length}{' '}
            {preview.generated_policies.length === 1 ? 'policy' : 'policies'}
          </h2>

          {preview.generated_policies.map((policy, i) => (
            <div
              key={i}
              className={`p-4 rounded border ${
                selectedPolicies.has(i)
                  ? 'border-orange-600 bg-zinc-800'
                  : 'border-zinc-700 bg-zinc-900 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedPolicies.has(i)}
                    onChange={() => togglePolicy(i)}
                    className="accent-orange-500"
                  />
                  <span className="font-medium text-white">{policy.name}</span>
                </div>
                {policy.confidence != null && (
                  <span className={`text-sm font-mono ${confidenceColor(policy.confidence)}`}>
                    {(policy.confidence * 100).toFixed(0)}% confidence
                  </span>
                )}
              </div>
              <div className="text-sm text-zinc-400 mb-2">
                Type: <span className="text-zinc-300">{policy.policy_type}</span>
              </div>
              <pre className="text-xs bg-zinc-900 p-2 rounded text-zinc-300 overflow-x-auto">
                {JSON.stringify(policy.rules, null, 2)}
              </pre>
              {policy.recovery_recipe && (
                <div className="mt-2 text-sm text-zinc-400">
                  Recovery: <span className="text-zinc-300">{policy.recovery_recipe.suggestion}</span>
                </div>
              )}
            </div>
          ))}

          {warnings.length > 0 && (
            <details className="text-sm">
              <summary className="text-yellow-400 cursor-pointer">
                {warnings.length} {warnings.length === 1 ? 'warning' : 'warnings'}
              </summary>
              <ul className="mt-2 space-y-1 text-zinc-400">
                {warnings.map((w, i) => (
                  <li key={i}>- {w}</li>
                ))}
              </ul>
            </details>
          )}

          <button
            onClick={handleCreate}
            disabled={creating || selectedPolicies.size === 0}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating
              ? 'Creating...'
              : `Create ${selectedPolicies.size} ${selectedPolicies.size === 1 ? 'Policy' : 'Policies'}`}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify the page renders**

Run: `npm run dev`
Navigate to `http://localhost:3000/policies/generate`
Expected: Page loads with textarea, "Generate Preview" button, and header text.

- [ ] **Step 3: Commit**

```bash
git add app/policies/generate/page.js
git commit -m "feat: add AI policy generator UI page"
```

---

### Task 10: Predictive Risk — Write failing tests

**Files:**
- Create: `__tests__/unit/predictive-risk.test.js`

- [ ] **Step 1: Write the test file**

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockExecuteCompletion } = vi.hoisted(() => ({
  mockExecuteCompletion: vi.fn(),
}));

vi.mock('@/lib/providers.js', () => ({
  executeCompletion: mockExecuteCompletion,
}));

import {
  computeStatisticalAdjustment,
  assessRiskWithLLM,
  getPredictiveRisk,
} from '@/lib/predictive-risk.js';
import { createSqlMock } from '../helpers.js';

describe('predictive-risk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeStatisticalAdjustment', () => {
    it('returns +15 for >50% failure rate', () => {
      const stats = { total: 10, failures: 6, avg_risk: 50, recent_count: 1 };
      const adj = computeStatisticalAdjustment(stats);
      expect(adj.adjustment).toBe(15);
    });

    it('returns +10 for 25-50% failure rate', () => {
      const stats = { total: 10, failures: 3, avg_risk: 50, recent_count: 1 };
      const adj = computeStatisticalAdjustment(stats);
      expect(adj.adjustment).toBe(10);
    });

    it('returns +5 for velocity spike (>5 actions in last hour)', () => {
      const stats = { total: 20, failures: 1, avg_risk: 30, recent_count: 8 };
      const adj = computeStatisticalAdjustment(stats);
      expect(adj.adjustment).toBe(5);
    });

    it('returns +5 for zero history (unknown territory)', () => {
      const stats = { total: 0, failures: 0, avg_risk: null, recent_count: 0 };
      const adj = computeStatisticalAdjustment(stats);
      expect(adj.adjustment).toBe(5);
    });

    it('returns 0 for healthy agent with low failure rate', () => {
      const stats = { total: 50, failures: 2, avg_risk: 30, recent_count: 2 };
      const adj = computeStatisticalAdjustment(stats);
      expect(adj.adjustment).toBe(0);
    });

    it('stacks failure rate and velocity adjustments', () => {
      const stats = { total: 10, failures: 6, avg_risk: 70, recent_count: 8 };
      const adj = computeStatisticalAdjustment(stats);
      // +15 (failure rate >50%) + 5 (velocity spike) = 20
      expect(adj.adjustment).toBe(20);
    });
  });

  describe('assessRiskWithLLM', () => {
    it('returns adjustment and reasoning from LLM', async () => {
      mockExecuteCompletion.mockResolvedValue({
        content: JSON.stringify({ adjustment: 12, reasoning: 'High failure rate after hours' }),
        provider: 'openai',
        model: 'gpt-4o-mini',
        usage: { input_tokens: 300, output_tokens: 50 },
        cost_usd: 0.001,
      });

      const sql = createSqlMock({
        taggedResponses: [
          // Recent actions query
          [
            { action_type: 'deploy', status: 'failed', risk_score: 70, created_at: '2026-04-07T01:00:00Z' },
            { action_type: 'deploy', status: 'completed', risk_score: 50, created_at: '2026-04-07T00:00:00Z' },
          ],
          // getSettings for BYOK
          [{ key: 'OPENAI_API_KEY', value: 'sk-test', encrypted: false }],
        ],
      });

      const result = await assessRiskWithLLM(sql, 'org_1', 'agent-1', 'deploy');
      expect(result.adjustment).toBe(12);
      expect(result.reasoning).toBe('High failure rate after hours');
    });

    it('clamps adjustment to [-20, +20]', async () => {
      mockExecuteCompletion.mockResolvedValue({
        content: JSON.stringify({ adjustment: 50, reasoning: 'Very risky' }),
        provider: 'openai',
        model: 'gpt-4o-mini',
        usage: { input_tokens: 300, output_tokens: 50 },
        cost_usd: 0.001,
      });

      const sql = createSqlMock({
        taggedResponses: [
          [{ action_type: 'deploy', status: 'failed', risk_score: 70, created_at: '2026-04-07T01:00:00Z' }],
          [{ key: 'OPENAI_API_KEY', value: 'sk-test', encrypted: false }],
        ],
      });

      const result = await assessRiskWithLLM(sql, 'org_1', 'agent-1', 'deploy');
      expect(result.adjustment).toBe(20);
    });

    it('returns null on LLM failure (fail-open)', async () => {
      mockExecuteCompletion.mockRejectedValue(new Error('Provider timeout'));

      const sql = createSqlMock({
        taggedResponses: [
          [{ action_type: 'deploy', status: 'failed', risk_score: 70, created_at: '2026-04-07T01:00:00Z' }],
          [{ key: 'OPENAI_API_KEY', value: 'sk-test', encrypted: false }],
        ],
      });

      const result = await assessRiskWithLLM(sql, 'org_1', 'agent-1', 'deploy');
      expect(result).toBeNull();
    });
  });

  describe('getPredictiveRisk', () => {
    it('returns statistical-only when score is below threshold', async () => {
      const sql = createSqlMock({
        queryResponses: [
          [{ total: '20', failures: '2', avg_risk: '30', recent_count: '1' }],
        ],
        taggedResponses: [
          // getSettings for predictive_risk_enabled
          [{ key: 'predictive_risk_enabled', value: 'true' }],
        ],
      });

      const result = await getPredictiveRisk(sql, 'org_1', 'agent-1', 'test', 30);
      expect(result.statistical).toBeDefined();
      expect(result.llm).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/predictive-risk.test.js`
Expected: FAIL — `Cannot find module '@/lib/predictive-risk.js'`

- [ ] **Step 3: Commit**

```bash
git add __tests__/unit/predictive-risk.test.js
git commit -m "test: add failing tests for predictive risk scoring"
```

---

### Task 11: Predictive Risk — Implement the lib module

**Files:**
- Create: `app/lib/predictive-risk.js`

- [ ] **Step 1: Implement predictive-risk.js**

```javascript
/**
 * Predictive Risk Scoring.
 * Statistical behavior analysis (always on) + LLM-enhanced risk assessment (opt-in for high-stakes).
 */

import { executeCompletion } from './providers.js';

const DEFAULT_THRESHOLD = 60;

const DEFAULT_STRATEGY_CONFIG = {
  primary: { provider: 'openai', model: 'gpt-4o-mini' },
  fallback: [
    { provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  ],
  maxRetries: 1,
  maxBudgetUsd: 0.05,
};

/**
 * Compute a statistical risk adjustment from historical action data.
 *
 * @param {{ total: number, failures: number, avg_risk: number|null, recent_count: number }} stats
 * @returns {{ adjustment: number, failure_rate: number, total_actions: number, avg_historical_risk: number|null, velocity: number }}
 */
export function computeStatisticalAdjustment(stats) {
  const { total, failures, avg_risk, recent_count } = stats;
  let adjustment = 0;

  if (total === 0) {
    // Unknown territory
    return {
      adjustment: 5,
      failure_rate: 0,
      total_actions: 0,
      avg_historical_risk: null,
      velocity: 0,
    };
  }

  const failureRate = failures / total;

  if (failureRate > 0.5) {
    adjustment += 15;
  } else if (failureRate > 0.25) {
    adjustment += 10;
  }

  if (recent_count > 5) {
    adjustment += 5;
  }

  return {
    adjustment,
    failure_rate: Math.round(failureRate * 100) / 100,
    total_actions: total,
    avg_historical_risk: avg_risk != null ? Math.round(Number(avg_risk)) : null,
    velocity: recent_count,
  };
}

/**
 * Query historical action stats for this (org, agent, action_type).
 *
 * @param {object} sql
 * @param {string} orgId
 * @param {string} agentId
 * @param {string} actionType
 * @returns {Promise<{ total: number, failures: number, avg_risk: number|null, recent_count: number }>}
 */
async function queryHistoricalStats(sql, orgId, agentId, actionType) {
  const rows = await sql.query(
    `SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'failed') as failures,
      AVG(risk_score) as avg_risk,
      COUNT(*) FILTER (WHERE timestamp_start::timestamptz > NOW() - INTERVAL '1 hour') as recent_count
    FROM action_records
    WHERE org_id = $1
      AND agent_id = $2
      AND action_type = $3
      AND timestamp_start::timestamptz > NOW() - INTERVAL '30 days'`,
    [orgId, agentId, actionType]
  );

  const row = rows[0] || {};
  return {
    total: parseInt(row.total || '0', 10),
    failures: parseInt(row.failures || '0', 10),
    avg_risk: row.avg_risk != null ? Number(row.avg_risk) : null,
    recent_count: parseInt(row.recent_count || '0', 10),
  };
}

/**
 * LLM-based risk assessment for high-stakes actions.
 * Returns { adjustment, reasoning, model } or null on failure (fail-open).
 *
 * @param {object} sql
 * @param {string} orgId
 * @param {string} agentId
 * @param {string} actionType
 * @returns {Promise<{ adjustment: number, reasoning: string, model: string } | null>}
 */
export async function assessRiskWithLLM(sql, orgId, agentId, actionType) {
  try {
    // Fetch last 10 similar actions
    const recentActions = await sql`
      SELECT action_type, status, risk_score, created_at
      FROM action_records
      WHERE org_id = ${orgId}
        AND agent_id = ${agentId}
        AND action_type = ${actionType}
      ORDER BY created_at DESC
      LIMIT 10
    `;

    const historyText = recentActions
      .map((a) => `${a.created_at}: ${a.action_type} → ${a.status} (risk: ${a.risk_score ?? 'N/A'})`)
      .join('\n');

    const messages = [
      {
        role: 'system',
        content: `You are a risk assessment engine for AI agent governance. Given an agent's recent action history, assess the risk of allowing the proposed action. Return ONLY a JSON object with two fields:
- "adjustment": integer from -20 to +20 (positive = increase risk, negative = decrease risk)
- "reasoning": 1-2 sentence explanation

Return ONLY the JSON object, no markdown fences.`,
      },
      {
        role: 'user',
        content: `Agent "${agentId}" wants to perform "${actionType}". Here are their last ${recentActions.length} similar actions:\n\n${historyText}\n\nAssess the risk adjustment.`,
      },
    ];

    const completion = await executeCompletion(sql, orgId, DEFAULT_STRATEGY_CONFIG, messages, {
      max_tokens: 256,
      temperature: 0.2,
    });

    let parsed;
    let cleaned = completion.content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return null;
    }

    const adjustment = Math.max(-20, Math.min(20, parseInt(parsed.adjustment, 10) || 0));
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 500) : '';

    return {
      adjustment,
      reasoning,
      model: completion.model,
    };
  } catch {
    // Fail open — never block on LLM failure
    return null;
  }
}

/**
 * Get the full predictive risk assessment for a guard call.
 *
 * @param {object} sql
 * @param {string} orgId
 * @param {string} agentId
 * @param {string} actionType
 * @param {number} currentRiskScore - The risk score computed so far (base + statistical)
 * @param {{ enabled?: boolean, threshold?: number }} [orgSettings={}]
 * @returns {Promise<{ statistical: object, llm: object|null, total_adjustment: number }>}
 */
export async function getPredictiveRisk(sql, orgId, agentId, actionType, currentRiskScore, orgSettings = {}) {
  if (!agentId || !actionType) {
    return { statistical: null, llm: null, total_adjustment: 0 };
  }

  const stats = await queryHistoricalStats(sql, orgId, agentId, actionType);
  const statistical = computeStatisticalAdjustment(stats);

  const enabled = orgSettings.enabled !== false; // default true for statistical
  const threshold = orgSettings.threshold ?? DEFAULT_THRESHOLD;

  let llm = null;
  const scoreWithStatistical = currentRiskScore + statistical.adjustment;

  // Only call LLM if score is above threshold and feature is explicitly enabled
  if (orgSettings.enabled === true && scoreWithStatistical >= threshold) {
    llm = await assessRiskWithLLM(sql, orgId, agentId, actionType);
  }

  return {
    statistical,
    llm,
    total_adjustment: statistical.adjustment + (llm?.adjustment ?? 0),
  };
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run __tests__/unit/predictive-risk.test.js`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/lib/predictive-risk.js
git commit -m "feat: add predictive risk scoring module"
```

---

### Task 12: Predictive Risk — Integrate into guard engine

**Files:**
- Modify: `app/lib/guard.js:84-281` — add predictive risk call inside `evaluateGuard()`
- Modify: `app/lib/repositories/settings.repository.js:7-42` — add keys to allowlist
- Modify: `drizzle/0000_clammy_falcon.sql` (append) — add composite index

- [ ] **Step 1: Add predictive risk settings keys to the allowlist**

In `app/lib/repositories/settings.repository.js`, add the following two keys to the `VALID_SETTING_KEYS` array, after the `'ENFORCE_AGENT_SIGNATURES'` entry (around line 42):

```javascript
  // Predictive risk scoring
  'PREDICTIVE_RISK_ENABLED',
  'PREDICTIVE_RISK_THRESHOLD',
```

- [ ] **Step 2: Add composite index to schema**

Append to the end of `drizzle/0000_clammy_falcon.sql`:

```sql
-- Predictive risk: fast historical action lookups by (org, agent, action_type)
CREATE INDEX IF NOT EXISTS idx_action_records_predictive
ON action_records (org_id, agent_id, action_type, timestamp_start DESC);
```

- [ ] **Step 3: Integrate predictive risk into evaluateGuard()**

In `app/lib/guard.js`, after the `effectiveRiskScore` calculation (around line 111) and before the policy loop (line 113), add the predictive risk call:

```javascript
  // Predictive risk scoring — statistical analysis of historical behavior
  let predictiveRisk = null;
  try {
    const { getPredictiveRisk } = await import('./predictive-risk.js');
    const { getSettings } = await import('./repositories/settings.repository.js');
    const riskSettings = await getSettings(sql, orgId, { category: 'general' });
    const prEnabled = riskSettings.find(s => s.key === 'PREDICTIVE_RISK_ENABLED')?.value === 'true';
    const prThreshold = parseInt(riskSettings.find(s => s.key === 'PREDICTIVE_RISK_THRESHOLD')?.value, 10) || 60;

    if (context.agent_id && context.action_type) {
      predictiveRisk = await getPredictiveRisk(
        sql, orgId, context.agent_id, context.action_type, effectiveRiskScore,
        { enabled: prEnabled, threshold: prThreshold }
      );
    }
  } catch (e) {
    // Predictive risk is best-effort — never block guard on failure
    console.warn('[Guard] Predictive risk failed:', e.message);
  }

  // Apply statistical adjustment to risk score
  const predictiveAdjustment = predictiveRisk?.total_adjustment ?? 0;
  const adjustedRiskScore = Math.max(0, Math.min(effectiveRiskScore + predictiveAdjustment, 100));
```

Then update the policy evaluation to use `adjustedRiskScore` instead of `effectiveRiskScore`. In the `for (const policy of policies)` loop, change the call at line 126:

```javascript
    const result = await evaluatePolicy(policy, rules, context, sql, orgId, adjustedRiskScore);
```

And in the return object (around line 266-280), add `predictive_risk` and update `risk_score`:

```javascript
  return {
    decision: highestDecision,
    action_id: decisionId,
    reason: reasons.join('; ') || null,
    signals: [...warnings, ...reasons],
    matched_policies: matchedPolicies,
    risk_score: adjustedRiskScore,
    agent_risk_score: agentRiskScore,
    evaluated_at,
    learning: learningContext || undefined,
    ...(recovery ? { recovery } : {}),
    ...(predictiveRisk ? { predictive_risk: predictiveRisk } : {}),
    // Backward compatibility
    reasons,
    warnings,
  };
```

Also update the `guard_decisions` INSERT to use `adjustedRiskScore`:

```javascript
      ${adjustedRiskScore},
```

- [ ] **Step 4: Run the existing guard tests to check nothing breaks**

Run: `npx vitest run __tests__/unit/guard-engine.test.js`
Expected: All existing tests PASS (predictive risk import will be mocked/fail-open).

- [ ] **Step 5: Run the predictive risk tests**

Run: `npx vitest run __tests__/unit/predictive-risk.test.js`
Expected: All tests PASS.

- [ ] **Step 6: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS. No regressions.

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: PASS with no new errors.

- [ ] **Step 8: Commit**

```bash
git add app/lib/guard.js app/lib/predictive-risk.js app/lib/repositories/settings.repository.js drizzle/0000_clammy_falcon.sql
git commit -m "feat: integrate predictive risk scoring into guard engine"
```

---

## Post-Implementation Checklist

- [ ] Run `npm run governance:boundary:check` — verify no boundary violations
- [ ] Run `npm run openapi:check` — verify no API contract drift (new route is under existing `/api/policies` path)
- [ ] Run `npm run test -- --run` — full test suite green
- [ ] Run `npm run lint` — no lint errors
- [ ] Verify `npm run dev` starts cleanly and `/policies/generate` loads
