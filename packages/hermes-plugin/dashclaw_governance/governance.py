"""GovernanceBridge — translates Hermes hook signals into the DashClaw
4-step governance loop.

Hermes invokes plugin hooks synchronously (`invoke_hook` in
`hermes_cli/plugins.py`). All bridge methods are therefore synchronous and
keep their work bounded:

  - `pre_tool_call`   → guard() + (optional waitForApproval) + createAction()
  - `post_tool_call`  → updateOutcome()
  - `pre_llm_call`    → cache turn metadata for token attribution (optional)
  - `post_llm_call`   → flush token attribution (optional)
  - `on_session_start`→ heartbeat("busy")
  - `on_session_end`  → heartbeat("online")
"""
from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any, Dict, Mapping, Optional

from .client import (
    ApprovalDeniedError,
    ApprovalTimeoutError,
    DashClawClient,
    GovernanceBlockedError,
    GovernanceUnreachableError,
    GuardDecision,
)
from .config import (
    PluginConfig,
    infer_reversible,
    infer_risk_score,
    resolve_action_type,
)


log = logging.getLogger("dashclaw.hermes")


def _key(task_id: str, session_id: str, tool_call_id: str) -> str:
    return f"{task_id}:{session_id}:{tool_call_id}"


def _truncate(value: Any, max_chars: int = 1000) -> Any:
    try:
        s = json.dumps(value, default=str)
    except Exception:
        return {"_unserializable": True}
    if len(s) <= max_chars:
        return value
    return {"_truncated": True, "preview": s[:max_chars]}


