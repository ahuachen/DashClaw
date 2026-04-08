# DashClaw: One-Clipboard Setup (Connect An Agent Machine)

You are helping a non-technical user connect an agent to their self-hosted DashClaw dashboard.

Rules:
- Do NOT ask the user to paste long-lived secrets into chat. If needed, instruct them to paste secrets only into their agent machine environment file/terminal.
- Never ask for `DATABASE_URL`. Agents never need it.

Inputs you need from the user (as short values):
- `DASHCLAW_BASE_URL` (example: `http://localhost:3000` or `https://dashclaw.example.com`)
- `DASHCLAW_API_KEY` (starts with `oc_live_...`)
- `DASHCLAW_AGENT_ID` (unique per agent, example: `cinder`)

## Step 1: Set Agent Environment Variables

On the agent machine, set:

```bash
DASHCLAW_BASE_URL=...
DASHCLAW_API_KEY=...
DASHCLAW_AGENT_ID=...   # optional but recommended; uniquely identifies this agent process
```

## Step 2: Send a Smoke-Test Action

If the agent is Node/TypeScript:

```bash
npm install dashclaw
```

Create a quick test script:

```js
import { DashClaw } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL,
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: process.env.DASHCLAW_AGENT_ID || 'my-agent',
});

// 1. Check policy before acting
const decision = await claw.guard({
  action_type: 'test',
  declared_goal: 'Verify DashClaw connection',
  risk_score: 5,
});

// 2. Record the action
const { action_id } = await claw.createAction({
  action_type: 'test',
  declared_goal: 'Verify DashClaw connection',
  risk_score: 5,
});

// 3. Record what you assumed
await claw.recordAssumption({
  action_id,
  assumption: 'DashClaw instance is reachable',
});

// 4. Close the loop
await claw.updateOutcome(action_id, { status: 'completed' });

console.log('DashClaw action recorded:', action_id);
```

Run it and confirm you can see the action in the dashboard (`/decisions`).

## Step 3 (Optional): Terminal Approval Channel

Install the DashClaw CLI to approve agent actions without opening a browser:

```bash
npm install -g @dashclaw/cli
```

Set env vars (same API key, no extra config needed):

```bash
export DASHCLAW_BASE_URL=...
export DASHCLAW_API_KEY=...
```

Commands:
- `dashclaw approvals` -- interactive inbox for pending actions
- `dashclaw approve <actionId>` -- approve a specific action
- `dashclaw deny <actionId>` -- deny a specific action

When an agent calls `waitForApproval()`, the SDK prints the action ID and a replay link to stdout. Approve from any terminal and the agent unblocks instantly via SSE.

## Step 4: One-Click Agent Pairing (Verified Signatures)

If the user wants cryptographic verification, do NOT make them copy/paste PEMs.

High-level flow:
1. Agent has (or generates) a private key locally.
2. Agent creates a pairing request and prints a one-click approval URL.
3. User clicks approve (or bulk approves in `/pairings`).
4. DashClaw stores the public key, and the agent's signed actions become `verified`.

Node example (private JWK in memory):

```js
// privateKeyJwk: the agent's RSA private key (JWK)
const { pairing, pairing_url } = await claw.createPairingFromPrivateJwk(privateKeyJwk);
console.log('Approve this agent:', pairing_url);
await claw.waitForPairing(pairing.id);
```

After approval, send a signed action and confirm the dashboard marks it verified.

## Step 5: Scaling to 50+ Agents

Best practice:
- Keep one shared `DASHCLAW_API_KEY` per workspace.
- Use a unique `DASHCLAW_AGENT_ID` per agent process.
- Use the Pairings inbox (`/pairings`) to approve many agents quickly.
