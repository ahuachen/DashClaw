# LangGraph + DashClaw Governance Example

A minimal example showing how to govern a LangGraph agent's tool calls with DashClaw.

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

5. Open your DashClaw dashboard at `/decisions` to see the governed action.

## What it does

This example creates a simple LangGraph StateGraph with two nodes:
- **governance_node**: Calls DashClaw guard, records the action, and reports the outcome
- **research_node**: Simulates researching a topic (LLM output is simulated — no OPENAI_API_KEY needed)

The governance node runs first, checks policy, then the research node executes if allowed.

## Note

This example uses the DashClaw Python SDK directly (`from dashclaw import DashClaw`).
For production LangChain integrations, see `sdk-python/dashclaw/integrations/langchain.py`
which provides a `DashClawCallbackHandler` for automatic governance of all LLM calls.
