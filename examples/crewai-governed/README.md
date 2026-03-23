# CrewAI + DashClaw Governance Example

A minimal example showing how to govern a CrewAI agent's tool calls with DashClaw using the @tool decorator pattern.

## Prerequisites

- Python 3.10+ (required by crewai — Python 3.14+ is not supported)
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

This example creates a CrewAI tool using the `@tool` decorator pattern.
Inside the tool function, it calls DashClaw guard to check policy before
executing, then records the action and reports the outcome.

No OPENAI_API_KEY is needed — the example runs the governance flow directly
without requiring an LLM provider.

## Note

This example uses the DashClaw Python SDK directly (`from dashclaw import DashClaw`).
For production CrewAI integrations, see `sdk-python/dashclaw/integrations/crewai.py`
which provides a `DashClawCrewIntegration` class with automatic task callbacks.
