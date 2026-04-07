# AutoGen + DashClaw Governance Example

A minimal example showing how to govern an AutoGen agent's tool calls with DashClaw using the 4-step governance loop.

## Prerequisites

- Python 3.10+
- A running DashClaw instance (deploy via the [Vercel button](https://github.com/ucsandman/DashClaw#deploy) or run locally)
- `DASHCLAW_BASE_URL` and `DASHCLAW_API_KEY` from your DashClaw instance

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env` and fill in your DashClaw credentials:
   ```bash
   cp .env.example .env
   ```

4. Run the example:
   ```bash
   python main.py
   ```

5. Open your DashClaw dashboard at `/decisions` to see the governed actions.

## What It Does

This example creates a governed deploy tool that runs two deployments:
1. **Staging deploy** (low risk) — guard allows, action recorded with assumptions
2. **Production deploy** (high risk) — guard may require approval or block based on your policies

No OPENAI_API_KEY is needed — the example runs the governance flow directly without requiring an LLM provider.

## What's Governed

| DashClaw Feature | How It's Used |
|---|---|
| **Guard** | Policy check before each deploy |
| **Action Recording** | Every deploy is tracked with risk score and systems_touched |
| **HITL Approval** | Production deploys wait for human approval when policy requires it |
| **Assumptions** | Each deploy records what the agent believes (tests pass, CI green) |
| **Outcome Tracking** | Success/failure reported back to DashClaw |

## Note

This example calls the tool function directly. In a full AutoGen setup, a `ConversableAgent` would invoke the tool automatically. For production AutoGen integrations, see `sdk-python/dashclaw/integrations/autogen.py` which provides a `DashClawAutoGenIntegration` class with automatic message hooks.