class GovernanceBridge:
    """Stateful bridge between Hermes hooks and DashClaw runtime."""

    def __init__(self, cfg: PluginConfig) -> None:
        self.cfg = cfg
        self.client = DashClawClient(
            base_url=cfg.base_url,
            api_key=cfg.api_key,
            agent_id=cfg.agent_id,
            agent_name=cfg.agent_name,
            request_timeout_ms=cfg.request_timeout_ms,
        )
        self._lock = threading.RLock()
        # tool_key -> (action_id, started_at_monotonic, tool_name)
        self._inflight: Dict[str, Dict[str, Any]] = {}
        self._heartbeated_sessions: set = set()
        self._registered = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        if self._registered:
            return
        try:
            self.client.heartbeat(
                status="online",
                metadata={
                    "agent_type": "hermes",
                    "adapter": "dashclaw-hermes-plugin",
                    "adapter_version": "0.1.0",
                },
            )
            log.info("DashClaw governance active for agent_id=%s", self.cfg.agent_id)
        except Exception as exc:
            log.warning("DashClaw heartbeat at startup failed: %s", exc)
        self._registered = True

    def stop(self) -> None:
        try:
            self.client.heartbeat(status="offline", metadata={"adapter": "dashclaw-hermes-plugin"})
        except Exception:
            pass
        self.client.close()

    # ------------------------------------------------------------------
    # pre_tool_call → guard + createAction
    #
    # Returns Hermes' block protocol (`{"action": "block", "message": ...}`)
    # when the policy says block / approval denied / timeout. Returns None
    # when the tool call should proceed.
    # ------------------------------------------------------------------

    def pre_tool_call(
        self,
        *,
        tool_name: str,
        args: Optional[Mapping[str, Any]],
        task_id: str,
        session_id: str,
        tool_call_id: str,
    ) -> Optional[Dict[str, str]]:
        if tool_name in self.cfg.ignored_tools:
            return None
        self._maybe_heartbeat_session(session_id)

        action_type = resolve_action_type(tool_name, self.cfg.tool_action_types)
        base_risk = infer_risk_score(tool_name, self.cfg.risk_score_default)
        risk_score = max(base_risk, 90) if tool_name in self.cfg.high_risk_tools else base_risk
        reversible = infer_reversible(tool_name)
        declared_goal = f"hermes tool call: {tool_name}"

        # 1. Guard
        try:
            decision = self.client.guard(
                {
                    "action_type": action_type,
                    "declared_goal": declared_goal,
                    "risk_score": risk_score,
                    "reversible": reversible,
                    "metadata": {
                        "tool": tool_name,
                        "task_id": task_id,
                        "session_id": session_id,
                        "tool_call_id": tool_call_id,
                        "args_preview": _truncate(args),
                    },
                }
            )
        except GovernanceUnreachableError as exc:
            log.warning("DashClaw unreachable during guard(%s): %s", tool_name, exc)
            if self.cfg.fail_closed:
                return {"action": "block", "message": "DashClaw governance unreachable (failClosed=true)"}
            return None
        except Exception as exc:
            log.error("DashClaw guard error for %s: %s", tool_name, exc)
            return None

        if decision.decision == "block":
            log.warning("BLOCK %s (callID=%s): %s", tool_name, tool_call_id, decision.reason)
            return {"action": "block", "message": decision.reason or "Action blocked by DashClaw policy"}

        # 2. Open record
        try:
            action = self.client.create_action(
                {
                    "action_type": action_type,
                    "declared_goal": declared_goal,
                    "risk_score": risk_score,
                    "reversible": reversible,
                    "metadata": {
                        "tool": tool_name,
                        "task_id": task_id,
                        "session_id": session_id,
                        "tool_call_id": tool_call_id,
                        "guard_decision_id": decision.action_id,
                        "args_preview": _truncate(args),
                    },
                }
            )
        except GovernanceUnreachableError as exc:
            log.warning("DashClaw unreachable during createAction(%s): %s", tool_name, exc)
            if self.cfg.fail_closed:
                return {"action": "block", "message": "DashClaw governance unreachable (failClosed=true)"}
            return None
        except Exception as exc:
            log.error("DashClaw createAction error for %s: %s", tool_name, exc)
            return None

        action_id = str(action.get("id", ""))

        # 3. Approval (synchronous, bounded)
        if decision.decision == "require_approval":
            log.info("AWAITING APPROVAL %s (action=%s)", tool_name, action_id)
            try:
                self.client.wait_for_approval(
                    action_id,
                    timeout_ms=self.cfg.approval_timeout_ms,
                )
                log.info("APPROVED %s (action=%s)", tool_name, action_id)
            except ApprovalDeniedError:
                return {"action": "block", "message": "Human reviewer denied the request"}
            except ApprovalTimeoutError:
                return {
                    "action": "block",
                    "message": f"Approval not granted within {self.cfg.approval_timeout_ms}ms",
                }
            except GovernanceUnreachableError as exc:
                log.warning("DashClaw unreachable during waitForApproval: %s", exc)
                if self.cfg.fail_closed:
                    return {"action": "block", "message": "DashClaw governance unreachable during approval"}

        with self._lock:
            self._inflight[_key(task_id, session_id, tool_call_id)] = {
                "action_id": action_id,
                "started_at": time.monotonic(),
                "tool_name": tool_name,
            }
        return None

    # ------------------------------------------------------------------
    # post_tool_call → updateOutcome
    # ------------------------------------------------------------------

    def post_tool_call(
        self,
        *,
        tool_name: str,
        args: Optional[Mapping[str, Any]],
        result: Any,
        task_id: str,
        session_id: str,
        tool_call_id: str,
        duration_ms: Optional[int] = None,
    ) -> None:
        with self._lock:
            entry = self._inflight.pop(_key(task_id, session_id, tool_call_id), None)
        if not entry:
            return

        actual_duration_ms = duration_ms if duration_ms is not None else int((time.monotonic() - entry["started_at"]) * 1000)

        # Hermes tools may signal failure either by raising (we'd never get here)
        # or by returning a JSON string with an "error" key. Detect the latter.
        failed = False
        error_message = None
        if isinstance(result, str):
            try:
                parsed = json.loads(result)
            except Exception:
                parsed = None
            if isinstance(parsed, dict) and "error" in parsed:
                failed = True
                err = parsed["error"]
                error_message = err if isinstance(err, str) else json.dumps(err, default=str)
        elif isinstance(result, dict) and "error" in result:
            failed = True
            err = result["error"]
            error_message = err if isinstance(err, str) else json.dumps(err, default=str)

        outcome: Dict[str, Any] = {
            "status": "failed" if failed else "ok",
            "duration_ms": actual_duration_ms,
            "metadata": {
                "tool": tool_name,
                "result_preview": _truncate(result, 800),
            },
        }
        if error_message:
            outcome["error_message"] = error_message
        if self.cfg.default_model:
            outcome["model"] = self.cfg.default_model

        try:
            self.client.update_outcome(entry["action_id"], outcome)
        except Exception as exc:
            log.warning("updateOutcome failed for action=%s: %s", entry["action_id"], exc)

    # ------------------------------------------------------------------
    # Session lifecycle (best-effort heartbeats)
    # ------------------------------------------------------------------

    def on_session_start(self, *, session_id: str, **_: Any) -> None:
        self._maybe_heartbeat_session(session_id)

    def on_session_end(self, *, session_id: str, **_: Any) -> None:
        try:
            self.client.heartbeat(
                status="online",  # back to idle
                metadata={"agent_type": "hermes", "session_id": session_id, "event": "session_end"},
            )
        except Exception:
            pass

    def _maybe_heartbeat_session(self, session_id: str) -> None:
        if not session_id:
            return
        with self._lock:
            if session_id in self._heartbeated_sessions:
                return
            self._heartbeated_sessions.add(session_id)
        try:
            self.client.heartbeat(
                status="busy",
                metadata={"agent_type": "hermes", "session_id": session_id},
            )
        except Exception:
            # Heartbeat is metadata-only — don't fail the tool call over it
            pass


__all__ = ["GovernanceBridge"]
