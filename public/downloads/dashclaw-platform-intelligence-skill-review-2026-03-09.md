# DashClaw Platform Intelligence Skill Review

Date: 2026-03-09
Context: Wes asked for a review of the `skills/dashclaw-platform-intelligence` skill, focused on whether it is usable for helping users get agents onto the DashClaw dashboard more easily.

## Overall Assessment

The skill is usable and well-structured.

Strengths:
- Good trigger description in frontmatter
- Clear workflow routing in `SKILL.md`
- Helpful progressive disclosure into `references/`
- Concrete operational scripts for validation, diagnosis, and bootstrap
- Strong practical value for agent onboarding, troubleshooting, and integration guidance

Caution areas:
- Some examples assume a different skill-install path than the one used in this workspace
- Some platform claims are broad/confident and should be verified against the current DashClaw repo before treating them as ground truth
- The scope is very broad, which increases the chance of stale sections over time

## Incorrect or Fragile File Paths

### 1. Script invocation examples in `SKILL.md` and references
Several examples use paths like:

```bash
node .claude/skills/dashclaw-platform-intelligence/scripts/validate-integration.mjs
node .claude/skills/dashclaw-platform-intelligence/scripts/diagnose.mjs
```

But in this workspace the actual path is:

```bash
C:\Users\sandm\.openclaw\workspace\skills\dashclaw-platform-intelligence\scripts\validate-integration.mjs
C:\Users\sandm\.openclaw\workspace\skills\dashclaw-platform-intelligence\scripts\diagnose.mjs
```

Suggested fix:
- Replace hardcoded `.claude/skills/...` examples with a neutral relative form, for example:

```bash
node skills/dashclaw-platform-intelligence/scripts/validate-integration.mjs
node skills/dashclaw-platform-intelligence/scripts/diagnose.mjs
```

Better fix:
- Add a short note in `SKILL.md` saying script paths depend on where the skill folder is installed, and examples should be adapted to the local environment.

### 2. Bootstrap helper depends on DashClaw repo layout
`scripts/bootstrap-agent-quick.mjs` resolves a bootstrap script here:

```text
<project-root>/scripts/bootstrap-agent.mjs
```

That is fine if the skill lives in a DashClaw-adjacent workspace with the expected repo structure, but fragile otherwise.

Suggested fix:
- Make the bootstrap script path configurable with a flag like `--bootstrap-script`
- Or detect the script in multiple common locations before failing
- Or clearly document that this helper assumes the local DashClaw repo layout

## Improvement Suggestions

### High priority

1. **Fix installation-path assumptions**
   - Remove `.claude/skills/...` assumptions from examples
   - Use portable examples or explicitly explain that paths vary by installation environment

2. **Split “verified implementation” from “platform vision”**
   - Mark sections as one of:
     - Verified against current repo
     - Pattern/recommendation
     - Forward-looking capability
   - This will make the skill more trustworthy and easier to maintain

3. **Focus the onboarding workflow more aggressively**
   Since the main goal is helping users get agents onto the dashboard easily, add a dedicated quickstart path near the top:
   - install SDK
   - set `DASHCLAW_BASE_URL`
   - set `DASHCLAW_API_KEY`
   - instantiate client
   - create test action
   - confirm action appears in dashboard
   - run validator if it does not

4. **Add a minimum viable integration checklist**
   Include a compact checklist users can follow in 2 to 5 minutes:
   - server reachable
   - API key present
   - SDK installed
   - one `createAction()` call works
   - action visible in dashboard
   - guard test works
   - org context matches dashboard org

### Medium priority

5. **Add “fast path” examples by language/runtime**
   Provide very short, copy-pasteable onboarding examples for:
   - Node.js
   - Python
   - local dev
   - deployed agent

6. **Add a “first successful event” workflow**
   Many users do not care about the full platform first. They just want proof that their agent connected.
   Add a section called something like:
   - “Get your first event into DashClaw in 60 seconds”

7. **Add a troubleshooting matrix for onboarding specifically**
   A compact table would help:
   - symptom
   - likely cause
   - fix

   Example rows:
   - “401 invalid API key”
   - “dashboard empty”
   - “writes blocked in demo mode”
   - “actions created but not visible due to org mismatch”

8. **Add environment-specific examples**
   Some users will run:
   - local self-hosted DashClaw
   - hosted DashClaw
   - demo instance by mistake

   Call those out early because demo-mode confusion is a common failure mode.

9. **Document the expected success signal**
   Explicitly tell users what success looks like:
   - action record visible in dashboard
   - no 401/403
   - agent appears in workspace/mission-control views as applicable

10. **Add a one-command wrapper for the common path**
   If the project supports it, a single helper script could:
   - validate health
   - validate auth
   - create a sample action
   - print the dashboard URL to check

### Lower priority but worthwhile

11. **Reduce overclaim tone in a few spots**
   Phrases like “You know every API route” or strong product-marketing language such as “unique moat” are a little too absolute for an operational skill.
   Better tone:
   - practical
   - precise
   - verifiable

12. **Add freshness markers**
   Include a “last verified against repo on YYYY-MM-DD” note in the skill or reference files.

13. **Add repo verification guidance**
   For platform contributors, the skill should say where to verify current truth:
   - OpenAPI spec
   - route inventory
   - Node SDK source
   - Python SDK source

14. **Add maintenance guidance**
   State which files are most likely to drift and should be refreshed when DashClaw changes:
   - `references/api-surface.md`
   - `references/platform-knowledge.md`
   - onboarding examples in `SKILL.md`

## Suggested Edits to `SKILL.md`

### Add a new top-level section near the top

Suggested section title:
- `## Quickstart: Get an Agent on the Dashboard`

Suggested content flow:
1. Install SDK
2. Set base URL and API key
3. Initialize DashClaw client
4. Send one test action
5. Open dashboard and confirm visibility
6. If it fails, run validator

### Add path note for scripts

Suggested wording:

> Script paths in this skill assume the skill folder is available locally. Adjust the path prefix to match your environment (for example `skills/...`, `.claude/skills/...`, or another installed location).

### Tighten the decision tree
Move the highest-value path to the top:
- “Need to get an agent onto DashClaw quickly?”

That should come before the deeper platform-extension workflows.

## Script-Specific Suggestions

### `validate-integration.mjs`
Good utility. Improvements:
- print a dashboard URL hint after successful validation
- include an explicit org check if possible
- include a dedicated “first action visibility” note

### `diagnose.mjs`
Good utility. Improvements:
- add an onboarding-specific mode or hints
- detect likely demo-mode confusion earlier
- add stronger suggestions for org mismatch cases

### `bootstrap-agent-quick.mjs`
Useful but path-fragile. Improvements:
- support configurable bootstrap script path
- print clearer guidance when the dependent DashClaw script is missing
- possibly support a dry-run summary that explains what kinds of memory/context artifacts will be imported

## Recommended Positioning

This skill should primarily position itself as:
- fastest path to getting an agent visible and useful in DashClaw
- then broader platform operations second

Right now it is strong as a broad platform-intelligence skill.
If the main product goal is onboarding/adoption, it would be even stronger if it biased earlier toward:
- first connection
- first visible action
- first successful dashboard proof
- then expansion into governance, compliance, drift, and advanced analytics

## Bottom Line

Keep the skill. It is good.

Best next improvements:
1. Fix the path assumptions
2. Add a true onboarding quickstart section
3. Add a first-action success workflow
4. Separate verified implementation details from broader guidance
5. Reduce future drift risk with explicit verification/freshness notes
