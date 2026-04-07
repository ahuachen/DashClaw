"""Sensing orchestrator — runs all 5 collectors and produces a unified state report."""
import os
from dataclasses import asdict
from datetime import datetime, timezone
from livingcode.types import StateReport, CollectorStatus
from livingcode.state import ensure_organism_dir, write_state_report
from livingcode.schema.validator import load_organism
from livingcode.collectors.git_stats import collect_git_stats
from livingcode.collectors.test_health import collect_test_health
from livingcode.collectors.code_quality import collect_code_quality
from livingcode.collectors.dependency_health import collect_dependency_health
from livingcode.collectors.ci_health import collect_ci_health


def run_sensing(repo_path: str) -> tuple[StateReport, str]:
    """Run all 5 collectors and write a state report. Returns (report, file_path)."""
    ensure_organism_dir(repo_path)

    # Load organism config for quality standards
    organism_path = os.path.join(repo_path, "organism.json")
    config, errors = load_organism(organism_path)
    organism_name = "unknown"
    max_file_length = 300
    if config:
        organism_name = config.get("identity", {}).get("name", "unknown")
        max_file_length = config.get("quality_standards", {}).get("max_file_length", 300)

    timestamp = datetime.now(timezone.utc).isoformat()
    collector_status: dict[str, str] = {}

    # Run each collector with error isolation
    git_stats = None
    try:
        git_stats = collect_git_stats(repo_path)
        collector_status["git_stats"] = CollectorStatus.OK
    except Exception:
        collector_status["git_stats"] = CollectorStatus.FAILED

    test_health = None
    try:
        test_health = collect_test_health(repo_path)
        collector_status["test_health"] = CollectorStatus.OK
    except Exception:
        collector_status["test_health"] = CollectorStatus.FAILED

    code_quality = None
    try:
        code_quality = collect_code_quality(repo_path, max_file_length=max_file_length)
        collector_status["code_quality"] = CollectorStatus.OK
    except Exception:
        collector_status["code_quality"] = CollectorStatus.FAILED

    dependency_health = None
    try:
        dependency_health = collect_dependency_health(repo_path)
        collector_status["dependency_health"] = CollectorStatus.OK
    except Exception:
        collector_status["dependency_health"] = CollectorStatus.FAILED

    ci_health = None
    try:
        ci_health = collect_ci_health(repo_path)
        collector_status["ci_health"] = CollectorStatus.OK
    except Exception:
        collector_status["ci_health"] = CollectorStatus.FAILED

    report = StateReport(
        organism=organism_name,
        timestamp=timestamp,
        collector_status=collector_status,
        git_stats=git_stats,
        test_health=test_health,
        code_quality=code_quality,
        dependency_health=dependency_health,
        ci_health=ci_health,
    )

    # Serialize and write
    report_dict = asdict(report)
    file_path = write_state_report(repo_path, report_dict)

    return report, file_path
