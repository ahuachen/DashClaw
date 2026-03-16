#!/usr/bin/env python3
"""
DashClaw PostToolUse Hook for Claude Code.

Records the outcome of governed tool calls by updating the action record
created by the PreToolUse hook. Never blocks. Always exits 0.
"""

import json
import os
import sys
import tempfile
import urllib.request
import urllib.error
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = (os.environ.get("DASHCLAW_BASE_URL") or "").rstrip("/")
API_KEY = os.environ.get("DASHCLAW_API_KEY") or ""


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Exit silently if DashClaw is not configured
    if not BASE_URL or not API_KEY:
        sys.exit(0)

    # Parse stdin
    try:
        raw = sys.stdin.read()
        data = json.loads(raw) if raw.strip() else {}
    except Exception:
        sys.exit(0)

    tool_use_id = data.get("tool_use_id") or ""
    if not tool_use_id:
        sys.exit(0)

    # Find the action ID from the temp file written by PreToolUse
    tmp_path = os.path.join(tempfile.gettempdir(), "dashclaw_last_action_" + tool_use_id)
    try:
        with open(tmp_path, "r") as f:
            action_id = f.read().strip()
    except Exception:
        # No temp file means this tool was not governed
        sys.exit(0)

    if not action_id:
        sys.exit(0)

    # Determine outcome from tool_response
    tool_response = data.get("tool_response") or {}
    error_val = tool_response.get("error")
    output_val = str(tool_response.get("output") or tool_response.get("stdout") or "")

    if error_val:
        status = "failed"
        output_summary = str(error_val)[:200]
    elif "Error:" in output_val or "error:" in output_val:
        status = "failed"
        output_summary = output_val[:200]
    else:
        status = "completed"
        output_summary = output_val[:200]

    # PATCH the action with the outcome
    timestamp_end = datetime.now(timezone.utc).isoformat()
    body = json.dumps({
        "status": status,
        "output_summary": output_summary,
        "timestamp_end": timestamp_end,
    }).encode("utf-8")

    url = BASE_URL + "/api/actions/" + action_id
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
        },
        method="PATCH",
    )
    try:
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        pass  # Never block on outcome recording failure

    # Clean up temp file
    try:
        os.remove(tmp_path)
    except Exception:
        pass

    sys.exit(0)


if __name__ == "__main__":
    main()
