---
id: todo-003
title: Hook silently fails open when guard is unavailable — violates core value
created: 2026-04-22
area: Claude Code integration (hook)
severity: HIGH
type: BUG candidate — contradicts product promise
source_conversation: 2026-04-22 diagnosis session — surfaced while reading dashclaw_pretool.py:558-560
---

## Problem

`hooks/dashclaw_pretool.py` lines 557-560:

```python
guard_resp = guard_check(context)
if guard_resp is None:
    log("[DashClaw] Guard unavailable, proceeding")
    sys.exit(0)
```

When the DashClaw API is unreachable (network failure, instance down, Docker container stopped, expired token, SSL error, timeout), the hook prints one line to stderr and exits 0 — **allowing the tool call through with no audit record**.

This contradicts DashClaw's core value prop from `PROJECT.md`:

> **Your coding agent can never surprise you with a destructive action, and you can always prove what it did.**

If guard is unavailable:
- "can never surprise you with a destructive action" — violated (allows destructive actions)
- "always prove what it did" — violated (no audit record, no `create_action` call, no decision logged)

The single stderr line is easy to miss, especially because Claude Code's UI may truncate or suppress it depending on display mode.

## Severity

**HIGH** — this is structurally the same class of bug as BUG-02 (`handle_block` had no audit trail) which was already classified as blocking Phase 2 launch. The root concern is the same: governance failures must be loud and auditable, not silent and permissive.

BUG-02 was caught 2026-04-11. This instance is arguably worse: BUG-02 lost audit on *denials*, this loses audit on *everything* during any outage.

## Proposed fix

Three defensible options, in order of conservativeness:

**Option A — Fail closed (strictest)**: Block on guard unavailability in enforce mode. Proceed in observe mode. Add env var `DASHCLAW_GUARD_UNAVAILABLE_POLICY=block|warn|allow` (default `block`).

**Option B — Require explicit opt-in to fail-open**: Default to block; allow only if `DASHCLAW_ALLOW_ON_GUARD_FAILURE=true` is explicitly set. Makes the fail-open a deliberate choice.

**Option C — Fail warn-loud (most conservative behavior-preserving)**: Still proceed, but:
1. Print a multi-line warning banner to stderr (prominent, easy to spot)
2. Write a local audit record to `~/.dashclaw/orphan-actions.jsonl` so the outage is recoverable
3. On next successful guard call, backfill the orphan via a batch ingest endpoint
4. Emit a high-severity signal via outbound webhook when guard recovers ("N orphan actions during outage")

## Recommended

**Option A with `enforce`/`observe` split + local orphan log (`Option C` hybrid).**

- In enforce mode: block on guard unavailable (consistent with product promise)
- In observe mode: allow but log to local orphan file for audit recovery
- Never lose the action record entirely

## Files

- `hooks/dashclaw_pretool.py:557-560` — primary fix
- `.claude/hooks/dashclaw_pretool.py` — keep in sync
- `hooks/dashclaw_posttool.py` — review for same pattern in postprocessing
- `hooks/dashclaw_stop.py` — review

## Candidate for REQUIREMENTS.md

Consider adding as BUG-04:
> **BUG-04**: `dashclaw_pretool.py` fails open (exits 0) when `/api/guard` is unreachable, with zero audit trail. This contradicts the "always prove what it did" core value. Fix: block in enforce mode (or write local orphan log in observe mode), backfill on recovery, visible stderr warning. Regression test: stop guard, run governed command, verify either block-and-stderr or local-orphan-record.

## Related

- BUG-02 (fixed 2026-04-11): same pattern — governance decision without audit
- `feedback_diagnose_live_state.md`: the debug session that exposed this (bug found while diagnosing the demo-container mis-route)
- CCI-02: policy pack expects enforcement to actually enforce

## Acceptance

- [ ] Hook does NOT silently exit 0 when `/api/guard` is unreachable in enforce mode
- [ ] Local orphan log captures actions when network fails (no lost audit)
- [ ] Visible warning rendered prominently (not a single stderr line)
- [ ] On recovery, orphan actions can be backfilled to the server
- [ ] Regression test in `hooks/tests/` covers the unreachable-guard scenario
