# DashClaw — SSE SDK + Framework Examples Design

> **Source:** Grok feedback follow-up — medium-effort builds.
> **Scope:** SSE-powered `waitForApproval()` in both SDKs, AutoGen example, improved CrewAI/LangGraph examples.

---

## 1. SSE-Powered `waitForApproval()` in Both SDKs

### Goal

Replace the polling loop in `waitForApproval()` / `wait_for_approval()` with a real-time SSE connection to the existing `/api/stream` endpoint. Default to SSE, fall back to polling silently on connection failure.

### Server (already exists)

`app/api/stream/route.js` is a fully functional SSE endpoint:
- Org-scoped via `getOrgId(request)`
- Emits `action.updated` events when actions change state (including approval)
- Heartbeat every 15s, 30-minute max connection, `last-event-id` replay support
- Returns 503 when realtime backend is unhealthy

No server changes needed.

### Node SDK (`sdk/dashclaw.js`)

**Current:** `waitForApproval()` at line 148 polls `GET /api/actions/:id` every 5 seconds.

**New behavior:**
1. Open a fetch-based SSE connection to `GET /api/stream` with the SDK's auth headers.
2. Parse SSE frames from the ReadableStream (split on `\n\n`, extract `event:` and `data:` lines).
3. Listen for `action.updated` events where `data.action_id === targetActionId`.
4. On match: run the same approval logic (check `approved_by`, denial, pending state transitions).
5. On SSE connection failure (network error, 503, non-200 response): close the stream and silently fall back to the current polling loop.
6. Clean up: close SSE connection on approval resolution, denial, timeout, or AbortController signal.

**Implementation approach:** Extract the SSE client into a private `_connectSSE()` method that returns an async iterator of parsed events. The `waitForApproval()` method races the SSE listener against a timeout, with polling as the catch fallback.

**No new dependencies.** Uses native `fetch` + `ReadableStream` (Node 18+ built-in). The legacy v1 SDK at `sdk/legacy/dashclaw-v1.js` already had this exact pattern — it can be referenced.

**API unchanged:** `waitForApproval(actionId, { timeout = 300000, interval = 5000 })`. The `interval` parameter is only used during polling fallback.

### Python SDK (`sdk-python/dashclaw/client.py`)

**Current:** `wait_for_approval()` at line 345 polls `GET /api/actions/:id` every 5 seconds.

**New behavior:**
1. Open an HTTP connection to `GET /api/stream` using `urllib.request.urlopen()` with auth headers.
2. Read the stream in chunks, parse SSE frames (split on `\n\n`, extract `event:` and `data:` lines).
3. Listen for `action.updated` events matching the target `action_id`.
4. On match: same approval logic as current polling.
5. On connection failure: silently fall back to current polling loop.
6. Clean up: close connection on resolution.

**No new dependencies.** Uses `urllib.request` (stdlib). The SDK already has zero runtime dependencies and this must stay that way.

**API unchanged:** `wait_for_approval(action_id, timeout=300, interval=5)`.

### SSE Frame Parsing (both SDKs)

SSE protocol is simple:
```
event: action.updated
data: {"action_id":"act_123","status":"running","approved_by":"usr_admin"}

```

Parse rules:
- Split stream on `\n\n` (frame boundary)
- Within each frame: `event:` line = event name, `data:` line = JSON payload
- Lines starting with `:` are comments (heartbeats) — ignore
- Empty frames — ignore

### Fallback Triggers

SSE falls back to polling when:
- `/api/stream` returns non-200 (503 = realtime backend unhealthy)
- Network error during connection
- Stream drops unexpectedly
- SSE is being run on Vercel free tier without Upstash (in-memory backend may not work across serverless invocations)

The fallback is silent — no error thrown, no log spam. The user doesn't need to know which mode is active.

---

## 2. AutoGen Governed Example

### Goal

Add `examples/autogen-governed/` — a minimal, runnable example showing DashClaw governance inside an AutoGen agent tool.

