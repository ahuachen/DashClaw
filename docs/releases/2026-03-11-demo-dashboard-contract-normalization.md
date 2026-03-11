---
source-of-truth: false
owner: Platform
last-verified: 2026-03-11
doc-type: release-note
---

# Release Notes: Demo Dashboard Contract Normalization (March 11, 2026)

## Summary

Fixed demo-mode regressions on the marketing-site dashboard where educational fixture content no longer matched the field names expected by the production UI.

## Impacted Surfaces

- `Messages` inbox rows rendered with blank content
- Thread detail views rendered blank message bodies
- Message copy actions returned `undefined`
- Shared docs inside `Messages` crashed on open
- `Policies` crashed on render in demo mode

## Root Cause

The educational demo refresh introduced teaching-oriented fixture records that used source fields such as:

- messages: `sender_id`, `type`, `content`
- threads: `subject`
- shared docs: `title`
- policies: `type`, `config`

The dashboard UI and demo handlers still expected the production contract:

- messages: `from_agent_id`, `message_type`, `body`
- threads: `name`
- shared docs: `name`
- policies: `policy_type`, `rules`

## Resolution

- Demo middleware now normalizes educational fixture records into the production dashboard contract before returning API responses.
- Message, thread, docs, and policy UI components now tolerate missing legacy/demo aliases instead of crashing.
- Middleware security logs were trimmed to avoid logging request-specific details unnecessarily.

## Decision

Demo fixtures may remain teaching-oriented internally, but demo API responses must preserve the same response shape used by the production dashboard. Future demo-content changes should normalize at the demo API boundary rather than forcing page components to adopt parallel schemas.
