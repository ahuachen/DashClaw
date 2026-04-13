"""Skill emitter — generates a fresh platform-intelligence skill markdown file.

Consumers run `python -m livingcode emit skill` (optionally with --output) to
regenerate the skill whenever DashClaw changes. The skill contains a snapshot
of the current shape plus instructions to prefer live queries.
"""
from livingcode.types import ShapeModel


def _group_routes_by_category(shape: ShapeModel) -> dict[str, list]:
    """Group active routes by their first path segment after /api/."""
    groups: dict[str, list] = {}
    for r in shape.routes:
        if r.archived:
            continue
        parts = r.path.strip("/").split("/")
        if len(parts) >= 2 and parts[0] == "api":
            category = parts[1]
            groups.setdefault(category, []).append(r)
    return groups


def emit_skill(shape: ShapeModel) -> str:
    """Render the shape model as a platform-intelligence skill markdown file."""
    active = [r for r in shape.routes if not r.archived]
    required_env = sorted([e for e in shape.env_vars if e.required], key=lambda e: e.name)
    optional_env = sorted([e for e in shape.env_vars if not e.required], key=lambda e: e.name)
    route_groups = _group_routes_by_category(shape)

    lines: list[str] = []

    # Frontmatter
    lines += [
        "---",
        "name: dashclaw-platform-intelligence",
        "description: DashClaw platform expert for integration, troubleshooting, and governance. "
        "Snapshot-based — always prefer live queries via `python -m livingcode query`.",
        "---",
        "",
        "# DashClaw Platform Intelligence",
        "",
        f"**Shape snapshot:** `{shape.timestamp}`",
        "**This file is auto-generated.** Do not edit by hand — regenerate with:",
        "",
        "```bash",
        "python -m livingcode emit skill --output <path-to-SKILL.md>",
        "```",
        "",
        "## Prefer Live Queries",
        "",
        "The facts below are a snapshot. Before answering any question about DashClaw's current",
        "structure, routes, env vars, or schema — run a live query:",
        "",
        "```bash",
        "python -m livingcode query summary     # High-level shape",
        "python -m livingcode query routes      # Current API surface",
        "python -m livingcode query env         # Current env vars",
        "python -m livingcode query tables      # Current schema",
        "python -m livingcode query all --json  # Full machine-readable shape",
        "```",
        "",
        "If the snapshot below disagrees with a live query, **trust the live query**.",
        "",
        "## At a Glance",
        "",
        f"- **{len(active)}** active API routes across **{len(route_groups)}** categories",
        f"- **{len(required_env)}** required + **{len(optional_env)}** optional environment variables",
        f"- **{len(shape.tables)}** database tables",
        "",
    ]

    # API surface
    lines += ["## API Surface", ""]
    for category in sorted(route_groups.keys()):
        routes = sorted(route_groups[category], key=lambda r: r.path)
        lines.append(f"### `{category}`")
        lines.append("")
        for r in routes:
            methods = ", ".join(r.methods) if r.methods else "-"
            lines.append(f"- `{methods}` `{r.path}`")
        lines.append("")

    # Required env vars
    lines += ["## Required Environment Variables", ""]
    lines += [
        "These must be set — DashClaw will fail to start without them.",
        "",
    ]
    for e in required_env:
        doc = "" if e.in_env_example else " *(undocumented in .env.example)*"
        lines.append(f"- **`{e.name}`** - referenced in {len(e.files)} file(s){doc}")
    lines.append("")

    # Optional env vars
    lines += ["## Optional Environment Variables", ""]
    lines += [
        "These have fallbacks or only activate specific features.",
        "",
    ]
    for e in optional_env:
        doc = "" if e.in_env_example else " *(undocumented)*"
        lines.append(f"- `{e.name}`{doc}")
    lines.append("")

    # Tables
    lines += ["## Database Tables", ""]
    lines += [
        f"All {len(shape.tables)} tables defined in `schema/schema.js` (Drizzle ORM):",
        "",
    ]
    for t in shape.tables:
        lines.append(f"- `{t.name}`")
    lines.append("")

    # Stale detection
    lines += [
        "## Detecting Drift",
        "",
        "To check whether this snapshot matches the current codebase:",
        "",
        "```bash",
        "python -m livingcode diff",
        "```",
        "",
        "If the diff shows changes, this skill is stale — regenerate it.",
    ]

    return "\n".join(lines) + "\n"
