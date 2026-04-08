---
source-of-truth: false
owner: SDK Lead
last-verified: 2026-04-07
doc-type: planning
---

# SDK Migration Matrix

## Purpose

This matrix tracks how DashClaw moves from an ambiguous `main + legacy` split to one canonical SDK plus a compatibility layer.

Use it when:

- planning SDK work,
- deciding where new methods should land,
- evaluating whether a legacy method should be promoted,
- checking whether docs are aligned.

## Policy Summary

- Canonical first
- Legacy is compatibility-only
- Promote by domain
- Shim legacy to the same route contracts

## Domain Matrix

| Domain | Current state | Canonical target | Legacy role | Priority | Notes |
|---|---|---|---|---|---|
| Guard / actions / approvals | Main SDK | `runtime` domain in canonical SDK | shim only | P0 | Already part of product spine |
| Sessions / action graph | Main SDK | `operator` or `runtime` domain | shim only | P0 | Important for operator cockpit |
| Workflows | Main SDK plus legacy/history baggage | `execution.workflows` | shim only | P0 | Critical for runtime depth |
| Capabilities | Main SDK plus early legacy/full-surface overlap | `execution.capabilities` | shim only | P0 | Primary commercial wedge |
| Model strategies | Main SDK | `execution.models` | shim only | P0 | Needed for runtime control plane |
| Knowledge collections | Main SDK | `data.knowledge` | shim only | P1 | Keep aligned with workflow and capability usage |
| Messaging / handoffs / context | Main SDK and Python broad surface | `runtime.collaboration` or equivalent | shim only | P1 | Preserve agent coordination semantics |
| Routing | Legacy/Python-heavy | `operator.routing` or `admin.routing` | compatibility until promoted | P1 | Promote after operator cockpit direction is stable |
| Pairing / identities | Legacy/Python-heavy | `admin.identity` | compatibility until promoted | P1 | Important for trust model |
| Compliance | Legacy/Python-heavy | `admin.compliance` | compatibility until promoted | P2 | Keep out of canonical runtime-first story for now |
| Webhooks / activity logs | Legacy/Python-heavy | `admin.integrations` / `operator.activity` | compatibility until promoted | P2 | Do not block runtime consolidation on this |
| Preferences / digest / ideas | Legacy/Python-heavy | undecided | compatibility only | P3 | Not part of near-term spine |

## Migration Workflow

For each promoted domain:

1. verify route contract and OpenAPI coverage,
2. define canonical grouping and method names,
3. implement canonical SDK wrapper,
4. add tests for canonical behavior,
5. make legacy wrapper call through if needed,
6. update README, SDK README, and parity docs.

## Immediate Promotion Candidates

These are the first domains that should set the pattern:

### Candidate 1: Capabilities

- Why: strongest product wedge
- Target: canonical execution namespace
- Needed work:
  - keep `execution.capabilities.invoke(...)`, `test(...)`, `getHealth(...)`, `listHealth(...)`, and `getHistory(...)` as the canonical shipped paths,
  - keep Python aligned to the same capability-runtime HTTP contracts via `invoke_capability(...)`, `test_capability(...)`, `get_capability_health(...)`, `list_capability_health(...)`, and `get_capability_history(...)`,
  - keep legacy flat methods as compatibility shims to the same routes where older integrations already expect them,
  - document the canonical path as primary.

### Candidate 2: Workflows

- Why: central to runtime story
- Target: canonical execution namespace
- Needed work:
  - keep Python aligned to the workflow template HTTP contracts via `list_workflow_templates(...)`, `create_workflow_template(...)`, `get_workflow_template(...)`, `update_workflow_template(...)`, `duplicate_workflow_template(...)`, `launch_workflow_template(...)`, and `execute_workflow_template(...)`,
  - keep launch vs execute semantics explicit,
  - avoid legacy-first method design,
  - align workflow methods with artifact/evidence model.

### Candidate 3: Sessions and operator surfaces

- Why: essential to unified operator cockpit
- Target: canonical operator namespace
- Needed work:
  - align session and action graph methods,
  - keep operator-facing state separate from admin-only tasks.

### Candidate 4: Knowledge collections

- Why: completes the execution-studio convergence sweep
- Target: canonical data and retrieval namespace
- Needed work:
  - keep Python aligned to the knowledge collection HTTP contracts via `list_knowledge_collections(...)`, `create_knowledge_collection(...)`, `get_knowledge_collection(...)`, `update_knowledge_collection(...)`, `list_knowledge_collection_items(...)`, `add_knowledge_collection_item(...)`, `sync_knowledge_collection(...)`, and `search_knowledge_collection(...)`,
  - keep sync and search semantics explicit,
  - keep API contract coverage present for the knowledge collection routes.

## Documentation Checklist Per Domain

When a domain changes, update:

- [README](../../README.md)
- [SDK README](../../sdk/README.md)
- [SDK Parity Matrix](../sdk-parity.md)
- relevant changelog entry

## Questions To Resolve Later

- exact final namespace layout,
- whether Python converges to the same namespaces directly or through compatibility aliases,
- when legacy can be formally deprecated.
