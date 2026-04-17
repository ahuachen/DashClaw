#!/usr/bin/env python3
"""
DashClaw Stop Hook for Claude Code.

Captures the assistant turn's LLM token usage from the session transcript and
PATCHes it to the action records created during the turn. Cost is derived
server-side from the configured model pricing table.

Data flow:
  - PreToolUse (dashclaw_pretool.py) appends each new action_id to
    "dashclaw_turn_<session_id>" in the temp dir.
  - This Stop hook sums token usage across assistant messages that landed
    since the last Stop (tracked via "dashclaw_stop_cursor_<session_id>"),
    distributes the totals evenly across the turn's action_ids, and PATCHes
    each action with tokens_in, tokens_out, and model. The server then
    derives cost_estimate from its pricing table.

Never blocks. Always exits 0.
"""

import json
import os
import sys
import tempfile
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = (os.environ.get("DASHCLAW_BASE_URL") or "").rstrip("/")
API_KEY = os.environ.get("DASHCLAW_API_KEY") or ""


# ---------------------------------------------------------------------------
# Error logging — best-effort append to a shared tempdir log so ops can detect
# token-attribution drift (API-key rotation, base-URL typo, transient 5xx).
# ---------------------------------------------------------------------------

def _log_hook_error(message):
    try:
        path = os.path.join(tempfile.gettempdir(), "dashclaw_hook_errors.log")
        from datetime import datetime, timezone
        ts = datetime.now(timezone.utc).isoformat()
        with open(path, "a", encoding="utf-8") as f:
            f.write(ts + " stop " + str(message) + "\n")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# State files
# ---------------------------------------------------------------------------

def _turn_actions_path(session_id):
    return os.path.join(tempfile.gettempdir(), "dashclaw_turn_" + session_id)


def _cursor_path(session_id):
    return os.path.join(tempfile.gettempdir(), "dashclaw_stop_cursor_" + session_id)


def _read_cursor(session_id):
    try:
        with open(_cursor_path(session_id), encoding="utf-8") as f:
            return f.read().strip()
    except Exception:
        return ""


def _write_cursor(session_id, uuid):
    if not uuid:
        return
    try:
        with open(_cursor_path(session_id), "w", encoding="utf-8") as f:
            f.write(uuid)
    except Exception:
        pass


def _read_turn_actions(session_id):
    try:
        with open(_turn_actions_path(session_id), encoding="utf-8") as f:
            ids = [ln.strip() for ln in f.readlines()]
    except Exception:
        return []
    # Preserve order, drop blanks and duplicates
    seen = set()
    out = []
    for aid in ids:
        if aid and aid not in seen:
            seen.add(aid)
            out.append(aid)
    return out


def _clear_turn_actions(session_id):
    try:
        os.remove(_turn_actions_path(session_id))
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Transcript walk
# ---------------------------------------------------------------------------

