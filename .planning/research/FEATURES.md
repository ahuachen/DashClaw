# Feature Landscape

**Domain:** Open-source developer tool adoption — AI agent governance platform
**Researched:** 2026-03-17
**Milestone:** Adoption (zero-to-first-governed-action, 10 active instances target)

---

## Research Method

Primary sources: DashClaw codebase analysis (`.env.example`, `deploy-without-oauth.md`,
`QUICK-START.md`, `docs/operator/first-15-minutes.md`, `docs/archive/LAUNCH_DAY_GUIDE.md`,
`README.md`, `sdk/README.md`, `vercel.json`), Vercel deploy button official docs
(verified via WebFetch). Secondary sources: training knowledge on HN launch patterns,
Discord community norms, and integration guide conventions for infrastructure tools.
Confidence noted per section.

**Critical finding from codebase:** `vercel.json` is currently `{}` (empty). The README
has no deploy button. `deploy-without-oauth.md` documents a 9-step manual process
requiring 9 env vars. The setup gap is real and fully confirmed.

---

## Table Stakes

Features developers expect before they will proceed. Missing = drop-off.

### Deploy Button

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Vercel deploy button badge in README | First thing developers look for in any Next.js OSS tool README. Absence signals project is not production-ready. | Low | One URL + one badge. `vercel.json` is currently empty — needs `crons` added too. |
| Auto-provision Neon Postgres via deploy button | DATABASE_URL is the #1 blocker. Without this, deploy button fails silently or requires out-of-flow DB setup. | Medium | Vercel supports `integration-ids` query param in deploy button URL to pre-wire Marketplace integrations. Neon is on Vercel Marketplace. Use `integration-ids=oac_VqOgBHqhEoFTPzGkPd7L0iH6` (Neon's integration ID — verify exact ID before shipping). |
| Inline env var prompts in deploy flow | Vercel deploy button supports `env=VAR1,VAR2` and `envDescription` params. Developers expect to fill secrets in-flow, not hunt for them after. | Low | Must list: `NEXTAUTH_SECRET`, `DASHCLAW_API_KEY`, `ENCRYPTION_KEY`, `CRON_SECRET`. `NEXTAUTH_URL` must be set to the Vercel deployment URL. |
| Secret generation instructions co-located with prompts | Developers stall when they hit "generate a 32-char secret" mid-deploy with no tooling. The `deploy-without-oauth.md` already has a one-liner — it must be surfaced in the deploy button description. | Low | Use `envDescription` param to link to the generation command. |
| `DASHCLAW_LOCAL_ADMIN_PASSWORD` as the primary auth path | OAuth requires creating a GitHub/Google app — a second registration flow that kills momentum. Local password auth is the right default for a self-hosted instance. | Low | Already implemented. Must be surfaced as the recommended path in deploy docs. |
| `/setup` page as post-deploy verifier | After clicking deploy, developers need a single URL that confirms everything worked. `/setup` already exists and does this. Must be the first link in post-deploy instructions. | Low | Already exists. Gap is discoverability — it is not linked prominently from README or deploy completion state. |

### Integration Guides

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Working code snippet for every supported framework in the README | Developers evaluate integration feasibility from the README. If they can't see their framework, they bounce. | Low | README currently says "Works with: LangChain, CrewAI, OpenAI, Anthropic..." but only provides a generic Node/Python snippet. Framework-specific snippets are missing. |
| LangChain/LangGraph integration guide | LangChain is the highest-volume agent framework. Callback system (`BaseCallbackHandler`) is the correct hook point — `on_tool_start`, `on_tool_end`, `on_agent_action`. | Medium | Python-first. DashClaw Python SDK exists. Guide must show a `DashClawCallbackHandler` that wraps `guard()` and `createAction()`. |
| OpenAI Agents SDK integration guide | Fastest-growing framework as of early 2026. Hooks: `on_tool_call`, `RunHooks`, `AgentHooks`. | Medium | Node and Python both needed. SDK v2 maps directly. `on_tool_start` → `guard()`, `on_tool_end` → `updateOutcome()`. |
| Claude Code hooks integration guide | DashClaw already ships `hooks/dashclaw_pretool.py` and `hooks/dashclaw_posttool.py`. This guide already partially exists in `sdk/README.md`. | Low | Needs its own standalone page/guide, not just buried in SDK README. Copy-paste UX must be zero-friction. |
| CrewAI integration guide | CrewAI is the most popular multi-agent framework for Python. Hook point: task `callback` parameter, or wrapping the `execute_task` method. | Medium | Python SDK maps naturally. |
| npm/PyPI install badge in README | Badge signals the package is real, maintained, and published. Already present — good. | None | Already done. |

