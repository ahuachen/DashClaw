# Quick Start Guide (v2 Governance Runtime)

DashClaw is a policy firewall for AI agents. This guide will get you from zero to your first **governed agent action** in under 8 minutes.

## ⚡ The 1-Minute Governance Test (Fastest Path)

The absolute fastest way to see DashClaw in action with **zero configuration**:

```bash
npx dashclaw-demo
```

**What happens?**
1. A local DashClaw demo runtime starts automatically.
2. An example agent attempts a high-risk deployment action.
3. DashClaw **intercepts** and **blocks** it.
4. Your browser will open directly to the Decision Replay.

---

## Step 1: Deploy DashClaw (Full Local Environment)
1. **Clone the repo**:
   ```bash
   git clone https://github.com/ucsandman/DashClaw.git
   cd DashClaw
   ```
2. **Run the setup**:
   ```bash
   npm install
   node scripts/setup.mjs
   ```
3. **Start the server**:
   ```bash
   npm run dev
   ```

### Option B: Cloud (Vercel + Neon)
1. Fork this repository.
2. Deploy to Vercel and connect a [Neon Postgres](https://neon.tech) database.
3. Set your `DATABASE_URL` and `NEXTAUTH_SECRET`.

---

## Step 2: Verify the Instance
Open `http://localhost:3000/setup`. This page verifies your database connection and environment variables. Once you see all green checks, you are ready to govern agents.

---

## Step 3: Run the Starter Agent (The Aha! Moment)
Run the canonical starter to record a real governed action.

1. **Enter the example directory**:
   ```bash
   cd examples/openai-governed-agent
   ```
2. **Install and configure**:
   ```bash
   npm install
   cp .env.example .env
   ```
   Edit `.env` and set `DASHCLAW_API_KEY` to the key from your instance (found in `.env.local` after `node scripts/setup.mjs`, or generate a new one at `/api-keys`). `OPENAI_API_KEY` is optional — the agent falls back to a simulated deployment response when it is unset.
3. **Run it**:
   ```bash
   node index.js
   ```
**Result:** The agent runs the full 4-step governance loop — `guard` → `createAction` → `recordAssumption` → `updateOutcome`. Open [Mission Control](http://localhost:3000/mission-control) and watch the Operations Feed light up with the new action, then click through to the Decision Replay to inspect the recorded evidence.

> **See the approval gate fire:** A fresh instance has no policies, so `guard` returns `allow` by default. To see DashClaw pause a risky action for human review, run `node scripts/seed-demo-capabilities.mjs` from the repo root first — the seeded `require_approval` policy will hold the agent at the deploy step until you approve it at [`/approvals`](http://localhost:3000/approvals).

---

## Step 4: Integrate Your Own Agent
Open `http://localhost:3000/connect`. This page provides the **Golden Path** for connecting any real agent (OpenAI, LangChain, CrewAI) using the minimal v2 SDK.

### The 4-Step Governance Loop:
1. **Guard** &rarr; `claw.guard()` checks intent against policy.
2. **Record** &rarr; `claw.createAction()` logs the start of the action.
3. **Verify** &rarr; `claw.recordAssumption()` tracks reasoning basis.
4. **Outcome** &rarr; `claw.updateOutcome()` records the final evidence.

---

## Essential Docs for Developers
- **v2 SDK Reference**: `sdk/README.md`
- **Minimal Runtime API**: `docs/architecture/runtime-api.md`
- **API Inventory**: `docs/api-inventory.md`

## Category Enforcement
DashClaw is infrastructure, not a platform. To prevent "platform creep," we enforce a strict **Governance Boundary** in CI. All new API routes must live in `app/api/_archive/` unless they are core governance primitives.
