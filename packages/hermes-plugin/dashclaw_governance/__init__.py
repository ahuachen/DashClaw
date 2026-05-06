"""dashclaw-hermes-plugin — DashClaw governance for Hermes.

Wires Hermes hooks into the DashClaw governance loop:

  pre_tool_call    → guard() + waitForApproval() + createAction()
  post_tool_call   → updateOutcome()
  on_session_start → heartbeat("busy")
  on_session_end   → heartbeat("online")

Activation: pip install + add ``observability/dashclaw`` to
``~/.hermes/config.yaml`` under ``plugins.enabled``.

Required env vars (or equivalent fields in ``~/.hermes/config.yaml`` under
``dashclaw_governance``):

  DASHCLAW_BASE_URL  - DashClaw runtime URL (e.g. http://localhost:3310)
  DASHCLAW_API_KEY   - API key for the runtime

Optional:

  DASHCLAW_AGENT_ID, DASHCLAW_AGENT_NAME, DASHCLAW_FAIL_CLOSED,
  DASHCLAW_RISK_DEFAULT, DASHCLAW_HIGH_RISK_TOOLS, DASHCLAW_DEFAULT_MODEL,
  DASHCLAW_APPROVAL_TIMEOUT_MS

See `docs/integrations/hermes.md` in the DashClaw repo for the full setup.
"""
from __future__ import annotations

import atexit
import logging
import os
from typing import Any, Mapping, Optional

from .config import PluginConfig, resolve
from .governance import GovernanceBridge

log = logging.getLogger("dashclaw.hermes")

# Module-scope singleton — Hermes calls register() once per process.
_BRIDGE: Optional[GovernanceBridge] = None


def _resolve_runtime_config() -> PluginConfig:
    """Resolve config from env + (optional) Hermes plugin config block.

    Hermes' standard pattern is to expose plugin config as a top-level
    YAML block keyed by plugin name (see langfuse plugin for reference).
    We accept config from two sources:

      1. ``~/.hermes/config.yaml`` → ``dashclaw_governance: {...}``
      2. environment variables (DASHCLAW_*)

    For simplicity we go env-first. If a richer config-driven setup is
    needed, the operator can also set the env vars in ``~/.hermes/.env``,
    which Hermes loads automatically before plugin discovery.
    """
    return resolve(env=os.environ)


def register(ctx: Any) -> None:
    """Hermes plugin entry point.

    ``ctx`` is the ``PluginContext`` instance from
    ``hermes_cli/plugins.py``. We only call its ``register_hook`` method.
    """
    global _BRIDGE

    cfg = _resolve_runtime_config()
    if not cfg.configured:
        log.warning(
            "DashClaw governance plugin loaded but inactive: set DASHCLAW_BASE_URL "
            "and DASHCLAW_API_KEY (e.g. via ~/.hermes/.env) to enable."
        )
        return

    bridge = GovernanceBridge(cfg)
    bridge.start()
    _BRIDGE = bridge

    atexit.register(bridge.stop)

    # ------------------------------------------------------------------
    # Hook callbacks. Each one is a thin shim that forwards to the bridge
    # while honouring Hermes' `**kwargs` calling convention.
    # ------------------------------------------------------------------

    def on_pre_tool_call(*, tool_name: str = "", args: Optional[Mapping[str, Any]] = None,
                         task_id: str = "", session_id: str = "",
                         tool_call_id: str = "", **_: Any) -> Optional[dict]:
        return bridge.pre_tool_call(
            tool_name=tool_name,
            args=args,
            task_id=task_id,
            session_id=session_id,
            tool_call_id=tool_call_id,
        )

    def on_post_tool_call(*, tool_name: str = "", args: Optional[Mapping[str, Any]] = None,
                          result: Any = None, task_id: str = "", session_id: str = "",
                          tool_call_id: str = "", duration_ms: Optional[int] = None,
                          **_: Any) -> None:
        bridge.post_tool_call(
            tool_name=tool_name,
            args=args,
            result=result,
            task_id=task_id,
            session_id=session_id,
            tool_call_id=tool_call_id,
            duration_ms=duration_ms,
        )

    def on_session_start(*, session_id: str = "", **_: Any) -> None:
        bridge.on_session_start(session_id=session_id)

    def on_session_end(*, session_id: str = "", **_: Any) -> None:
        bridge.on_session_end(session_id=session_id)

    ctx.register_hook("pre_tool_call", on_pre_tool_call)
    ctx.register_hook("post_tool_call", on_post_tool_call)
    ctx.register_hook("on_session_start", on_session_start)
    ctx.register_hook("on_session_end", on_session_end)


__all__ = ["register", "GovernanceBridge", "PluginConfig", "resolve"]
