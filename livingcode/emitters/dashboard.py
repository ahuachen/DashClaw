"""Dashboard emitter — single-file HTML snapshot of the living codebase.

Visual surface for the shape + recent health. Intended to be opened directly
from `public/livingcode/index.html` (or served by Next.js at /livingcode/).
Byte-stable: timestamp is replaced with a content-hash by livingcode-refresh.mjs.
"""
from html import escape

from livingcode.types import ShapeModel


_STYLES = """
body{font:14px/1.45 ui-sans-serif,system-ui,sans-serif;margin:2rem;color:#0f172a;background:#fafafa}
h1{font-size:1.25rem;margin:0 0 .25rem}
.sig{color:#64748b;font-family:ui-monospace,monospace;font-size:.8rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin:1.25rem 0}
.cell{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:.75rem 1rem}
.n{font-size:1.5rem;font-weight:600}
.k{color:#475569;font-size:.85rem}
figure{margin:0 0 1rem;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:.5rem .75rem}
figcaption{font-size:.85rem;color:#334155;margin-bottom:.25rem}
h2{font-size:1rem;margin:1.5rem 0 .5rem}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
th,td{padding:.5rem .75rem;text-align:left;border-bottom:1px solid #f1f5f9;font-size:.9rem}
th{background:#f8fafc;font-weight:600}
code{font-family:ui-monospace,monospace;font-size:.85rem}
ul.diff{list-style:none;padding:0}
ul.diff li{background:#fff;border:1px solid #e2e8f0;border-radius:6px;padding:.5rem .75rem;margin-bottom:.25rem}
details{margin-bottom:.5rem;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:.5rem .75rem}
summary{font-weight:600;cursor:pointer;font-size:.9rem}
details[open] summary{margin-bottom:.5rem}
details table{margin-top:.5rem;border:1px solid #f1f5f9}
input#route-filter{width:100%;max-width:24rem;padding:.5rem .75rem;margin-bottom:.75rem;border:1px solid #e2e8f0;border-radius:6px;font:inherit}
.cell.danger{border-color:#f97316;box-shadow:inset 3px 0 0 #f97316}
.cell.danger .n{color:#c2410c}
.trend{font-size:.85rem;margin-left:.25rem;color:#64748b}
.trend.up{color:#16a34a}
.trend.down{color:#dc2626}
p.kicker{background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:.5rem .75rem;margin:0 0 .5rem;font-size:.9rem}
p.kicker b{color:#c2410c}
""".strip()


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


def _section_counts(shape, active_routes, archived_routes, required_env, optional_env) -> str:
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
    return f'<div class="grid">\n{count_cells}\n</div>\n'


def _section_timeline(snapshots, state_history=None) -> str:
    sparklines = []

    if snapshots and len(snapshots) >= 2:
        ordered = sorted(snapshots, key=lambda s: s["timestamp"])
        sparklines.extend([
            _sparkline("Active routes over time", [
                (s["timestamp"], sum(1 for r in s["routes"] if not r.get("archived")))
                for s in ordered
            ]),
            _sparkline("Required env vars over time", [
                (s["timestamp"], sum(1 for e in s["env_vars"] if e.get("required")))
                for s in ordered
            ]),
            _sparkline("Tables over time", [
                (s["timestamp"], len(s["tables"]))
                for s in ordered
            ]),
        ])

    if state_history and len(state_history) >= 2:
        ordered = sorted(state_history, key=lambda s: s["timestamp"])
        todos = [(s["timestamp"], (s.get("code_quality") or {}).get("todo_count", 0)) for s in ordered]
        files = [(s["timestamp"], (s.get("code_quality") or {}).get("files_over_300_lines", 0)) for s in ordered]
        lockfile = [(s["timestamp"], (s.get("dependency_health") or {}).get("lockfile_age_days", 0)) for s in ordered]
        sparklines.extend([
            _sparkline("TODOs over time", todos),
            _sparkline("Files >300 lines over time", files),
            _sparkline("Lockfile age over time", lockfile),
        ])

    sparklines = [s for s in sparklines if s]
    if not sparklines:
        return ""
    return '<section><h2>Timeline</h2>' + "\n".join(sparklines) + '</section>\n'


def _chip_danger(label: str, value) -> bool:
    """Return True if the chip value crosses a health threshold worth calling out."""
    try:
        if label == "Bus factor":
            return int(value) <= 1
        if label == "Vulnerabilities":
            return int(value) > 0
        if label == "Lockfile age":
            if isinstance(value, str) and value.endswith("d"):
                return int(value[:-1]) > 180
        if label == "Untested routes":
            return int(value) > 10
    except (TypeError, ValueError):
        return False
    return False


