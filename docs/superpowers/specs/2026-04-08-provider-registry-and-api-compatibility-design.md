# Provider Registry And API Compatibility Design

## Goal

Create one canonical provider registry for DashClaw so provider/model choices, defaults, labels, deprecation state, and API compatibility are not duplicated across workflow drafting, model strategies, policy generation, semantic guardrails, and internal LLM helpers.

This is meant to solve two problems at once:

1. UI and backend surfaces drift because they maintain their own provider/model lists.
2. Backend routes can silently continue using stale model ids or stale provider API assumptions even after the UI is updated.

## Problem Statement

Current provider/model truth is duplicated across multiple places:

- `app/workflows/lib/workflowAiModelCatalog.js`
- `app/model-strategies/lib/modelStrategyFormModel.js`
- `app/model-strategies/components/ModelStrategyExecutionSection.jsx`
- `app/model-strategies/components/ModelStrategyAdvancedSection.jsx`
- `app/lib/llm.js`
- `app/lib/policy-generator.js`
- `app/lib/predictive-risk.js`
- `app/lib/integration-health.js`
- `app/api/settings/test/route.js`

This leads to several classes of drift:

- a workflow picker can be updated while the backend still accepts invalid or deprecated models
- model strategy forms can suggest older provider/model combinations than workflow drafting
- internal AI features can keep defaulting to stale models even after visible UI changes
- provider-specific endpoint semantics remain handwritten in multiple places

## Design Summary

Introduce a shared provider registry module that defines:

- provider metadata
- supported model ids
- human-readable labels
- status metadata such as `active`, `preview`, `deprecated`
- compatibility tags such as `chat`, `reasoning`, `fast`, `cheap`, `long_context`
- route/use-case defaults
- provider API compatibility metadata

All major AI-facing surfaces should read from this registry instead of maintaining local lists.

## Recommended Approach

### Option 1: Canonical registry plus compatibility metadata

One shared registry powers:

- UI dropdowns
- backend model validation
- backend provider dispatch assumptions
- product defaults

This is the recommended approach.

### Option 2: Shared UI catalog only

Use one shared catalog for dropdowns, but keep backend compatibility logic handwritten.

This improves UX consistency but still leaves backend correctness drift.

### Option 3: Dynamic provider syncing

Try to fetch live provider/model data at runtime or in CI.

This is not recommended for v1 because it introduces network variance, key requirements, and unstable product behavior.

## Canonical Registry Shape

Create a shared module, for example:

- `app/lib/providers/providerRegistry.js`

The registry should expose:

- providers by id
- model list per provider
- filtered lists for UI
- defaults for use cases
- compatibility lookup helpers
- validation helpers

### Provider entry fields

Each provider entry should define:

- `id`
- `label`
- `apiStyle`
- `baseUrl`
- `status`
- `models`
- `defaults`
- `supportedUseCases`
- `notes`

### Model entry fields

Each model entry should define:

- `id`
- `label`
- `status`
- `capabilities`
- `recommendedFor`
- `deprecated`
- `hidden`

Example capability tags:

- `chat`
- `reasoning`
- `fast`
- `cheap`
- `long_context`

## API Compatibility Metadata

Provider entries should capture the API style DashClaw actually uses. For example:

- OpenAI: `openai_chat_completions`
- Anthropic: `anthropic_messages`
- Groq: `openai_compatible_chat`
- Together: `openai_compatible_chat`
- Perplexity: `openai_compatible_chat`

The registry should also support compatibility notes such as:

- required version header
- unsupported route types
- migration notes for future endpoint changes

This allows backend routes to rely on registry metadata instead of hardcoding provider behavior in multiple places.

## Validation Rules

### UI rules

- all provider dropdowns are sourced from the registry
- all model dropdowns are filtered from the registry for the selected provider
- deprecated models are hidden by default or clearly marked
- human labels come from the registry instead of handwritten alias maps

### Backend rules

- routes validate selected models against the registry
- routes must not accept arbitrary model ids for known curated selectors
- provider dispatch helpers should derive compatibility behavior from registry metadata when possible
- internal defaults should come from registry defaults, not local constants

## Rollout Order

### Wave 1

Move workflow drafting completely onto the canonical registry.

This includes:

- AI workflow draft picker
- workflow draft route validation
- workflow draft defaults

### Wave 2

Move model strategies onto the registry.

This includes:

- primary provider/model
- fallback rows
- task mode overrides
- summary labeling

### Wave 3

Move internal AI features onto the registry.

This includes:

- policy generator defaults
- predictive risk defaults
- semantic guard/LLM helper defaults
- provider health checks and settings tests

## Provider Docs Audit

The registry should be updated deliberately from official docs, not by runtime scraping.

Add a checked-in audit artifact, for example:

- `docs/providers/provider-doc-audit.md`

or a small structured source such as:

- `contracts/providers/provider-doc-audit.json`

This should record:

- audit date
- official source URLs
- confirmed current model ids used by DashClaw
- deprecation notes
- endpoint compatibility notes

The purpose is not to mirror every provider model. The purpose is to prove that DashClaw’s curated list is current and intentional.

## Contract And Verification Follow-up

After the registry exists, extend the contract system with provider registry validation:

- route consumers should point at the registry instead of maintaining local provider/model constants
- use-case defaults should be declared once
- provider registry drift should be caught by CI

Potential future command:

- `npm run providers:audit:check`

This should validate repository consistency, not scrape the internet during CI.

## Non-Goals

This design does not attempt to:

- support every model every provider exposes
- live-sync provider catalogs in production
- fetch provider docs in CI
- replace all existing LLM abstractions in one change

The v1 goal is a curated, trustworthy, centralized provider/model layer.

## Acceptance Criteria

This work is successful when:

1. Workflow drafting, model strategies, and internal AI helpers no longer keep independent provider/model lists.
2. Provider/model validation is enforced by shared helpers.
3. Deprecated or invalid model ids cannot silently pass curated UI routes.
4. Official-doc verification becomes an explicit maintenance process instead of tribal knowledge.
5. Adding or changing a supported model requires updating one canonical source of truth.
