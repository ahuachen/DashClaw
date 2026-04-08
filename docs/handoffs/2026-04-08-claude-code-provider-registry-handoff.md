# Claude Code Handoff: Provider Registry And Current Platform State

This file is intended to be pasted into Claude Code as a high-context session prompt, with enough product and engineering context to continue DashClaw without re-discovering the recent work.

## Copy-Paste Prompt For Claude Code

```md
You are continuing work on DashClaw in `C:\Projects\DashClaw`.

Current branch state:
- branch: `main`
- latest relevant commit: `1e6daec feat: centralize provider registry metadata`
- recent related commits:
  - `1e6daec feat: centralize provider registry metadata`
  - `b34ac0d fix: validate workflow ai provider models`
  - `d902c7e chore: update anthropic workflow ai models`
  - `5f70229 chore: refresh workflow ai provider models`
  - `4b2614e fix: stabilize workflow ai drafting and python approval waits`
  - `8e7eb33 feat: improve workflow authoring and cleanup UX`
  - `00a52d5 feat: add ai-assisted workflow drafting`
  - `c327f42 feat: add workflow resource pickers and variable helpers`
  - `3e200db feat: replace workflow canvas with executable step builder`
  - `124d99b feat: polish policy action paths`
  - `91498bc feat: move policy import behind advanced panel`

## What DashClaw Has Been Doing

We have been systematically removing raw JSON/YAML and misleading fake abstractions from operator/admin workflows across the product, while also tightening backend contract/CI safety.

The broad product direction has been:
- make the platform operator-friendly
- replace raw config editors with guided builders
- make AI features draft into real product editors instead of generating opaque JSON
- reduce drift between backend contracts, setup scripts, SDKs, docs, and UI
- centralize unstable provider/model metadata so model ids and API compatibility are not duplicated all over the repo

## Major Product/UX Changes Already Shipped

### 1. Capabilities
- The old capability experience was confusing because the UI implied all capability types were runnable/testable, but only `http_api` capabilities were actually executable.
- We replaced the metadata-only create flow with a guided mode split:
  - `Registry entry only`
  - `Runnable HTTP capability`
- Guided runtime/test UI now exists, and metadata-only capabilities no longer pretend to be runnable.
- Relevant files:
  - `app/capabilities/new/page.jsx`
  - `app/capabilities/lib/capabilityFormModel.js`
  - `app/capabilities/[capabilityId]/components/CapabilityTestPanel.jsx`
  - `app/capabilities/[capabilityId]/components/CapabilityGeneratedTestForm.jsx`
  - `app/capabilities/components/CapabilityRegistryCard.jsx`

### 2. Model Strategies
- The raw JSON config editor was replaced with a structured builder:
  - basics
  - execution
  - constraints
  - advanced task-mode overrides
- Summary cards now explain a strategy in plain language.
- Relevant files:
  - `app/model-strategies/new/page.jsx`
  - `app/model-strategies/[strategyId]/page.jsx`
  - `app/model-strategies/lib/modelStrategyFormModel.js`
  - `app/model-strategies/components/ModelStrategyExecutionSection.jsx`
  - `app/model-strategies/components/ModelStrategyAdvancedSection.jsx`

### 3. Policies
- Manual policy authoring now uses guided builders instead of exposing raw rule structure.
- AI policy generation now drafts into the same structured editor instead of dumping raw JSON.
- Raw YAML / advanced import has been pushed behind an explicit advanced path instead of leaking into the default operator lane.
- Relevant files:
  - `app/policies/page.jsx`
  - `app/policies/lib/policyFormModel.js`
  - `app/policies/generate/page.jsx`
  - `app/policies/generate/lib/policyGeneratorDrafts.js`
  - `app/policies/components/PolicyAdvancedImportPanel.jsx`

### 4. Workflows
- The old canvas/graph editor was misleading because runtime execution was strictly sequential and only supported real executable step types.
- We replaced the canvas with an ordered executable step builder.
- Supported runtime step types are now aligned with the actual executor:
  - `knowledge_search`
  - `capability_invoke`
  - `prompt`
- Then we added:
  - linked resource pickers
  - variable insertion helpers
  - AI workflow drafting into the same editor
  - bulk selection + delete on the workflow list
- Relevant files:
  - `app/workflows/new/page.jsx`
  - `app/workflows/[templateId]/page.jsx`
  - `app/workflows/components/WorkflowStepBuilder.jsx`
  - `app/workflows/lib/workflowStepFormModel.js`
  - `app/workflows/lib/workflowDraftFormModel.js`
  - `app/workflows/lib/workflowAiDrafts.js`
  - `app/workflows/components/WorkflowAiDraftPanel.jsx`
  - `app/api/workflows/draft/route.js`
  - `app/api/workflows/templates/[templateId]/route.js`

## Major Platform/Infra Changes Already Shipped

### 1. Contract Validation System
- We introduced `contracts/` manifests and `npm run contracts:check`.
- CI now blocks drift for:
  - schema/setup contracts
  - startup prerequisites
  - env prerequisites
  - SDK surface drift
  - API route drift
- This is validator-first, not generator-first.
- Relevant files:
  - `contracts/`
  - `scripts/check-contracts.mjs`
  - `scripts/lib/contracts/*`

### 2. Startup Smoke Test In CI
- CI now proves the app can migrate, boot, and report setup readiness against ephemeral Postgres.
- Relevant files:
  - `.github/workflows/ci.yml`
  - `scripts/startup-smoke.mjs`
  - `scripts/lib/startup-smoke.mjs`

### 3. Python SDK Convergence
- Python SDK capability/workflow/model-strategy/knowledge surfaces were brought closer to Node and added to contract checks.
- Relevant files:
  - `sdk-python/dashclaw/client.py`
  - `contracts/sdk/public-surface.json`
  - `contracts/sdk/release-plan.json`

## What Was Just Finished

The latest completed slice is a canonical provider/model registry.

### Goal
Stop hardcoding provider/model truth in isolated files and make one curated source of truth for:
- provider ids and labels
- model ids and labels
- API style compatibility
- default models per DashClaw use case
- supported-use-case metadata

### What was implemented
- New canonical registry:
  - `app/lib/providers/providerRegistry.js`
- Workflow AI drafting now uses it:
  - `app/workflows/lib/workflowAiModelCatalog.js`
  - `app/workflows/components/WorkflowAiDraftPanel.jsx`
  - `app/api/workflows/draft/route.js`
- Model strategies now use it:
  - `app/model-strategies/lib/modelStrategyFormModel.js`
  - `app/model-strategies/components/ModelStrategyExecutionSection.jsx`
  - `app/model-strategies/components/ModelStrategyAdvancedSection.jsx`
- Some internal AI defaults were also moved onto it:
  - `app/lib/llm.js`
  - `app/lib/policy-generator.js`
  - `app/lib/predictive-risk.js`
  - `app/lib/integration-health.js`
  - `app/api/settings/test/route.js`

### Current providers in the registry
- OpenAI
- Anthropic
- Groq
- Together
- Perplexity

### Current use-case defaults in the registry
- `workflow_drafting`
- `model_strategies`
- `policy_generation`
- `semantic_guard`
- `predictive_risk`

### Tests added/updated
- `__tests__/unit/provider-registry.test.js`
- `__tests__/unit/workflow-ai-draft-panel.test.jsx`
- `__tests__/unit/workflow-draft.route.test.js`
- `__tests__/unit/model-strategy-form-model.test.js`
- `__tests__/unit/model-strategies-new.page.test.jsx`
- `__tests__/unit/model-strategies-detail.page.test.jsx`
- `__tests__/unit/policy-generator.test.js`
- `__tests__/unit/predictive-risk.test.js`

### Verification already run successfully
- `npx vitest run __tests__/unit/provider-registry.test.js __tests__/unit/policy-generator.test.js __tests__/unit/predictive-risk.test.js __tests__/unit/workflow-ai-draft-panel.test.jsx __tests__/unit/workflow-draft.route.test.js __tests__/unit/model-strategy-form-model.test.js __tests__/unit/model-strategies-new.page.test.jsx __tests__/unit/model-strategies-detail.page.test.jsx __tests__/unit/workflow-new.page.test.jsx`
- `npm run docs:check`
- `npm run contracts:check`
- `npm run build`

## What Was Completed (2026-04-08, session 2)

### Backend execution convergence
`app/lib/providers.js` was refactored to consume provider metadata from `app/lib/providers/providerRegistry.js`:
- Removed `PROVIDER_KEY_MAP` — credential keys now come from `credentialKey` field in the registry
- Replaced 5 copy-pasted per-provider handlers with 2 protocol handlers (`openaiStyleCall`, `anthropicStyleCall`) dispatched by `apiStyle`
- Endpoint URLs and error labels now come from the registry via `getProviderBaseUrl()` and `getProviderLabel()`
- Adding a new provider with an existing `apiStyle` requires zero changes to `providers.js`
- New registry helpers: `getProviderBaseUrl()`, `getProviderCredentialKey()`
- All 47 tests pass, docs:check, contracts:check, and build all green

### Verification already run successfully
- `npx vitest run` (9 test files, 47 tests)
- `npm run docs:check`
- `npm run contracts:check`
- `npm run build`

## What Was Completed (2026-04-08, session 3)

### Capability retry policies (Capability Gateway V2 M2)
Added operator-configurable retry policies to capability invocations:
- `retry_policy` config in `invocation_schema`: max_retries (0-5), backoff (none/fixed/exponential), base_delay_ms, max_delay_ms, retryable_status_codes
- Core retry loop with backoff in `capability-invoke.js` (extracted singleAttempt + retry wrapper)
- Contract validation for all retry_policy fields in `capability-contracts.js`
- Runtime passthrough in `capability-runtime.js`
- `retry_metadata` in invoke and test route responses
- Form model compilation + retry policy UI in create page
- 75 tests pass across 11 capability test files, docs:check, contracts:check, build all green
- Default is 0 retries — backward compatible, no behavior change for existing capabilities

Files changed:
- `app/lib/capability-invoke.js` — retry loop, backoff helpers, retryability checks
- `app/lib/capability-contracts.js` — retry_policy validation
- `app/lib/capability-runtime.js` — passthrough (1 line)
- `app/api/capabilities/[capabilityId]/invoke/route.js` — retry_metadata in responses
- `app/api/capabilities/[capabilityId]/test/route.js` — retry_metadata in responses
- `app/capabilities/lib/capabilityFormModel.js` — compile retry_policy
- `app/capabilities/new/page.jsx` — state + updateRuntime handler
- `app/capabilities/new/components/CapabilityHttpRuntimeSection.jsx` — retry config UI
- `app/capabilities/new/components/CapabilitySummaryCard.jsx` — summary line

## What Was Completed (2026-04-08, session 4)

### Capability circuit breaker (Capability Gateway V2 M2)
Added circuit breaker to auto-block invocations after consecutive failures:
- `circuit_breaker` config in `invocation_schema`: enabled (boolean), consecutive_failures (1-50, default 5)
- `checkCircuitBreaker()` in `capability-health.js` queries last N invoke actions
- Returns 503 `circuit_breaker_open` when all recent invocations failed
- Reset mechanism: operator runs a successful test → sets health_status to 'healthy' → bypasses breaker
- Successful invocations also update health_status to 'healthy' (fire-and-forget)
- Contract validation, form model, UI toggle + threshold in create page
- 87 tests pass, all gates green

### Workflow step retry (Workflow Runtime V2 M1)
Added per-step retry policies to the workflow executor:
- `retry_policy` on each step (sibling to config): max_retries (0-10), backoff (none/fixed/exponential), base_delay_ms, max_delay_ms
- Executor wraps each step in a retry loop with backoff, reusing `calculateBackoffDelay` and `sleep` from capability-invoke.js
- Step results include `retry_metadata` when retries occurred
- `sanitizeRetryPolicy()` in step form model normalizes/validates fields
- Retry config UI in WorkflowStepCard per step
- 26 workflow tests pass, all gates green

## What Still Needs To Happen Next

### Capability Gateway V2 (remaining)
- Capability certification badge flow
- Error rate and p95 latency display on detail page (health cards exist but could be richer)

### Provider registry (remaining)
Continue with the remaining AI/integration surfaces:
- remaining settings/provider UIs
- LLM status/help surfaces
- connection-test logic where provider behavior is still duplicated
- integration-health checks where provider defaults are still too local

Then add a lightweight provider-docs audit workflow:
- a checked-in audit file or maintenance script
- explicit refresh process against official provider docs
- ideally a contract/check so catalog changes are reviewable and intentional

## Important Product Judgment To Preserve

Do not regress on these principles:
- guided builder first, raw JSON/YAML second
- AI should draft into real editors, not dump opaque structure
- the UI should not force users to type internal IDs or schema syntax
- keep the product honest about what is really executable
- prefer narrow, coherent slices over giant redesign sweeps

## Important Engineering Judgment To Preserve

- Do not sweep unrelated local untracked files into commits.
- The repo currently has unrelated local noise in untracked folders/files.
- Local Windows Git hooks are still broken in this environment, so manual verification before `--no-verify` commits has been the normal pattern.
- When Vitest hits Windows sandbox `spawn EPERM`, rerun outside the sandbox rather than misdiagnosing a repo regression.
- `docs:check`, `contracts:check`, and `build` are non-negotiable before calling a slice done.

## Useful Files To Read First In The Next Session

- `app/lib/providers/providerRegistry.js`
- `app/lib/providers.js`
- `app/workflows/lib/workflowAiModelCatalog.js`
- `app/api/workflows/draft/route.js`
- `app/model-strategies/lib/modelStrategyFormModel.js`
- `app/lib/llm.js`
- `app/lib/policy-generator.js`
- `app/lib/predictive-risk.js`
- `docs/superpowers/specs/2026-04-08-provider-registry-and-api-compatibility-design.md`
- `docs/superpowers/plans/2026-04-08-provider-registry-and-api-compatibility.md`

## If You Need A One-Sentence Mission

Continue turning DashClaw into a real operator control plane by centralizing provider correctness in the backend the same way we already centralized it in the editor surfaces and curated registry.
```

## Repo Notes

- This handoff intentionally focuses on the newest work after the older April 7 handoff bundle.
- If you also want a shorter “executive summary” version for another model/session, create a second companion handoff rather than bloating this one further.