def _load_entries(transcript_path):
    if not transcript_path or not os.path.exists(transcript_path):
        return []
    out = []
    try:
        with open(transcript_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    out.append(json.loads(line))
                except Exception:
                    continue
    except Exception:
        return []
    return out


def _index_after_last_user_prompt(entries):
    """Return the index of the first entry after the most recent real user
    prompt — i.e. the start of the current assistant turn.

    A "real" user prompt is a user entry whose content is a string, or whose
    content list has no tool_result blocks. Tool results are modeled as user
    messages but are not prompts."""
    for i in range(len(entries) - 1, -1, -1):
        e = entries[i]
        if e.get("type") != "user":
            continue
        msg = e.get("message") or {}
        content = msg.get("content")
        if isinstance(content, str):
            return i + 1
        if isinstance(content, list):
            has_tool_result = any(
                isinstance(c, dict) and c.get("type") == "tool_result"
                for c in content
            )
            if not has_tool_result:
                return i + 1
    return 0


def _collect_turn_usage(entries, last_uuid):
    """Sum token usage and pick a model from assistant entries since last_uuid.

    Returns (tokens_in, tokens_out, model, new_cursor_uuid).
    If last_uuid is missing or not found, starts from the last user prompt."""
    start = -1
    if last_uuid:
        for i, e in enumerate(entries):
            if e.get("uuid") == last_uuid:
                start = i + 1
                break
    if start < 0:
        start = _index_after_last_user_prompt(entries)

    tokens_in = 0
    tokens_out = 0
    model = ""
    new_cursor = last_uuid
    for e in entries[start:]:
        if e.get("type") != "assistant":
            if e.get("uuid"):
                new_cursor = e["uuid"]
            continue
        msg = e.get("message") or {}
        usage = msg.get("usage") or {}
        # tokens_in is the "effective" input-token count used for cost:
        #   - regular input tokens        full price
        #   - cache_creation_input_tokens full price (~1.25x is close to 1x for 5m cache)
        #   - cache_read_input_tokens     10% price — apply the discount here so
        #                                 downstream cost derivation matches real billing
        tokens_in += int(usage.get("input_tokens") or 0)
        tokens_in += int(usage.get("cache_creation_input_tokens") or 0)
        cache_read = int(usage.get("cache_read_input_tokens") or 0)
        tokens_in += int(round(cache_read * 0.1))
        tokens_out += int(usage.get("output_tokens") or 0)
        if not model and msg.get("model"):
            model = msg["model"]
        if e.get("uuid"):
            new_cursor = e["uuid"]

    return tokens_in, tokens_out, model, new_cursor


# ---------------------------------------------------------------------------
# Distribution + HTTP
# ---------------------------------------------------------------------------

def _distribute(total, n):
    """Split `total` into `n` non-negative integers that sum to `total`.

    Early buckets get one extra when the split isn't even. n must be > 0."""
    base = total // n
    remainder = total - base * n
    return [base + (1 if i < remainder else 0) for i in range(n)]


def _patch_action(action_id, body):
    """PATCH /api/actions/{action_id}. Failures log and return; never block."""
    url = BASE_URL + "/api/actions/" + action_id
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
        },
        method="PATCH",
    )
    try:
        urllib.request.urlopen(req, timeout=3)
    except urllib.error.HTTPError as e:
        _log_hook_error("PATCH " + action_id + " -> HTTP " + str(e.code))
    except Exception as e:
        _log_hook_error("PATCH " + action_id + " -> " + type(e).__name__ + ": " + str(e))


def _apply(action_ids, tokens_in, tokens_out, model):
    """Distribute token usage across the turn's action_ids and request a
    server-side conditional close on each.

    The server honors `close_if_running: true` atomically — close fields
    (status/output_summary/timestamp_end) only apply when the row is still
    `running`, so a concurrent PostToolUse PATCH can never be clobbered. Token
    fields apply unconditionally via COALESCE. Safe to send on every action —
    no per-action GET required."""
    if not action_ids:
        return
    has_tokens = tokens_in > 0 or tokens_out > 0
    n = len(action_ids)
    in_parts = _distribute(tokens_in, n) if has_tokens else [0] * n
    out_parts = _distribute(tokens_out, n) if has_tokens else [0] * n
    ts_end = datetime_now_iso()
    for idx, aid in enumerate(action_ids):
        body = {
            "close_if_running": True,
            "status": "completed",
            "output_summary": "Auto-closed by Stop hook",
            "timestamp_end": ts_end,
        }
        if has_tokens:
            body["tokens_in"] = in_parts[idx]
            body["tokens_out"] = out_parts[idx]
            if model:
                body["model"] = model
        _patch_action(aid, body)


def datetime_now_iso():
    """ISO-8601 UTC timestamp with trailing Z — matches posttool convention."""
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not BASE_URL or not API_KEY:
        sys.exit(0)

    try:
        raw = sys.stdin.buffer.read().decode("utf-8-sig").strip()
        data = json.loads(raw) if raw else {}
    except Exception:
        sys.exit(0)

    session_id = data.get("session_id") or ""
    transcript_path = data.get("transcript_path") or ""
    if not session_id:
        sys.exit(0)

    action_ids = _read_turn_actions(session_id)
    # Even if there are no turn actions we still advance the cursor so the
    # next turn starts clean.
    entries = _load_entries(transcript_path)
    last_uuid = _read_cursor(session_id)
    tokens_in, tokens_out, model, new_cursor = _collect_turn_usage(entries, last_uuid)

    _apply(action_ids, tokens_in, tokens_out, model)
    _write_cursor(session_id, new_cursor)
    _clear_turn_actions(session_id)
    sys.exit(0)


if __name__ == "__main__":
    main()