### Community

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Somewhere to ask questions | Developers evaluating a tool always look for a support channel. Absence signals abandonment risk. | Low | Discord is the right answer for this persona. |
| A place to report bugs / follow progress | GitHub Issues exists already. No additional work needed. | None | Already done. |
| Show HN post within first week | The DashClaw persona (technical, builds agents, cares about control) is exactly the HN audience. A Show HN post that lands well generates 50-200 immediate evaluators. | Low | Writing effort. No code required. |

### Developer Onboarding

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `npx dashclaw-demo` zero-config "Aha!" moment | Already exists. This is the table-stakes entry point. | None | Already done. |
| Time-to-first-governed-action under 10 minutes | Standard expectation for any infra tool. The `deploy-without-oauth.md` path achieves this in theory. The gap is that it requires 9 manual steps. | Medium | Deploy button reduces this to 3 steps: click, fill secrets, visit /setup. |
| `/connect` as the first-agent onboarding page | Already exists. Maps directly to the 4-step governance loop. | None | Already done. |

---

## Differentiators

Features that set DashClaw apart. Not universally expected but create competitive advantage.

### Deploy Button

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Neon integration pre-wired (zero DB setup) | Every competitor requires manual DB provisioning. DashClaw with a working deploy-button-plus-Neon would be uniquely frictionless for a self-hosted governance tool. | Medium | Requires Neon Marketplace integration ID in deploy URL. Must verify exact `integration-ids` value from Vercel Marketplace. HIGH value if it works. |
| Demo-mode screenshot in README | Social proof. Tools with a live screenshot or GIF in the README convert significantly better. README already has `demo-gif2.gif` — this is already differentiated. | None | Already done. |
| Cost callout ("$0 to deploy") | Governance tools are typically expensive SaaS. Making "$0 on free tiers" prominent in the deploy docs is a differentiator. | None | `deploy-without-oauth.md` already includes this. Surface it in README. |

### Integration Guides

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Framework-specific starter repos | Beyond a guide, a standalone runnable repo per framework dramatically reduces integration time. DashClaw already has `examples/openai-governed-agent` with its own README. This pattern is proven. | High | Replicate for LangChain and CrewAI. Lower priority than the guide text itself. |
| `DashClawCallbackHandler` as a drop-in class | For LangChain specifically, a pre-built callback handler class that developers can import and pass to any chain is a genuine differentiator — governance becomes a one-line addition. | Medium | Belongs in the `dashclaw` npm/pip package. Makes the integration guide a one-liner. |
| guardrails.yml shown in integration guides | Showing that governance policy is code (not UI clicks) resonates strongly with the infrastructure persona. Most agent tools don't have this. | Low | `guardrailgen` and `guardrails.yml` already exist. Show a minimal example in each guide. |

### Community

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| "#governed-agents" or "#show-your-agent" channel in Discord | A place for developers to share what they're governing. Creates social proof and organic discovery. | Low | Channel naming, no engineering required. |
| Demo video or Loom linked from README | Video walkthroughs convert early adopters significantly better than text. The `LAUNCH_DAY_GUIDE.md` describes exactly what to record. | Low | Recording effort. |
| X/LinkedIn launch thread with a blocked-action clip | Governance is inherently dramatic ("the agent tried to delete production data and DashClaw stopped it"). A short video of this is highly shareable in the AI developer community. | Low | Content creation. The `npx dashclaw-demo` output is the clip. |

