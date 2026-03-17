#!/usr/bin/env python3
"""
DashClaw PreToolUse Hook for Claude Code.

Evaluates Bash, Edit, Write, and MultiEdit tool calls against DashClaw
guard policies before execution. Blocks or warns based on policy decisions.

Exit codes:
  0 - Allow the tool to proceed
  2 - Block the tool (Claude Code shows stderr to user)
"""

import json
import os
import re
import sys
import tempfile
import time
import urllib.request
import urllib.error

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BASE_URL = (os.environ.get("DASHCLAW_BASE_URL") or "").rstrip("/")
API_KEY = os.environ.get("DASHCLAW_API_KEY") or ""
AGENT_ID = os.environ.get("DASHCLAW_AGENT_ID") or "claude-code"
HOOK_MODE = os.environ.get("DASHCLAW_HOOK_MODE") or "enforce"
RISK_THRESHOLD = int(os.environ.get("DASHCLAW_RISK_THRESHOLD") or "60")

GOVERNED_TOOLS = {"Bash", "Edit", "Write", "MultiEdit"}


def log(msg):
    """Print to stderr (visible to Claude Code user)."""
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()


# ---------------------------------------------------------------------------
# HTTP helpers (stdlib only, no third-party)
# ---------------------------------------------------------------------------

def api_request(method, path, body=None, timeout=2.5):
    """Make an HTTP request to the DashClaw API. Returns parsed JSON or None."""
    url = BASE_URL + path
    data = json.dumps(body).encode("utf-8") if body else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return None


def guard_check(context):
    """POST /api/guard. Returns response dict or None on failure."""
    return api_request("POST", "/api/guard", body=context)


def create_action(context, status="running"):
    """POST /api/actions. Returns response dict or None on failure."""
    payload = dict(context)
    payload["status"] = status
    return api_request("POST", "/api/actions", body=payload)


def get_action(action_id):
    """GET /api/actions/<id>. Returns response dict or None."""
    return api_request("GET", "/api/actions/" + action_id, timeout=3)


# ---------------------------------------------------------------------------
# Tool-to-action mapping
# ---------------------------------------------------------------------------

def _match_any(text, patterns):
    lower = text.lower()
    return any(p in lower for p in patterns)


def map_bash(command):
    """Map a Bash command string to DashClaw action context."""
    risk = 20
    action_type = "other"
    reversible = True

    if _match_any(command, ["git push", "git merge", "git rebase", "git reset"]):
        action_type, risk, reversible = "deploy", 80, False
    elif _match_any(command, ["npm run deploy", "npm run build", "vercel", "netlify", "heroku", "fly deploy", "railway"]):
        action_type, risk, reversible = "deploy", 75, False
    elif _match_any(command, ["kubectl", "terraform", "ansible", "helm", "pulumi"]):
        action_type, risk, reversible = "deploy", 85, False
    elif _match_any(command, ["rm -rf", "drop table", "delete from", "truncate"]):
        action_type, risk, reversible = "security", 90, False
    elif _match_any(command, ["curl", "wget", "fetch", "http"]):
        action_type, risk, reversible = "api", 40, True
    elif _match_any(command, ["npm install", "pip install", "yarn add"]):
        action_type, risk, reversible = "build", 30, True

    systems = ["shell"]
    if _match_any(command, ["postgres", "psql"]):
        systems = ["postgres"]
    elif _match_any(command, ["redis"]):
        systems = ["redis"]
    elif _match_any(command, ["vercel"]):
        systems = ["vercel"]
    elif _match_any(command, ["kubectl", "kubernetes", "k8s"]):
        systems = ["kubernetes"]

    return {
        "action_type": action_type,
        "agent_id": AGENT_ID,
        "declared_goal": "Bash: " + command[:120],
        "risk_score": risk,
        "reversible": reversible,
        "systems_touched": systems,
    }


def map_file_tool(tool_name, tool_input):
    """Map Edit/Write/MultiEdit to DashClaw action context."""
    path = tool_input.get("path") or tool_input.get("file_path") or "unknown"
    path_lower = path.lower()

    risk = 15
    action_type = "other"
    reversible = True

    if re.search(r"(\.env|secret|credential|private_key|id_rsa)", path_lower):
        action_type, risk, reversible = "security", 85, True
    elif re.search(r"(migration|schema|seed)", path_lower):
        action_type, risk, reversible = "migrate", 70, False
    elif re.search(r"(deploy|infra|terraform|kubernetes|k8s)", path_lower):
        action_type, risk, reversible = "deploy", 75, True
    elif re.search(r"(auth|login|oauth|jwt|token|password)", path_lower):
        action_type, risk, reversible = "security", 75, True

    return {
        "action_type": action_type,
        "agent_id": AGENT_ID,
        "declared_goal": "%s: %s" % (tool_name, path),
        "risk_score": risk,
        "reversible": reversible,
        "systems_touched": ["filesystem"],
    }


# ---------------------------------------------------------------------------
# Temp file for passing action_id to PostToolUse
# ---------------------------------------------------------------------------

