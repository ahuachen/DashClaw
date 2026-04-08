# SSE SDK + Framework Examples Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SSE-powered `waitForApproval()` to both Node and Python SDKs (with polling fallback), create an AutoGen governed example, and enhance existing CrewAI + LangGraph examples with HITL, assumptions, and multi-tool governance.

**Architecture:** The server-side SSE endpoint (`app/api/stream/route.js`) already exists. Changes are SDK-side only — both SDKs get a private SSE client that connects to `/api/stream`, listens for `action.updated` events, and falls back to polling on connection failure. Framework examples are independent Python scripts that demonstrate governance patterns.

**Tech Stack:** Node.js 18+ (native fetch + ReadableStream), Python 3.7+ (urllib.request), Vitest for Node tests, AutoGen `autogen-agentchat>=0.4.0`, CrewAI `crewai>=1.11.0`, LangGraph `langgraph>=1.1.0`.

**Source spec:** `docs/superpowers/specs/2026-04-07-sse-sdk-framework-examples-design.md`

---

## Complete File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `sdk/dashclaw.js:148-212` | Add `_connectSSE()` + SSE-first `waitForApproval()` |
| Create | `__tests__/unit/sdk-sse.test.js` | Tests for SSE-powered waitForApproval |
| Modify | `sdk-python/dashclaw/client.py:345-381` | Add `_connect_sse()` + SSE-first `wait_for_approval()` |
| Modify | `sdk/README.md` | Update waitForApproval description |
| Modify | `sdk-python/README.md:53` | Remove "Node SDK only" SSE note |
| Create | `examples/autogen-governed/main.py` | AutoGen governed example |
| Create | `examples/autogen-governed/README.md` | Setup + What's Governed |
| Create | `examples/autogen-governed/requirements.txt` | Dependencies |
| Create | `examples/autogen-governed/.env.example` | DashClaw credentials |
| Modify | `examples/crewai-governed/main.py` | Add publish tool, HITL, assumptions |
| Modify | `examples/crewai-governed/README.md` | Add What's Governed section |
| Modify | `examples/langgraph-governed/main.py` | Conditional routing, approval node, assumptions |
| Modify | `examples/langgraph-governed/README.md` | Add What's Governed section |

---

## Task 1: Node SDK — SSE-powered waitForApproval (tests)

**Files:**
- Create: `__tests__/unit/sdk-sse.test.js`

- [ ] **Step 1: Write SSE test file**

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashClaw, ApprovalDeniedError } from '../../sdk/dashclaw.js';

/**
 * Tests for SSE-powered waitForApproval.
 * Mocks fetch to simulate SSE streams and polling fallback.
 */

function createSSEStream(frames) {
  const encoder = new TextEncoder();
  const chunks = frames.map(f => {
    let text = '';
    if (f.id) text += `id: ${f.id}\n`;
    if (f.event) text += `event: ${f.event}\n`;
    if (f.data) text += `data: ${JSON.stringify(f.data)}\n`;
    text += '\n';
    return encoder.encode(text);
  });

  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++]);
      } else {
        controller.close();
      }
    },
  });
}

function mockSSEResponse(frames) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body: createSSEStream(frames),
  };
}

function mockJSONResponse(data, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
  };
}

