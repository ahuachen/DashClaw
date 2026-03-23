# Phase 3: Integration Guides - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 03-integration-guides
**Areas discussed:** Guide Format, Proof Moment, Python Examples, Navigation Wiring

---

## Guide Format

### Page type

| Option | Description | Selected |
|--------|-------------|----------|
| In-app pages | JSX pages under app/guides/ matching /connect's dark theme + PublicNavbar pattern | ✓ |
| Markdown in repo | Static .md files in docs/guides/. Simpler but no live code injection | |
| Tabs on /connect | Extend /connect page with framework tabs | |

**User's choice:** In-app pages

### Step count

| Option | Description | Selected |
|--------|-------------|----------|
| 5-7 steps | Deploy → Install SDK → Set env vars → Write guard call → Run → See result | ✓ |
| 3-4 steps | Ultra-minimal, assumes more from reader | |
| You decide | Claude determines per framework | |

**User's choice:** 5-7 steps

### guardrails.yml

| Option | Description | Selected |
|--------|-------------|----------|
| Inline per guide | Each guide has framework-specific guardrails.yml example | ✓ |
| Shared example | One guardrails.yml linked from all 4 guides | |
| Both | Shared base + per-guide customization | |

**User's choice:** Inline per guide

---

## Proof Moment

### Dashboard view

| Option | Description | Selected |
|--------|-------------|----------|
| Same for all | Every guide ends with "Go to /decisions" — action visible in ledger | ✓ |
| Framework-specific | Each shows a different DashClaw capability | |
| You decide | Claude picks per framework | |

**User's choice:** Same for all

### Visual proof

| Option | Description | Selected |
|--------|-------------|----------|
| Text description only | Describe expected row, no images to maintain | ✓ |
| Screenshot | Static screenshot of expected dashboard view | |
| You decide | Claude decides per guide | |

**User's choice:** Text description only

---

## Python Examples

### Complexity level

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal but real | Single-file, one agent, one governed action. Under 30 seconds. Real SDK calls. | ✓ |
| Realistic use case | Multi-agent workflow with guard checks at each step | |
| Hello-world stub | Absolute minimum: import, call guard, print result | |

**User's choice:** Minimal but real

### SDK vs HTTP

| Option | Description | Selected |
|--------|-------------|----------|
| Python SDK | Use dashclaw-python SDK. Consistent with Node SDK pattern. | ✓ |
| Raw HTTP | Direct requests to API. No SDK dependency but more verbose. | |
| Both shown | Primary SDK flow, with manual alternative section | |

**User's choice:** Python SDK

---

## Navigation Wiring

### Discovery method

| Option | Description | Selected |
|--------|-------------|----------|
| Cards on /connect | Add "Framework Guides" section to /connect with 4 cards | ✓ |
| Separate /guides page | New landing page with 4 cards | |
| README + /self-host only | Links in README and /self-host, no in-app navigation | |

**User's choice:** Cards on /connect

### README linking

| Option | Description | Selected |
|--------|-------------|----------|
| Link to /connect | One link in README. Cards on /connect handle framework selection. | ✓ |
| Individual links | Four separate links in README, one per framework | |
| Both | One "Get Started" link + table with individual links | |

**User's choice:** Link to /connect

---

## Claude's Discretion

- Exact step content and code snippets per guide
- Card layout and styling on /connect
- Whether to create a shared GuideLayout component
- Order of guides on /connect cards
- guardrails.yml content per framework

## Deferred Ideas

None — discussion stayed within phase scope.