def write_action_id(tool_use_id, action_id):
    """Write action_id to a temp file keyed by tool_use_id."""
    path = os.path.join(tempfile.gettempdir(), "dashclaw_last_action_" + tool_use_id)
    try:
        with open(path, "w") as f:
            f.write(action_id)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Decision handlers
# ---------------------------------------------------------------------------

def handle_allow(context, tool_use_id):
    """Record the action and exit 0."""
    resp = create_action(context, status="running")
    if resp:
        action_id = (resp.get("action_id")
                     or (resp.get("action") or {}).get("action_id")
                     or "")
        if action_id:
            write_action_id(tool_use_id, action_id)
    sys.exit(0)


def handle_warn(guard_resp, context, tool_use_id):
    """Print warning, record action, exit 0."""
    warnings = guard_resp.get("warnings") or guard_resp.get("reasons") or []
    msg = warnings[0] if warnings else "Policy warning"
    log("[DashClaw] Warning: " + msg)
    resp = create_action(context, status="running")
    if resp:
        action_id = (resp.get("action_id")
                     or (resp.get("action") or {}).get("action_id")
                     or "")
        if action_id:
            write_action_id(tool_use_id, action_id)
    sys.exit(0)


def handle_block(guard_resp, context):
    """Block in enforce mode, warn in observe mode."""
    reasons = guard_resp.get("reasons") or []
    policies = guard_resp.get("matched_policies") or []
    reason = reasons[0] if reasons else "Guard policy violation"
    policy = policies[0] if policies else "guard policy"

    if HOOK_MODE == "observe":
        log("[DashClaw] [observe] Would block: " + reason)
        sys.exit(0)

    log("[DashClaw] Blocked by policy: " + reason)
    log("Policy: " + policy)
    log("Action: " + context["declared_goal"])
    log("Run 'dashclaw approvals' to review or override.")
    sys.exit(2)


def handle_require_approval(guard_resp, context, tool_use_id):
    """Create pending action, wait for approval, or block on timeout."""
    policies = guard_resp.get("matched_policies") or []
    policy = policies[0] if policies else "require_approval policy"

    resp = create_action(context, status="pending_approval")
    if not resp:
        log("[DashClaw] Could not create approval request, proceeding")
        sys.exit(0)

    action_id = (resp.get("action_id")
                 or (resp.get("action") or {}).get("action_id")
                 or "")
    if not action_id:
        log("[DashClaw] Could not create approval request, proceeding")
        sys.exit(0)

    if HOOK_MODE == "observe":
        log("[DashClaw] [observe] Would require approval for: " + context["declared_goal"])
        write_action_id(tool_use_id, action_id)
        sys.exit(0)

    log("[DashClaw] Approval required")
    log("Action ID: " + action_id)
    log("Goal:      " + context["declared_goal"])
    log("Policy:    " + policy)
    log("Replay:    " + BASE_URL + "/replay/" + action_id)
    log("")
    log("Approve from terminal: dashclaw approve " + action_id)
    log("Or visit the approval queue in your DashClaw dashboard.")
    log("Waiting for approval... (30s timeout, then blocking)")

    deadline = time.time() + 30
    while time.time() < deadline:
        time.sleep(3)
        action_resp = get_action(action_id)
        if not action_resp:
            continue
        action = action_resp.get("action") or action_resp
        if action.get("approved_by"):
            write_action_id(tool_use_id, action_id)
            sys.exit(0)
        status = action.get("status", "")
        if status == "running":
            write_action_id(tool_use_id, action_id)
            sys.exit(0)
        if status in ("failed", "cancelled"):
            log("[DashClaw] Action denied by operator.")
            sys.exit(2)

    log("[DashClaw] Approval timeout. Blocking tool execution.")
    sys.exit(2)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    # Exit silently if DashClaw is not configured
    if not BASE_URL or not API_KEY:
        sys.exit(0)

    # Parse stdin — read as raw bytes and decode as UTF-8 to handle
    # Windows PowerShell which pipes UTF-8 BOM bytes through cp1252 stdin
    try:
        raw = sys.stdin.buffer.read().decode("utf-8-sig").strip()
        data = json.loads(raw) if raw else {}
    except Exception:
        sys.exit(0)

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input") or {}
    tool_use_id = data.get("tool_use_id") or "unknown"

    # Only govern specific tools
    if tool_name not in GOVERNED_TOOLS:
        sys.exit(0)

    # Map tool to action context
    if tool_name == "Bash":
        command = tool_input.get("command") or ""
        context = map_bash(command)
    else:
        context = map_file_tool(tool_name, tool_input)

    # Call DashClaw guard
    guard_resp = guard_check(context)
    if guard_resp is None:
        log("[DashClaw] Guard unavailable, proceeding")
        sys.exit(0)

    decision = guard_resp.get("decision", "allow")

    if decision == "allow":
        handle_allow(context, tool_use_id)
    elif decision == "warn":
        handle_warn(guard_resp, context, tool_use_id)
    elif decision == "block":
        handle_block(guard_resp, context)
    elif decision == "require_approval":
        handle_require_approval(guard_resp, context, tool_use_id)
    else:
        handle_allow(context, tool_use_id)


if __name__ == "__main__":
    main()