describe('SSE-powered waitForApproval', () => {
  let claw;

  beforeEach(() => {
    claw = new DashClaw({
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-key',
      agentId: 'test-agent',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves via SSE when action.updated contains approved_by', async () => {
    global.fetch = vi.fn()
      // First call: SSE stream
      .mockResolvedValueOnce(mockSSEResponse([
        { event: 'connected', data: { status: 'ok' } },
        { event: 'action.updated', data: { action_id: 'act_123', status: 'running', approved_by: 'usr_admin' }, id: 'evt_1' },
      ]))
      // Second call: getAction to confirm (same as polling path)
      .mockResolvedValueOnce(mockJSONResponse({ action: { action_id: 'act_123', status: 'running', approved_by: 'usr_admin' } }));

    const result = await claw.waitForApproval('act_123', { timeout: 5000 });
    expect(result.action.approved_by).toBe('usr_admin');
  });

  it('falls back to polling when SSE returns non-200', async () => {
    global.fetch = vi.fn()
      // First call: SSE fails
      .mockResolvedValueOnce({ ok: false, status: 503, headers: new Headers() })
      // Polling calls
      .mockResolvedValueOnce(mockJSONResponse({ action: { action_id: 'act_123', status: 'running', approved_by: 'usr_admin' } }));

    const result = await claw.waitForApproval('act_123', { timeout: 5000, interval: 100 });
    expect(result.action.approved_by).toBe('usr_admin');
  });

  it('falls back to polling when SSE fetch throws', async () => {
    global.fetch = vi.fn()
      // First call: SSE network error
      .mockRejectedValueOnce(new Error('Network error'))
      // Polling calls
      .mockResolvedValueOnce(mockJSONResponse({ action: { action_id: 'act_123', status: 'running', approved_by: 'usr_admin' } }));

    const result = await claw.waitForApproval('act_123', { timeout: 5000, interval: 100 });
    expect(result.action.approved_by).toBe('usr_admin');
  });

  it('throws ApprovalDeniedError on denial via SSE', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockSSEResponse([
        { event: 'action.updated', data: { action_id: 'act_123', status: 'cancelled', error_message: 'Denied by ops' }, id: 'evt_1' },
      ]))
      .mockResolvedValueOnce(mockJSONResponse({ action: { action_id: 'act_123', status: 'cancelled', error_message: 'Denied by ops' } }));

    await expect(claw.waitForApproval('act_123', { timeout: 5000 }))
      .rejects.toThrow(ApprovalDeniedError);
  });

  it('ignores SSE events for other action IDs', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockSSEResponse([
        { event: 'action.updated', data: { action_id: 'act_OTHER', status: 'running', approved_by: 'usr_1' }, id: 'evt_1' },
        { event: 'action.updated', data: { action_id: 'act_123', status: 'running', approved_by: 'usr_admin' }, id: 'evt_2' },
      ]))
      .mockResolvedValueOnce(mockJSONResponse({ action: { action_id: 'act_123', status: 'running', approved_by: 'usr_admin' } }));

    const result = await claw.waitForApproval('act_123', { timeout: 5000 });
    expect(result.action.approved_by).toBe('usr_admin');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run __tests__/unit/sdk-sse.test.js`
Expected: FAIL — current `waitForApproval` doesn't connect to SSE.

- [ ] **Step 3: Commit**

```bash
git add __tests__/unit/sdk-sse.test.js
git commit -m "test: add failing tests for SSE-powered waitForApproval"
```

---

## Task 2: Node SDK — Implement SSE-powered waitForApproval

**Files:**
- Modify: `sdk/dashclaw.js:148-212`

- [ ] **Step 1: Add `_connectSSE()` private method**

Add this method to the `DashClaw` class, BEFORE the existing `waitForApproval` method (before line 148):

```javascript
  /**
   * Connect to the SSE stream and yield parsed events.
   * @private
   * @param {AbortController} controller - abort to close the stream
   * @returns {AsyncGenerator<{event: string, data: object, id: string|null}>}
   */
  async *_connectSSE(controller) {
    const res = await fetch(`${this.baseUrl}/api/stream`, {
      headers: { 'x-api-key': this.apiKey },
      signal: controller.signal,
    });

    if (!res.ok) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent = null;
    let currentData = '';
    let currentId = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('id: ')) {
          currentId = line.slice(4).trim();
        } else if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          currentData += line.slice(6);
        } else if (line.startsWith(':')) {
          // SSE comment (heartbeat) — ignore
        } else if (line === '' && currentEvent) {
          if (currentData) {
            try {
              yield { event: currentEvent, data: JSON.parse(currentData), id: currentId };
            } catch { /* ignore parse errors */ }
          }
          currentEvent = null;
          currentData = '';
          currentId = null;
        } else if (line === '') {
          currentEvent = null;
          currentData = '';
          currentId = null;
        }
      }
    }
  }
