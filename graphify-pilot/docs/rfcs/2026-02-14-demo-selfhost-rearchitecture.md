---
source-of-truth: false
owner: Platform
last-verified: 2026-02-14
doc-type: rfc
---

# RFC: Demo Site + One-Click Self-Hosting Rearchitecture

## Problem Statement

DashClaw is for people who are new to running agents. The current setup path mixes:

- Marketing site vs. dashboard product vs. API host.
- OAuth setup vs. local use.
- Cryptographic identity enrollment that currently creates support load.

We need a setup that is:

- Hilariously easy for new users.
- Security-forward and transparent (auditable, verifiable agents supported).
- Low marginal cost for the DashClaw operator (do not host per-user dashboards).
- Scales to 50+ agents without making the user do repeated manual steps.

## Goals

- `dashclaw.io` becomes a single place users can go to understand DashClaw and try it.
- A "Live Demo" experience that requires no login and no setup.
- A "Self-host" experience that is one click (or one command) to start locally.
- Users can choose self-host locally, or deploy to their own cloud account (they pay).
- Agents can be brought online quickly and safely (pairing, API keys, approvals).
- Avoid support loops around keys and signatures.

## Non-Goals

- Hosting dashboards for all users under DashClaw's account.
- Building a full enterprise IAM platform right now.
- Perfect cryptographic guarantees in the demo sandbox (demo is illustrative, not a security boundary).

## Target Mental Model (Three Things)

1. **Marketing + Demo (dashclaw.io)**: what DashClaw is, what it looks like, how to self-host.
2. **Your Dashboard (self-hosted)**: your actual data and policies, running on your machine/cloud.
3. **Your Agents**: they send data to your dashboard's base URL, not to dashclaw.io (unless you are intentionally using the demo).

## Deployment Modes

### Mode 1: Demo Sandbox (hosted by DashClaw)

Purpose: "Show me what this is" with no setup.

Requirements:
- No user secrets.
- **Same dashboard UI as self-host** (so users see exactly what they will get).
- Read-only demo dataset representing 50+ agents.
- Clear banners: "Demo data. Not your agents."

Hard security requirement:
- Demo environment must not accept writes to real storage.
- Demo environment must not accept or store real agent secrets.

Implementation sketch:
- Env: `DASHCLAW_MODE=demo`
- Auth: no login required for demo pages.
- API: fixture-backed GET endpoints for the dashboard UI; all mutations return 403.
- Data: deterministic fixtures shipped with the app (no database required for the demo).

### Mode 2: Local Self-Host (user-owned)

Purpose: "Get my own dashboard running in minutes on my computer."

Requirements:
- "One command" to run app + Postgres.
- Automatically generate required secrets.
- No OAuth required for the first-run experience.
- Provide an admin API key and a clickable URL to open the dashboard.

Implementation sketch:
- Provide an install/run script that:
  - ensures Docker Desktop is available (or prints instructions).
  - writes `.env.local` with generated `NEXTAUTH_SECRET`, `DASHCLAW_API_KEY`, `NEXTAUTH_URL`.
  - starts `docker-compose up -d`.
  - prints: dashboard URL + admin key + agent env snippet.

### Mode 3: Cloud Self-Host (user-owned)

Purpose: "Run this in my own cloud with one click and pay myself."

Requirements:
- Provide templates for providers where the user pays (Railway/Render/Fly/Hetzner/etc).
- Provide a documented path for custom reverse proxy and TLS.

Implementation sketch:
- Add deploy templates and a "Deploy" page on `dashclaw.io`.
- Document required env vars and persistence.

## Authentication Rearchitecture (Self-Host Friendly)

Current state: dashboard UI requires OAuth (GitHub/Google) and database-backed NextAuth callbacks.

Target:
- Keep OAuth support for teams and production.
- Add a **Local Admin Password** mode for first-run and small self-hosts.

Proposed behavior:
- If `DASHCLAW_LOCAL_ADMIN_PASSWORD` (or better: a hashed variant) is set:
  - `/login` offers "Local Password" login in addition to OAuth.
  - Local password grants role `admin` within the org.
  - Avoid requiring GitHub/Google credentials for local-only usage.

Security notes:
- Store only a hash (recommended) rather than plaintext. If using plaintext env for MVP, document risk clearly.
- Lock down cookies, CSRF, and rate limiting for the password endpoint.

Files to change:
- `app/login/page.js`: add local password UI when env indicates it is enabled.
- `app/api/auth/*` or new `app/api/auth/local/route.js`: implement local password session issuance.
- `middleware.js`: recognize local auth session and inject `x-org-id`/`x-org-role`.
- `docs/client-setup-guide.md`: document local mode clearly.

## Agent Auth + Identity Binding (Make It Invisible)

### API Keys

Keep the current `x-api-key` model for agents.

Self-host onboarding must surface:
- The dashboard base URL the agent should use (usually `http://<host>:3000` or `https://dashclaw.<yourdomain>`).
- The API key to paste into the agent environment.

### Verified Agents (Cryptographic Signatures)

Keep signatures as an advanced, security-forward option, but remove manual key registration.

