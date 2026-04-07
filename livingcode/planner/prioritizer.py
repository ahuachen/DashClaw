"""Tiered prioritizer — generates work items from sensing data."""
from datetime import datetime, timezone
from livingcode.types import StateReport, WorkItem


def _next_id() -> str:
    ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"wk-{ts}"


def generate_work_items(report: StateReport, max_items: int = 10) -> list[WorkItem]:
    """Generate prioritized work items from a state report."""
    items: list[WorkItem] = []
    now = datetime.now(timezone.utc).isoformat()
    seq = 0

    def _add(tier: int, title: str, desc: str, files: list[str], metric: str):
        nonlocal seq
        seq += 1
        items.append(WorkItem(
            id=f"{_next_id()}-{seq:03d}",
            tier=tier,
            title=title,
            description=desc,
            affected_files=files,
            metric=metric,
            status="proposed",
            created_at=now,
        ))

    # --- Tier 1: Critical ---
    if report.dependency_health and report.dependency_health.js_vulnerabilities > 0:
        _add(1, f"Fix {report.dependency_health.js_vulnerabilities} security vulnerability(ies)",
             "npm audit detected vulnerabilities that need resolution.",
             [], "dependency_health.js_vulnerabilities")

    if report.test_health:
        if report.test_health.js_tests.failed > 0:
            _add(1, f"Fix {report.test_health.js_tests.failed} failing JS test(s)",
                 "Tests must be green before any other work.",
                 [], "test_health.js_tests.failed")
        if report.test_health.python_tests.failed > 0:
            _add(1, f"Fix {report.test_health.python_tests.failed} failing Python test(s)",
                 "SDK tests must be green.",
                 [], "test_health.python_tests.failed")

    if report.code_quality and report.code_quality.eslint_status == "fail":
        _add(1, "Fix ESLint violations",
             "Lint must pass — it's a blocking CI gate.",
             [], "code_quality.eslint_status")

    # --- Tier 2: Regression ---
    if report.ci_health and report.ci_health.pass_rate_30d < 0.9:
        _add(2, f"Improve CI pass rate (currently {report.ci_health.pass_rate_30d:.0%})",
             "CI reliability has degraded below 90%.",
             [], "ci_health.pass_rate_30d")

    # --- Tier 3: Maintenance ---
    if report.dependency_health and report.dependency_health.js_outdated > 5:
        _add(3, f"Update {report.dependency_health.js_outdated} outdated JS dependencies",
             "Stale dependencies increase security and compatibility risk.",
             [], "dependency_health.js_outdated")

    if report.test_health and report.test_health.untested_routes:
        count = len(report.test_health.untested_routes)
        _add(3, f"Add tests for {count} untested API route(s)",
             f"Routes without tests: {', '.join(report.test_health.untested_routes[:5])}",
             report.test_health.untested_routes[:5], "test_health.untested_routes")

    if report.code_quality and report.code_quality.todo_count > 10:
        _add(3, f"Triage {report.code_quality.todo_count} TODO/FIXME comments",
             "High TODO count suggests accumulated deferred work.",
             [], "code_quality.todo_count")

    if report.code_quality and report.code_quality.largest_files:
        for f in report.code_quality.largest_files[:3]:
            if f.lines > 500:
                _add(3, f"Split {f.path} ({f.lines} lines)",
                     f"Exceeds organism.json max_file_length of 300 by {f.lines/300:.1f}x.",
                     [f.path], "code_quality.largest_files")

    # --- Tier 4: Improvement ---
    if report.git_stats and report.git_stats.bus_factor <= 1:
        _add(4, "Bus factor is 1 — document critical subsystems",
             "97%+ of commits from a single contributor. Knowledge concentration risk.",
             [], "git_stats.bus_factor")

    if report.code_quality and report.code_quality.archive_size_kb > 100:
        _add(4, f"Clean up archive ({report.code_quality.archive_size_kb}KB)",
             "Archived code adds weight without value.",
             ["app/api/_archive/"], "code_quality.archive_size_kb")

    if report.git_stats and report.git_stats.stale_branches > 2:
        _add(4, f"Prune {report.git_stats.stale_branches} stale remote branches",
             "Stale branches clutter the remote and can cause confusion.",
             [], "git_stats.stale_branches")

    # Sort by tier, then truncate
    items.sort(key=lambda i: i.tier)
    return items[:max_items]