```

- [ ] **Step 2: Replace `waitForApproval` with SSE-first implementation**

Replace the entire `waitForApproval` method (lines 148-212) with:

```javascript
  /**
   * Wait for human approval of a pending action.
   * Tries SSE first for instant notification, falls back to polling on failure.
   */
  async waitForApproval(actionId, { timeout = 300000, interval = 5000 } = {}) {
    const startTime = Date.now();

    // Helper: check action state and resolve/reject/continue
    const checkAction = (action) => {
      if (action.approved_by) return { resolved: true, result: { action } };
      if (action.status === 'failed' || action.status === 'cancelled') {
        return { resolved: true, error: new ApprovalDeniedError(action.error_message || 'Operator denied the action.', action.status) };
      }
      return { resolved: false };
    };

    // Try SSE first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        for await (const frame of this._connectSSE(controller)) {
          if (frame.event === 'action.updated' && frame.data?.action_id === actionId) {
            const check = checkAction(frame.data);
            if (check.resolved) {
              clearTimeout(timeoutId);
              controller.abort();
              if (check.error) throw check.error;
              // Confirm with a fresh GET (SSE data may be partial)
              const confirmed = await this._request(`/api/actions/${actionId}`, 'GET');
              return confirmed;
            }
          }

          if (Date.now() - startTime >= timeout) {
            clearTimeout(timeoutId);
            controller.abort();
            throw new Error(`Timed out waiting for approval of action ${actionId}`);
          }
        }
      } finally {
        clearTimeout(timeoutId);
        if (!controller.signal.aborted) controller.abort();
      }
    } catch (err) {
      // If it's an approval error or timeout, rethrow
      if (err instanceof ApprovalDeniedError || err.message?.includes('Timed out')) throw err;
      // Otherwise SSE failed — fall through to polling
    }

    // Polling fallback
    let wasPending = false;
    let printedBlock = false;

    while (Date.now() - startTime < timeout) {
      const { action } = await this._request(`/api/actions/${actionId}`, 'GET');

      if (!printedBlock) {
        printedBlock = true;
        try {
          const actionType = action.action_type || 'unknown';
          const riskScore = action.risk_score != null ? String(action.risk_score) : '-';
          const goal = action.declared_goal || '-';
          const agent = action.agent_id || this.agentId;
          const replayUrl = `${this.baseUrl}/replay/${actionId}`;

          const lines = [
            '\u2554\u2550\u2550 DashClaw Approval Required \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557',
            `  Action ID:   ${actionId}`,
            `  Agent:       ${agent}`,
            `  Action:      ${actionType}`,
            '  Policy:      require_approval',
            `  Risk Score:  ${riskScore}`,
            `  Goal:        ${goal}`,
            '',
            `  Replay:      ${replayUrl}`,
            '',
            '  Waiting for approval... (Ctrl+C to abort)',
            '\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d',
          ];
          process.stdout.write('\n' + lines.join('\n') + '\n\n');
        } catch (_) { /* rendering failure must not prevent wait */ }
      }

      if (action.status === 'pending_approval') wasPending = true;
      if (action.approved_by) return { action };
      if (action.status === 'failed' || action.status === 'cancelled') {
        throw new ApprovalDeniedError(action.error_message || 'Operator denied the action.', action.status);
      }
      if (wasPending && action.status !== 'pending_approval') {
        throw new Error(`Action ${actionId} left pending_approval state without explicit approval metadata (Status: ${action.status})`);
      }
      if (!wasPending && action.status === 'running') return { action };

      await new Promise(r => setTimeout(r, interval));
    }
    throw new Error(`Timed out waiting for approval of action ${actionId}`);
  }
```

- [ ] **Step 2: Run SSE tests**

Run: `npx vitest run __tests__/unit/sdk-sse.test.js`
Expected: All 5 tests PASS.

- [ ] **Step 3: Run existing HITL tests for regression**

Run: `npx vitest run __tests__/unit/hitl.test.js`
Expected: All existing tests PASS.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add sdk/dashclaw.js
git commit -m "feat: add SSE-powered waitForApproval with polling fallback (Node SDK)"
```

---

## Task 3: Python SDK — SSE-powered wait_for_approval

**Files:**
- Modify: `sdk-python/dashclaw/client.py:345-381`

- [ ] **Step 1: Add `_connect_sse()` private method**

Add this method to the `DashClaw` class, BEFORE the existing `wait_for_approval` method (before line 345):

```python
    def _connect_sse(self, action_id, timeout):
        """
        Connect to the SSE stream and listen for action.updated events.
        Returns the matching action data or None on failure (triggers polling fallback).
        """
        import json as _json
        url = f"{self.base_url}/api/stream"
        req = urllib.request.Request(url, headers={
            "x-api-key": self.api_key,
            "Accept": "text/event-stream",
            "Cache-Control": "no-cache",
        })

        try:
            resp = urllib.request.urlopen(req, timeout=timeout)
        except Exception:
            return None

        buffer = ""
        current_event = None
        current_data = ""
        start_time = time.time()

        try:
            while (time.time() - start_time) < timeout:
                try:
                    chunk = resp.read(4096)
                except Exception:
                    return None
                if not chunk:
                    return None

                buffer += chunk.decode("utf-8", errors="replace")
                lines = buffer.split("\n")
                buffer = lines.pop()

                for line in lines:
                    if line.startswith("id: "):
                        pass  # Track if needed for reconnect
                    elif line.startswith("event: "):
                        current_event = line[7:].strip()
                    elif line.startswith("data: "):
                        current_data += line[6:]
                    elif line.startswith(":"):
                        pass  # SSE comment (heartbeat)
                    elif line == "" and current_event:
                        if current_data and current_event == "action.updated":
                            try:
                                data = _json.loads(current_data)
                                if data.get("action_id") == action_id:
                                    return data
                            except Exception:
                                pass
                        current_event = None
                        current_data = ""
                    elif line == "":
                        current_event = None
                        current_data = ""
        finally:
            try:
                resp.close()
            except Exception:
                pass

        return None
```