Target flow:
- Agent prints a one-click pairing URL.
- User approves from dashboard or from a bulk inbox.
- The public key is registered automatically.

This repo now has the core pairing UX and APIs:
- `/api/pairings` (create/list/fetch)
- `/pair/:pairingId` (one-click approval)
- `/pairings` (bulk inbox, Approve All)

Signature robustness:
- Sign and verify canonical JSON (stable, deterministic).
- Avoid signing `JSON.stringify` of arbitrary objects.

Signature enforcement:
- Do not hard-require signatures unless explicitly enabled.
- Env: `ENFORCE_AGENT_SIGNATURES=true`

## UX Rearchitecture for dashclaw.io

### Landing page CTAs

Replace/clarify the "Dashboard" button:
- "Live Demo" -> goes to demo environment.
- "Self-Host" -> goes to installation flow.

Do not imply dashclaw.io is the user's API base URL unless they are using DashClaw-hosted mode.

### Demo vs Self-Host Onboarding

Demo:
- no login
- no API key
- no agent pairing
- show "Pairing" concept via fake UI or disabled controls

Self-host:
- step-by-step wizard:
  1. Start dashboard (one click/one command)
  2. Copy agent env snippet (base URL + API key)
  3. Optional: enable verified agents (pairing links + approve)

## Concrete Implementation Plan (File-by-File)

### 1) Add "Mode" concept

New env:
- `DASHCLAW_MODE=demo|self_host`

Update:
- `middleware.js`: in demo mode, allow public access to demo pages and block mutations.
- `PROJECT_DETAILS.md`: document modes and required env per mode.

### 2) Demo dataset and read-only API behavior

Add:
- `app/lib/demo/*` fixture generator(s) (deterministic sample data)

Update:
- `middleware.js` in demo mode:
  - serve `/dashboard` and dashboard pages publicly (no login)
  - intercept key `/api/*` GET endpoints and return fixture-backed JSON
  - block all non-GET `/api/*` mutations with 403
  - disable any endpoints not needed for the demo (return 403)

### 3) Demo routes

Add:
- `app/demo` route that redirects into the real dashboard UI (`/dashboard`) in demo mode.

Update:
- `app/page.js` (marketing) to link to `/demo` and `/self-host`.

### 4) Local self-host one-command flow

Update:
- `docker-compose.yml`: keep as baseline; ensure safe defaults and persistence.
- `install-windows.bat` and `install-mac.sh`:
  - generate `NEXTAUTH_SECRET` and `DASHCLAW_API_KEY` automatically.
  - write `.env.local` (server-side env) and print agent env snippet.
  - start `docker-compose up -d`.

Add:
- `docs/self-host/quickstart.md` (single page, copy-paste, minimal).
- `docs/self-host/troubleshooting.md`.

### 5) Local auth (remove OAuth requirement for self-host)

Add:
- `DASHCLAW_LOCAL_ADMIN_PASSWORD_HASH` (preferred) or `DASHCLAW_LOCAL_ADMIN_PASSWORD` (MVP).
- `app/api/auth/local/*` for login.

Update:
- `app/login/page.js`: show local login option when env is set.
- `middleware.js`: trust local session cookie and set `x-org-role=admin`.

Docs:
- `docs/client-setup-guide.md`: "Local auth mode" setup and risks.

### 6) Verified agents UX integration

Update:
- Add "Pairings" link in navigation (already exists in code).
- Add an onboarding panel that points users to `/pairings`.

Docs:
- `docs/client-setup-guide.md`: the "click-to-pair" snippet for agents.

### 7) Domain strategy (dashclaw.io)

Recommended:
- `dashclaw.io` serves marketing + demo.
- Self-host runs on:
  - `http://localhost:3000` for local, or
  - `https://dashclaw.<yourdomain>` for deployed self-host.

If we later provide a managed SaaS tier:
- `app.dashclaw.io` can be a paid hosted dashboard.
- Keep `dashclaw.io` as the front door.

## Security and Transparency Checklist

- Demo mode:
  - No writes.
  - No external key ingestion.
  - Clear warnings and banners.
- Self-host:
  - Local auth is rate limited.
  - API keys are hashed in DB.
  - Pairing approvals require admin.
  - Pairing requests expire quickly (15 minutes).
  - Canonical signing for deterministic verification.
- Docs:
  - Explicitly list what env vars belong on the server vs on agents.
  - "Your agent never needs DATABASE_URL" is repeated in onboarding docs.

## Open Questions

### Decisions (Resolved)

- Demo under the same codebase (this Next.js app).
  - Rationale: speed and shared visual language. Demo is isolated to `/demo` and does not depend on `/api/*`.
- First cloud "user-paid one click" target: Railway.
  - Rationale: easiest path for non-technical users to provision Postgres + env vars with minimal yak shaving.
  - Follow-ups: add Render and Fly templates after Railway is stable.
- Local password mode is single-user (admin) only for v1.
  - Rationale: eliminates OAuth setup and removes 95% of onboarding friction.
  - Follow-ups: multi-user local auth can come later (or be solved by enabling OAuth).
