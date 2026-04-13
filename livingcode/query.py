"""Query interface — answer questions about DashClaw's current shape.

This is the key piece: instead of hardcoding facts into skills, MCP
definitions, or doctor checks, consumers call query() and get current
truth from the source code.
"""
import json
from dataclasses import asdict

from livingcode.shape import build_shape

TOPICS = ("routes", "archived-routes", "env", "tables", "summary", "all")


def query_shape(repo_path: str, topic: str, *, output_json: bool = False) -> str:
    """Query the shape model for a specific topic. Returns formatted text or JSON."""
    shape = build_shape(repo_path)

    if topic == "routes":
        items = [r for r in shape.routes if not r.archived]
        if output_json:
            return json.dumps([asdict(r) for r in items], indent=2)
        lines = [f"Active API routes ({len(items)}):"]
        for r in items:
            methods = ", ".join(r.methods) if r.methods else "NO METHODS"
            params = f"  [{', '.join(r.dynamic_params)}]" if r.dynamic_params else ""
            lines.append(f"  {methods:20s} {r.path}{params}")
        return "\n".join(lines)

    if topic == "archived-routes":
        items = [r for r in shape.routes if r.archived]
        if output_json:
            return json.dumps([asdict(r) for r in items], indent=2)
        lines = [f"Archived routes ({len(items)}):"]
        for r in items:
            lines.append(f"  {r.path}")
        return "\n".join(lines)

    if topic == "env":
        if output_json:
            return json.dumps([asdict(e) for e in shape.env_vars], indent=2)
        required = [e for e in shape.env_vars if e.required]
        optional = [e for e in shape.env_vars if not e.required]
        lines = [f"Environment variables ({len(shape.env_vars)} total):"]
        lines.append(f"\n  Required ({len(required)}):")
        for e in required:
            doc = "documented" if e.in_env_example else "UNDOCUMENTED"
            lines.append(f"    {e.name:40s} ({doc}, {len(e.files)} refs)")
        lines.append(f"\n  Optional ({len(optional)}):")
        for e in optional:
            doc = "documented" if e.in_env_example else "UNDOCUMENTED"
            lines.append(f"    {e.name:40s} ({doc}, {len(e.files)} refs)")
        return "\n".join(lines)

    if topic == "tables":
        if output_json:
            return json.dumps([asdict(t) for t in shape.tables], indent=2)
        lines = [f"Database tables ({len(shape.tables)}):"]
        for t in shape.tables:
            lines.append(f"  {t.name}")
        return "\n".join(lines)

    if topic == "summary":
        active = len([r for r in shape.routes if not r.archived])
        archived = len([r for r in shape.routes if r.archived])
        req_env = len([e for e in shape.env_vars if e.required])
        opt_env = len([e for e in shape.env_vars if not e.required])
        undoc = len([e for e in shape.env_vars if not e.in_env_example])

        if output_json:
            return json.dumps(
                {
                    "timestamp": shape.timestamp,
                    "routes": {"active": active, "archived": archived},
                    "env_vars": {"required": req_env, "optional": opt_env, "undocumented": undoc},
                    "tables": len(shape.tables),
                },
                indent=2,
            )
        return "\n".join([
            f"DashClaw Shape ({shape.timestamp})",
            f"  Routes:    {active} active, {archived} archived",
            f"  Env vars:  {req_env} required, {opt_env} optional ({undoc} undocumented)",
            f"  Tables:    {len(shape.tables)}",
        ])

    if topic == "all":
        if output_json:
            return json.dumps(asdict(shape), indent=2)
        parts = [query_shape(repo_path, t) for t in ("summary", "routes", "env", "tables")]
        return "\n\n".join(parts)

    return f"Unknown topic: {topic}. Available: {', '.join(TOPICS)}"