- [ ] **Step 2: Replace `wait_for_approval` with SSE-first implementation**

Replace the entire `wait_for_approval` method (lines 345-381) with:

```python
    def wait_for_approval(self, action_id, timeout=300, interval=5):
        """Wait for human approval. Uses SSE for instant notification, falls back to polling."""
        start_time = time.time()

        # Try SSE first
        try:
            remaining = timeout - (time.time() - start_time)
            if remaining > 0:
                sse_data = self._connect_sse(action_id, remaining)
                if sse_data is not None:
                    # Got an SSE event — check approval state
                    if sse_data.get("approved_by"):
                        # Confirm with a fresh GET
                        return self.get_action(action_id)
                    if sse_data.get("status") in ["failed", "cancelled"]:
                        raise ApprovalDeniedError(
                            sse_data.get("error_message") or "Operator denied the action.",
                            decision=sse_data.get("status")
                        )
        except ApprovalDeniedError:
            raise
        except Exception:
            pass  # SSE failed — fall through to polling

        # Polling fallback
        was_pending = False
        while (time.time() - start_time) < timeout:
            res = self.get_action(action_id)
            action = res.get("action", {})

            if action.get("status") == "pending_approval":
                was_pending = True

            if action.get("approved_by"):
                print(f"[DashClaw] Action {action_id} approved by operator: {action.get('approved_by')}")
                return res

            if action.get("status") in ["failed", "cancelled"]:
                raise ApprovalDeniedError(
                    action.get("error_message") or "Operator denied the action.",
                    decision=action.get("status")
                )

            if was_pending and action.get("status") != "pending_approval":
                raise DashClawError(
                    f"Action {action_id} left pending_approval state without explicit approval metadata (Status: {action.get('status')})"
                )

            if not was_pending and action.get("status") == "running":
                return res

            time.sleep(interval)

        raise TimeoutError(f"[DashClaw] Timed out waiting for approval of action {action_id}")
```

- [ ] **Step 3: Run existing Python SDK tests**

Run: `npm run sdk:integration:python`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add sdk-python/dashclaw/client.py
git commit -m "feat: add SSE-powered wait_for_approval with polling fallback (Python SDK)"
```

---

## Task 4: Update SDK docs for SSE

**Files:**
- Modify: `sdk/README.md` — update waitForApproval description
- Modify: `sdk-python/README.md:53` — replace "Node SDK only" note

- [ ] **Step 1: Update Node SDK README**

In `sdk/README.md`, find the line:

```
- `waitForApproval(id)` -- Polling helper for human-in-the-loop approvals
```

Replace with:

```
- `waitForApproval(id)` -- Real-time SSE listener for human-in-the-loop approvals (automatic polling fallback)
```

- [ ] **Step 2: Update Python SDK README**

In `sdk-python/README.md`, find line 53:

```
> **Note:** Real-time SSE events are currently available in the Node SDK only. Python SDK support is planned for a future release (requires an SSE client dependency such as `sseclient-py`). In the meantime, use polling via `wait_for_approval()`.
```

Replace with:

```
Both Node and Python SDKs support real-time SSE events for `waitForApproval()` / `wait_for_approval()`. The SDK connects to `/api/stream` automatically and falls back to polling if SSE is unavailable. Zero additional dependencies required.
```

- [ ] **Step 3: Commit**

```bash
git add sdk/README.md sdk-python/README.md
git commit -m "docs: update SDK READMEs for SSE-powered approval wait"
```

---

## Task 5: AutoGen Governed Example

**Files:**
- Create: `examples/autogen-governed/main.py`
- Create: `examples/autogen-governed/README.md`
- Create: `examples/autogen-governed/requirements.txt`
- Create: `examples/autogen-governed/.env.example`

- [ ] **Step 1: Create .env.example**

```
DASHCLAW_BASE_URL=http://localhost:3000
DASHCLAW_API_KEY=your_api_key
```

- [ ] **Step 2: Create requirements.txt**

```
dashclaw
autogen-agentchat>=0.4.0
python-dotenv
```

- [ ] **Step 3: Create main.py**

```python
"""
AutoGen + DashClaw Governance Example

Demonstrates how to govern an AutoGen tool with the DashClaw 4-step loop:
guard → create_action → record_assumption → update_outcome.

Handles require_approval (HITL) and block decisions.
No OPENAI_API_KEY required — runs the governance flow directly.
"""

