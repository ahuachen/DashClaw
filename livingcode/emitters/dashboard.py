"""Dashboard emitter — single-file HTML snapshot of the living codebase.

Visual surface for the shape + recent health. Intended to be opened directly
from `public/livingcode/index.html` (or served by Next.js at /livingcode/).
Byte-stable: timestamp is replaced with a content-hash by livingcode-refresh.mjs.
"""
from html import escape

from livingcode.types import ShapeModel


def _sparkline(label: str, series: list[tuple[str, int]]) -> str:
    """Inline SVG sparkline with labels. Deterministic, no JS."""
    if len(series) < 2:
        return ""
    width, height, pad = 320, 48, 4
    values = [v for _, v in series]
    vmin, vmax = min(values), max(values)
    span = max(vmax - vmin, 1)
    step = (width - 2 * pad) / (len(series) - 1)
    pts = " ".join(
        f"{pad + i * step:.1f},{height - pad - (v - vmin) / span * (height - 2 * pad):.1f}"
        for i, (_, v) in enumerate(series)
    )
    return (
        f'<figure><figcaption>{escape(label)} '
        f'<span class="sig">({vmin} → {vmax})</span></figcaption>'
        f'<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
        f'<polyline fill="none" stroke="#f97316" stroke-width="2" points="{pts}"/>'
        f'</svg></figure>'
    )


def emit_dashboard(shape: ShapeModel, snapshots: list[dict] | None = None) -> str:
    active_routes = [r for r in shape.routes if not r.archived]
    archived_routes = [r for r in shape.routes if r.archived]
    required_env = [e for e in shape.env_vars if e.required]
    optional_env = [e for e in shape.env_vars if not e.required]

    counts = [
        ("Active routes", len(active_routes)),
        ("Archived routes", len(archived_routes)),
        ("Required env vars", len(required_env)),
        ("Optional env vars", len(optional_env)),
        ("Tables", len(shape.tables)),
        ("Events", len(shape.events)),
        ("Signals", len(shape.signal_types)),
        ("Adapters", len(shape.adapters)),
        ("Setting keys", len(shape.setting_keys)),
    ]

    count_cells = "\n".join(
        f'      <div class="cell"><div class="n">{n}</div><div class="k">{escape(k)}</div></div>'
        for k, n in counts
    )

    timeline_html = ""
    if snapshots:
        ordered = sorted(snapshots, key=lambda s: s["timestamp"])
        routes_series = [
            (s["timestamp"], sum(1 for r in s["routes"] if not r.get("archived")))
            for s in ordered
        ]
        env_series = [
            (s["timestamp"], sum(1 for e in s["env_vars"] if e.get("required")))
            for s in ordered
        ]
        tables_series = [(s["timestamp"], len(s["tables"])) for s in ordered]
        sparklines = "\n".join([
            _sparkline("Active routes over time", routes_series),
            _sparkline("Required env vars over time", env_series),
            _sparkline("Tables over time", tables_series),
        ])
        timeline_html = f'<section><h2>Timeline</h2>{sparklines}</section>\n'

    return (
        "<!doctype html>\n"
        '<html lang="en"><head><meta charset="utf-8">\n'
        "<title>DashClaw Livingcode Dashboard</title>\n"
        "<style>\n"
        "body{font:14px/1.45 ui-sans-serif,system-ui,sans-serif;margin:2rem;color:#0f172a;background:#fafafa}\n"
        "h1{font-size:1.25rem;margin:0 0 .25rem}\n"
        ".sig{color:#64748b;font-family:ui-monospace,monospace;font-size:.8rem}\n"
        ".grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin:1.25rem 0}\n"
        ".cell{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:.75rem 1rem}\n"
        ".n{font-size:1.5rem;font-weight:600}\n"
        ".k{color:#475569;font-size:.85rem}\n"
        "figure{margin:0 0 1rem;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:.5rem .75rem}\n"
        "figcaption{font-size:.85rem;color:#334155;margin-bottom:.25rem}\n"
        "h2{font-size:1rem;margin:1.5rem 0 .5rem}\n"
        "</style></head><body>\n"
        f"<h1>DashClaw Livingcode Dashboard</h1>\n"
        f'<div class="sig">Shape signature: {escape(shape.timestamp)}</div>\n'
        f'<div class="grid">\n{count_cells}\n</div>\n'
        f'{timeline_html}'
        "</body></html>\n"
    )