### Developer Onboarding

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Decision Replay URL as the shareable proof artifact | Replay URLs allow a developer to share what DashClaw captured with teammates. This is unique — most governance tools are internal dashboards only. | None | Already implemented. Should be highlighted in onboarding. |
| `/setup` health page as the deploy verification URL | Providing a single URL that proves a deployment is healthy is uncommon for OSS infrastructure. It is a differentiator if prominently surfaced. | None | Already implemented. Gap is discoverability. |

---

## Anti-Features

Features to deliberately NOT build during this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Railway / Render deploy buttons | Out of scope per PROJECT.md. Engineering time is limited. A second deploy button adds maintenance burden before any adoption signal from the first. | Add after first 10 instances are proven. |
| SaaS / hosted version | MIT self-hosted positioning is the core competitive differentiation. A hosted version would require pricing decisions, ToS, support infrastructure — all before product-market fit is confirmed. | Keep self-hosted. Let the deploy button eliminate the setup friction. |
| New governance features | The runtime is feature-complete. Adding features before getting 10 users is optimizing the wrong variable. | Lock the runtime. Focus entirely on distribution. |
| OAuth setup in the default deploy path | GitHub OAuth app creation is a second registration flow. It kills the deploy button's friction reduction. | Surface `DASHCLAW_LOCAL_ADMIN_PASSWORD` as the default. OAuth is documented as an upgrade path. |
| Custom domain / SSL docs | Developers deploying to Vercel get HTTPS automatically. Custom domains are an advanced case. Documenting it now adds noise to the onboarding path. | Link to Vercel's own domain docs if asked. |
| Integration guides for AutoGen | AutoGen's API surface changes frequently and its adoption is lower than LangChain, OpenAI Agents SDK, and CrewAI. It is lower ROI for documentation effort at this stage. | Add after the four priority frameworks are done. |
| Discord bot / slash commands | Governance notifications already work via webhooks. A Discord bot is infrastructure complexity that does not serve the adoption milestone. | Use plain Discord webhook integration already in the runtime. |

---

## Feature Dependencies

```
Vercel deploy button
  └─ requires: vercel.json with cron config (currently empty)
  └─ requires: Neon integration-ids verification (check Vercel Marketplace)
  └─ requires: NEXTAUTH_URL env var documentation updated (must equal Vercel deployment URL)
  └─ enables:  README deploy button badge
  └─ enables:  /setup as post-deploy landing page (already exists)

LangChain integration guide
  └─ requires: Python SDK (already exists)
  └─ optional: DashClawCallbackHandler class in dashclaw pip package
  └─ enables:  framework-specific example repo (higher complexity, defer)

OpenAI Agents SDK integration guide
  └─ requires: Node SDK (already exists)
  └─ requires: Python SDK (already exists)
  └─ enables:  framework-specific example repo (already partially exists)

Discord community
  └─ no dependencies
  └─ enables: Show HN post can reference Discord for follow-up questions
  └─ enables: X/Twitter/LinkedIn launch content can direct to Discord

Show HN post
  └─ requires: deploy button exists (drop-off if deploy is broken at launch)
  └─ requires: at least one integration guide exists (so evaluators can connect an agent)
  └─ ideally:  Discord server exists before post goes live (for community support)

X/LinkedIn launch content
  └─ requires: npx dashclaw-demo works and produces shareable output (already done)
  └─ requires: demo GIF or clip of blocked action (README already has demo-gif2.gif)
  └─ no dependency on deploy button (content can precede deploy button)
```

---

## MVP Recommendation

**Ship in this order:**