import os
from dotenv import load_dotenv
from dashclaw import DashClaw

load_dotenv()

claw = DashClaw(
    base_url=os.environ["DASHCLAW_BASE_URL"],
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="autogen-deploy-agent",
)


def governed_deploy_tool(environment: str) -> str:
    """Deploy to an environment. Governed by DashClaw policies."""

    # 1. GUARD: Check policy before executing
    result = claw.guard({
        "action_type": "deploy",
        "declared_goal": f"Deploy to {environment}",
        "risk_score": 70 if environment == "production" else 30,
        "systems_touched": [environment],
        "reversible": environment != "production",
    })

    decision = result.get("decision", "allow")
    print(f"Guard decision: {decision}")

    if decision == "block":
        reasons = result.get("reasons", [])
        return f"BLOCKED: {', '.join(reasons)}"

    # 2. RECORD: Declare intent
    action = claw.create_action(
        "deploy",
        f"Deploy to {environment}",
        risk_score=70 if environment == "production" else 30,
        systems_touched=[environment],
    )
    action_id = action["action_id"]
    print(f"Action recorded: {action_id}")

    # 3. HITL: Wait for approval if required
    if decision == "require_approval":
        print(f"Waiting for human approval of {action_id}...")
        try:
            claw.wait_for_approval(action_id, timeout=120, interval=5)
            print("Approved!")
        except Exception as e:
            claw.update_outcome(action_id, status="cancelled", error_message=str(e))
            return f"DENIED: {e}"

    # 4. ASSUMPTION: Record what we believe to be true
    claw.record_assumption({
        "action_id": action_id,
        "assumption": f"Tests pass on {environment}",
        "basis": "CI pipeline green for current branch",
    })

    # 5. EXECUTE: Simulated deploy (no real infra needed)
    deploy_result = f"Successfully deployed to {environment}. Version: v2.9.0"

    # 6. OUTCOME: Report result
    claw.update_outcome(
        action_id,
        status="completed",
        output_summary=deploy_result,
    )

    return deploy_result


if __name__ == "__main__":
    print("=== AutoGen + DashClaw Governance Example ===\n")

    # In a full AutoGen setup, a ConversableAgent would call this tool.
    # Here we call it directly to demonstrate the governance flow.

    print("--- Deploy to staging (low risk) ---")
    result1 = governed_deploy_tool("staging")
    print(f"Result: {result1}\n")

    print("--- Deploy to production (high risk, may require approval) ---")
    result2 = governed_deploy_tool("production")
    print(f"Result: {result2}\n")

    base = os.environ.get("DASHCLAW_BASE_URL", "http://localhost:3000")
    print(f"View governed decisions: {base}/decisions")
```

- [ ] **Step 4: Create README.md**

```markdown
# AutoGen + DashClaw Governance Example

A minimal example showing how to govern an AutoGen agent's tool calls with DashClaw using the 4-step governance loop.

## Prerequisites

