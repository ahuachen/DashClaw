# Quick Start Guide (v2 Governance Runtime)

DashClaw is a policy firewall for AI agents. This guide will get you from zero to your first **governed agent action** in under 8 minutes.

---

## Step 1: Deploy DashClaw

### Option A: Local Development
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

## Step 3: See a Blocked Action (The Aha! Moment)
The fastest way to see DashClaw in action is to run the canonical example.

1. **Enter the example directory**:
   ```bash
   cd examples/dashclaw-example-openai-agent
   ```
2. **Install and Run**:
   ```bash
   npm install
   export DASHCLAW_BASE_URL=http://localhost:3000
   export DASHCLAW_API_KEY=your_key_from_settings
   node index.js
   ```
**Result:** You will see the agent attempt a deployment and DashClaw **block it** based on the default safety policy.

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
