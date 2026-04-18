"""Emit dispatcher — route an emit target to the right emitter module."""
from livingcode.shape import build_shape

TARGETS = ("skill", "shape-json", "doctor-checks", "mcp-tools", "dashboard")


def emit(repo_path: str, target: str, *, with_context: bool = False) -> str:
    """Build the current shape and render it as the requested artifact."""
    shape = build_shape(repo_path)

    if target == "skill":
        from livingcode.emitters.skill import emit_skill
        return emit_skill(shape)

    if target == "shape-json":
        from livingcode.emitters.shape_json import emit_shape_json
        return emit_shape_json(shape)

    if target == "doctor-checks":
        from livingcode.emitters.doctor_checks import emit_doctor_checks
        return emit_doctor_checks(shape)

    if target == "mcp-tools":
        from livingcode.emitters.mcp_tools import emit_mcp_tools
        return emit_mcp_tools(shape)

    if target == "dashboard":
        from livingcode.emitters.dashboard import emit_dashboard
        ctx = _load_dashboard_context(repo_path) if with_context else {}
        return emit_dashboard(shape, **ctx)

    raise ValueError(f"Unknown emit target: {target}. Available: {', '.join(TARGETS)}")


def _load_dashboard_context(repo_path: str) -> dict:
    """Load snapshots, latest state report, and latest diff from .organism/.

    Returned dict contains up to three keys: `snapshots`, `state_report`, `diff`.
    Missing directories / malformed JSON / absent prior snapshot are all tolerated
    (the corresponding key is simply omitted).
    """
    import json
    from pathlib import Path
    from dataclasses import asdict
    from livingcode.diff import diff_against_snapshot

    root = Path(repo_path)
    ctx: dict = {}

    snap_dir = root / ".organism" / "shape-snapshots"
    if snap_dir.is_dir():
        snapshots = []
        for p in sorted(snap_dir.glob("*.json")):
            try:
                snapshots.append(json.loads(p.read_text(encoding="utf-8")))
            except (OSError, json.JSONDecodeError):
                continue
        if snapshots:
            ctx["snapshots"] = snapshots

    rpt_dir = root / ".organism" / "state-reports"
    if rpt_dir.is_dir():
        reports = sorted(rpt_dir.glob("*.json"))
        if reports:
            try:
                ctx["state_report"] = json.loads(reports[-1].read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                pass

    try:
        d = diff_against_snapshot(repo_path)
    except (OSError, json.JSONDecodeError, KeyError):
        d = None
    if d is not None:
        ctx["diff"] = asdict(d)

    return ctx
