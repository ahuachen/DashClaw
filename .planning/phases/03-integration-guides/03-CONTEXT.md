# Phase 3: Integration Guides - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Four framework-specific integration guide pages (Claude Code, OpenAI Agents SDK, LangChain/LangGraph, CrewAI) that take a developer from a deployed DashClaw instance to a first governed action in under 20 minutes. Includes new Python examples for LangGraph and CrewAI, and navigation wiring from /connect, /self-host, and README.

</domain>

<decisions>
## Implementation Decisions

### Guide format
- **D-01:** In-app JSX pages under `app/guides/` matching /connect's dark theme pattern (`bg-[#0a0a0a]`, PublicNavbar, PublicFooter)
- **D-02:** 5-7 steps per guide: Deploy → Install SDK → Set env vars → Write guard call → Run → See result in dashboard
- **D-03:** Each guide has its own inline guardrails.yml policy example showing governance-as-code in that framework's context — not a shared example
- **D-04:** Code blocks with copy-paste support and live host URL injection (same pattern as /connect's `ConnectGuideClient`)

### Proof moment
- **D-05:** Same proof moment for all 4 guides: "Go to /decisions — you should see your action in the ledger" with a text description of the expected row (action_type, status)
- **D-06:** No screenshots — text description only. No images to maintain.

### Python examples
- **D-07:** Minimal but real — single-file script, one agent, one governed action. Runs in under 30 seconds. Uses real SDK calls, not mocks.
- **D-08:** Use the DashClaw Python SDK (`dashclaw-python` from `sdk-python/`), not raw HTTP calls
- **D-09:** Two new example directories: `examples/langgraph-governed/` and `examples/crewai-governed/` with pinned dependency versions in requirements.txt

### Navigation wiring
- **D-10:** Add a "Framework Guides" section to /connect with 4 cards linking to /guides/claude-code, /guides/openai-agents-sdk, /guides/langgraph, /guides/crewai
- **D-11:** README links to /connect (one link), not to individual guides. /connect cards handle framework selection.
- **D-12:** /self-host page also gets guide links (same 4-card pattern or simple link list)

### Claude's Discretion
- Exact step content and code snippets per guide
- Card layout and styling on /connect
- Whether to create a shared GuideLayout component or keep each page self-contained
- Order of guides on the /connect cards
- guardrails.yml content per framework (as long as it demonstrates governance-as-code)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing guide pattern
- `app/connect/page.js` — Server component, dark theme, PublicNavbar, breadcrumbs, dynamic host injection
- `app/connect/ConnectGuideClient.js` — Client component for interactive guide content with copy-paste code blocks
- `app/lib/connectGuide.js` — `getConnectGuideContent({ host })` generates guide content with live URLs

### Existing examples (reuse patterns)
- `examples/openai-agents-governed/` — Working OpenAI Agents SDK example with README, index.js, package.json
- `examples/claude-code-review-agent/` — Working Claude Code example with README, index.js, package.json, sample-auth.js
- `examples/first-governed-action.py` — Python SDK usage pattern for reference

### SDK references
- `sdk/dashclaw.js` — Node.js SDK v2 (5 core methods)
- `sdk-python/` — Python SDK (guard, create_action, update_outcome, record_assumption, wait_for_approval)

### Navigation targets
- `app/self-host/page.js` — Self-host page needing guide links
- `README.md` — Needs /connect link in deploy section

### UI components
- `app/components/PublicNavbar.js` — Shared navbar for public pages
- `app/components/PublicFooter.js` — Shared footer for public pages

### Phase 2 audit report
- `.planning/phases/02-security-product-audit/02-AUDIT-REPORT.md` — Confirms governance loop works end-to-end, all 4 steps verified

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConnectGuideClient` component — Interactive guide with copy-paste code blocks; can be used as pattern for guide pages
- `getConnectGuideContent()` — Host URL injection pattern; guides should follow this for dynamic API URLs
- `PublicNavbar` / `PublicFooter` — Shared layout components for all public pages
- `examples/openai-agents-governed/` — Existing working example to link from OpenAI guide
- `examples/claude-code-review-agent/` — Existing working example to reference in Claude Code guide

### Established Patterns
- Public pages use `export const dynamic = 'force-dynamic'` and `headers()` for host detection
- Dark theme: `bg-[#0a0a0a] text-white` with zinc color palette
- Breadcrumb navigation: Home → Section → Page
- Code blocks with syntax highlighting and copy button

### Integration Points
- `app/guides/` — New directory, 4 page.js files (one per framework)
- `app/connect/page.js` — Add "Framework Guides" card section
- `app/self-host/page.js` — Add guide links
- `README.md` — Ensure /connect link exists in deploy section
- `examples/langgraph-governed/` — New Python example directory
- `examples/crewai-governed/` — New Python example directory

</code_context>

<specifics>
## Specific Ideas

- Each guide should feel like the /connect page — same dark theme, same copy-paste UX, same "8 minutes to first action" energy
- The guides are conversion tools: a developer who finishes one should feel confident that DashClaw works with their stack
- Python SDK must be the primary interface for LangGraph and CrewAI guides — not raw HTTP

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-integration-guides*
*Context gathered: 2026-03-23*
