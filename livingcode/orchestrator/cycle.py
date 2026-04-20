"""Lifecycle cycle — SENSE → PLAN → REVIEW → REFLECT."""
import time
from dataclasses import asdict
from pathlib import Path
from livingcode.types import CycleResult, Baselines
from livingcode.state import (
    ensure_organism_dir, increment_cycle_counter, read_json_file, write_json_file,
)
from livingcode.schema.validator import load_organism
from livingcode.sensing import run_sensing
from livingcode.immune.checks import run_all_checks
from livingcode.immune.verdict import generate_verdict
from livingcode.planner.prioritizer import generate_work_items, load_long_file_allowlist
from livingcode.planner.backlog import write_backlog_item
from livingcode.orchestrator.safety import (
    is_kill_switch_active, is_paused, is_cycle_locked,
    acquire_cycle_lock, release_cycle_lock,
    increment_failures, reset_failures,
)


def _load_baselines(repo_path: str) -> Baselines | None:
    path = Path(repo_path) / ".organism" / "baselines.json"
    data = read_json_file(path)
    if not data:
        return None
    return Baselines(**data)


def _save_baselines(repo_path: str, report) -> None:
    """Update baselines from a successful sensing report."""
    baselines = {
        "updated_at": report.timestamp,
        "test_count": {
            "js": report.test_health.js_tests.total if report.test_health else 0,
            "python": report.test_health.python_tests.total if report.test_health else 0,
        },
        "file_count_over_300": report.code_quality.files_over_300_lines if report.code_quality else 0,
        "js_vulnerabilities": report.dependency_health.js_vulnerabilities if report.dependency_health else 0,
        "sdk_methods": {"node": 67, "python": 236},  # Static until SDK method counting is added
        "ci_pass_rate_30d": report.ci_health.pass_rate_30d if report.ci_health else 0.0,
    }
    write_json_file(Path(repo_path) / ".organism" / "baselines.json", baselines)


def _save_cycle_history(repo_path: str, result: CycleResult) -> None:
    history_dir = Path(repo_path) / ".organism" / "cycle-history"
    history_dir.mkdir(parents=True, exist_ok=True)
    filepath = history_dir / f"cycle-{result.cycle_number:04d}.json"
    write_json_file(filepath, asdict(result))


def run_lifecycle_cycle(repo_path: str, supervised: bool = True) -> CycleResult:
    """Run the full lifecycle cycle: SENSE → PLAN → REVIEW → REFLECT."""
    start = time.time()
    ensure_organism_dir(repo_path)
    phases: list[str] = []

    # Safety checks
    if is_kill_switch_active(repo_path):
        return CycleResult(
            cycle_number=0, outcome="aborted",
            duration_seconds=time.time() - start, phases_completed=phases,
        )

    if is_paused(repo_path):
        return CycleResult(
            cycle_number=0, outcome="paused",
            duration_seconds=time.time() - start, phases_completed=phases,
        )

    if is_cycle_locked(repo_path):
        return CycleResult(
            cycle_number=0, outcome="aborted",
            duration_seconds=time.time() - start, phases_completed=phases,
        )

    cycle_num = increment_cycle_counter(repo_path)

    try:
        acquire_cycle_lock(repo_path)

        # SENSE
        report, report_path = run_sensing(repo_path)
        phases.append("sense")

        # PLAN
        items = generate_work_items(
            report,
            long_file_allowlist=load_long_file_allowlist(repo_path),
        )
        for item in items:
            write_backlog_item(repo_path, item)
        phases.append("plan")

        # REVIEW
        baselines = _load_baselines(repo_path)
        checks = run_all_checks(report, baselines)
        verdict = generate_verdict(checks)
        phases.append("review")

        # REFLECT
        _save_baselines(repo_path, report)
        phases.append("reflect")

        reset_failures(repo_path)

        result = CycleResult(
            cycle_number=cycle_num,
            outcome="productive" if items else "stable",
            duration_seconds=round(time.time() - start, 2),
            phases_completed=phases,
            sensing_report=report,
            plan=items,
            review=verdict,
        )
        _save_cycle_history(repo_path, result)
        return result

    except Exception:
        increment_failures(repo_path)
        return CycleResult(
            cycle_number=cycle_num, outcome="aborted",
            duration_seconds=round(time.time() - start, 2),
            phases_completed=phases,
        )
    finally:
        release_cycle_lock(repo_path)
