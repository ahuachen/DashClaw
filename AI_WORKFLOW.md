# AI Workflow Rules

This file defines how AI coding agents should operate inside the DashClaw repository.

These rules apply to Gemini CLI, Claude Code, Codex CLI, and any other coding agent.

The goal is simple:

Make useful changes without breaking the product, the architecture, or the developer experience.

---

# Mission

DashClaw is a policy firewall and governance runtime for AI agents.

Agents working in this repository must optimize for:

- correctness
- clarity
- stability
- small safe changes
- developer usability

Do not optimize for cleverness.

Do not optimize for rewriting large parts of the codebase unless explicitly asked.

---

# Default Working Mode

When given a task, follow this sequence:

1. Read the relevant files first
2. Identify the smallest safe change
3. Explain the plan briefly
4. Make the change
5. Validate the result
6. Summarize what changed

Do not skip directly to editing unless the task is extremely small and obvious.

---

# Read Before Writing

Before making changes, inspect:

- the target file
- nearby components or utilities
- existing patterns in the same area
- any shared types, helpers, or API contracts involved

Do not invent a new pattern when a local pattern already exists.

Prefer consistency over novelty.

---

# Change Size Policy

Prefer:

- small edits
- additive changes
- local refactors
- minimal surface area

Avoid:

- repo wide rewrites
- speculative cleanup
- unrelated refactors
- renaming files or symbols unless required
- changing public APIs unless explicitly requested

If a task would require large structural changes, stop and explain the tradeoffs first.

---

# Architecture Preservation Rules

DashClaw is built around a few critical ideas that should not be diluted.

Preserve these:

- agent decision governance before execution
- lightweight SDK integration
- clear separation between SDK, control plane, and dashboard
- strong developer UX
- modular architecture
- minimal unnecessary dependencies

Do not turn DashClaw into a generic enterprise CRUD product.

Do not weaken the core product narrative in code or copy.

---

# Frontend Rules

For frontend work:

- follow existing Next.js patterns
- use TypeScript
- prefer functional React components
- keep components small and composable
- use Tailwind utilities when possible
- preserve the current design language unless asked to redesign
- avoid unnecessary client side state
- avoid adding new UI libraries unless necessary

When editing marketing pages:

- make the product easier to understand in under 10 seconds
- emphasize the core wedge before the full platform surface
- prefer clear technical language over hype

---

# Backend Rules

For backend work:

- preserve existing API contracts
- avoid tight coupling
- prefer simple readable logic
- keep modules focused
- do not add unnecessary abstractions
- avoid hidden magic

If changing routes, services, or persistence logic:

- inspect adjacent implementations first
- preserve compatibility where possible
- avoid silent behavior changes

---

# SDK Rules

The SDK is strategically important.

Treat it as a product surface, not just helper code.

SDK changes must preserve:

- low complexity
- zero dependency philosophy where applicable
- clear naming
- stable behavior
- framework agnostic usage

Do not add heavy abstractions or unnecessary wrappers.

Every SDK method should feel obvious to a developer reading it for the first time.

---

# Documentation Rules

When writing docs or copy:

Prefer:

- what this does
- why it exists
- how to use it
- when to use it

Avoid:

- vague marketing language
- inflated claims
- long intros before value is clear
- feature dumping without hierarchy

Good docs reduce uncertainty.

---

# UI and Marketing Copy Rules

DashClaw should be presented as:

- a policy firewall for AI agents
- an AI governance runtime
- the layer that governs agents before they act

Do not lead with platform sprawl.

Do not frame the product as just another dashboard.

Lead with the core idea:

Govern AI agents before they act.

Then expand into the broader platform.

---

# Validation Rules

After making changes, validate them appropriately.

Use the smallest relevant validation step first.

Examples:

- inspect the changed file for obvious mistakes
- run targeted lint or type checks if relevant
- run the local page or component if possible
- verify imports and exports
- confirm no accidental formatting corruption

Do not claim something is verified if you did not actually verify it.

Be explicit about what was and was not checked.

---

# Safety Rules

Never:

- expose secrets
- paste environment values into output
- modify unrelated files without reason
- silently delete important logic
- replace working code with placeholders
- fabricate test results
- claim a task is done if key validation is still missing

If uncertain, say so clearly.

---

# Decision Rule for Ambiguous Tasks

If a request is ambiguous:

- infer the most likely intent from repo context
- choose the smallest safe implementation
- explain assumptions briefly

If ambiguity could cause harmful or expensive changes, ask before proceeding.

---

# Expected Output Style

When completing a task, report back in this order:

1. What you changed
2. Which files were touched
3. Why this approach was chosen
4. What was validated
5. Any remaining risks or follow ups

Keep it concise.

---

# DashClaw Specific Product Reminder

DashClaw exists to govern the moment where agent intent becomes real world action.

Agents working in this repo should protect that core concept.

Every change should either:

- strengthen the governance layer
- improve operator clarity
- improve developer adoption
- reduce friction to first governed action
- make the product easier to trust

If a change does none of those things, reconsider it.