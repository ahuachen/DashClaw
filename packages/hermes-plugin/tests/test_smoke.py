"""Smoke tests for the dashclaw-hermes-plugin.

Run with:  pytest packages/hermes-plugin/tests/

These tests don't hit a real DashClaw server — they mock the HTTP client
to verify the bridge translates hook signals into the right governance
calls and honours the Hermes block protocol (`{"action": "block", ...}`).
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

# Make the in-repo package importable without installing it.
PKG_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PKG_DIR))

from dashclaw_governance.config import PluginConfig, resolve  # noqa: E402
from dashclaw_governance.governance import GovernanceBridge  # noqa: E402
from dashclaw_governance.client import GuardDecision  # noqa: E402


def make_bridge(monkeypatch, **cfg_overrides) -> GovernanceBridge:
    cfg = PluginConfig(
        base_url="http://test",
        api_key="k",
        agent_id="hermes-test",
        agent_name="Hermes Test",
        **cfg_overrides,
    )
    bridge = GovernanceBridge.__new__(GovernanceBridge)
    bridge.cfg = cfg
    bridge.client = MagicMock()
    bridge._lock = __import__("threading").RLock()
    bridge._inflight = {}
    bridge._heartbeated_sessions = set()
    bridge._registered = True
    return bridge


def test_resolve_config_from_env(monkeypatch):
    cfg = resolve(env={
        "DASHCLAW_BASE_URL": "http://x:3310",
        "DASHCLAW_API_KEY": "key123",
        "DASHCLAW_AGENT_ID": "h-prod",
        "DASHCLAW_HIGH_RISK_TOOLS": "bash, write_file",
    })
    assert cfg.base_url == "http://x:3310"
    assert cfg.api_key == "key123"
    assert cfg.agent_id == "h-prod"
    assert cfg.high_risk_tools == frozenset({"bash", "write_file"})
    assert cfg.fail_closed is True


def test_pre_tool_call_allow(monkeypatch):
    bridge = make_bridge(monkeypatch)
    bridge.client.guard.return_value = GuardDecision(decision="allow", action_id="gd_1")
    bridge.client.create_action.return_value = {"id": "act_1", "status": "in_progress"}

    result = bridge.pre_tool_call(
        tool_name="read_file", args={"path": "/etc/hosts"},
        task_id="t1", session_id="s1", tool_call_id="c1",
    )
    assert result is None
    assert "t1:s1:c1" in bridge._inflight
    bridge.client.guard.assert_called_once()
    bridge.client.create_action.assert_called_once()


def test_pre_tool_call_block(monkeypatch):
    bridge = make_bridge(monkeypatch)
    bridge.client.guard.return_value = GuardDecision(
        decision="block", action_id="gd_2", reason="prod write blocked"
    )

    result = bridge.pre_tool_call(
        tool_name="bash", args={"command": "rm -rf /"},
        task_id="t1", session_id="s1", tool_call_id="c2",
    )
    assert result == {"action": "block", "message": "prod write blocked"}
    bridge.client.create_action.assert_not_called()


def test_pre_tool_call_unreachable_fail_closed(monkeypatch):
    from dashclaw_governance.client import GovernanceUnreachableError
    bridge = make_bridge(monkeypatch)
    bridge.client.guard.side_effect = GovernanceUnreachableError("connection refused")

    result = bridge.pre_tool_call(
        tool_name="bash", args={}, task_id="t", session_id="s", tool_call_id="c3",
    )
    assert result is not None
    assert result["action"] == "block"
    assert "unreachable" in result["message"].lower()


def test_pre_tool_call_unreachable_fail_open(monkeypatch):
    from dashclaw_governance.client import GovernanceUnreachableError
    bridge = make_bridge(monkeypatch, fail_closed=False)
    bridge.client.guard.side_effect = GovernanceUnreachableError("connection refused")

    result = bridge.pre_tool_call(
        tool_name="bash", args={}, task_id="t", session_id="s", tool_call_id="c4",
    )
    assert result is None  # let tool run


def test_post_tool_call_closes_record(monkeypatch):
    bridge = make_bridge(monkeypatch)
    # Seed an inflight record as if pre had run.
    bridge._inflight["t1:s1:c1"] = {
        "action_id": "act_99",
        "started_at": 0.0,
        "tool_name": "edit_file",
    }
    bridge.client.update_outcome.return_value = {"id": "act_99", "status": "ok"}

    bridge.post_tool_call(
        tool_name="edit_file", args={"path": "/x"}, result='{"ok": true}',
        task_id="t1", session_id="s1", tool_call_id="c1",
    )
    assert "t1:s1:c1" not in bridge._inflight
    bridge.client.update_outcome.assert_called_once()
    args = bridge.client.update_outcome.call_args
    assert args[0][0] == "act_99"
    assert args[0][1]["status"] == "ok"


def test_post_tool_call_marks_failure(monkeypatch):
    bridge = make_bridge(monkeypatch)
    bridge._inflight["t:s:c"] = {"action_id": "act_88", "started_at": 0.0, "tool_name": "bash"}
    bridge.client.update_outcome.return_value = {}

    bridge.post_tool_call(
        tool_name="bash", args={}, result='{"error": "permission denied"}',
        task_id="t", session_id="s", tool_call_id="c",
    )
    body = bridge.client.update_outcome.call_args[0][1]
    assert body["status"] == "failed"
    assert body["error_message"] == "permission denied"


def test_ignored_tools_skip_governance(monkeypatch):
    bridge = make_bridge(monkeypatch, ignored_tools=frozenset({"read_file"}))
    result = bridge.pre_tool_call(
        tool_name="read_file", args={}, task_id="t", session_id="s", tool_call_id="c",
    )
    assert result is None
    bridge.client.guard.assert_not_called()
