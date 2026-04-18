"""Dashboard emitter — single-file HTML snapshot of the living codebase.

Visual surface for the shape + recent health. Intended to be opened directly
from `public/livingcode/index.html` (or served by Next.js at /livingcode/).
Byte-stable: timestamp is replaced with a content-hash by livingcode-refresh.mjs.
"""
from html import escape

from livingcode.types import ShapeModel


def emit_dashboard(shape: ShapeModel) -> str:
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
        "</style></head><body>\n"
        f"<h1>DashClaw Livingcode Dashboard</h1>\n"
        f'<div class="sig">Shape signature: {escape(shape.timestamp)}</div>\n'
        f'<div class="grid">\n{count_cells}\n</div>\n'
        "</body></html>\n"
    )