def _health_chip_value(label: str, report: dict):
    """Extract numeric chip value from a state_report for trend comparison."""
    gs = report.get("git_stats") or {}
    th = report.get("test_health") or {}
    cq = report.get("code_quality") or {}
    dep = report.get("dependency_health") or {}
    ci = report.get("ci_health") or {}
    js = th.get("js_tests") or {}
    py = th.get("python_tests") or {}

    def pct(suite):
        t = suite.get("total", 0)
        return (suite.get("passed", 0) / t * 100) if t else None

    mapping = {
        "Commits 7d": gs.get("commits_7d"),
        "Bus factor": gs.get("bus_factor"),
        "JS tests": pct(js),
        "Python tests": pct(py),
        "Test file ratio": th.get("test_file_ratio"),
        "Untested routes": len(th.get("untested_routes") or []) or None,
        "Vulnerabilities": dep.get("js_vulnerabilities"),
        "Lockfile age": dep.get("lockfile_age_days"),
        "CI pass 30d": (ci.get("pass_rate_30d") * 100) if ci.get("pass_rate_30d") is not None else None,
        "TODOs": cq.get("todo_count"),
        "Files >300 lines": cq.get("files_over_300_lines"),
    }
    return mapping.get(label)


def _section_health(state_report, previous=None) -> str:
    if not state_report:
        return ""
    gs = state_report.get("git_stats") or {}
    th = state_report.get("test_health") or {}
    cq = state_report.get("code_quality") or {}
    js = th.get("js_tests") or {"total": 0, "passed": 0}
    py = th.get("python_tests") or {"total": 0, "passed": 0}
    dep = state_report.get("dependency_health") or {}
    ci = state_report.get("ci_health") or {}
    contribs = gs.get("top_contributors_30d") or []
    top_contrib = contribs[0]["name"] if contribs else "?"

    def _pct(suite):
        t = suite.get("total", 0)
        return f"{(suite.get('passed', 0) / t * 100):.1f}%" if t else "n/a"

    chips = [
        ("Commits 7d", gs.get("commits_7d", "?")),
        ("Bus factor", gs.get("bus_factor", "?")),
        ("Top contributor", top_contrib),
        ("JS tests", _pct(js)),
        ("Python tests", _pct(py)),
        ("Test file ratio", f"{th.get('test_file_ratio', 0):.2f}" if th.get("test_file_ratio") is not None else "?"),
        ("Untested routes", len(th.get("untested_routes") or [])),
        ("Vulnerabilities", dep.get("js_vulnerabilities", "?")),
        ("Lockfile age", f"{dep.get('lockfile_age_days', '?')}d" if dep.get("lockfile_age_days") is not None else "?"),
        ("CI pass 30d", f"{ci['pass_rate_30d'] * 100:.1f}%" if ci.get("pass_rate_30d") is not None else "?"),
        ("TODOs", cq.get("todo_count", "?")),
        ("Files >300 lines", cq.get("files_over_300_lines", "?")),
    ]
    def _arrow(label, value):
        if not previous:
            return ""
        prior_val = _health_chip_value(label, previous)
        if prior_val is None:
            return ""
        try:
            if float(value) > float(prior_val):
                return '<span class="trend up">↑</span>'
            if float(value) < float(prior_val):
                return '<span class="trend down">↓</span>'
            return '<span class="trend">→</span>'
        except (TypeError, ValueError):
            return ""

    chip_cells = "\n".join(
        f'      <div class="cell{" danger" if _chip_danger(k, v) else ""}">'
        f'<div class="n">{escape(str(v))}{_arrow(k, v)}</div>'
        f'<div class="k">{escape(k)}</div></div>'
        for k, v in chips
    )
    return f'<section><h2>Health</h2><div class="grid">{chip_cells}</div></section>\n'


def _section_diff(diff) -> str:
    if not diff or not diff.get("changes"):
        return ""
    changes = diff["changes"]

    from collections import Counter
    summary_counts = Counter((c["category"], c["action"]) for c in changes)
    kicker_parts = [
        f'<b>{count}</b> {escape(category)} {escape(action)}'
        for (category, action), count in sorted(summary_counts.items())
    ]
    kicker = '<p class="kicker">' + ", ".join(kicker_parts) + ' since last snapshot.</p>'

    rows = "\n".join(
        f'    <li><code>{escape(c["action"])}</code> '
        f'<b>{escape(c["category"])}</b>: {escape(c["item"])} '
        f'<span class="sig">{escape(c.get("detail", ""))}</span></li>'
        for c in changes
    )
    return (
        f'<section><h2>Changed since last snapshot</h2>'
        f'{kicker}'
        f'<ul class="diff">{rows}</ul></section>\n'
    )


