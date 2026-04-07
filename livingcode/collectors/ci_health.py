"""CI health collector — GitHub Actions pass rate, gate status. Requires gh CLI."""
import json
import subprocess
from livingcode.types import CIHealthReport, CIGateInfo


def _run_gh(args: list[str], cwd: str) -> tuple[int, str]:
    """Run a gh CLI command. Returns (exit_code, stdout)."""
    try:
        result = subprocess.run(
            ["gh"] + args, cwd=cwd, capture_output=True, text=True, timeout=30,
        )
        return result.returncode, result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return 1, ""


def collect_ci_health(repo_path: str) -> CIHealthReport:
    """Collect CI pipeline health from GitHub Actions. Gracefully degrades if gh unavailable."""
    # Fetch recent runs (30d worth)
    exit_code, runs_output = _run_gh(
        ["run", "list", "--limit", "50", "--json", "conclusion,createdAt,databaseId"],
        repo_path,
    )
    if exit_code != 0 or not runs_output:
        return CIHealthReport(
            pass_rate_30d=0.0,
            last_10_runs=[],
            last_failure_reason=None,
            slowest_gate=None,
            gate_count=0,
        )

    try:
        runs = json.loads(runs_output)
    except json.JSONDecodeError:
        runs = []

    if not runs:
        return CIHealthReport(
            pass_rate_30d=0.0,
            last_10_runs=[],
            last_failure_reason=None,
            slowest_gate=None,
            gate_count=0,
        )

    # Pass rate
    completed = [r for r in runs if r.get("conclusion") in ("success", "failure")]
    successes = [r for r in completed if r["conclusion"] == "success"]
    pass_rate = len(successes) / len(completed) if completed else 0.0

    # Last 10 runs
    _, last10_output = _run_gh(
        ["run", "list", "--limit", "10", "--json", "conclusion"],
        repo_path,
    )
    last_10_list = []
    try:
        last10 = json.loads(last10_output) if last10_output else []
        last_10_list = [
            "pass" if r.get("conclusion") == "success" else "fail"
            for r in last10
            if r.get("conclusion") in ("success", "failure")
        ]
    except json.JSONDecodeError:
        pass

    # Last failure reason
    last_failure_reason = None
    failures = [r for r in runs if r.get("conclusion") == "failure"]
    if failures:
        fail_id = failures[0].get("databaseId", "")
        if fail_id:
            _, fail_output = _run_gh(["run", "view", str(fail_id)], repo_path)
            last_failure_reason = fail_output[:200] if fail_output else None
        else:
            _, fail_output = _run_gh(["run", "view"], repo_path)
            last_failure_reason = fail_output[:200] if fail_output else None

    return CIHealthReport(
        pass_rate_30d=round(pass_rate, 4),
        last_10_runs=last_10_list,
        last_failure_reason=last_failure_reason,
        slowest_gate=None,  # Requires deeper workflow step parsing (future enhancement)
        gate_count=0,       # Would need to parse workflow YAML (future enhancement)
    )