1. **Vercel deploy button** — Unblocks every subsequent distribution effort. Until the deploy story is fixed, Show HN and X/LinkedIn launches send people to a broken funnel. Must go first.
   - Add `crons` to `vercel.json`
   - Add deploy button URL to README (above the fold)
   - Verify Neon `integration-ids` against Vercel Marketplace
   - Confirm `NEXTAUTH_URL` auto-population or document exactly

2. **Discord server** — Set up in one hour. Needed before any public launch so evaluators have somewhere to ask questions. No engineering work.

3. **Integration guides** — Priority order: (a) Claude Code (guide already mostly written, just needs its own page), (b) OpenAI Agents SDK (example already exists), (c) LangChain/LangGraph (highest framework volume, Python SDK already exists), (d) CrewAI. Each guide: framework callback hook → guard() → createAction() → updateOutcome(). Show guardrails.yml at the end.

4. **Show HN post** — After deploy button and at least two integration guides are live. The post must have something for people to actually do. Template: problem (agents take unreviewed real-world actions), solution (DashClaw intercepts before execution), proof (npx dashclaw-demo), deploy (button), integrate (guide links).

5. **X/LinkedIn launch content** — Can run in parallel with Show HN. Lead with the "blocked deploy" clip from `npx dashclaw-demo`. Thread format on X, single post with clip on LinkedIn.

**Defer:**
- `DashClawCallbackHandler` as a pip/npm export — high value but requires SDK release, which adds coordination overhead. Start with guide-only, ship callback class as a fast follow.
- Framework-specific starter repos beyond the existing OpenAI example — guides are sufficient for the adoption milestone.
- Railway deploy button — validate Vercel traction first.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Deploy button mechanics | MEDIUM | Vercel docs confirmed existence of `integration-ids`, `env`, `envDescription` params but returned truncated content. The exact Neon integration ID must be verified against Vercel Marketplace before shipping. |
| Env var requirements | HIGH | Sourced directly from `.env.example` and `deploy-without-oauth.md` in the codebase. |
| Framework integration hooks | MEDIUM | Training knowledge on LangChain callbacks, OpenAI Agents SDK hooks, and CrewAI task callbacks is based on knowledge through August 2025. API surfaces may have changed. Each guide must be validated against current docs before publish. |
| Community platform selection | HIGH | Discord is the established default for developer tools with real-time support needs. Confirmed by pattern across comparable OSS tools. |
| Show HN launch best practices | MEDIUM | Based on training knowledge through August 2025. Core conventions (title format "Show HN: [thing] – [what it does]", lead with concrete demo, comment actively in first two hours) are stable patterns. |
| Anti-features | HIGH | Sourced directly from PROJECT.md out-of-scope list and the governance boundary constraint that is CI-enforced. |

---

## Sources

- `C:/Projects/DashClaw/.planning/PROJECT.md` — milestone scope, constraints, out-of-scope list
- `C:/Projects/DashClaw/.env.example` — complete env var surface (9 required vars for Vercel deploy)
- `C:/Projects/DashClaw/docs/deploy-without-oauth.md` — existing manual deploy path (confirms the gap)
- `C:/Projects/DashClaw/docs/operator/first-15-minutes.md` — operator onboarding baseline
- `C:/Projects/DashClaw/docs/archive/LAUNCH_DAY_GUIDE.md` — demo recording runbook
- `C:/Projects/DashClaw/QUICK-START.md` — existing quickstart (confirms /connect and /setup exist)
- `C:/Projects/DashClaw/sdk/README.md` — full SDK surface, Claude Code hooks documentation
- `C:/Projects/DashClaw/README.md` — current README state (no deploy button, no framework guides)
- `C:/Projects/DashClaw/vercel.json` — empty `{}` (confirms no deploy config exists)
- `C:/Projects/DashClaw/examples/openai-governed-agent/README.md` — existing example pattern
- Vercel deploy button docs (https://vercel.com/docs/deploy-button) — HIGH confidence on URL param existence, MEDIUM on exact Neon integration-ids value
