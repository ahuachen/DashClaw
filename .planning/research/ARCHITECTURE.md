# Architecture Patterns

**Domain:** AI agent governance platform — adoption milestone (Vercel deploy, integration guides, community)
**Researched:** 2026-03-17

---

## Context: What Is Being Added

The governance runtime is architecturally complete. This milestone adds four adoption-layer components on top of it:

1. **Vercel deploy button** — `vercel.json` configuration + README deploy badge
2. **Agent integration guides** — documentation pages for LangChain/LangGraph, Claude Code agents, OpenAI Agents SDK, CrewAI/AutoGen
3. **Discord community server** — external, no in-app integration required
4. **Launch content** — Show HN post, X/LinkedIn thread; no in-app work

None of these components modify the governance runtime. They are additive surface changes that sit at the edges of the existing app.

---

## Recommended Architecture

### Component Map

```
┌─────────────────────────────────────────────────────────────┐
│  EXISTING — Governance Runtime (unchanged this milestone)    │
│                                                              │
│  app/api/         7 canonical governance routes              │
│  app/lib/         guard, signals, validate, repositories     │
│  app/(extensions) compliance, drift, evaluations, scoring    │
│  app/connect/     8-minute onboarding path                   │
│  app/docs/        SDK reference (existing page.js)           │
│  app/self-host/   Deploy guide (existing page.js)            │
│  sdk/             Node.js v2 SDK                             │
│  sdk-python/      Python SDK                                 │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  NEW — Adoption Layer (this milestone)                        │
│                                                              │
│  vercel.json          Deploy button config + cron schedule   │
│  README.md            Deploy badge + quick-start snippet     │
│  app/guides/          Integration guide pages (new dir)      │
│    [framework]/page.js  Per-framework guide page             │
│  discord.com/...      Community server (external, no code)   │
└──────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With | In-App? |
|-----------|---------------|-------------------|---------|
| `vercel.json` | Declare cron schedules, framework preset, function config for Vercel deployment | Vercel platform reads at build time | Yes — file in repo root |
| Deploy button URL | Encode required env vars into the one-click flow URL | Vercel new-project wizard; links from README | No — URL only |
| `README.md` deploy badge | Entry point for GitHub visitors | Links to `vercel.com/new/clone?...` | Yes — file in repo root |
| `app/guides/[framework]/page.js` | Static documentation pages for each agent framework | Links to `app/docs`, `app/connect`, `app/self-host` | Yes — new Next.js pages |
| `app/self-host/page.js` (existing) | Vercel + Docker deployment steps | Already exists; may get Vercel button embedded | Yes — existing |
| Discord server | Community support channel | Links from README, `app/self-host`, `app/connect` | No — external |
| Launch content (HN, X, LinkedIn) | Distribution — drives traffic to repo and `/self-host` | External platforms | No — external |

---

## Data Flow

### Deploy Button Flow (user perspective)

```
GitHub README
  → user clicks "Deploy to Vercel" badge
  → vercel.com/new/clone?repository-url=...&env=DATABASE_URL,DASHCLAW_API_KEY,...
  → Vercel forks repo to user's GitHub account
  → Vercel wizard prompts user to fill in env vars
  → Vercel builds and deploys
  → User visits /setup to verify readiness
  → User visits /connect for 8-minute first-agent path
```

No data flows through the app during this process. The deploy button is a URL — all logic lives in Vercel's new-project wizard.

### Integration Guide Flow (developer perspective)

```
Developer finds DashClaw (HN / X / GitHub)
  → lands on README or /self-host
  → clicks "LangChain Guide" (or OpenAI, Claude Code, CrewAI)
  → app/guides/langchain/page.js (static page, no API calls)
  → copies SDK init snippet + guard() example for their framework
  → follows to /connect for live instance connection
```

Guide pages are static. They read no database, call no APIs, touch no governance routes.

### Community Flow (external)

```
User gets stuck post-deploy
  → Discord link in README or /self-host or /connect
  → external server — no in-app integration
