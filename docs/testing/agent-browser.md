---
owner: Platform
last-verified: 2026-04-13
doc-type: guide
---

# Agent Browser for Flow Testing

[`agent-browser`](https://github.com/vercel-labs/agent-browser) is a Vercel Labs CLI that gives AI coding agents (Claude Code, Cursor, Codex, Gemini CLI, etc.) direct, accessibility-tree-based browser control. It's a thin Rust wrapper around Playwright optimized for agent use:

- ~5.7x fewer tokens per test than Playwright MCP or Chrome DevTools MCP
- Uses accessibility-tree snapshots instead of making the agent guess CSS selectors
- Ships with a SKILL.md that Claude Code auto-loads

Use it for **AI-driven flow testing** — when you want the agent to exercise a user journey end-to-end and report what breaks, instead of pre-writing every assertion.

## Install (one time)

```bash
npm install -g agent-browser
agent-browser --version
```

Works alongside the Playwright smoke suite — both depend on the same Chromium install done by `npx playwright install chromium`.

## When to use it vs. Playwright smoke

| | Smoke (Playwright) | Flow (Agent Browser) |
|---|---|---|
| Question | "does every page render cleanly?" | "does the approval flow work end-to-end?" |
| Who decides steps | test code | AI agent, driving intelligently |
| Tokens per run | 0 | ~1,400 per 6-step flow |
| Runs in CI | yes (every PR) | no — on-demand only |
| Replaces | clicking around pages | clicking through a user journey |

## Running a flow interactively

Best invoked via Claude Code — ask Claude to "exercise the approval flow" or "test the webhook create-and-fire cycle" and Claude drives `agent-browser` via the installed SKILL.md.

Direct CLI use:

```bash
# Navigate to the approval PWA, list pending actions, approve one
agent-browser open http://localhost:3000/approve
agent-browser snapshot            # accessibility tree snapshot — cheap for AI
agent-browser click @e42          # click by ref from the snapshot
agent-browser screenshot

# Interactive REPL (agent-browser chat)
agent-browser chat
```

CLI usage should be rare — for repeatable assertions write a Playwright spec under `tests/smoke/` or a new `tests/flow/` directory.

## Useful flows to run periodically

Ideas for Claude to drive on-demand:

1. **End-to-end approval** — agent creates action → policy requires approval → operator approves via `/approve` → action resolves. Verifies the Redis SSE sync works.
2. **Capability edit + test** — go to `/capabilities`, edit a capability, run the Test button, confirm the result panel updates without error.
3. **Policy builder — shields-first** — create a new policy via `/policies`, toggle shields, confirm preview updates.
4. **Workflow draft** — `/workflows` → new template → launch → inspect run.
5. **Analytics trend cards** — `/analytics` with 7-day / 30-day / 90-day toggles, confirm chart rerenders and numbers change.

When Claude finds a bug during one of these flows, the reproducer from `agent-browser` is a deterministic sequence of CLI commands — much easier to triage than "I clicked around and it broke."

## What about CI?

Don't run `agent-browser` in CI by default — it's AI-driven and non-deterministic. The Playwright smoke sweep covers the regression case. Use `agent-browser` for exploration and manual-ish flow QA, not for gatekeeping merges.