### Files

**`examples/autogen-governed/main.py`:**
- Creates an AutoGen `ConversableAgent` with a governed tool function
- Tool function runs the 4-step governance loop: guard → create_action → record_assumption → update_outcome
- Handles `require_approval` by calling `wait_for_approval()`
- Handles `block` by printing the reason and skipping execution
- No OPENAI_API_KEY required — runs governance flow directly without LLM

**`examples/autogen-governed/requirements.txt`:**
```
dashclaw
autogen-agentchat>=0.4.0
python-dotenv
```

**`examples/autogen-governed/.env.example`:**
```
DASHCLAW_BASE_URL=http://localhost:3000
DASHCLAW_API_KEY=your_api_key
```

**`examples/autogen-governed/README.md`:**
- Matches the format of `examples/crewai-governed/README.md` exactly
- Prerequisites, Setup (venv, install, .env, run), What It Does, What's Governed, Note about production integration class

### Pattern

Follows the existing CrewAI example pattern: governance runs inside the tool function, not as middleware. The tool calls DashClaw before doing its "real work" (simulated), records assumptions, and reports the outcome.

References `sdk-python/dashclaw/integrations/autogen.py` for production use.

---

## 3. Improved CrewAI + LangGraph Examples

### Goal

Make the existing examples demonstrate more DashClaw features beyond the basic guard → action loop.

### CrewAI (`examples/crewai-governed/main.py`)

**Current state:** One tool, guard check, create_action, update_outcome. No HITL, no assumptions.

**Additions:**
1. **Second governed tool** — add a "publish" tool alongside the existing one, showing multi-tool governance with different risk levels.
2. **HITL flow** — when guard returns `require_approval`, call `wait_for_approval()` before proceeding (currently just prints "BLOCKED" and stops).
3. **Assumption recording** — `record_assumption()` call in each tool showing evidence tracking.
4. **"What's Governed" README section** — explains which DashClaw features are demonstrated.

**Still runnable without LLM key.** The governance flow is the point.

### LangGraph (`examples/langgraph-governed/main.py`)

**Current state:** Linear graph: governance_node → research_node → report_node. Guard check in governance_node, action recording, basic outcome.

**Additions:**
1. **Conditional edge on guard decision** — if `require_approval`, route through an `approval_node` that calls `wait_for_approval()`. If `block`, route to an `abort_node`. If `allow`, proceed to research.
2. **Assumption recording** — in the research node.
3. **Outcome recording** — dedicated outcome node that captures success/failure with `update_outcome()`.
4. **"What's Governed" README section** — explains the graph structure and which governance features each node demonstrates.

This better showcases LangGraph's conditional routing integrated with governance decisions.

### Both Examples

- Updated README with "What's Governed" section
- Updated requirements.txt if dependencies changed
- Keep zero LLM key requirement

---

## Implementation Order

1. **SSE Node SDK** — modify `sdk/dashclaw.js` (most impactful, enables faster HITL in the examples too)
2. **SSE Python SDK** — modify `sdk-python/dashclaw/client.py`
3. **AutoGen example** — new `examples/autogen-governed/`
4. **Improve CrewAI example** — modify `examples/crewai-governed/`
5. **Improve LangGraph example** — modify `examples/langgraph-governed/`

Items 3-5 are independent and could be parallelized.

---

## Doc Updates Required

- `sdk-python/README.md` line 53: Remove the "SSE events are currently available in the Node SDK only" note — replace with documentation of SSE support.
- `sdk/README.md`: Update `waitForApproval` description to mention SSE with polling fallback.
- `CHANGELOG.md`: New version entry.

## Out of Scope

- New server-side SSE features (server already complete)
- SDK method additions beyond `waitForApproval` changes
- Streaming events for other SDK methods
- AutoGen integration class improvements (existing `sdk-python/dashclaw/integrations/autogen.py`)