```

---

## Patterns to Follow

### Pattern 1: Static Documentation Pages

The existing `app/docs/page.js` and `app/self-host/page.js` establish the pattern for documentation surfaces in this app.

**What:** Pure server component pages — no client state, no API calls, no `use client` except for interactive UI islands (copy buttons, tabs).

**When:** Any new guide page.

**Structure to follow:**
```
app/guides/
  [framework]/
    page.js          ← Server component (metadata export + static JSX)
    [Name]Tabs.js    ← Client component only if tabs/copy interactivity needed
```

The `app/self-host/SetupTabs.js` pattern (client island within server page) is the right model for guide pages that need copy buttons or framework switchers.

**Metadata pattern (from existing `app/docs/page.js`):**
```javascript
export const metadata = {
  title: 'LangChain + DashClaw Integration Guide',
  description: '...',
};
```

### Pattern 2: Shared Layout Components

Guide pages must use the existing public layout components:
- `PublicNavbar` — already used by `/docs`, `/self-host`, `/connect`
- `PublicFooter` — already used by the same pages
- `CopyableCodeBlock` — already exists in `app/components/`

Do not create new layout wrappers. Plug into the existing public-facing component set.

### Pattern 3: vercel.json Cron Registration

DashClaw has cron routes at `/api/cron/signals` and `/api/cron/integration-health`. Currently `vercel.json` is an empty `{}`. For Vercel production deployments, cron jobs must be declared in `vercel.json`.

**Required addition:**
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "crons": [
    { "path": "/api/cron/signals", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/integration-health", "schedule": "0 */6 * * *" }
  ]
}
```

This is not a new feature — it is registering existing cron routes so they fire correctly on Vercel's platform. Without this, signals and integration health checks are silent on Vercel deployments.

### Pattern 4: Deploy Button URL (not vercel.json)

The Vercel deploy button encodes env var requirements in the URL query string, not in `vercel.json`. The `env` parameter is a comma-separated list of env var names; `envDescription` provides a human-readable prompt; `envLink` points to documentation.

**Minimal required env vars for the deploy button URL:**

From `.env.example` analysis, the vars a user must supply on first deploy are:
- `DATABASE_URL` — Neon connection string
- `DASHCLAW_API_KEY` — API key for agent SDK calls
- `ENCRYPTION_KEY` — 32-char string for settings encryption
- `NEXTAUTH_SECRET` — 32-char string for session signing
- `NEXTAUTH_URL` — The deployed app URL

Optional-but-recommended (can be added to button):
- `CRON_SECRET` — Secures cron route invocations on Vercel

Auth provider vars (GitHub OAuth, Google OAuth) are optional and defer to the existing local-admin-password path, reducing required vars from ~20 to 5-6.

**Deploy button URL format:**
```
https://vercel.com/new/clone
  ?repository-url=https://github.com/ucsandman/DashClaw
  &env=DATABASE_URL,DASHCLAW_API_KEY,ENCRYPTION_KEY,NEXTAUTH_SECRET,NEXTAUTH_URL,CRON_SECRET
  &envDescription=Required%20environment%20variables%20for%20DashClaw
  &envLink=https://github.com/ucsandman/DashClaw/blob/main/.env.example
  &demo-title=DashClaw
  &demo-description=AI%20agent%20governance%20runtime
  &demo-url=https://dashclaw.io
```

The badge renders as: `[![Deploy with Vercel](https://vercel.com/button)](URL)`

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: New API Routes for Guides

**What:** Creating `/api/guides/*` routes or database-backed guide content.

**Why bad:** Guide pages are static marketing/documentation content. They do not need database reads, org scoping, or the repository pattern. Any route added to `/api/` must pass `governance:boundary:check` — and guide content is explicitly not a governance concern.

**Instead:** Static Next.js server components in `app/guides/`. Zero API calls.

### Anti-Pattern 2: MDX for Integration Guides

**What:** Installing `@next/mdx` or a docs framework (Nextra, Contentlayer) to render guides from `.mdx` files.

**Why bad:** The existing codebase has zero MDX infrastructure. Adding a new dependency and build pipeline for 4 guide pages adds complexity without proportional value. The existing `app/docs/page.js` (a large static JSX file with code blocks) is already the established pattern. MDX is justified when you have dozens of docs pages maintained by non-engineers; this milestone has 4 pages maintained by the same engineer who builds the runtime.

