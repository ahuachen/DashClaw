"""Tiny synchronous DashClaw client used by the Hermes governance plugin.

We hit only four endpoints — `POST /api/guard`, `POST /api/actions`,
`PATCH /api/actions/:id`, `POST /api/agents/heartbeat` — plus polling
`GET /api/actions/:id` while waiting for human approval.

The Hermes hook system invokes plugin callbacks synchronously from inside
the tool-call critical section, so we keep this client synchronous too.
Long-blocking calls (waitForApproval) are bounded by `approval_timeout_ms`.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Dict, Mapping, Optional

import httpx


class GovernanceUnreachableError(Exception):
    """Raised when the DashClaw runtime cannot be reached (DNS, TCP, timeout)."""


class GovernanceBlockedError(Exception):
    """Raised when policy says block (or approval was denied / timed out).

    Hermes' `pre_tool_call` hook protocol uses ``return {"action": "block",
    "message": ...}`` instead of exceptions to stop a tool call — but we
    raise this internally and translate at the hook boundary.
    """

    def __init__(self, reason: str, *, action_id: Optional[str] = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.action_id = action_id


class ApprovalDeniedError(GovernanceBlockedError):
    pass


class ApprovalTimeoutError(GovernanceBlockedError):
    pass


@dataclass(frozen=True)
class GuardDecision:
    decision: str  # "allow" | "block" | "require_approval"
    action_id: str
    reason: str = ""
    risk_score: Optional[int] = None
    raw: Mapping[str, Any] = None  # type: ignore[assignment]


class DashClawClient:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        agent_id: str,
        agent_name: Optional[str] = None,
        request_timeout_ms: int = 10_000,
    ) -> None:
        if not base_url:
            raise ValueError("base_url is required")
        if not api_key:
            raise ValueError("api_key is required")
        if not agent_id:
            raise ValueError("agent_id is required")
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.agent_id = agent_id
        self.agent_name = agent_name
        self._timeout = httpx.Timeout(request_timeout_ms / 1000.0)
        self._client = httpx.Client(
            timeout=self._timeout,
            headers={
                "x-api-key": api_key,
                "User-Agent": f"dashclaw-hermes-plugin/0.1.0 (agent_id={agent_id})",
            },
        )

    def close(self) -> None:
        try:
            self._client.close()
        except Exception:  # pragma: no cover
            pass

    # ------------------------------------------------------------------
    # Internal request helper
    # ------------------------------------------------------------------

    def _request(self, method: str, path: str, *, json: Optional[Dict[str, Any]] = None) -> Any:
        try:
            res = self._client.request(method, f"{self.base_url}{path}", json=json)
        except (httpx.TransportError, httpx.TimeoutException) as exc:
            raise GovernanceUnreachableError(f"{method} {path}: {exc!s}") from exc

        if res.status_code >= 400:
            try:
                detail = res.json()
            except Exception:
                detail = res.text
            raise RuntimeError(f"DashClaw {method} {path} failed ({res.status_code}): {detail}")

        if res.content:
            try:
                return res.json()
            except Exception:
                return res.text
        return None

    # ------------------------------------------------------------------
    # Public API surface
    # ------------------------------------------------------------------

    def guard(self, ctx: Dict[str, Any]) -> GuardDecision:
        body = dict(ctx)
        body.setdefault("agent_id", self.agent_id)
        if "agent_name" not in body and self.agent_name:
            body["agent_name"] = self.agent_name
        data = self._request("POST", "/api/guard", json=body) or {}
        return GuardDecision(
            decision=str(data.get("decision", "allow")),
            action_id=str(data.get("action_id", "")),
            reason=str(data.get("reason", "")),
            risk_score=data.get("risk_score"),
            raw=data,
        )

    def create_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        body = dict(action)
        body.setdefault("agent_id", self.agent_id)
        if "agent_name" not in body and self.agent_name:
            body["agent_name"] = self.agent_name
        return self._request("POST", "/api/actions", json=body) or {}

    def update_outcome(self, action_id: str, outcome: Dict[str, Any]) -> Dict[str, Any]:
        body = dict(outcome)
        body.setdefault("timestamp_end", _iso_now())
        return self._request("PATCH", f"/api/actions/{action_id}", json=body) or {}

    def get_action(self, action_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/api/actions/{action_id}") or {}

    def heartbeat(self, status: str = "online", metadata: Optional[Dict[str, Any]] = None) -> None:
        self._request(
            "POST",
            "/api/agents/heartbeat",
            json={"agent_id": self.agent_id, "status": status, "metadata": metadata},
        )

    def wait_for_approval(
        self,
        action_id: str,
        *,
        timeout_ms: int = 300_000,
        interval_ms: int = 5_000,
    ) -> Dict[str, Any]:
        deadline = time.monotonic() + (timeout_ms / 1000.0)
        while time.monotonic() < deadline:
            action = self.get_action(action_id)
            if action.get("approved_by"):
                return action
            status = action.get("status")
            if status in {"failed", "cancelled", "denied"}:
                raise ApprovalDeniedError(
                    f"Approval denied (status={status}) for {action_id}",
                    action_id=action_id,
                )
            time.sleep(interval_ms / 1000.0)
        raise ApprovalTimeoutError(
            f"Approval timed out for {action_id} after {timeout_ms}ms",
            action_id=action_id,
        )


def _iso_now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
