# DashClaw Launch Day: "Fresh Start" Setup Runbook

This is a step-by-step runbook for recording a DashClaw setup video from a blank slate (fresh database) while keeping your OAuth login working.

Goal: your audience sees onboarding, API key generation, and the security dashboard react to real agent events.

## Phase 0: Clean Slate (Pre-Recording)

Do this before you hit record.

1) Confirm OAuth is already configured in `.env.local`

- `NEXTAUTH_URL=http://localhost:3000`
- `NEXTAUTH_SECRET=...`
- `GITHUB_ID=...` + `GITHUB_SECRET=...` (and/or Google)

Local callback URIs:

- `http://localhost:3000/api/auth/callback/github`
- `http://localhost:3000/api/auth/callback/google`

2) Create a fresh database

- Start a fresh database: `docker compose up -d db` (or create a new Neon project) and copy the connection string.
- Update `DATABASE_URL` in `.env.local`.

3) Run migrations (fresh DB bootstrap)

```bash
node scripts/_run-with-env.mjs scripts/migrate-multi-tenant.mjs
node scripts/_run-with-env.mjs scripts/migrate-cost-analytics.mjs
node scripts/_run-with-env.mjs scripts/migrate-identity-binding.mjs
```

4) Prepare the demo agent folder

- Create a new folder (example: `my-demo-agent`)
- Open two terminal windows:
  - Terminal 1: `DashClaw`
  - Terminal 2: `my-demo-agent`

## Phase 1: Launch The Dashboard (Start Recording)

1) Start the server (Terminal 1)

```bash
npm run dev
```

2) Open the dashboard

- Visit `http://localhost:3000/dashboard`
- Sign in (GitHub or Google)

3) Complete onboarding

- Create a workspace (org)
- Generate the admin API key when prompted
- Tell the audience: "This API key is how agents authenticate to the control plane (x-api-key)."

## Phase 2: Security Flex

1) Open the security page

- Click "Security" in the sidebar (`/security`)

2) Ensure encryption is enabled

If you want to demonstrate the jump from "unencrypted" to "encrypted", temporarily remove `ENCRYPTION_KEY` from `.env.local` before recording.

Generate a 32-character key (16 bytes hex) and set it:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

Set:

```
ENCRYPTION_KEY=<32-hex-chars>
```

Refresh the dashboard and show the security status change.

## Phase 3: Connect An Agent (Live Coding)

1) Initialize agent folder (Terminal 2)

```bash
npm init -y
npm install dashclaw
```

Edit `package.json` and add:

```json
{ "type": "module" }
```

2) Create `index.js`

```javascript
import { DashClaw } from "dashclaw";

const claw = new DashClaw({
  baseUrl: "http://localhost:3000",
  apiKey: process.env.DASHCLAW_API_KEY, // set this in the agent env
  agentId: "video-demo-001",
  agentName: "Demo Assistant",
});

async function run() {
  console.log("Agent reporting for duty...");

  // 1) Normal tracking
  await claw.track(
    { action_type: "research", declared_goal: "Analyze market trends", risk_score: 10 },
    async () => "Market analysis complete."
  );

  // 2) High-risk alert
  await claw.createAction({
    action_type: "deploy",
    declared_goal: "Wiping the production server",
    risk_score: 98,
    reversible: false,
  });
}

run();
```

3) Run the agent (Terminal 2)

Set `DASHCLAW_API_KEY` in your agent shell (paste the key generated in onboarding), then:

```bash
node index.js
```

## Phase 4: Payload (Show It Live)

1) Switch back to the dashboard

- Show the "Research" action appear in the dashboard
- Show the security page light up with a high-risk signal for the "deploy" action

2) Close with the thesis

"DashClaw makes agent behavior observable, governable, and auditable with the same primitives we use for production systems."