def _section_routes(active_routes) -> str:
    """Active routes grouped by first path segment, with a native search filter."""
    if not active_routes:
        return ""

    # Group by first segment after /api/ (or fallback to the full path)
    groups: dict[str, list] = {}
    for r in active_routes:
        parts = [p for p in r.path.split("/") if p]
        key = parts[1] if len(parts) > 1 and parts[0] == "api" else (parts[0] if parts else "/")
        groups.setdefault(key, []).append(r)

    group_html = []
    for key in sorted(groups):
        rows = "\n".join(
            f'    <tr data-path="{escape(r.path)}"><td><code>{escape(r.path)}</code></td>'
            f'<td>{escape(", ".join(r.methods))}</td>'
            f'<td class="sig">{escape(r.file_path)}</td></tr>'
            for r in groups[key]
        )
        group_html.append(
            f'<details><summary>/{escape(key)}/* ({len(groups[key])})</summary>'
            f'<table><thead><tr><th>Path</th><th>Methods</th><th>File</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></details>'
        )

    filter_js = (
        "var q=this.value.toLowerCase();"
        "document.querySelectorAll('section.routes tr[data-path]').forEach(function(r){"
        "r.style.display=r.dataset.path.toLowerCase().includes(q)?'':'none';});"
        "document.querySelectorAll('section.routes details').forEach(function(d){"
        "var visible=d.querySelectorAll(\"tr[data-path]:not([style*='none'])\").length;"
        "d.style.display=visible||!q?'':'none';if(q)d.open=true;});"
    )

    return (
        '<section class="routes"><h2>Active routes</h2>'
        f'<input id="route-filter" type="search" placeholder="Filter routes…" oninput="{filter_js}">'
        + "\n".join(group_html) +
        '</section>\n'
    )


def _section_shape_details(shape: ShapeModel) -> str:
    """Collapsible lists of tables, events, signals, adapters, setting keys."""
    blocks = []

    if shape.tables:
        rows = "\n".join(
            f'    <tr><td><code>{escape(t.name)}</code></td>'
            f'<td class="sig">{escape(t.domain or "—")}</td></tr>'
            for t in sorted(shape.tables, key=lambda t: t.name)
        )
        blocks.append(
            f'<details><summary>Tables ({len(shape.tables)})</summary>'
            f'<table><thead><tr><th>Name</th><th>Domain</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></details>'
        )

    if shape.events:
        rows = "\n".join(
            f'    <tr><td><code>{escape(e.constant)}</code></td>'
            f'<td><code>{escape(e.event)}</code></td></tr>'
            for e in sorted(shape.events, key=lambda e: e.event)
        )
        blocks.append(
            f'<details><summary>Events ({len(shape.events)})</summary>'
            f'<table><thead><tr><th>Constant</th><th>Event</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></details>'
        )

    if shape.adapters:
        rows = "\n".join(
            f'    <tr><td><code>{escape(a.name)}</code></td>'
            f'<td class="sig">{escape(", ".join(a.required_keys))}</td></tr>'
            for a in sorted(shape.adapters, key=lambda a: a.name)
        )
        blocks.append(
            f'<details><summary>Adapters ({len(shape.adapters)})</summary>'
            f'<table><thead><tr><th>Name</th><th>Required keys</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></details>'
        )

    if shape.signal_types:
        items = "\n".join(
            f'    <li><code>{escape(s)}</code></li>'
            for s in sorted(shape.signal_types)
        )
        blocks.append(
            f'<details><summary>Signals ({len(shape.signal_types)})</summary>'
            f'<ul class="diff">{items}</ul></details>'
        )

    if shape.setting_keys:
        rows = "\n".join(
            f'    <tr><td><code>{escape(k.name)}</code></td>'
            f'<td class="sig">{escape(k.section or "—")}</td></tr>'
            for k in sorted(shape.setting_keys, key=lambda k: k.name)
        )
        blocks.append(
            f'<details><summary>Setting keys ({len(shape.setting_keys)})</summary>'
            f'<table><thead><tr><th>Key</th><th>Section</th></tr></thead>'
            f'<tbody>{rows}</tbody></table></details>'
        )

    if not blocks:
        return ""
    return '<section><h2>Shape</h2>' + "\n".join(blocks) + '</section>\n'


def emit_dashboard(
    shape: ShapeModel,
    snapshots: list[dict] | None = None,
    state_report: dict | None = None,
    previous_state_report: dict | None = None,
    state_history: list[dict] | None = None,
    diff: dict | None = None,
) -> str:
    active_routes = [r for r in shape.routes if not r.archived]
    archived_routes = [r for r in shape.routes if r.archived]
    required_env = [e for e in shape.env_vars if e.required]
    optional_env = [e for e in shape.env_vars if not e.required]

    sections = [
        _section_counts(shape, active_routes, archived_routes, required_env, optional_env),
        _section_shape_details(shape),
        _section_timeline(snapshots, state_history),
        _section_health(state_report, previous_state_report),
        _section_diff(diff),
        _section_routes(active_routes),
    ]
    body = "\n".join(s for s in sections if s)

    return (
        "<!doctype html>\n"
        '<html lang="en"><head><meta charset="utf-8">\n'
        "<title>DashClaw Livingcode Dashboard</title>\n"
        f"<style>\n{_STYLES}\n</style></head><body>\n"
        "<h1>DashClaw Livingcode Dashboard</h1>\n"
        f'<div class="sig" id="sig">Shape signature: {escape(shape.timestamp)} · generated {escape(shape.timestamp)}</div>\n'
        f"{body}\n"
        "</body></html>\n"
    )