- Python 3.10+
- A running DashClaw instance (deploy via the [Vercel button](https://github.com/ucsandman/DashClaw#deploy) or run locally)
- `DASHCLAW_BASE_URL` and `DASHCLAW_API_KEY` from your DashClaw instance

## Setup

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env` and fill in your DashClaw credentials:
   ```bash
   cp .env.example .env
   ```

4. Run the example:
   ```bash
   python main.py
   ```

5. Open your DashClaw dashboard at `/decisions` to see the governed actions.

## What It Does

This example creates a governed deploy tool that runs two deployments:
1. **Staging deploy** (low risk) — guard allows, action recorded with assumptions
2. **Production deploy** (high risk) — guard may require approval or block based on your policies

No OPENAI_API_KEY is needed — the example runs the governance flow directly without requiring an LLM provider.

## What's Governed

| DashClaw Feature | How It's Used |
|---|---|
| **Guard** | Policy check before each deploy |
| **Action Recording** | Every deploy is tracked with risk score and systems_touched |
| **HITL Approval** | Production deploys wait for human approval when policy requires it |
| **Assumptions** | Each deploy records what the agent believes (tests pass, CI green) |
| **Outcome Tracking** | Success/failure reported back to DashClaw |

## Note

This example calls the tool function directly. In a full AutoGen setup, a `ConversableAgent` would invoke the tool automatically. For production AutoGen integrations, see `sdk-python/dashclaw/integrations/autogen.py` which provides a `DashClawAutoGenIntegration` class with automatic message hooks.
```

- [ ] **Step 5: Commit**

```bash
git add examples/autogen-governed/
git commit -m "feat: add AutoGen governed agent example"
```

---

## Task 6: Improve CrewAI Example

**Files:**
- Modify: `examples/crewai-governed/main.py`
- Modify: `examples/crewai-governed/README.md`

- [ ] **Step 1: Replace main.py with enhanced version**

```python
"""
CrewAI + DashClaw Governance Example

Demonstrates multi-tool governance with:
- Guard policy checks before each tool execution
- HITL (Human-in-the-Loop) approval for high-risk actions
- Assumption recording for decision evidence
- Outcome tracking for learning loop

No OPENAI_API_KEY required — runs governance flow directly.
"""

import os
from dotenv import load_dotenv
from dashclaw import DashClaw
from crewai.tools import tool

load_dotenv()

claw = DashClaw(
    base_url=os.environ["DASHCLAW_BASE_URL"],
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="crewai-analyst-agent",
)


@tool("Analyze Customer Data")
def analyze_customer_data(query: str) -> str:
    """Analyze customer data based on the query. Governed by DashClaw policies."""

    # 1. GUARD: Check policy before executing
    result = claw.guard({
        "action_type": "research",
        "declared_goal": f"Analyze customer data: {query}",
        "risk_score": 40,
        "systems_touched": ["customer_database"],
    })

    decision = result.get("decision", "allow")
    print(f"[analyze] Guard decision: {decision}")

    if decision == "block":
        reasons = result.get("reasons", [])
        return f"Blocked by governance policy: {', '.join(reasons)}"

    # 2. RECORD: Declare intent
    action = claw.create_action(
        "research",
        f"Analyze customer data: {query}",
        risk_score=40,
        systems_touched=["customer_database"],
    )
    action_id = action["action_id"]
    print(f"[analyze] Action recorded: {action_id}")

    # 3. HITL: Wait for approval if required
    if decision == "require_approval":
        print(f"[analyze] Waiting for human approval of {action_id}...")
        try:
            claw.wait_for_approval(action_id, timeout=120, interval=5)
            print("[analyze] Approved!")
        except Exception as e:
            claw.update_outcome(action_id, status="cancelled", error_message=str(e))
            return f"Denied: {e}"

    # 4. ASSUMPTION: Record reasoning basis
    claw.record_assumption({
        "action_id": action_id,
        "assumption": "Customer database credentials are read-only",
        "basis": "Service account has SELECT-only permissions",
    })

    # 5. EXECUTE: Simulated analysis
    analysis_result = (
        f"Analysis of '{query}': Found 42 matching customer segments "
        f"with avg satisfaction 4.2/5."
    )

    # 6. OUTCOME: Report result
    claw.update_outcome(
        action_id,
        status="completed",
        output_summary=analysis_result,
    )

    return analysis_result


@tool("Publish Report")
def publish_report(title: str) -> str:
    """Publish an analysis report externally. Higher risk — may require approval."""

    # 1. GUARD: Higher risk action
    result = claw.guard({
        "action_type": "post",
        "declared_goal": f"Publish report: {title}",
        "risk_score": 65,
        "systems_touched": ["external_api", "customer_portal"],
        "reversible": False,
    })

    decision = result.get("decision", "allow")
    print(f"[publish] Guard decision: {decision}")

    if decision == "block":
        reasons = result.get("reasons", [])
        return f"Blocked by governance policy: {', '.join(reasons)}"

    # 2. RECORD
    action = claw.create_action(
        "post",
        f"Publish report: {title}",
        risk_score=65,
        systems_touched=["external_api", "customer_portal"],
    )
    action_id = action["action_id"]
    print(f"[publish] Action recorded: {action_id}")

    # 3. HITL
    if decision == "require_approval":
        print(f"[publish] Waiting for human approval of {action_id}...")
        try:
            claw.wait_for_approval(action_id, timeout=120, interval=5)
            print("[publish] Approved!")
        except Exception as e:
            claw.update_outcome(action_id, status="cancelled", error_message=str(e))
            return f"Denied: {e}"

    # 4. ASSUMPTION
    claw.record_assumption({
        "action_id": action_id,
        "assumption": "Report data has been reviewed and is non-sensitive",
        "basis": "Analyst confirmed no PII in output",
    })

    # 5. EXECUTE
    publish_result = f"Report '{title}' published to customer portal."

    # 6. OUTCOME
    claw.update_outcome(
        action_id,
        status="completed",
        output_summary=publish_result,
    )

    return publish_result


if __name__ == "__main__":
    print("=== CrewAI + DashClaw Governance Example ===\n")

    print("--- Tool 1: Analyze Customer Data (low risk) ---")
    result1 = analyze_customer_data.run("high-value customers in Q4")
    print(f"Result: {result1}\n")

    print("--- Tool 2: Publish Report (higher risk) ---")
    result2 = publish_report.run("Q4 High-Value Customer Analysis")
    print(f"Result: {result2}\n")

    base = os.environ.get("DASHCLAW_BASE_URL", "http://localhost:3000")
    print(f"View governed decisions: {base}/decisions")
```

- [ ] **Step 2: Update README.md — append "What's Governed" section**

Add before the existing `## Note` section:

```markdown
## What's Governed

| DashClaw Feature | How It's Used |
|---|---|
| **Guard** | Policy check before each tool call (different risk levels per tool) |
| **Action Recording** | Both tools record intent with risk scores and systems_touched |
| **HITL Approval** | High-risk tools wait for human approval when policy requires it |
| **Assumptions** | Each tool records its reasoning basis (read-only access, reviewed data) |
| **Outcome Tracking** | Success/failure/cancellation reported for the learning loop |
| **Multi-Tool Governance** | Two tools with different risk profiles show graduated governance |
```

- [ ] **Step 3: Commit**

```bash
git add examples/crewai-governed/
git commit -m "feat: enhance CrewAI example with HITL, assumptions, multi-tool governance"
```

---

## Task 7: Improve LangGraph Example

**Files:**
- Modify: `examples/langgraph-governed/main.py`
- Modify: `examples/langgraph-governed/README.md`

- [ ] **Step 1: Replace main.py with enhanced version**

```python
"""
LangGraph + DashClaw Governance Example

Demonstrates conditional graph routing based on governance decisions:
- allow → research → outcome
- require_approval → approval → research → outcome
- block → abort

Shows assumptions, HITL approval, and outcome recording.
No OPENAI_API_KEY required.
"""

import os
from dotenv import load_dotenv
from dashclaw import DashClaw
from langgraph.graph import StateGraph, END
from typing import TypedDict

load_dotenv()

class AgentState(TypedDict):
    topic: str
    research_result: str
    governance_decision: str
    action_id: str


claw = DashClaw(
    base_url=os.environ["DASHCLAW_BASE_URL"],
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="langgraph-research-agent",
)


def governance_node(state: AgentState) -> AgentState:
    """Check DashClaw guard and record the action."""
    result = claw.guard({
        "action_type": "research",
        "declared_goal": f"Research topic: {state['topic']}",
        "risk_score": 45,
        "systems_touched": ["web_search", "knowledge_base"],
    })
    decision = result.get("decision", "allow")
    print(f"[governance] Guard decision: {decision}")

    if decision == "block":
        print(f"[governance] BLOCKED: {result.get('reasons', [])}")
        return {**state, "governance_decision": "blocked"}

    # Record the action
    action = claw.create_action(
        "research",
        f"Research topic: {state['topic']}",
        risk_score=45,
        systems_touched=["web_search", "knowledge_base"],
    )
    action_id = action["action_id"]
    print(f"[governance] Action recorded: {action_id}")
    return {**state, "governance_decision": decision, "action_id": action_id}


def approval_node(state: AgentState) -> AgentState:
    """Wait for human approval before proceeding."""
    action_id = state.get("action_id")
    if not action_id:
        return {**state, "governance_decision": "blocked"}

    print(f"[approval] Waiting for human approval of {action_id}...")
    try:
        claw.wait_for_approval(action_id, timeout=120, interval=5)
        print("[approval] Approved!")
        return {**state, "governance_decision": "allow"}
    except Exception as e:
        print(f"[approval] Denied: {e}")
        claw.update_outcome(action_id, status="cancelled", error_message=str(e))
        return {**state, "governance_decision": "blocked"}


def research_node(state: AgentState) -> AgentState:
    """Simulate research and record assumptions."""
    action_id = state.get("action_id")

    # Record assumption
    if action_id:
        claw.record_assumption({
            "action_id": action_id,
            "assumption": "Web search results are from reputable sources",
            "basis": "Using curated knowledge base with source verification",
        })

    # Simulated research
    result = f"Research complete for '{state['topic']}': Found 3 relevant papers on governance frameworks."
    print(f"[research] {result}")
    return {**state, "research_result": result}


def outcome_node(state: AgentState) -> AgentState:
    """Report the outcome to DashClaw."""
    action_id = state.get("action_id")
    if action_id:
        claw.update_outcome(
            action_id,
            status="completed",
            output_summary=state.get("research_result", "No result"),
        )
        print(f"[outcome] Reported success for {action_id}")
    return state


def abort_node(state: AgentState) -> AgentState:
    """Handle blocked actions."""
    action_id = state.get("action_id")
    if action_id:
        claw.update_outcome(
            action_id,
            status="cancelled",
            error_message="Blocked by governance policy",
        )
    print("[abort] Action blocked by governance policy.")
    return {**state, "research_result": "Blocked by governance policy"}


def route_after_governance(state: AgentState) -> str:
    """Route based on guard decision."""
    decision = state.get("governance_decision", "allow")
    if decision == "blocked":
        return "abort"
    if decision == "require_approval":
        return "approval"
    return "research"


def route_after_approval(state: AgentState) -> str:
    """Route after approval — proceed or abort."""
    if state.get("governance_decision") == "blocked":
        return "abort"
    return "research"


# Build the graph
graph = StateGraph(AgentState)
graph.add_node("governance", governance_node)
graph.add_node("approval", approval_node)
graph.add_node("research", research_node)
graph.add_node("outcome", outcome_node)
graph.add_node("abort", abort_node)

graph.set_entry_point("governance")
graph.add_conditional_edges("governance", route_after_governance, {
    "research": "research",
    "approval": "approval",
    "abort": "abort",
})
graph.add_conditional_edges("approval", route_after_approval, {
    "research": "research",
    "abort": "abort",
})
graph.add_edge("research", "outcome")
graph.add_edge("outcome", END)
graph.add_edge("abort", END)

app = graph.compile()


if __name__ == "__main__":
    print("=== LangGraph + DashClaw Governance Example ===\n")
    result = app.invoke({
        "topic": "AI safety best practices",
        "research_result": "",
        "governance_decision": "",
        "action_id": "",
    })
    print(f"\nFinal: {result['governance_decision']} — {result['research_result']}")
    if result.get("action_id"):
        base = os.environ.get("DASHCLAW_BASE_URL", "http://localhost:3000")
        print(f"View decision: {base}/decisions/{result['action_id']}")
```

- [ ] **Step 2: Update README.md — append "What's Governed" section**

Add before the existing `## Note` section (or at the end if no Note section):

```markdown
## What's Governed

| DashClaw Feature | Graph Node |
|---|---|
| **Guard** | `governance` — policy check with conditional routing |
| **Action Recording** | `governance` — records intent with risk score |
| **HITL Approval** | `approval` — waits for human decision (SSE-powered) |
| **Assumptions** | `research` — records reasoning basis |
| **Outcome Tracking** | `outcome` / `abort` — reports success or cancellation |

### Graph Structure

```
governance → [allow] → research → outcome → END
           → [require_approval] → approval → [approved] → research → outcome → END
                                            → [denied] → abort → END
           → [blocked] → abort → END
```

This demonstrates LangGraph's conditional routing integrated with DashClaw governance decisions.
```

- [ ] **Step 3: Commit**

```bash
git add examples/langgraph-governed/
git commit -m "feat: enhance LangGraph example with conditional routing, HITL, assumptions"
```

---

## Post-Implementation Checklist

- [ ] Run `npx vitest run` — full test suite green
- [ ] Run `npm run lint` — no lint errors
- [ ] Run `npm run sdk:integration:python` — Python SDK tests pass
- [ ] Run `npm run openapi:check` — no drift
- [ ] Verify `examples/autogen-governed/main.py` has no syntax errors: `python -c "import ast; ast.parse(open('examples/autogen-governed/main.py').read())"`
- [ ] Verify `examples/crewai-governed/main.py` has no syntax errors: `python -c "import ast; ast.parse(open('examples/crewai-governed/main.py').read())"`
- [ ] Verify `examples/langgraph-governed/main.py` has no syntax errors: `python -c "import ast; ast.parse(open('examples/langgraph-governed/main.py').read())"`
