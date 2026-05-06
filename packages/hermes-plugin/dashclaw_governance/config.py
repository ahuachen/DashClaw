"""Configuration resolution for the DashClaw Hermes plugin.

See `docs/architecture/multi-agent-adapter.md` §3 in the DashClaw repo for the
canonical config contract — the same keys are honoured here as in the
`@dashclaw/opencode-plugin` TypeScript adapter.
"""
from __future__ import annotations

import os
import socket
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, Mapping, Optional, Set

# Conservative per-tool risk score. Anything not listed falls back to
# `risk_score_default`. Hermes ships a large tool set (file IO, shell,
# web fetch, achievements, kanban, …); we only encode the well-known
# high-risk built-ins.
_BUILTIN_RISK: Dict[str, int] = {
    "read_file": 5,
    "list_directory": 5,
    "find_files": 5,
    "search_text": 5,
    "fetch_url": 20,
    "todo_read": 5,
    "todo_write": 30,
    "edit_file": 60,
    "write_file": 65,
    "patch_file": 65,
    "bash": 80,
    "shell": 80,
    "execute_command": 80,
    "run_shell_command": 80,
}

_REVERSIBLE_TOOLS: Set[str] = {
    "read_file",
    "list_directory",
    "find_files",
    "search_text",
    "fetch_url",
    "todo_read",
}


def _first_str(*candidates: Any) -> str:
    for c in candidates:
        if isinstance(c, str) and c:
            return c
    return ""


def _as_bool(v: Any, fallback: bool) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        s = v.strip().lower()
        if s in {"true", "1", "yes", "on"}:
            return True
        if s in {"false", "0", "no", "off"}:
            return False
    return fallback


def _as_int(v: Any, fallback: int) -> int:
    if isinstance(v, int) and not isinstance(v, bool):
        return v
    if isinstance(v, str) and v.strip():
        try:
            return int(v)
        except ValueError:
            return fallback
    return fallback


def _as_str_set(v: Any) -> Set[str]:
    if isinstance(v, set):
        return {x for x in v if isinstance(x, str) and x}
    if isinstance(v, (list, tuple)):
        return {x for x in v if isinstance(x, str) and x}
    if isinstance(v, str) and v:
        return {x.strip() for x in v.split(",") if x.strip()}
    return set()


def _as_str_map(v: Any) -> Dict[str, str]:
    if isinstance(v, Mapping):
        return {str(k): str(val) for k, val in v.items() if isinstance(val, str)}
    return {}


@dataclass(frozen=True)
class PluginConfig:
    base_url: str
    api_key: str
    agent_id: str
    agent_name: str
    fail_closed: bool = True
    risk_score_default: int = 50
    high_risk_tools: frozenset = field(default_factory=frozenset)
    ignored_tools: frozenset = field(default_factory=frozenset)
    tool_action_types: Mapping[str, str] = field(default_factory=dict)
    default_model: str = ""
    approval_timeout_ms: int = 300_000
    request_timeout_ms: int = 10_000

    @property
    def configured(self) -> bool:
        return bool(self.base_url) and bool(self.api_key)


def resolve(raw: Optional[Mapping[str, Any]] = None, *, env: Optional[Mapping[str, str]] = None) -> PluginConfig:
    """Resolve plugin config. Priority: explicit kwargs > env > defaults."""
    cfg: Mapping[str, Any] = raw or {}
    e = env if env is not None else os.environ

    base_url = _first_str(
        cfg.get("base_url"),
        cfg.get("baseUrl"),
        cfg.get("dashclaw_url"),
        e.get("DASHCLAW_BASE_URL"),
        e.get("DASHCLAW_URL"),
    ).rstrip("/")

    api_key = _first_str(
        cfg.get("api_key"),
        cfg.get("apiKey"),
        cfg.get("dashclaw_api_key"),
        e.get("DASHCLAW_API_KEY"),
    )

    agent_id = _first_str(cfg.get("agent_id"), cfg.get("agentId"), e.get("DASHCLAW_AGENT_ID")) or "hermes"
    agent_name_default = f"hermes@{socket.gethostname()}" if hasattr(socket, "gethostname") else "hermes"
    agent_name = _first_str(cfg.get("agent_name"), cfg.get("agentName"), e.get("DASHCLAW_AGENT_NAME")) or agent_name_default

    return PluginConfig(
        base_url=base_url,
        api_key=api_key,
        agent_id=agent_id,
        agent_name=agent_name,
        fail_closed=_as_bool(cfg.get("fail_closed", cfg.get("failClosed", e.get("DASHCLAW_FAIL_CLOSED"))), True),
        risk_score_default=_as_int(cfg.get("risk_score_default", cfg.get("riskScoreDefault", e.get("DASHCLAW_RISK_DEFAULT"))), 50),
        high_risk_tools=frozenset(_as_str_set(cfg.get("high_risk_tools") or cfg.get("highRiskTools") or e.get("DASHCLAW_HIGH_RISK_TOOLS"))),
        ignored_tools=frozenset(_as_str_set(cfg.get("ignored_tools") or cfg.get("ignoredTools"))),
        tool_action_types=_as_str_map(cfg.get("tool_action_types") or cfg.get("toolActionTypes")),
        default_model=_first_str(cfg.get("default_model"), cfg.get("defaultModel"), e.get("DASHCLAW_DEFAULT_MODEL")),
        approval_timeout_ms=_as_int(cfg.get("approval_timeout_ms", cfg.get("approvalTimeoutMs", e.get("DASHCLAW_APPROVAL_TIMEOUT_MS"))), 300_000),
        request_timeout_ms=_as_int(cfg.get("request_timeout_ms", e.get("DASHCLAW_REQUEST_TIMEOUT_MS")), 10_000),
    )


def resolve_action_type(tool_name: str, overrides: Mapping[str, str]) -> str:
    if tool_name in overrides:
        return overrides[tool_name]
    return tool_name.lower()


def infer_risk_score(tool_name: str, fallback: int) -> int:
    return _BUILTIN_RISK.get(tool_name.lower(), fallback)


def infer_reversible(tool_name: str) -> bool:
    return tool_name.lower() in _REVERSIBLE_TOOLS


__all__ = [
    "PluginConfig",
    "resolve",
    "resolve_action_type",
    "infer_risk_score",
    "infer_reversible",
]
