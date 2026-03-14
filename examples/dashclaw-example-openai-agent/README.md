# DashClaw: Intercept and Govern your first agent action

This example demonstrates how to use **DashClaw** to govern AI agent decisions before they reach production systems.

## The Goal
In under 5 minutes, see DashClaw intercept and block a risky agent action.

## Prerequisites
1. A running DashClaw instance (e.g. `npm run dev` in the main repo).
2. Your DashClaw API Key (found in your workspace settings).

## Quick Start

```bash
# 1. Enter the example directory
cd examples/dashclaw-example-openai-agent

# 2. Install dependencies (linked to local sdk for this repo)
npm install

# 3. Set your environment variables
export DASHCLAW_BASE_URL=http://localhost:3000
export DASHCLAW_API_KEY=your_dashclaw_api_key

# 4. Run the agent script
node index.js
```

## What Happens?
1. The script simulates an agent attempting a **high-risk deploy** to production.
2. It calls `claw.guard()` to ask DashClaw for a decision.
3. DashClaw evaluates its policies and returns a **Block** decision.
4. The script catches the `GuardBlockedError` and points you to the Mission Control dashboard to see the record.

## Next Steps
- Open **Mission Control** in your browser to see the blocked decision evidence.
- Try changing the `risk_score` to `10` in `index.js` and see DashClaw allow it.
- Deploy DashClaw to production to govern your real agent fleet.