**Instead:** Follow the `app/docs/page.js` + `app/self-host/SetupTabs.js` pattern — server component with JSX, client islands for interactivity.

### Anti-Pattern 3: In-App Discord Integration

**What:** Adding a Discord widget, embed, or webhook to the app dashboard.

**Why bad:** The governance boundary explicitly excludes platform/social features. Discord is an external community surface. In-app Discord integration would add an archived-tier feature (webhooks already exist in `app/api/_archive/`) back into the governed surface.

**Instead:** Link to the Discord server from README, `/self-host`, and `/connect`. The link is all that's needed at this adoption stage.

### Anti-Pattern 4: Env Var Sprawl in vercel.json

**What:** Trying to declare env var defaults or schema in `vercel.json`.

**Why bad:** `vercel.json` has no `env` block for the deploy wizard. The env var prompting mechanism is exclusively URL query parameters on the deploy button link. Inventing a non-standard `env` key in `vercel.json` will be silently ignored by Vercel.

**Instead:** Encode required vars in the deploy button URL. Keep `.env.example` as the canonical reference (already linked via `envLink` parameter).

### Anti-Pattern 5: Separate Guide App or Subdomain

**What:** Building a separate `docs.dashclaw.io` or `guides.dashclaw.io` site.

**Why bad:** The existing app already has `/docs` and `/self-host` as public pages. A separate site doubles the maintenance surface and breaks the single-deploy story. Vercel's free tier constrains to one project; this milestone must fit in the existing deployment unit.

**Instead:** All guide pages live inside the existing Next.js app at `app/guides/[framework]/page.js`.

---

## Scalability Considerations

| Concern | Now (adoption milestone) | Later (if traction) |
|---------|--------------------------|---------------------|
| Guide pages | 4 static pages in `app/guides/` | Could add MDX pipeline if 20+ pages needed |
| Deploy targets | Vercel only | Railway, Render, Fly.io buttons can reuse same env var set |
| Community | Discord server, no in-app | Could add in-app notification adapter if Discord integration is requested by users |
| Cron execution | Vercel cron (requires Pro for < 1 hour intervals) | Already has Docker + self-host path for users on free tier |

---

## Build Order (Dependencies)

The four adoption components have minimal interdependencies. Recommended build sequence:

```
1. vercel.json (crons + framework)
   └── No dependencies. Enables cron jobs to fire correctly on any Vercel deploy.
       Must land before or alongside the deploy button so first-deployers get working crons.

2. Deploy button URL (README badge + /self-host embed)
   └── Depends on: vercel.json being correct (crons registered)
   └── Required env vars already documented in .env.example (exists)
   └── Unblocks: any user who discovers the repo

3. Integration guide pages (app/guides/[framework]/page.js)
   └── Depends on: nothing in the runtime
   └── Uses: existing PublicNavbar, PublicFooter, CopyableCodeBlock
   └── 4 guides can be built in parallel or sequentially
   └── Links from: README, /self-host, /connect (add links after pages exist)

4. Discord server (external)
   └── No code dependencies
   └── Can be created in parallel with any of the above
   └── Links added to README, /self-host, /connect after server is live

5. Launch content (Show HN, X, LinkedIn)
   └── Depends on: deploy button + at least one integration guide being live
   └── Final step — gates on adoption infrastructure being in place
```

---

## Sources

- Existing codebase: `app/docs/page.js`, `app/self-host/page.js`, `app/self-host/SetupTabs.js` (pattern reference)
- Existing codebase: `.env.example` (env var inventory, confidence: HIGH)
- Existing codebase: `.planning/codebase/ARCHITECTURE.md` (runtime architecture, confidence: HIGH)
- Vercel docs: `vercel.com/docs/project-configuration/vercel-json` (crons block structure, confidence: HIGH)
- Vercel docs: `vercel.com/docs/deploy-button` (deploy button URL format, confidence: HIGH from training + partial doc fetch)
- `.vercel/project.json` confirms project is already connected to Vercel (`prj_Jp0jocDFsJOyMA0MliLt4zwH1RrK`)
