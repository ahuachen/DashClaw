"""Shape diff -detect what changed in DashClaw's structure between two points in time.

Save snapshots with save_snapshot(), then compute_diff() to see what routes,
env vars, or tables were added, removed, or changed. This is how downstream
artifacts (doctor checks, skills, MCP definitions) know they're stale.
"""
import json
from dataclasses import asdict
from pathlib import Path

from livingcode.shape import build_shape
from livingcode.state import ensure_organism_dir, _safe_timestamp
from livingcode.types import (
    EnvVarInfo,
    RouteInfo,
    ShapeChange,
    ShapeDiff,
    ShapeModel,
    TableInfo,
)

SNAPSHOTS_DIR = "shape-snapshots"


# --- Snapshot persistence ---


def save_snapshot(repo_path: str) -> str:
    """Save current shape as a JSON snapshot. Returns the file path."""
    base = ensure_organism_dir(repo_path)
    snap_dir = base / SNAPSHOTS_DIR
    snap_dir.mkdir(exist_ok=True)

    shape = build_shape(repo_path)
    filepath = snap_dir / f"{_safe_timestamp()}.json"
    with open(filepath, "w") as f:
        json.dump(asdict(shape), f, indent=2, default=str)
    return str(filepath)


def load_latest_snapshot(repo_path: str) -> ShapeModel | None:
    """Load the most recent shape snapshot. Returns None if none exist."""
    snap_dir = Path(repo_path) / ".organism" / SNAPSHOTS_DIR
    if not snap_dir.exists():
        return None
    files = sorted(snap_dir.glob("*.json"), key=lambda p: p.stat().st_mtime)
    if not files:
        return None
    with open(files[-1]) as f:
        data = json.load(f)
    return _shape_from_dict(data)


def _shape_from_dict(data: dict) -> ShapeModel:
    """Reconstruct a ShapeModel from a JSON-loaded dict."""
    return ShapeModel(
        timestamp=data["timestamp"],
        routes=[RouteInfo(**r) for r in data.get("routes", [])],
        env_vars=[EnvVarInfo(**e) for e in data.get("env_vars", [])],
        tables=[TableInfo(**t) for t in data.get("tables", [])],
    )


# --- Diff computation ---


def compute_diff(old: ShapeModel, new: ShapeModel) -> ShapeDiff:
    """Compare two shape models and return structured changes."""
    changes: list[ShapeChange] = []

    # Routes
    old_routes = {r.path: r for r in old.routes}
    new_routes = {r.path: r for r in new.routes}

    for path in sorted(set(new_routes) - set(old_routes)):
        r = new_routes[path]
        methods = ", ".join(r.methods) if r.methods else "no methods"
        changes.append(ShapeChange(
            category="routes",
            action="added",
            item=path,
            detail=f"New route: {methods}",
        ))

    for path in sorted(set(old_routes) - set(new_routes)):
        changes.append(ShapeChange(
            category="routes",
            action="removed",
            item=path,
            detail="Route removed",
        ))

    for path in sorted(set(old_routes) & set(new_routes)):
        old_r, new_r = old_routes[path], new_routes[path]
        if old_r.methods != new_r.methods:
            changes.append(ShapeChange(
                category="routes",
                action="changed",
                item=path,
                detail=f"Methods: {', '.join(old_r.methods)} -> {', '.join(new_r.methods)}",
            ))

    # Env vars
    old_env = {e.name: e for e in old.env_vars}
    new_env = {e.name: e for e in new.env_vars}

    for name in sorted(set(new_env) - set(old_env)):
        e = new_env[name]
        req = "required" if e.required else "optional"
        doc = "documented" if e.in_env_example else "undocumented"
        changes.append(ShapeChange(
            category="env_vars",
            action="added",
            item=name,
            detail=f"New env var ({req}, {doc})",
        ))

    for name in sorted(set(old_env) - set(new_env)):
        changes.append(ShapeChange(
            category="env_vars",
            action="removed",
            item=name,
            detail="Env var no longer referenced",
        ))

    for name in sorted(set(old_env) & set(new_env)):
        old_e, new_e = old_env[name], new_env[name]
        diffs = []
        if old_e.required != new_e.required:
            diffs.append(f"required: {old_e.required} ->{new_e.required}")
        if old_e.in_env_example != new_e.in_env_example:
            diffs.append(f"documented: {old_e.in_env_example} ->{new_e.in_env_example}")
        if diffs:
            changes.append(ShapeChange(
                category="env_vars",
                action="changed",
                item=name,
                detail="; ".join(diffs),
            ))

    # Tables
    old_tables = {t.name for t in old.tables}
    new_tables = {t.name for t in new.tables}

    for name in sorted(new_tables - old_tables):
        changes.append(ShapeChange(
            category="tables",
            action="added",
            item=name,
            detail="New table in schema",
        ))

    for name in sorted(old_tables - new_tables):
        changes.append(ShapeChange(
            category="tables",
            action="removed",
            item=name,
            detail="Table removed from schema",
        ))

    return ShapeDiff(
        previous_timestamp=old.timestamp,
        current_timestamp=new.timestamp,
        changes=changes,
    )


def diff_against_snapshot(repo_path: str) -> ShapeDiff | None:
    """Build current shape, diff against latest snapshot. Returns None if no snapshot exists."""
    old = load_latest_snapshot(repo_path)
    if old is None:
        return None
    new = build_shape(repo_path)
    return compute_diff(old, new)


# --- Formatting ---


def format_diff(diff: ShapeDiff) -> str:
    """Render a ShapeDiff as human-readable text."""
    if not diff.changes:
        return "No shape changes detected."

    # Group by category
    by_cat: dict[str, list[ShapeChange]] = {}
    for c in diff.changes:
        by_cat.setdefault(c.category, []).append(c)

    labels = {"routes": "Routes", "env_vars": "Environment Variables", "tables": "Database Tables"}
    symbols = {"added": "+", "removed": "-", "changed": "~"}

    lines = [f"Shape diff ({diff.previous_timestamp} -> {diff.current_timestamp})", ""]

    for cat in ("routes", "env_vars", "tables"):
        items = by_cat.get(cat, [])
        if not items:
            continue
        lines.append(f"  {labels[cat]}:")
        for c in items:
            sym = symbols.get(c.action, "?")
            lines.append(f"    {sym} {c.item}  - {c.detail}")
        lines.append("")

    # Summary line
    added = sum(1 for c in diff.changes if c.action == "added")
    removed = sum(1 for c in diff.changes if c.action == "removed")
    changed = sum(1 for c in diff.changes if c.action == "changed")
    parts = []
    if added:
        parts.append(f"{added} added")
    if removed:
        parts.append(f"{removed} removed")
    if changed:
        parts.append(f"{changed} changed")
    lines.append(f"  Total: {', '.join(parts)}")

    return "\n".join(lines)
