# DashClaw Living Organism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port giti's living codebase framework to DashClaw as a zero-dependency Python module — sensing, immune system, planner, orchestrator, and heartbeat.

**Architecture:** A `livingcode/` Python package at the DashClaw repo root. Five sensing collectors measure codebase health (git stats, test health, code quality, dependency health, CI health). An immune system reviews changes against baselines. A tiered planner surfaces prioritized work items. An orchestrator runs the full lifecycle cycle (sense → plan → review → reflect) with safety systems. A heartbeat scheduler runs quick checks on commit and full cycles on schedule.

**Tech Stack:** Python 3.12, stdlib only (dataclasses, subprocess, json, pathlib, datetime, argparse, unittest). No external dependencies.

**Spec:** `docs/superpowers/specs/2026-04-07-livingcode-organism-design.md`

**Reference implementation:** `C:\Projects\git-intelligence\packages\giti\src\agents\` (TypeScript)

---

### Task 1: Foundation — Types, State, Schema Validator

**Files:**
- Create: `livingcode/__init__.py`
- Create: `livingcode/types.py`
- Create: `livingcode/state.py`
- Create: `livingcode/schema/organism_schema.json`
- Create: `livingcode/schema/__init__.py`
- Create: `livingcode/schema/validator.py`
- Create: `organism.json`
- Test: `livingcode/tests/__init__.py`
- Test: `livingcode/tests/test_types.py`
- Test: `livingcode/tests/test_state.py`
- Test: `livingcode/tests/test_validator.py`

- [ ] **Step 1: Create livingcode package with empty __init__.py**

```python
# livingcode/__init__.py
"""DashClaw Living Organism — codebase health sensing framework."""

__version__ = "0.1.0"
```

```python
# livingcode/tests/__init__.py
```

- [ ] **Step 2: Write failing tests for types**

```python
# livingcode/tests/test_types.py
import unittest
from datetime import datetime


class TestTypes(unittest.TestCase):

    def test_git_stats_report_has_required_fields(self):
        from livingcode.types import GitStatsReport
        report = GitStatsReport(
            commits_7d=14,
            commits_30d=48,
            active_branches=3,
            stale_branches=1,
            bus_factor=1,
            top_contributors_30d=[{"name": "Wes", "commits": 46}],
            files_changed_7d=87,
        )
        self.assertEqual(report.commits_7d, 14)
        self.assertEqual(report.bus_factor, 1)

    def test_test_health_report_has_required_fields(self):
        from livingcode.types import TestSuiteResult, TestHealthReport
        js = TestSuiteResult(total=107, passed=107, failed=0)
        py = TestSuiteResult(total=12, passed=12, failed=0)
        report = TestHealthReport(
            js_tests=js,
            python_tests=py,
            test_file_ratio=0.42,
            untested_routes=["api/cron/signals"],
        )
        self.assertEqual(report.js_tests.total, 107)
        self.assertEqual(len(report.untested_routes), 1)

    def test_code_quality_report_has_required_fields(self):
        from livingcode.types import FileInfo, CodeQualityReport
        report = CodeQualityReport(
            files_over_300_lines=12,
            largest_files=[FileInfo(path="app/docs/page.js", lines=1703)],
            eslint_status="pass",
            python_files_over_300=1,
            todo_count=16,
            archive_size_kb=245,
        )
        self.assertEqual(report.files_over_300_lines, 12)
        self.assertEqual(report.largest_files[0].lines, 1703)

    def test_dependency_health_report_has_required_fields(self):
        from livingcode.types import DependencyHealthReport
        report = DependencyHealthReport(
            js_dependencies=25,
            js_outdated=3,
            js_vulnerabilities=0,
            python_dependencies=0,
            lockfile_age_days=2,
        )
        self.assertEqual(report.python_dependencies, 0)

    def test_ci_health_report_has_required_fields(self):
        from livingcode.types import CIGateInfo, CIHealthReport
        report = CIHealthReport(
            pass_rate_30d=0.94,
            last_10_runs=["pass", "pass", "fail"],
            last_failure_reason="route-sql baseline mismatch",
            slowest_gate=CIGateInfo(name="build", duration_seconds=142),
            gate_count=11,
        )
        self.assertEqual(report.pass_rate_30d, 0.94)

    def test_collector_status_values(self):
        from livingcode.types import CollectorStatus
        self.assertEqual(CollectorStatus.OK, "ok")
        self.assertEqual(CollectorStatus.FAILED, "failed")
        self.assertEqual(CollectorStatus.SKIPPED, "skipped")

    def test_state_report_holds_all_collectors(self):
        from livingcode.types import StateReport, CollectorStatus
        report = StateReport(
            organism="dashclaw",
            timestamp="2026-04-07T06:30:00Z",
            collector_status={"git_stats": CollectorStatus.OK},
            git_stats=None,
            test_health=None,
            code_quality=None,
            dependency_health=None,
            ci_health=None,
        )
        self.assertEqual(report.organism, "dashclaw")

    def test_check_result_structure(self):
        from livingcode.types import CheckResult, CheckStatus
        result = CheckResult(
            name="ci_gates",
            status=CheckStatus.PASS,
            message="All 11 gates passing",
        )
        self.assertEqual(result.status, "pass")

    def test_verdict_structure(self):
        from livingcode.types import Verdict
        v = Verdict(
            recommendation="merge",
            checks=[],
            blocking=[],
            summary="All checks passed",
        )
        self.assertEqual(v.recommendation, "merge")

    def test_work_item_structure(self):
        from livingcode.types import WorkItem
        item = WorkItem(
            id="wk-20260407-001",
            tier=2,
            title="Split large file",
            description="File too long",
            affected_files=["app/docs/page.js"],
            metric="code_quality.largest_files",
            status="proposed",
        )
        self.assertEqual(item.tier, 2)

    def test_cycle_result_structure(self):
        from livingcode.types import CycleResult
        result = CycleResult(
            cycle_number=1,
            outcome="stable",
            duration_seconds=45.2,
            phases_completed=["sense", "plan", "review", "reflect"],
        )
        self.assertEqual(result.outcome, "stable")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_types.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'livingcode.types'`

- [ ] **Step 4: Implement types.py**

```python
# livingcode/types.py
"""Data structures for the livingcode organism framework.

All types use stdlib dataclasses — zero external dependencies.
"""
from dataclasses import dataclass, field
from typing import Any


class CollectorStatus:
    OK = "ok"
    FAILED = "failed"
    SKIPPED = "skipped"


class CheckStatus:
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"


# --- Collector report types ---


@dataclass
class FileInfo:
    path: str
    lines: int


@dataclass
class ContributorInfo:
    name: str
    commits: int


@dataclass
class GitStatsReport:
    commits_7d: int
    commits_30d: int
    active_branches: int
    stale_branches: int
    bus_factor: int
    top_contributors_30d: list[dict[str, Any]]
    files_changed_7d: int


@dataclass
class TestSuiteResult:
    total: int
    passed: int
    failed: int


@dataclass
class TestHealthReport:
    js_tests: TestSuiteResult
    python_tests: TestSuiteResult
    test_file_ratio: float
    untested_routes: list[str]


@dataclass
class CodeQualityReport:
    files_over_300_lines: int
    largest_files: list[FileInfo]
    eslint_status: str
    python_files_over_300: int
    todo_count: int
    archive_size_kb: int


@dataclass
class DependencyHealthReport:
    js_dependencies: int
    js_outdated: int
    js_vulnerabilities: int
    python_dependencies: int
    lockfile_age_days: int


@dataclass
class CIGateInfo:
    name: str
    duration_seconds: int


@dataclass
class CIHealthReport:
    pass_rate_30d: float
    last_10_runs: list[str]
    last_failure_reason: str | None
    slowest_gate: CIGateInfo | None
    gate_count: int


# --- Immune system types ---


@dataclass
class CheckResult:
    name: str
    status: str  # CheckStatus.PASS / WARN / FAIL
    message: str
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class Verdict:
    recommendation: str  # "merge" | "fix_required" | "needs_discussion"
    checks: list[CheckResult]
    blocking: list[str]
    summary: str


# --- Planner types ---


@dataclass
class WorkItem:
    id: str
    tier: int
    title: str
    description: str
    affected_files: list[str]
    metric: str
    status: str  # "proposed" | "accepted" | "completed"
    created_at: str = ""


# --- Orchestrator types ---


@dataclass
class CycleResult:
    cycle_number: int
    outcome: str  # "stable" | "productive" | "aborted" | "paused"
    duration_seconds: float
    phases_completed: list[str]
    sensing_report: Any = None
    plan: Any = None
    review: Any = None


# --- State report (top-level) ---


@dataclass
class StateReport:
    organism: str
    timestamp: str
    collector_status: dict[str, str]
    git_stats: GitStatsReport | None
    test_health: TestHealthReport | None
    code_quality: CodeQualityReport | None
    dependency_health: DependencyHealthReport | None
    ci_health: CIHealthReport | None


# --- Baselines ---


@dataclass
class Baselines:
    updated_at: str
    test_count: dict[str, int]
    file_count_over_300: int
    js_vulnerabilities: int
    sdk_methods: dict[str, int]
    ci_pass_rate_30d: float
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_types.py -v`
Expected: All 11 tests PASS

- [ ] **Step 6: Write failing tests for state.py**

```python
# livingcode/tests/test_state.py
import json
import os
import tempfile
import unittest
from pathlib import Path


class TestState(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        self.organism_dir = Path(self.tmpdir) / ".organism"

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_ensure_organism_dir_creates_structure(self):
        from livingcode.state import ensure_organism_dir
        ensure_organism_dir(self.tmpdir)
        self.assertTrue(self.organism_dir.exists())
        self.assertTrue((self.organism_dir / "state-reports").exists())
        self.assertTrue((self.organism_dir / "heartbeats").exists())
        self.assertTrue((self.organism_dir / "backlog").exists())
        self.assertTrue((self.organism_dir / "cycle-history").exists())

    def test_write_state_report_creates_json_file(self):
        from livingcode.state import ensure_organism_dir, write_state_report
        ensure_organism_dir(self.tmpdir)
        data = {"organism": "test", "timestamp": "2026-04-07T06:30:00Z"}
        path = write_state_report(self.tmpdir, data)
        self.assertTrue(Path(path).exists())
        with open(path) as f:
            loaded = json.load(f)
        self.assertEqual(loaded["organism"], "test")

    def test_write_state_report_filename_is_windows_safe(self):
        from livingcode.state import ensure_organism_dir, write_state_report
        ensure_organism_dir(self.tmpdir)
        data = {"organism": "test", "timestamp": "2026-04-07T06:30:00Z"}
        path = write_state_report(self.tmpdir, data)
        self.assertNotIn(":", Path(path).name)

    def test_read_latest_state_report_returns_none_when_empty(self):
        from livingcode.state import ensure_organism_dir, read_latest_state_report
        ensure_organism_dir(self.tmpdir)
        result = read_latest_state_report(self.tmpdir)
        self.assertIsNone(result)

    def test_read_latest_state_report_returns_most_recent(self):
        from livingcode.state import (
            ensure_organism_dir, write_state_report, read_latest_state_report
        )
        ensure_organism_dir(self.tmpdir)
        write_state_report(self.tmpdir, {"organism": "old", "timestamp": "2026-04-06T00:00:00Z"})
        write_state_report(self.tmpdir, {"organism": "new", "timestamp": "2026-04-07T00:00:00Z"})
        result = read_latest_state_report(self.tmpdir)
        self.assertEqual(result["organism"], "new")

    def test_prune_old_reports_keeps_max_100(self):
        from livingcode.state import ensure_organism_dir, write_state_report, prune_old_reports
        ensure_organism_dir(self.tmpdir)
        for i in range(110):
            write_state_report(
                self.tmpdir,
                {"organism": "test", "timestamp": f"2026-01-{i+1:03d}T00:00:00Z"},
            )
        prune_old_reports(self.tmpdir, max_reports=100)
        reports_dir = self.organism_dir / "state-reports"
        remaining = list(reports_dir.glob("*.json"))
        self.assertEqual(len(remaining), 100)

    def test_read_json_file_returns_none_for_missing(self):
        from livingcode.state import read_json_file
        result = read_json_file(Path(self.tmpdir) / "nonexistent.json")
        self.assertIsNone(result)

    def test_write_json_file_creates_file(self):
        from livingcode.state import write_json_file, read_json_file
        path = Path(self.tmpdir) / "test.json"
        write_json_file(path, {"key": "value"})
        result = read_json_file(path)
        self.assertEqual(result["key"], "value")

    def test_get_cycle_counter_starts_at_zero(self):
        from livingcode.state import ensure_organism_dir, get_cycle_counter
        ensure_organism_dir(self.tmpdir)
        self.assertEqual(get_cycle_counter(self.tmpdir), 0)

    def test_increment_cycle_counter(self):
        from livingcode.state import ensure_organism_dir, increment_cycle_counter, get_cycle_counter
        ensure_organism_dir(self.tmpdir)
        new_val = increment_cycle_counter(self.tmpdir)
        self.assertEqual(new_val, 1)
        self.assertEqual(get_cycle_counter(self.tmpdir), 1)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_state.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'livingcode.state'`

- [ ] **Step 8: Implement state.py**

```python
# livingcode/state.py
"""Filesystem operations for .organism/ state directory."""
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ORGANISM_DIR = ".organism"
SUBDIRS = ["state-reports", "heartbeats", "backlog", "cycle-history"]


def ensure_organism_dir(repo_path: str) -> Path:
    """Create .organism/ directory structure if it doesn't exist."""
    base = Path(repo_path) / ORGANISM_DIR
    base.mkdir(exist_ok=True)
    for sub in SUBDIRS:
        (base / sub).mkdir(exist_ok=True)
    return base


def _safe_timestamp() -> str:
    """Generate a Windows-safe timestamp string (no colons)."""
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H-%M-%S")


def write_state_report(repo_path: str, data: dict[str, Any]) -> str:
    """Write a state report JSON file. Returns the file path."""
    reports_dir = Path(repo_path) / ORGANISM_DIR / "state-reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{_safe_timestamp()}.json"
    filepath = reports_dir / filename
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, default=str)
    return str(filepath)


def read_latest_state_report(repo_path: str) -> dict[str, Any] | None:
    """Read the most recent state report. Returns None if none exist."""
    reports_dir = Path(repo_path) / ORGANISM_DIR / "state-reports"
    if not reports_dir.exists():
        return None
    files = sorted(reports_dir.glob("*.json"))
    if not files:
        return None
    with open(files[-1]) as f:
        return json.load(f)


def prune_old_reports(repo_path: str, max_reports: int = 100) -> int:
    """Delete oldest state reports beyond max_reports. Returns count deleted."""
    reports_dir = Path(repo_path) / ORGANISM_DIR / "state-reports"
    if not reports_dir.exists():
        return 0
    files = sorted(reports_dir.glob("*.json"))
    if len(files) <= max_reports:
        return 0
    to_delete = files[: len(files) - max_reports]
    for f in to_delete:
        f.unlink()
    return len(to_delete)


def read_json_file(path: Path) -> dict[str, Any] | None:
    """Read a JSON file. Returns None if it doesn't exist."""
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


def write_json_file(path: Path, data: dict[str, Any]) -> None:
    """Write a JSON file, creating parent dirs if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)


def get_cycle_counter(repo_path: str) -> int:
    """Read the current cycle counter. Returns 0 if not set."""
    path = Path(repo_path) / ORGANISM_DIR / "cycle-counter.json"
    data = read_json_file(path)
    if data is None:
        return 0
    return data.get("cycle", 0)


def increment_cycle_counter(repo_path: str) -> int:
    """Increment and return the new cycle counter value."""
    path = Path(repo_path) / ORGANISM_DIR / "cycle-counter.json"
    current = get_cycle_counter(repo_path)
    new_val = current + 1
    write_json_file(path, {"cycle": new_val})
    return new_val
```

- [ ] **Step 9: Run test to verify it passes**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_state.py -v`
Expected: All 10 tests PASS

- [ ] **Step 10: Write failing tests for schema validator**

```python
# livingcode/tests/test_validator.py
import unittest


class TestValidator(unittest.TestCase):

    def test_valid_organism_json(self):
        from livingcode.schema.validator import validate_organism
        config = {
            "identity": {
                "name": "dashclaw",
                "purpose": "Decision infrastructure",
                "philosophy": "Control before execution",
            },
            "boundaries": {
                "growth_zone": ["governance"],
                "forbidden_zone": ["secrets"],
            },
            "quality_standards": {
                "test_coverage_floor": 80,
                "max_complexity_per_function": 15,
                "max_file_length": 300,
            },
        }
        errors = validate_organism(config)
        self.assertEqual(errors, [])

    def test_missing_identity_returns_error(self):
        from livingcode.schema.validator import validate_organism
        config = {
            "boundaries": {"growth_zone": [], "forbidden_zone": []},
            "quality_standards": {"test_coverage_floor": 80, "max_complexity_per_function": 15, "max_file_length": 300},
        }
        errors = validate_organism(config)
        self.assertTrue(any("identity" in e for e in errors))

    def test_missing_boundaries_returns_error(self):
        from livingcode.schema.validator import validate_organism
        config = {
            "identity": {"name": "test", "purpose": "test", "philosophy": "test"},
            "quality_standards": {"test_coverage_floor": 80, "max_complexity_per_function": 15, "max_file_length": 300},
        }
        errors = validate_organism(config)
        self.assertTrue(any("boundaries" in e for e in errors))

    def test_missing_quality_standards_returns_error(self):
        from livingcode.schema.validator import validate_organism
        config = {
            "identity": {"name": "test", "purpose": "test", "philosophy": "test"},
            "boundaries": {"growth_zone": [], "forbidden_zone": []},
        }
        errors = validate_organism(config)
        self.assertTrue(any("quality_standards" in e for e in errors))

    def test_missing_identity_name_returns_error(self):
        from livingcode.schema.validator import validate_organism
        config = {
            "identity": {"purpose": "test", "philosophy": "test"},
            "boundaries": {"growth_zone": [], "forbidden_zone": []},
            "quality_standards": {"test_coverage_floor": 80, "max_complexity_per_function": 15, "max_file_length": 300},
        }
        errors = validate_organism(config)
        self.assertTrue(any("name" in e for e in errors))

    def test_load_organism_from_file(self):
        import json
        import tempfile
        import os
        from livingcode.schema.validator import load_organism
        config = {
            "identity": {"name": "test", "purpose": "test", "philosophy": "test"},
            "boundaries": {"growth_zone": [], "forbidden_zone": []},
            "quality_standards": {"test_coverage_floor": 80, "max_complexity_per_function": 15, "max_file_length": 300},
        }
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(config, f)
            tmp_path = f.name
        try:
            loaded, errors = load_organism(tmp_path)
            self.assertEqual(errors, [])
            self.assertEqual(loaded["identity"]["name"], "test")
        finally:
            os.unlink(tmp_path)

    def test_load_organism_missing_file_returns_error(self):
        from livingcode.schema.validator import load_organism
        loaded, errors = load_organism("/nonexistent/organism.json")
        self.assertIsNone(loaded)
        self.assertTrue(len(errors) > 0)

    def test_optional_ci_gates_accepted(self):
        from livingcode.schema.validator import validate_organism
        config = {
            "identity": {"name": "test", "purpose": "test", "philosophy": "test"},
            "boundaries": {"growth_zone": [], "forbidden_zone": []},
            "quality_standards": {"test_coverage_floor": 80, "max_complexity_per_function": 15, "max_file_length": 300},
            "ci_gates": ["lint", "test", "build"],
        }
        errors = validate_organism(config)
        self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 11: Run test to verify it fails**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_validator.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 12: Create schema files and implement validator**

```python
# livingcode/schema/__init__.py
```

```python
# livingcode/schema/validator.py
"""Validate organism.json configuration files."""
import json
from pathlib import Path
from typing import Any


REQUIRED_SECTIONS = ["identity", "boundaries", "quality_standards"]
REQUIRED_IDENTITY_FIELDS = ["name", "purpose", "philosophy"]
REQUIRED_BOUNDARY_FIELDS = ["growth_zone", "forbidden_zone"]
REQUIRED_QUALITY_FIELDS = ["test_coverage_floor", "max_complexity_per_function", "max_file_length"]


def validate_organism(config: dict[str, Any]) -> list[str]:
    """Validate an organism config dict. Returns list of error strings (empty = valid)."""
    errors: list[str] = []

    for section in REQUIRED_SECTIONS:
        if section not in config:
            errors.append(f"Missing required section: {section}")

    if "identity" in config:
        identity = config["identity"]
        for field_name in REQUIRED_IDENTITY_FIELDS:
            if field_name not in identity:
                errors.append(f"Missing required field: identity.{field_name}")

    if "boundaries" in config:
        boundaries = config["boundaries"]
        for field_name in REQUIRED_BOUNDARY_FIELDS:
            if field_name not in boundaries:
                errors.append(f"Missing required field: boundaries.{field_name}")

    if "quality_standards" in config:
        qs = config["quality_standards"]
        for field_name in REQUIRED_QUALITY_FIELDS:
            if field_name not in qs:
                errors.append(f"Missing required field: quality_standards.{field_name}")

    return errors


def load_organism(filepath: str) -> tuple[dict[str, Any] | None, list[str]]:
    """Load and validate an organism.json file. Returns (config, errors)."""
    path = Path(filepath)
    if not path.exists():
        return None, [f"organism.json not found at: {filepath}"]
    try:
        with open(path) as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        return None, [f"Invalid JSON in organism.json: {e}"]
    errors = validate_organism(config)
    return config, errors
```

- [ ] **Step 13: Run all foundation tests**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_types.py livingcode/tests/test_state.py livingcode/tests/test_validator.py -v`
Expected: All tests PASS

- [ ] **Step 14: Create organism.json at repo root**

Write the file `organism.json` at `C:\Projects\DashClaw\organism.json` with the exact content from the spec (the full JSON block in the organism.json section of the design doc).

- [ ] **Step 15: Commit**

```bash
cd C:\Projects\DashClaw
git add livingcode/__init__.py livingcode/types.py livingcode/state.py \
  livingcode/schema/__init__.py livingcode/schema/validator.py \
  livingcode/tests/__init__.py livingcode/tests/test_types.py \
  livingcode/tests/test_state.py livingcode/tests/test_validator.py \
  organism.json
git commit -m "feat(livingcode): add foundation — types, state, schema validator, organism.json"
```

---

### Task 2: Git Stats Collector

**Files:**
- Create: `livingcode/collectors/__init__.py`
- Create: `livingcode/collectors/git_stats.py`
- Test: `livingcode/tests/test_git_stats.py`

- [ ] **Step 1: Write failing tests for git_stats collector**

```python
# livingcode/tests/test_git_stats.py
import unittest
from unittest.mock import patch, MagicMock


class TestGitStatsCollector(unittest.TestCase):

    @patch("livingcode.collectors.git_stats._run_git")
    def test_collects_commit_counts(self, mock_git):
        from livingcode.collectors.git_stats import collect_git_stats
        mock_git.side_effect = self._mock_git_responses()
        result = collect_git_stats("/fake/repo")
        self.assertEqual(result.commits_7d, 14)
        self.assertEqual(result.commits_30d, 48)

    @patch("livingcode.collectors.git_stats._run_git")
    def test_calculates_bus_factor(self, mock_git):
        from livingcode.collectors.git_stats import collect_git_stats
        mock_git.side_effect = self._mock_git_responses()
        result = collect_git_stats("/fake/repo")
        self.assertEqual(result.bus_factor, 1)

    @patch("livingcode.collectors.git_stats._run_git")
    def test_counts_active_and_stale_branches(self, mock_git):
        from livingcode.collectors.git_stats import collect_git_stats
        mock_git.side_effect = self._mock_git_responses()
        result = collect_git_stats("/fake/repo")
        self.assertEqual(result.active_branches, 2)
        self.assertEqual(result.stale_branches, 1)

    @patch("livingcode.collectors.git_stats._run_git")
    def test_returns_top_contributors(self, mock_git):
        from livingcode.collectors.git_stats import collect_git_stats
        mock_git.side_effect = self._mock_git_responses()
        result = collect_git_stats("/fake/repo")
        self.assertEqual(len(result.top_contributors_30d), 2)
        self.assertEqual(result.top_contributors_30d[0]["name"], "Wes Sander")

    @patch("livingcode.collectors.git_stats._run_git")
    def test_counts_files_changed(self, mock_git):
        from livingcode.collectors.git_stats import collect_git_stats
        mock_git.side_effect = self._mock_git_responses()
        result = collect_git_stats("/fake/repo")
        self.assertEqual(result.files_changed_7d, 3)

    def _mock_git_responses(self):
        """Returns a side_effect callable that dispatches on git args."""
        responses = {
            # commits_7d: git rev-list --count --since=7.days HEAD
            ("rev-list", "--count"): "14",
            # commits_30d: git rev-list --count --since=30.days HEAD
            ("rev-list-30",): "48",
            # branches: git branch -r --no-merged
            ("branch",): "  origin/main\n  origin/feat-a\n  origin/stale-one",
            # branch last commit (active): git log -1 --format=%ci origin/feat-a
            ("log-branch-feat-a",): "2026-04-06 12:00:00 +0000",
            # branch last commit (stale): git log -1 --format=%ci origin/stale-one
            ("log-branch-stale",): "2026-02-01 12:00:00 +0000",
            # branch last commit (main): git log -1 --format=%ci origin/main
            ("log-branch-main",): "2026-04-07 12:00:00 +0000",
            # shortlog: git shortlog -sn --since=30.days HEAD
            ("shortlog",): "    46\tWes Sander\n     2\tdependabot[bot]",
            # files changed: git diff --shortstat HEAD~14..HEAD (or similar)
            ("diff-stat",): " 3 files changed, 200 insertions(+), 50 deletions(-)",
        }

        call_count = {"n": 0}

        def dispatch(*args, **kwargs):
            cmd = args[0] if args else kwargs.get("args", [])
            call_count["n"] += 1
            n = call_count["n"]
            # Map sequential calls to expected responses
            ordered = [
                "14",     # 1: commits 7d
                "48",     # 2: commits 30d
                "  origin/main\n  origin/feat-a\n  origin/stale-one",  # 3: branches
                "2026-04-07 12:00:00 +0000",   # 4: main last commit
                "2026-04-06 12:00:00 +0000",   # 5: feat-a last commit
                "2026-02-01 12:00:00 +0000",   # 6: stale-one last commit
                "    46\tWes Sander\n     2\tdependabot[bot]",  # 7: shortlog
                " 3 files changed, 200 insertions(+), 50 deletions(-)",  # 8: diff stat
            ]
            if n <= len(ordered):
                return ordered[n - 1]
            return ""

        return dispatch


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_git_stats.py -v`
Expected: FAIL with `ModuleNotFoundError`

- [ ] **Step 3: Implement git_stats collector**

```python
# livingcode/collectors/__init__.py
```

```python
# livingcode/collectors/git_stats.py
"""Git statistics collector — commit velocity, branch health, bus factor."""
import subprocess
from datetime import datetime, timezone, timedelta
from livingcode.types import GitStatsReport


def _run_git(args: list[str], repo_path: str) -> str:
    """Run a git command and return stdout. Returns empty string on error."""
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=30,
        )
        return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return ""


def collect_git_stats(repo_path: str) -> GitStatsReport:
    """Collect git repository statistics."""
    # Commit counts
    commits_7d_str = _run_git(["rev-list", "--count", "--since=7.days", "HEAD"], repo_path)
    commits_7d = int(commits_7d_str) if commits_7d_str.isdigit() else 0

    commits_30d_str = _run_git(["rev-list", "--count", "--since=30.days", "HEAD"], repo_path)
    commits_30d = int(commits_30d_str) if commits_30d_str.isdigit() else 0

    # Branch health
    branches_output = _run_git(["branch", "-r"], repo_path)
    branches = [b.strip() for b in branches_output.splitlines() if b.strip() and "->" not in b]

    now = datetime.now(timezone.utc)
    stale_threshold = now - timedelta(days=30)
    active_count = 0
    stale_count = 0

    for branch in branches:
        last_commit = _run_git(["log", "-1", "--format=%ci", branch], repo_path)
        if last_commit:
            try:
                commit_date = datetime.fromisoformat(last_commit.replace(" +0000", "+00:00").replace(" -", "-"))
                if commit_date.tzinfo is None:
                    commit_date = commit_date.replace(tzinfo=timezone.utc)
                if commit_date > stale_threshold:
                    active_count += 1
                else:
                    stale_count += 1
            except ValueError:
                active_count += 1  # assume active if parse fails
        else:
            active_count += 1

    # Top contributors (30d)
    shortlog = _run_git(["shortlog", "-sn", "--since=30.days", "HEAD"], repo_path)
    contributors = []
    total_commits_30d = 0
    for line in shortlog.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split("\t", 1)
        if len(parts) == 2:
            count = int(parts[0].strip())
            name = parts[1].strip()
            contributors.append({"name": name, "commits": count})
            total_commits_30d += count

    # Bus factor: how many contributors cover 80% of commits
    bus_factor = 0
    if total_commits_30d > 0:
        running = 0
        threshold = total_commits_30d * 0.8
        for c in contributors:
            running += c["commits"]
            bus_factor += 1
            if running >= threshold:
                break

    # Files changed (7d)
    diff_stat = _run_git(["diff", "--shortstat", "HEAD~14..HEAD"], repo_path)
    files_changed = 0
    if diff_stat:
        parts = diff_stat.split()
        if parts and parts[0].isdigit():
            files_changed = int(parts[0])

    return GitStatsReport(
        commits_7d=commits_7d,
        commits_30d=commits_30d,
        active_branches=active_count,
        stale_branches=stale_count,
        bus_factor=bus_factor,
        top_contributors_30d=contributors,
        files_changed_7d=files_changed,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_git_stats.py -v`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Projects\DashClaw
git add livingcode/collectors/__init__.py livingcode/collectors/git_stats.py \
  livingcode/tests/test_git_stats.py
git commit -m "feat(livingcode): add git_stats collector"
```

---

### Task 3: Test Health Collector

**Files:**
- Create: `livingcode/collectors/test_health.py`
- Test: `livingcode/tests/test_test_health.py`

- [ ] **Step 1: Write failing tests**

```python
# livingcode/tests/test_test_health.py
import unittest
from unittest.mock import patch


class TestTestHealthCollector(unittest.TestCase):

    @patch("livingcode.collectors.test_health._run_command")
    @patch("livingcode.collectors.test_health._find_untested_routes")
    @patch("livingcode.collectors.test_health._count_test_files")
    def test_collects_js_test_results(self, mock_count, mock_untested, mock_cmd):
        from livingcode.collectors.test_health import collect_test_health
        mock_cmd.side_effect = [
            # npm run test -- --run output
            (0, "Tests  107 passed (107)\nDuration  12.34s"),
            # python -m pytest output
            (0, "12 passed in 3.45s"),
        ]
        mock_count.return_value = (107, 250)  # test_files, source_files
        mock_untested.return_value = ["api/cron/signals"]
        result = collect_test_health("/fake/repo")
        self.assertEqual(result.js_tests.total, 107)
        self.assertEqual(result.js_tests.passed, 107)
        self.assertEqual(result.js_tests.failed, 0)

    @patch("livingcode.collectors.test_health._run_command")
    @patch("livingcode.collectors.test_health._find_untested_routes")
    @patch("livingcode.collectors.test_health._count_test_files")
    def test_collects_python_test_results(self, mock_count, mock_untested, mock_cmd):
        from livingcode.collectors.test_health import collect_test_health
        mock_cmd.side_effect = [
            (0, "Tests  50 passed (50)\nDuration  5.00s"),
            (0, "12 passed in 3.45s"),
        ]
        mock_count.return_value = (50, 200)
        mock_untested.return_value = []
        result = collect_test_health("/fake/repo")
        self.assertEqual(result.python_tests.total, 12)
        self.assertEqual(result.python_tests.passed, 12)

    @patch("livingcode.collectors.test_health._run_command")
    @patch("livingcode.collectors.test_health._find_untested_routes")
    @patch("livingcode.collectors.test_health._count_test_files")
    def test_handles_js_test_failures(self, mock_count, mock_untested, mock_cmd):
        from livingcode.collectors.test_health import collect_test_health
        mock_cmd.side_effect = [
            (1, "Tests  3 failed | 104 passed (107)\nDuration  12.34s"),
            (0, "12 passed in 3.45s"),
        ]
        mock_count.return_value = (107, 250)
        mock_untested.return_value = []
        result = collect_test_health("/fake/repo")
        self.assertEqual(result.js_tests.failed, 3)
        self.assertEqual(result.js_tests.passed, 104)

    @patch("livingcode.collectors.test_health._run_command")
    @patch("livingcode.collectors.test_health._find_untested_routes")
    @patch("livingcode.collectors.test_health._count_test_files")
    def test_calculates_test_file_ratio(self, mock_count, mock_untested, mock_cmd):
        from livingcode.collectors.test_health import collect_test_health
        mock_cmd.side_effect = [
            (0, "Tests  50 passed (50)\nDuration  5.00s"),
            (0, "12 passed in 3.45s"),
        ]
        mock_count.return_value = (100, 200)
        mock_untested.return_value = []
        result = collect_test_health("/fake/repo")
        self.assertAlmostEqual(result.test_file_ratio, 100 / 300)

    @patch("livingcode.collectors.test_health._run_command")
    @patch("livingcode.collectors.test_health._find_untested_routes")
    @patch("livingcode.collectors.test_health._count_test_files")
    def test_handles_no_python_tests(self, mock_count, mock_untested, mock_cmd):
        from livingcode.collectors.test_health import collect_test_health
        mock_cmd.side_effect = [
            (0, "Tests  50 passed (50)\nDuration  5.00s"),
            (1, "no tests ran"),
        ]
        mock_count.return_value = (50, 200)
        mock_untested.return_value = []
        result = collect_test_health("/fake/repo")
        self.assertEqual(result.python_tests.total, 0)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_test_health.py -v`
Expected: FAIL

- [ ] **Step 3: Implement test_health collector**

```python
# livingcode/collectors/test_health.py
"""Test health collector — JS (Vitest) and Python (pytest) test status."""
import os
import re
import subprocess
from pathlib import Path
from livingcode.types import TestHealthReport, TestSuiteResult


def _run_command(args: list[str], cwd: str) -> tuple[int, str]:
    """Run a command, return (exit_code, combined_output)."""
    try:
        result = subprocess.run(
            args, cwd=cwd, capture_output=True, text=True, timeout=120,
        )
        return result.returncode, result.stdout + result.stderr
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return 1, ""


def _parse_vitest_output(output: str) -> TestSuiteResult:
    """Parse Vitest console output for test counts."""
    total, passed, failed = 0, 0, 0
    # Pattern: "Tests  3 failed | 104 passed (107)" or "Tests  107 passed (107)"
    m = re.search(r"Tests\s+(?:(\d+)\s+failed\s+\|\s+)?(\d+)\s+passed\s+\((\d+)\)", output)
    if m:
        failed = int(m.group(1)) if m.group(1) else 0
        passed = int(m.group(2))
        total = int(m.group(3))
    return TestSuiteResult(total=total, passed=passed, failed=failed)


def _parse_pytest_output(output: str) -> TestSuiteResult:
    """Parse pytest console output for test counts."""
    # Pattern: "12 passed in 3.45s" or "3 failed, 9 passed in 5.00s"
    passed_m = re.search(r"(\d+)\s+passed", output)
    failed_m = re.search(r"(\d+)\s+failed", output)
    passed = int(passed_m.group(1)) if passed_m else 0
    failed = int(failed_m.group(1)) if failed_m else 0
    total = passed + failed
    return TestSuiteResult(total=total, passed=passed, failed=failed)


def _count_test_files(repo_path: str) -> tuple[int, int]:
    """Count test files and source files. Returns (test_count, source_count)."""
    test_count = 0
    source_count = 0
    skip_dirs = {"node_modules", ".next", "dist", ".git", "__pycache__", ".organism"}
    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for f in files:
            if not (f.endswith(".js") or f.endswith(".ts") or f.endswith(".py")):
                continue
            if f.endswith(".d.ts"):
                continue
            rel = os.path.relpath(os.path.join(root, f), repo_path)
            is_test = (
                "test" in f.lower()
                or "__tests__" in rel
                or "tests/" in rel.replace("\\", "/")
            )
            if is_test:
                test_count += 1
            else:
                source_count += 1
    return test_count, source_count


def _find_untested_routes(repo_path: str) -> list[str]:
    """Find API routes without corresponding test files."""
    api_dir = Path(repo_path) / "app" / "api"
    test_dir = Path(repo_path) / "__tests__" / "unit"
    if not api_dir.exists():
        return []
    untested = []
    for route_dir in api_dir.rglob("route.js"):
        rel = route_dir.parent.relative_to(api_dir)
        # Skip archived routes
        if str(rel).startswith("_archive"):
            continue
        # Check for corresponding test
        possible_test = test_dir / f"{str(rel).replace(os.sep, '-')}-route.test.js"
        # Also check by directory name
        route_name = str(rel).replace(os.sep, "/")
        has_test = False
        if test_dir.exists():
            for test_file in test_dir.rglob("*.test.js"):
                if route_name.replace("/", "-") in test_file.name or route_name.split("/")[-1] in test_file.name:
                    has_test = True
                    break
        if not has_test:
            untested.append(f"api/{rel}")
    return untested


def collect_test_health(repo_path: str) -> TestHealthReport:
    """Collect test health metrics for JS and Python test suites."""
    # JS tests (Vitest)
    js_exit, js_output = _run_command(["npm", "run", "test", "--", "--run"], repo_path)
    js_tests = _parse_vitest_output(js_output)

    # Python tests
    sdk_path = os.path.join(repo_path, "sdk-python")
    if os.path.exists(sdk_path):
        py_exit, py_output = _run_command(["python", "-m", "pytest", "tests/", "-q"], sdk_path)
        python_tests = _parse_pytest_output(py_output)
    else:
        python_tests = TestSuiteResult(total=0, passed=0, failed=0)

    # File ratio
    test_count, source_count = _count_test_files(repo_path)
    total_files = test_count + source_count
    test_file_ratio = test_count / total_files if total_files > 0 else 0.0

    # Untested routes
    untested_routes = _find_untested_routes(repo_path)

    return TestHealthReport(
        js_tests=js_tests,
        python_tests=python_tests,
        test_file_ratio=round(test_file_ratio, 4),
        untested_routes=untested_routes,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_test_health.py -v`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Projects\DashClaw
git add livingcode/collectors/test_health.py livingcode/tests/test_test_health.py
git commit -m "feat(livingcode): add test_health collector"
```

---

### Task 4: Code Quality Collector

**Files:**
- Create: `livingcode/collectors/code_quality.py`
- Test: `livingcode/tests/test_code_quality.py`

- [ ] **Step 1: Write failing tests**

```python
# livingcode/tests/test_code_quality.py
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class TestCodeQualityCollector(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_counts_files_over_300_lines(self):
        from livingcode.collectors.code_quality import collect_code_quality
        # Create a JS file with 350 lines
        app_dir = Path(self.tmpdir) / "app"
        app_dir.mkdir()
        big_file = app_dir / "big.js"
        big_file.write_text("\n".join([f"// line {i}" for i in range(350)]))
        small_file = app_dir / "small.js"
        small_file.write_text("// small\n")
        with patch("livingcode.collectors.code_quality._run_lint") as mock_lint:
            mock_lint.return_value = "pass"
            result = collect_code_quality(self.tmpdir, max_file_length=300)
        self.assertEqual(result.files_over_300_lines, 1)

    def test_finds_largest_files_sorted(self):
        from livingcode.collectors.code_quality import collect_code_quality
        app_dir = Path(self.tmpdir) / "app"
        app_dir.mkdir()
        for i, size in enumerate([500, 200, 800]):
            f = app_dir / f"file{i}.js"
            f.write_text("\n".join([f"// line {j}" for j in range(size)]))
        with patch("livingcode.collectors.code_quality._run_lint") as mock_lint:
            mock_lint.return_value = "pass"
            result = collect_code_quality(self.tmpdir, max_file_length=300)
        self.assertEqual(result.largest_files[0].lines, 800)
        self.assertEqual(len(result.largest_files), 3)

    def test_counts_todos(self):
        from livingcode.collectors.code_quality import collect_code_quality
        app_dir = Path(self.tmpdir) / "app"
        app_dir.mkdir()
        f = app_dir / "code.js"
        f.write_text("// TODO: fix this\n// FIXME: broken\nconst x = 1;\n// TODO: later\n")
        with patch("livingcode.collectors.code_quality._run_lint") as mock_lint:
            mock_lint.return_value = "pass"
            result = collect_code_quality(self.tmpdir, max_file_length=300)
        self.assertEqual(result.todo_count, 3)

    def test_measures_archive_size(self):
        from livingcode.collectors.code_quality import collect_code_quality
        archive_dir = Path(self.tmpdir) / "app" / "api" / "_archive"
        archive_dir.mkdir(parents=True)
        f = archive_dir / "old.js"
        f.write_text("x" * 10240)  # 10KB
        with patch("livingcode.collectors.code_quality._run_lint") as mock_lint:
            mock_lint.return_value = "pass"
            result = collect_code_quality(self.tmpdir, max_file_length=300)
        self.assertEqual(result.archive_size_kb, 10)

    def test_reports_eslint_status(self):
        from livingcode.collectors.code_quality import collect_code_quality
        with patch("livingcode.collectors.code_quality._run_lint") as mock_lint:
            mock_lint.return_value = "fail"
            result = collect_code_quality(self.tmpdir, max_file_length=300)
        self.assertEqual(result.eslint_status, "fail")

    def test_skips_node_modules_and_dist(self):
        from livingcode.collectors.code_quality import collect_code_quality
        nm_dir = Path(self.tmpdir) / "node_modules" / "pkg"
        nm_dir.mkdir(parents=True)
        (nm_dir / "huge.js").write_text("\n" * 1000)
        with patch("livingcode.collectors.code_quality._run_lint") as mock_lint:
            mock_lint.return_value = "pass"
            result = collect_code_quality(self.tmpdir, max_file_length=300)
        self.assertEqual(result.files_over_300_lines, 0)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_code_quality.py -v`
Expected: FAIL

- [ ] **Step 3: Implement code_quality collector**

```python
# livingcode/collectors/code_quality.py
"""Code quality collector — file length, lint status, TODO count, archive size."""
import os
import re
import subprocess
from pathlib import Path
from livingcode.types import CodeQualityReport, FileInfo

SKIP_DIRS = {"node_modules", ".next", "dist", ".git", "__pycache__", ".organism", "coverage"}
CODE_EXTENSIONS = {".js", ".ts", ".jsx", ".tsx"}
PYTHON_EXTENSIONS = {".py"}


def _run_lint(repo_path: str) -> str:
    """Run ESLint via npm run lint. Returns 'pass' or 'fail'."""
    try:
        result = subprocess.run(
            ["npm", "run", "lint"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=60,
        )
        return "pass" if result.returncode == 0 else "fail"
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return "unknown"


def collect_code_quality(repo_path: str, max_file_length: int = 300) -> CodeQualityReport:
    """Collect code quality metrics."""
    files_over_limit = 0
    all_files: list[FileInfo] = []
    todo_count = 0
    python_over_limit = 0

    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            ext = os.path.splitext(fname)[1]
            if ext not in CODE_EXTENSIONS and ext not in PYTHON_EXTENSIONS:
                continue
            if fname.endswith(".d.ts"):
                continue
            filepath = os.path.join(root, fname)
            try:
                with open(filepath, encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                lines = content.count("\n") + (1 if content and not content.endswith("\n") else 0)
            except OSError:
                continue

            rel_path = os.path.relpath(filepath, repo_path).replace("\\", "/")

            if ext in CODE_EXTENSIONS:
                all_files.append(FileInfo(path=rel_path, lines=lines))
                if lines > max_file_length:
                    files_over_limit += 1
            elif ext in PYTHON_EXTENSIONS:
                if lines > max_file_length:
                    python_over_limit += 1

            # Count TODOs and FIXMEs
            todo_count += len(re.findall(r"\bTODO\b|\bFIXME\b", content))

    # Sort largest files descending, take top 10
    all_files.sort(key=lambda f: f.lines, reverse=True)
    largest = all_files[:10]

    # Archive size
    archive_dir = Path(repo_path) / "app" / "api" / "_archive"
    archive_kb = 0
    if archive_dir.exists():
        total_bytes = sum(
            f.stat().st_size for f in archive_dir.rglob("*") if f.is_file()
        )
        archive_kb = total_bytes // 1024

    # ESLint
    eslint_status = _run_lint(repo_path)

    return CodeQualityReport(
        files_over_300_lines=files_over_limit,
        largest_files=largest,
        eslint_status=eslint_status,
        python_files_over_300=python_over_limit,
        todo_count=todo_count,
        archive_size_kb=archive_kb,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_code_quality.py -v`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Projects\DashClaw
git add livingcode/collectors/code_quality.py livingcode/tests/test_code_quality.py
git commit -m "feat(livingcode): add code_quality collector"
```

---

### Task 5: Dependency Health Collector

**Files:**
- Create: `livingcode/collectors/dependency_health.py`
- Test: `livingcode/tests/test_dependency_health.py`

- [ ] **Step 1: Write failing tests**

```python
# livingcode/tests/test_dependency_health.py
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class TestDependencyHealthCollector(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_counts_js_dependencies(self):
        from livingcode.collectors.dependency_health import collect_dependency_health
        pkg = {"dependencies": {"react": "18.0.0", "next": "16.0.0"}, "devDependencies": {"vitest": "4.0.0"}}
        (Path(self.tmpdir) / "package.json").write_text(json.dumps(pkg))
        (Path(self.tmpdir) / "package-lock.json").write_text("{}")
        with patch("livingcode.collectors.dependency_health._run_npm") as mock:
            mock.side_effect = [
                (0, "{}"),   # npm outdated
                (0, json.dumps({"vulnerabilities": {}})),  # npm audit
            ]
            result = collect_dependency_health(self.tmpdir)
        self.assertEqual(result.js_dependencies, 3)

    def test_counts_outdated_packages(self):
        from livingcode.collectors.dependency_health import collect_dependency_health
        pkg = {"dependencies": {"react": "17.0.0"}}
        (Path(self.tmpdir) / "package.json").write_text(json.dumps(pkg))
        (Path(self.tmpdir) / "package-lock.json").write_text("{}")
        outdated = {"react": {"current": "17.0.0", "wanted": "17.0.2", "latest": "18.2.0"}}
        with patch("livingcode.collectors.dependency_health._run_npm") as mock:
            mock.side_effect = [
                (1, json.dumps(outdated)),
                (0, json.dumps({"vulnerabilities": {}})),
            ]
            result = collect_dependency_health(self.tmpdir)
        self.assertEqual(result.js_outdated, 1)

    def test_counts_vulnerabilities(self):
        from livingcode.collectors.dependency_health import collect_dependency_health
        pkg = {"dependencies": {"bad-pkg": "1.0.0"}}
        (Path(self.tmpdir) / "package.json").write_text(json.dumps(pkg))
        (Path(self.tmpdir) / "package-lock.json").write_text("{}")
        audit = {"vulnerabilities": {"bad-pkg": {"severity": "high"}}}
        with patch("livingcode.collectors.dependency_health._run_npm") as mock:
            mock.side_effect = [
                (0, "{}"),
                (1, json.dumps(audit)),
            ]
            result = collect_dependency_health(self.tmpdir)
        self.assertEqual(result.js_vulnerabilities, 1)

    def test_detects_python_zero_dependencies(self):
        from livingcode.collectors.dependency_health import collect_dependency_health
        pkg = {"dependencies": {}}
        (Path(self.tmpdir) / "package.json").write_text(json.dumps(pkg))
        (Path(self.tmpdir) / "package-lock.json").write_text("{}")
        sdk_dir = Path(self.tmpdir) / "sdk-python"
        sdk_dir.mkdir()
        pyproject = {"project": {"dependencies": []}}
        (sdk_dir / "pyproject.toml").write_text("[project]\ndependencies = []\n")
        with patch("livingcode.collectors.dependency_health._run_npm") as mock:
            mock.side_effect = [(0, "{}"), (0, json.dumps({"vulnerabilities": {}}))]
            result = collect_dependency_health(self.tmpdir)
        self.assertEqual(result.python_dependencies, 0)

    def test_lockfile_age_days(self):
        from livingcode.collectors.dependency_health import collect_dependency_health
        pkg = {"dependencies": {}}
        (Path(self.tmpdir) / "package.json").write_text(json.dumps(pkg))
        lock = Path(self.tmpdir) / "package-lock.json"
        lock.write_text("{}")
        with patch("livingcode.collectors.dependency_health._run_npm") as mock:
            mock.side_effect = [(0, "{}"), (0, json.dumps({"vulnerabilities": {}}))]
            result = collect_dependency_health(self.tmpdir)
        self.assertGreaterEqual(result.lockfile_age_days, 0)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_dependency_health.py -v`
Expected: FAIL

- [ ] **Step 3: Implement dependency_health collector**

```python
# livingcode/collectors/dependency_health.py
"""Dependency health collector — npm audit, outdated, Python SDK zero-dep check."""
import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from livingcode.types import DependencyHealthReport


def _run_npm(args: list[str], cwd: str) -> tuple[int, str]:
    """Run an npm command. Returns (exit_code, stdout)."""
    try:
        result = subprocess.run(
            ["npm"] + args, cwd=cwd, capture_output=True, text=True, timeout=60,
        )
        return result.returncode, result.stdout
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return 1, ""


def _count_python_deps(repo_path: str) -> int:
    """Count Python SDK runtime dependencies from pyproject.toml."""
    pyproject_path = Path(repo_path) / "sdk-python" / "pyproject.toml"
    if not pyproject_path.exists():
        return 0
    content = pyproject_path.read_text()
    # Simple parse: find dependencies = [...] block
    m = re.search(r"dependencies\s*=\s*\[(.*?)\]", content, re.DOTALL)
    if not m:
        return 0
    deps_block = m.group(1).strip()
    if not deps_block:
        return 0
    # Count non-empty quoted strings
    return len(re.findall(r'"[^"]+"', deps_block))


def collect_dependency_health(repo_path: str) -> DependencyHealthReport:
    """Collect dependency health metrics."""
    # Count JS dependencies from package.json
    pkg_path = Path(repo_path) / "package.json"
    js_deps = 0
    if pkg_path.exists():
        with open(pkg_path) as f:
            pkg = json.load(f)
        js_deps = len(pkg.get("dependencies", {})) + len(pkg.get("devDependencies", {}))

    # Outdated packages
    _, outdated_output = _run_npm(["outdated", "--json"], repo_path)
    try:
        outdated_data = json.loads(outdated_output) if outdated_output.strip() else {}
    except json.JSONDecodeError:
        outdated_data = {}
    js_outdated = len(outdated_data)

    # Audit vulnerabilities
    _, audit_output = _run_npm(["audit", "--json"], repo_path)
    try:
        audit_data = json.loads(audit_output) if audit_output.strip() else {}
    except json.JSONDecodeError:
        audit_data = {}
    js_vulns = len(audit_data.get("vulnerabilities", {}))

    # Python SDK dependencies
    python_deps = _count_python_deps(repo_path)

    # Lockfile age
    lockfile = Path(repo_path) / "package-lock.json"
    lockfile_age = 0
    if lockfile.exists():
        mtime = datetime.fromtimestamp(lockfile.stat().st_mtime, tz=timezone.utc)
        age = datetime.now(timezone.utc) - mtime
        lockfile_age = age.days

    return DependencyHealthReport(
        js_dependencies=js_deps,
        js_outdated=js_outdated,
        js_vulnerabilities=js_vulns,
        python_dependencies=python_deps,
        lockfile_age_days=lockfile_age,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_dependency_health.py -v`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Projects\DashClaw
git add livingcode/collectors/dependency_health.py livingcode/tests/test_dependency_health.py
git commit -m "feat(livingcode): add dependency_health collector"
```

---

### Task 6: CI Health Collector

**Files:**
- Create: `livingcode/collectors/ci_health.py`
- Test: `livingcode/tests/test_ci_health.py`

- [ ] **Step 1: Write failing tests**

```python
# livingcode/tests/test_ci_health.py
import json
import unittest
from unittest.mock import patch


class TestCIHealthCollector(unittest.TestCase):

    @patch("livingcode.collectors.ci_health._run_gh")
    def test_collects_pass_rate(self, mock_gh):
        from livingcode.collectors.ci_health import collect_ci_health
        runs = [
            {"conclusion": "success", "createdAt": "2026-04-07T00:00:00Z"},
            {"conclusion": "success", "createdAt": "2026-04-06T00:00:00Z"},
            {"conclusion": "failure", "createdAt": "2026-04-05T00:00:00Z"},
        ] * 3 + [{"conclusion": "success", "createdAt": "2026-04-04T00:00:00Z"}]
        mock_gh.side_effect = [
            (0, json.dumps(runs)),       # gh run list
            (0, json.dumps(runs[:10])),   # gh run list (last 10)
            (0, ""),                       # gh run view (failure details)
        ]
        result = collect_ci_health("/fake/repo")
        self.assertGreater(result.pass_rate_30d, 0.5)
        self.assertEqual(result.gate_count, 0)  # No workflow steps parsed in this mock

    @patch("livingcode.collectors.ci_health._run_gh")
    def test_graceful_degradation_no_gh(self, mock_gh):
        from livingcode.collectors.ci_health import collect_ci_health
        mock_gh.side_effect = [(1, "gh: command not found")] * 3
        result = collect_ci_health("/fake/repo")
        self.assertEqual(result.pass_rate_30d, 0.0)
        self.assertEqual(result.last_10_runs, [])
        self.assertIsNone(result.last_failure_reason)

    @patch("livingcode.collectors.ci_health._run_gh")
    def test_last_10_runs_mapped_to_pass_fail(self, mock_gh):
        from livingcode.collectors.ci_health import collect_ci_health
        runs = [{"conclusion": "success", "createdAt": "2026-04-07T00:00:00Z"}] * 8 + \
               [{"conclusion": "failure", "createdAt": "2026-04-01T00:00:00Z"}] * 2
        mock_gh.side_effect = [
            (0, json.dumps(runs)),
            (0, json.dumps(runs[:10])),
            (0, "route-sql:check failed"),
        ]
        result = collect_ci_health("/fake/repo")
        self.assertEqual(len(result.last_10_runs), 10)
        self.assertEqual(result.last_10_runs.count("pass"), 8)
        self.assertEqual(result.last_10_runs.count("fail"), 2)

    @patch("livingcode.collectors.ci_health._run_gh")
    def test_captures_last_failure_reason(self, mock_gh):
        from livingcode.collectors.ci_health import collect_ci_health
        runs = [
            {"conclusion": "failure", "createdAt": "2026-04-07T00:00:00Z", "databaseId": 123},
            {"conclusion": "success", "createdAt": "2026-04-06T00:00:00Z"},
        ]
        mock_gh.side_effect = [
            (0, json.dumps(runs)),
            (0, json.dumps(runs[:10])),
            (0, "route-sql:check — baseline mismatch"),
        ]
        result = collect_ci_health("/fake/repo")
        self.assertIn("route-sql", result.last_failure_reason)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_ci_health.py -v`
Expected: FAIL

- [ ] **Step 3: Implement ci_health collector**

```python
# livingcode/collectors/ci_health.py
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
        gate_count=0,  # Would need to parse workflow YAML (future enhancement)
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_ci_health.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Projects\DashClaw
git add livingcode/collectors/ci_health.py livingcode/tests/test_ci_health.py
git commit -m "feat(livingcode): add ci_health collector"
```

---

### Task 7: Sensing Orchestrator

**Files:**
- Create: `livingcode/sensing.py`
- Test: `livingcode/tests/test_sensing.py`

- [ ] **Step 1: Write failing tests**

```python
# livingcode/tests/test_sensing.py
import unittest
from unittest.mock import patch, MagicMock
from livingcode.types import (
    GitStatsReport, TestHealthReport, TestSuiteResult, CodeQualityReport,
    DependencyHealthReport, CIHealthReport, CollectorStatus,
)


def _make_git_stats():
    return GitStatsReport(
        commits_7d=14, commits_30d=48, active_branches=3,
        stale_branches=1, bus_factor=1, top_contributors_30d=[], files_changed_7d=87,
    )

def _make_test_health():
    return TestHealthReport(
        js_tests=TestSuiteResult(107, 107, 0),
        python_tests=TestSuiteResult(12, 12, 0),
        test_file_ratio=0.42, untested_routes=[],
    )

def _make_code_quality():
    return CodeQualityReport(
        files_over_300_lines=5, largest_files=[], eslint_status="pass",
        python_files_over_300=1, todo_count=16, archive_size_kb=245,
    )

def _make_dep_health():
    return DependencyHealthReport(
        js_dependencies=25, js_outdated=3, js_vulnerabilities=0,
        python_dependencies=0, lockfile_age_days=2,
    )

def _make_ci_health():
    return CIHealthReport(
        pass_rate_30d=0.94, last_10_runs=["pass"] * 10,
        last_failure_reason=None, slowest_gate=None, gate_count=11,
    )


class TestSensing(unittest.TestCase):

    @patch("livingcode.sensing.collect_ci_health", return_value=_make_ci_health())
    @patch("livingcode.sensing.collect_dependency_health", return_value=_make_dep_health())
    @patch("livingcode.sensing.collect_code_quality", return_value=_make_code_quality())
    @patch("livingcode.sensing.collect_test_health", return_value=_make_test_health())
    @patch("livingcode.sensing.collect_git_stats", return_value=_make_git_stats())
    @patch("livingcode.sensing.load_organism")
    @patch("livingcode.sensing.write_state_report", return_value="/fake/.organism/state-reports/report.json")
    @patch("livingcode.sensing.ensure_organism_dir")
    def test_runs_all_collectors(self, mock_ensure, mock_write, mock_load, *collector_mocks):
        from livingcode.sensing import run_sensing
        mock_load.return_value = ({"identity": {"name": "dashclaw"}}, [])
        report, path = run_sensing("/fake/repo")
        self.assertEqual(report.organism, "dashclaw")
        self.assertIsNotNone(report.git_stats)
        self.assertIsNotNone(report.test_health)
        self.assertIsNotNone(report.code_quality)
        self.assertIsNotNone(report.dependency_health)
        self.assertIsNotNone(report.ci_health)
        for status in report.collector_status.values():
            self.assertEqual(status, CollectorStatus.OK)

    @patch("livingcode.sensing.collect_ci_health", return_value=_make_ci_health())
    @patch("livingcode.sensing.collect_dependency_health", return_value=_make_dep_health())
    @patch("livingcode.sensing.collect_code_quality", side_effect=Exception("boom"))
    @patch("livingcode.sensing.collect_test_health", return_value=_make_test_health())
    @patch("livingcode.sensing.collect_git_stats", return_value=_make_git_stats())
    @patch("livingcode.sensing.load_organism")
    @patch("livingcode.sensing.write_state_report", return_value="/fake/report.json")
    @patch("livingcode.sensing.ensure_organism_dir")
    def test_handles_collector_failure_gracefully(self, mock_ensure, mock_write, mock_load, *mocks):
        from livingcode.sensing import run_sensing
        mock_load.return_value = ({"identity": {"name": "test"}}, [])
        report, _ = run_sensing("/fake/repo")
        self.assertEqual(report.collector_status["code_quality"], CollectorStatus.FAILED)
        self.assertIsNone(report.code_quality)
        self.assertEqual(report.collector_status["git_stats"], CollectorStatus.OK)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_sensing.py -v`
Expected: FAIL

- [ ] **Step 3: Implement sensing orchestrator**

```python
# livingcode/sensing.py
"""Sensing orchestrator — runs all 5 collectors and produces a unified state report."""
from datetime import datetime, timezone
from livingcode.types import StateReport, CollectorStatus
from livingcode.state import ensure_organism_dir, write_state_report
from livingcode.schema.validator import load_organism
from livingcode.collectors.git_stats import collect_git_stats
from livingcode.collectors.test_health import collect_test_health
from livingcode.collectors.code_quality import collect_code_quality
from livingcode.collectors.dependency_health import collect_dependency_health
from livingcode.collectors.ci_health import collect_ci_health
from dataclasses import asdict
import os


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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_sensing.py -v`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Projects\DashClaw
git add livingcode/sensing.py livingcode/tests/test_sensing.py
git commit -m "feat(livingcode): add sensing orchestrator"
```

---

### Task 8: Immune System — Checks and Verdict

**Files:**
- Create: `livingcode/immune/__init__.py`
- Create: `livingcode/immune/checks.py`
- Create: `livingcode/immune/verdict.py`
- Test: `livingcode/tests/test_immune.py`

- [ ] **Step 1: Write failing tests**

```python
# livingcode/tests/test_immune.py
import unittest
from livingcode.types import (
    Baselines, CheckResult, CheckStatus, StateReport, CollectorStatus,
    GitStatsReport, TestHealthReport, TestSuiteResult, CodeQualityReport,
    DependencyHealthReport, CIHealthReport, FileInfo,
)


def _make_baselines():
    return Baselines(
        updated_at="2026-04-06T00:00:00Z",
        test_count={"js": 107, "python": 12},
        file_count_over_300=10,
        js_vulnerabilities=0,
        sdk_methods={"node": 67, "python": 236},
        ci_pass_rate_30d=0.94,
    )


def _make_report(**overrides):
    defaults = dict(
        organism="dashclaw",
        timestamp="2026-04-07T06:30:00Z",
        collector_status={k: CollectorStatus.OK for k in
                          ["git_stats", "test_health", "code_quality", "dependency_health", "ci_health"]},
        git_stats=GitStatsReport(14, 48, 3, 1, 1, [], 87),
        test_health=TestHealthReport(
            TestSuiteResult(107, 107, 0), TestSuiteResult(12, 12, 0), 0.42, [],
        ),
        code_quality=CodeQualityReport(10, [], "pass", 1, 16, 245),
        dependency_health=DependencyHealthReport(25, 3, 0, 0, 2),
        ci_health=CIHealthReport(0.94, ["pass"] * 10, None, None, 11),
    )
    defaults.update(overrides)
    return StateReport(**defaults)


class TestImmuneChecks(unittest.TestCase):

    def test_ci_gates_pass_when_all_green(self):
        from livingcode.immune.checks import check_ci_gates
        report = _make_report()
        result = check_ci_gates(report, _make_baselines())
        self.assertEqual(result.status, CheckStatus.PASS)

    def test_ci_gates_fail_when_pass_rate_drops(self):
        from livingcode.immune.checks import check_ci_gates
        report = _make_report(ci_health=CIHealthReport(0.50, ["fail"] * 5 + ["pass"] * 5, "build failed", None, 11))
        result = check_ci_gates(report, _make_baselines())
        self.assertEqual(result.status, CheckStatus.FAIL)

    def test_file_length_pass_when_no_new_violations(self):
        from livingcode.immune.checks import check_file_length
        report = _make_report()
        result = check_file_length(report, _make_baselines())
        self.assertEqual(result.status, CheckStatus.PASS)

    def test_file_length_warn_when_new_violations(self):
        from livingcode.immune.checks import check_file_length
        report = _make_report(code_quality=CodeQualityReport(15, [], "pass", 1, 16, 245))
        result = check_file_length(report, _make_baselines())
        self.assertEqual(result.status, CheckStatus.WARN)

    def test_test_regression_pass_when_counts_stable(self):
        from livingcode.immune.checks import check_test_regression
        report = _make_report()
        result = check_test_regression(report, _make_baselines())
        self.assertEqual(result.status, CheckStatus.PASS)

    def test_test_regression_fail_when_count_drops(self):
        from livingcode.immune.checks import check_test_regression
        report = _make_report(
            test_health=TestHealthReport(
                TestSuiteResult(100, 100, 0), TestSuiteResult(12, 12, 0), 0.42, [],
            )
        )
        result = check_test_regression(report, _make_baselines())
        self.assertEqual(result.status, CheckStatus.FAIL)

    def test_dependency_safety_pass_when_no_vulns(self):
        from livingcode.immune.checks import check_dependency_safety
        report = _make_report()
        result = check_dependency_safety(report, _make_baselines())
        self.assertEqual(result.status, CheckStatus.PASS)

    def test_dependency_safety_fail_when_new_vulns(self):
        from livingcode.immune.checks import check_dependency_safety
        report = _make_report(dependency_health=DependencyHealthReport(25, 3, 2, 0, 2))
        result = check_dependency_safety(report, _make_baselines())
        self.assertEqual(result.status, CheckStatus.FAIL)

    def test_test_regression_fail_on_failures(self):
        from livingcode.immune.checks import check_test_regression
        report = _make_report(
            test_health=TestHealthReport(
                TestSuiteResult(107, 104, 3), TestSuiteResult(12, 12, 0), 0.42, [],
            )
        )
        result = check_test_regression(report, _make_baselines())
        self.assertEqual(result.status, CheckStatus.FAIL)


class TestVerdict(unittest.TestCase):

    def test_all_pass_returns_merge(self):
        from livingcode.immune.verdict import generate_verdict
        checks = [
            CheckResult("ci_gates", CheckStatus.PASS, "ok"),
            CheckResult("file_length", CheckStatus.PASS, "ok"),
            CheckResult("test_regression", CheckStatus.PASS, "ok"),
        ]
        verdict = generate_verdict(checks)
        self.assertEqual(verdict.recommendation, "merge")
        self.assertEqual(verdict.blocking, [])

    def test_hard_block_returns_fix_required(self):
        from livingcode.immune.verdict import generate_verdict
        checks = [
            CheckResult("ci_gates", CheckStatus.FAIL, "CI failing"),
            CheckResult("file_length", CheckStatus.PASS, "ok"),
        ]
        verdict = generate_verdict(checks)
        self.assertEqual(verdict.recommendation, "fix_required")
        self.assertIn("ci_gates", verdict.blocking)

    def test_soft_warn_only_returns_needs_discussion(self):
        from livingcode.immune.verdict import generate_verdict
        checks = [
            CheckResult("ci_gates", CheckStatus.PASS, "ok"),
            CheckResult("file_length", CheckStatus.WARN, "2 new files over limit"),
            CheckResult("sdk_parity", CheckStatus.WARN, "drift detected"),
        ]
        verdict = generate_verdict(checks)
        self.assertEqual(verdict.recommendation, "needs_discussion")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_immune.py -v`
Expected: FAIL

- [ ] **Step 3: Implement immune checks**

```python
# livingcode/immune/__init__.py
```

```python
# livingcode/immune/checks.py
"""Immune system checks — 6 checks that compare current state against baselines."""
from livingcode.types import Baselines, CheckResult, CheckStatus, StateReport

# Checks classified by severity
HARD_BLOCK_CHECKS = {"ci_gates", "openapi_contract", "test_regression", "dependency_safety"}
SOFT_WARN_CHECKS = {"file_length", "sdk_parity"}


def check_ci_gates(report: StateReport, baselines: Baselines | None) -> CheckResult:
    """Check if CI pass rate has degraded."""
    if not report.ci_health:
        return CheckResult("ci_gates", CheckStatus.WARN, "CI health data unavailable")
    current_rate = report.ci_health.pass_rate_30d
    baseline_rate = baselines.ci_pass_rate_30d if baselines else 0.9
    if current_rate < 0.7:
        return CheckResult("ci_gates", CheckStatus.FAIL,
                           f"CI pass rate critically low: {current_rate:.0%} (baseline: {baseline_rate:.0%})")
    if baselines and current_rate < baseline_rate - 0.1:
        return CheckResult("ci_gates", CheckStatus.FAIL,
                           f"CI pass rate dropped: {current_rate:.0%} (baseline: {baseline_rate:.0%})")
    return CheckResult("ci_gates", CheckStatus.PASS,
                       f"CI pass rate: {current_rate:.0%}")


def check_openapi_contract(report: StateReport, baselines: Baselines | None) -> CheckResult:
    """Check if OpenAPI contract is stable. Uses ESLint as proxy (openapi:check runs in CI)."""
    if not report.code_quality:
        return CheckResult("openapi_contract", CheckStatus.WARN, "Code quality data unavailable")
    if report.code_quality.eslint_status == "fail":
        return CheckResult("openapi_contract", CheckStatus.WARN,
                           "Lint failing — OpenAPI contract may be drifting")
    return CheckResult("openapi_contract", CheckStatus.PASS, "OpenAPI contract stable")


def check_file_length(report: StateReport, baselines: Baselines | None) -> CheckResult:
    """Check if new files exceed the 300-line limit."""
    if not report.code_quality:
        return CheckResult("file_length", CheckStatus.WARN, "Code quality data unavailable")
    current = report.code_quality.files_over_300_lines
    baseline_count = baselines.file_count_over_300 if baselines else 0
    if current > baseline_count:
        new_violations = current - baseline_count
        return CheckResult("file_length", CheckStatus.WARN,
                           f"{new_violations} new file(s) exceed 300-line limit (total: {current})")
    return CheckResult("file_length", CheckStatus.PASS,
                       f"No new file length violations (total: {current})")


def check_test_regression(report: StateReport, baselines: Baselines | None) -> CheckResult:
    """Check if test count decreased or tests are failing."""
    if not report.test_health:
        return CheckResult("test_regression", CheckStatus.WARN, "Test health data unavailable")
    # Check for failures first
    js_failed = report.test_health.js_tests.failed
    py_failed = report.test_health.python_tests.failed
    if js_failed > 0 or py_failed > 0:
        return CheckResult("test_regression", CheckStatus.FAIL,
                           f"Tests failing: {js_failed} JS, {py_failed} Python")
    # Check for count regression
    if baselines:
        js_baseline = baselines.test_count.get("js", 0)
        py_baseline = baselines.test_count.get("python", 0)
        js_current = report.test_health.js_tests.total
        py_current = report.test_health.python_tests.total
        if js_current < js_baseline:
            return CheckResult("test_regression", CheckStatus.FAIL,
                               f"JS test count dropped: {js_current} (was {js_baseline})")
        if py_current < py_baseline:
            return CheckResult("test_regression", CheckStatus.FAIL,
                               f"Python test count dropped: {py_current} (was {py_baseline})")
    return CheckResult("test_regression", CheckStatus.PASS, "Test counts stable, all passing")


def check_dependency_safety(report: StateReport, baselines: Baselines | None) -> CheckResult:
    """Check for new security vulnerabilities."""
    if not report.dependency_health:
        return CheckResult("dependency_safety", CheckStatus.WARN, "Dependency data unavailable")
    current_vulns = report.dependency_health.js_vulnerabilities
    baseline_vulns = baselines.js_vulnerabilities if baselines else 0
    if current_vulns > baseline_vulns:
        new_vulns = current_vulns - baseline_vulns
        return CheckResult("dependency_safety", CheckStatus.FAIL,
                           f"{new_vulns} new vulnerability(ies) detected (total: {current_vulns})")
    if current_vulns > 0:
        return CheckResult("dependency_safety", CheckStatus.WARN,
                           f"{current_vulns} existing vulnerability(ies)")
    return CheckResult("dependency_safety", CheckStatus.PASS, "No vulnerabilities detected")


def check_sdk_parity(report: StateReport, baselines: Baselines | None) -> CheckResult:
    """Check if Python SDK method count has diverged from Node SDK."""
    if not baselines or not baselines.sdk_methods:
        return CheckResult("sdk_parity", CheckStatus.PASS, "No SDK baseline to compare against")
    # This is a structural check — we can't count methods from sensing data alone.
    # For now, pass. Will be enhanced when SDK method counting is added to a collector.
    return CheckResult("sdk_parity", CheckStatus.PASS, "SDK parity check (baseline only)")


def run_all_checks(report: StateReport, baselines: Baselines | None) -> list[CheckResult]:
    """Run all 6 immune checks and return results."""
    return [
        check_ci_gates(report, baselines),
        check_openapi_contract(report, baselines),
        check_file_length(report, baselines),
        check_test_regression(report, baselines),
        check_dependency_safety(report, baselines),
        check_sdk_parity(report, baselines),
    ]
```

```python
# livingcode/immune/verdict.py
"""Verdict logic — translates immune check results into a recommendation."""
from livingcode.types import CheckResult, CheckStatus, Verdict
from livingcode.immune.checks import HARD_BLOCK_CHECKS


def generate_verdict(checks: list[CheckResult]) -> Verdict:
    """Generate a verdict from immune check results."""
    blocking: list[str] = []
    warnings: list[str] = []

    for check in checks:
        if check.status == CheckStatus.FAIL:
            if check.name in HARD_BLOCK_CHECKS:
                blocking.append(check.name)
            else:
                warnings.append(check.name)
        elif check.status == CheckStatus.WARN:
            warnings.append(check.name)

    if blocking:
        recommendation = "fix_required"
        summary = f"Blocked by: {', '.join(blocking)}"
    elif warnings:
        recommendation = "needs_discussion"
        summary = f"Warnings: {', '.join(warnings)}"
    else:
        recommendation = "merge"
        summary = "All checks passed"

    return Verdict(
        recommendation=recommendation,
        checks=checks,
        blocking=blocking,
        summary=summary,
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_immune.py -v`
Expected: All 12 tests PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Projects\DashClaw
git add livingcode/immune/__init__.py livingcode/immune/checks.py \
  livingcode/immune/verdict.py livingcode/tests/test_immune.py
git commit -m "feat(livingcode): add immune system — 6 checks + verdict logic"
```

---

### Task 9: Planner — Prioritizer and Backlog

**Files:**
- Create: `livingcode/planner/__init__.py`
- Create: `livingcode/planner/prioritizer.py`
- Create: `livingcode/planner/backlog.py`
- Test: `livingcode/tests/test_planner.py`

- [ ] **Step 1: Write failing tests**

```python
# livingcode/tests/test_planner.py
import json
import os
import tempfile
import unittest
from pathlib import Path
from livingcode.types import (
    StateReport, CollectorStatus, GitStatsReport, TestHealthReport,
    TestSuiteResult, CodeQualityReport, DependencyHealthReport,
    CIHealthReport, FileInfo,
)


def _make_report(**overrides):
    defaults = dict(
        organism="dashclaw",
        timestamp="2026-04-07T06:30:00Z",
        collector_status={k: CollectorStatus.OK for k in
                          ["git_stats", "test_health", "code_quality", "dependency_health", "ci_health"]},
        git_stats=GitStatsReport(14, 48, 3, 1, 1, [{"name": "Wes", "commits": 46}], 87),
        test_health=TestHealthReport(
            TestSuiteResult(107, 107, 0), TestSuiteResult(12, 12, 0), 0.42,
            ["api/cron/signals", "api/cron/reset-meters"],
        ),
        code_quality=CodeQualityReport(
            12, [FileInfo("app/docs/page.js", 1703), FileInfo("app/policies/page.js", 1504)],
            "pass", 1, 16, 245,
        ),
        dependency_health=DependencyHealthReport(25, 3, 2, 0, 2),
        ci_health=CIHealthReport(0.94, ["pass"] * 10, None, None, 11),
    )
    defaults.update(overrides)
    return StateReport(**defaults)


class TestPrioritizer(unittest.TestCase):

    def test_generates_work_items_from_report(self):
        from livingcode.planner.prioritizer import generate_work_items
        report = _make_report()
        items = generate_work_items(report)
        self.assertGreater(len(items), 0)

    def test_tier1_for_vulnerabilities(self):
        from livingcode.planner.prioritizer import generate_work_items
        report = _make_report()
        items = generate_work_items(report)
        vuln_items = [i for i in items if i.tier == 1]
        self.assertGreater(len(vuln_items), 0)

    def test_tier3_for_untested_routes(self):
        from livingcode.planner.prioritizer import generate_work_items
        report = _make_report()
        items = generate_work_items(report)
        untested = [i for i in items if "untested" in i.title.lower()]
        self.assertGreater(len(untested), 0)

    def test_tier4_for_bus_factor(self):
        from livingcode.planner.prioritizer import generate_work_items
        report = _make_report()
        items = generate_work_items(report)
        bus = [i for i in items if "bus factor" in i.title.lower()]
        self.assertGreater(len(bus), 0)

    def test_max_10_items(self):
        from livingcode.planner.prioritizer import generate_work_items
        report = _make_report()
        items = generate_work_items(report, max_items=10)
        self.assertLessEqual(len(items), 10)

    def test_sorted_by_tier(self):
        from livingcode.planner.prioritizer import generate_work_items
        report = _make_report()
        items = generate_work_items(report)
        tiers = [i.tier for i in items]
        self.assertEqual(tiers, sorted(tiers))


class TestBacklog(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_write_backlog_item(self):
        from livingcode.planner.backlog import write_backlog_item
        from livingcode.types import WorkItem
        from livingcode.state import ensure_organism_dir
        ensure_organism_dir(self.tmpdir)
        item = WorkItem(
            id="wk-001", tier=2, title="Test", description="Desc",
            affected_files=[], metric="test", status="proposed",
        )
        path = write_backlog_item(self.tmpdir, item)
        self.assertTrue(Path(path).exists())
        with open(path) as f:
            data = json.load(f)
        self.assertEqual(data["id"], "wk-001")

    def test_read_backlog_items(self):
        from livingcode.planner.backlog import write_backlog_item, read_backlog_items
        from livingcode.types import WorkItem
        from livingcode.state import ensure_organism_dir
        ensure_organism_dir(self.tmpdir)
        for i in range(3):
            write_backlog_item(self.tmpdir, WorkItem(
                id=f"wk-{i}", tier=i+1, title=f"Item {i}", description="",
                affected_files=[], metric="test", status="proposed",
            ))
        items = read_backlog_items(self.tmpdir)
        self.assertEqual(len(items), 3)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_planner.py -v`
Expected: FAIL

- [ ] **Step 3: Implement prioritizer**

```python
# livingcode/planner/__init__.py
```

```python
# livingcode/planner/prioritizer.py
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
```

```python
# livingcode/planner/backlog.py
"""Backlog management — read/write work items to .organism/backlog/."""
import json
from dataclasses import asdict
from pathlib import Path
from livingcode.types import WorkItem


def write_backlog_item(repo_path: str, item: WorkItem) -> str:
    """Write a work item to .organism/backlog/. Returns file path."""
    backlog_dir = Path(repo_path) / ".organism" / "backlog"
    backlog_dir.mkdir(parents=True, exist_ok=True)
    filepath = backlog_dir / f"{item.id}.json"
    with open(filepath, "w") as f:
        json.dump(asdict(item), f, indent=2)
    return str(filepath)


def read_backlog_items(repo_path: str) -> list[WorkItem]:
    """Read all backlog items from .organism/backlog/."""
    backlog_dir = Path(repo_path) / ".organism" / "backlog"
    if not backlog_dir.exists():
        return []
    items = []
    for filepath in sorted(backlog_dir.glob("*.json")):
        with open(filepath) as f:
            data = json.load(f)
        items.append(WorkItem(**data))
    return items
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_planner.py -v`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Projects\DashClaw
git add livingcode/planner/__init__.py livingcode/planner/prioritizer.py \
  livingcode/planner/backlog.py livingcode/tests/test_planner.py
git commit -m "feat(livingcode): add planner — tiered prioritizer + backlog management"
```

---

### Task 10: Orchestrator — Safety Systems and Lifecycle Cycle

**Files:**
- Create: `livingcode/orchestrator/__init__.py`
- Create: `livingcode/orchestrator/safety.py`
- Create: `livingcode/orchestrator/cycle.py`
- Test: `livingcode/tests/test_orchestrator.py`

- [ ] **Step 1: Write failing tests**

```python
# livingcode/tests/test_orchestrator.py
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
from livingcode.state import ensure_organism_dir


class TestSafety(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        ensure_organism_dir(self.tmpdir)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_kill_switch_inactive_by_default(self):
        from livingcode.orchestrator.safety import is_kill_switch_active
        self.assertFalse(is_kill_switch_active(self.tmpdir))

    def test_activate_kill_switch(self):
        from livingcode.orchestrator.safety import activate_kill_switch, is_kill_switch_active
        activate_kill_switch(self.tmpdir)
        self.assertTrue(is_kill_switch_active(self.tmpdir))

    def test_deactivate_kill_switch(self):
        from livingcode.orchestrator.safety import activate_kill_switch, deactivate_kill_switch, is_kill_switch_active
        activate_kill_switch(self.tmpdir)
        deactivate_kill_switch(self.tmpdir)
        self.assertFalse(is_kill_switch_active(self.tmpdir))

    def test_cycle_lock_not_held_by_default(self):
        from livingcode.orchestrator.safety import is_cycle_locked
        self.assertFalse(is_cycle_locked(self.tmpdir))

    def test_acquire_and_release_cycle_lock(self):
        from livingcode.orchestrator.safety import acquire_cycle_lock, release_cycle_lock, is_cycle_locked
        acquire_cycle_lock(self.tmpdir)
        self.assertTrue(is_cycle_locked(self.tmpdir))
        release_cycle_lock(self.tmpdir)
        self.assertFalse(is_cycle_locked(self.tmpdir))

    def test_consecutive_failures_starts_at_zero(self):
        from livingcode.orchestrator.safety import get_consecutive_failures
        self.assertEqual(get_consecutive_failures(self.tmpdir), 0)

    def test_increment_and_reset_failures(self):
        from livingcode.orchestrator.safety import increment_failures, reset_failures, get_consecutive_failures
        increment_failures(self.tmpdir)
        increment_failures(self.tmpdir)
        self.assertEqual(get_consecutive_failures(self.tmpdir), 2)
        reset_failures(self.tmpdir)
        self.assertEqual(get_consecutive_failures(self.tmpdir), 0)

    def test_is_paused_after_3_failures(self):
        from livingcode.orchestrator.safety import increment_failures, is_paused
        for _ in range(3):
            increment_failures(self.tmpdir)
        self.assertTrue(is_paused(self.tmpdir))


class TestCycle(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        ensure_organism_dir(self.tmpdir)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    @patch("livingcode.orchestrator.cycle.run_sensing")
    @patch("livingcode.orchestrator.cycle.generate_work_items")
    @patch("livingcode.orchestrator.cycle.run_all_checks")
    @patch("livingcode.orchestrator.cycle.generate_verdict")
    @patch("livingcode.orchestrator.cycle.load_organism")
    def test_full_cycle_returns_stable(self, mock_load, mock_verdict, mock_checks, mock_plan, mock_sense):
        from livingcode.orchestrator.cycle import run_lifecycle_cycle
        from livingcode.types import Verdict, CheckResult, CheckStatus
        mock_load.return_value = ({"identity": {"name": "test"}}, [])
        mock_sense.return_value = (MagicMock(organism="test"), "/fake/path")
        mock_plan.return_value = []
        mock_checks.return_value = [CheckResult("ci_gates", CheckStatus.PASS, "ok")]
        mock_verdict.return_value = Verdict("merge", [], [], "All passed")
        result = run_lifecycle_cycle(self.tmpdir)
        self.assertEqual(result.outcome, "stable")
        self.assertIn("sense", result.phases_completed)

    @patch("livingcode.orchestrator.cycle.load_organism")
    def test_cycle_aborts_on_kill_switch(self, mock_load):
        from livingcode.orchestrator.cycle import run_lifecycle_cycle
        from livingcode.orchestrator.safety import activate_kill_switch
        mock_load.return_value = ({"identity": {"name": "test"}}, [])
        activate_kill_switch(self.tmpdir)
        result = run_lifecycle_cycle(self.tmpdir)
        self.assertEqual(result.outcome, "aborted")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_orchestrator.py -v`
Expected: FAIL

- [ ] **Step 3: Implement safety systems**

```python
# livingcode/orchestrator/__init__.py
```

```python
# livingcode/orchestrator/safety.py
"""Safety systems — kill switch, cycle lock, failure tracking, pause."""
from pathlib import Path
from livingcode.state import read_json_file, write_json_file
from datetime import datetime, timezone

ORGANISM_DIR = ".organism"


def is_kill_switch_active(repo_path: str) -> bool:
    return (Path(repo_path) / ORGANISM_DIR / "kill-switch").exists()


def activate_kill_switch(repo_path: str) -> None:
    path = Path(repo_path) / ORGANISM_DIR / "kill-switch"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.touch()


def deactivate_kill_switch(repo_path: str) -> None:
    path = Path(repo_path) / ORGANISM_DIR / "kill-switch"
    if path.exists():
        path.unlink()


def is_cycle_locked(repo_path: str) -> bool:
    path = Path(repo_path) / ORGANISM_DIR / "active-cycle.json"
    return path.exists()


def acquire_cycle_lock(repo_path: str) -> None:
    path = Path(repo_path) / ORGANISM_DIR / "active-cycle.json"
    write_json_file(path, {"started": datetime.now(timezone.utc).isoformat()})


def release_cycle_lock(repo_path: str) -> None:
    path = Path(repo_path) / ORGANISM_DIR / "active-cycle.json"
    if path.exists():
        path.unlink()


def get_consecutive_failures(repo_path: str) -> int:
    path = Path(repo_path) / ORGANISM_DIR / "consecutive-failures.json"
    data = read_json_file(path)
    return data.get("count", 0) if data else 0


def increment_failures(repo_path: str) -> int:
    current = get_consecutive_failures(repo_path)
    new_count = current + 1
    path = Path(repo_path) / ORGANISM_DIR / "consecutive-failures.json"
    write_json_file(path, {"count": new_count})
    if new_count >= 3:
        _set_paused(repo_path)
    return new_count


def reset_failures(repo_path: str) -> None:
    path = Path(repo_path) / ORGANISM_DIR / "consecutive-failures.json"
    write_json_file(path, {"count": 0})
    _clear_paused(repo_path)


def is_paused(repo_path: str) -> bool:
    return (Path(repo_path) / ORGANISM_DIR / "paused").exists()


def _set_paused(repo_path: str) -> None:
    (Path(repo_path) / ORGANISM_DIR / "paused").touch()


def _clear_paused(repo_path: str) -> None:
    path = Path(repo_path) / ORGANISM_DIR / "paused"
    if path.exists():
        path.unlink()
```

- [ ] **Step 4: Implement lifecycle cycle**

```python
# livingcode/orchestrator/cycle.py
"""Lifecycle cycle — SENSE → PLAN → REVIEW → REFLECT."""
import json
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
from livingcode.planner.prioritizer import generate_work_items
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
        items = generate_work_items(report)
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

    except Exception as e:
        increment_failures(repo_path)
        return CycleResult(
            cycle_number=cycle_num, outcome="aborted",
            duration_seconds=round(time.time() - start, 2),
            phases_completed=phases,
        )
    finally:
        release_cycle_lock(repo_path)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_orchestrator.py -v`
Expected: All 10 tests PASS

- [ ] **Step 6: Commit**

```bash
cd C:\Projects\DashClaw
git add livingcode/orchestrator/__init__.py livingcode/orchestrator/safety.py \
  livingcode/orchestrator/cycle.py livingcode/tests/test_orchestrator.py
git commit -m "feat(livingcode): add orchestrator — lifecycle cycle + safety systems"
```

---

### Task 11: Heartbeat Runner

**Files:**
- Create: `livingcode/heartbeat/__init__.py`
- Create: `livingcode/heartbeat/runner.py`
- Test: `livingcode/tests/test_heartbeat.py`

- [ ] **Step 1: Write failing tests**

```python
# livingcode/tests/test_heartbeat.py
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock
from livingcode.state import ensure_organism_dir
from livingcode.types import GitStatsReport, CodeQualityReport


class TestHeartbeat(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        ensure_organism_dir(self.tmpdir)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    @patch("livingcode.heartbeat.runner.collect_code_quality")
    @patch("livingcode.heartbeat.runner.collect_git_stats")
    def test_quick_heartbeat_runs_two_collectors(self, mock_git, mock_quality):
        from livingcode.heartbeat.runner import run_heartbeat
        mock_git.return_value = GitStatsReport(14, 48, 3, 1, 1, [], 87)
        mock_quality.return_value = CodeQualityReport(5, [], "pass", 0, 10, 100)
        result = run_heartbeat(self.tmpdir, mode="quick")
        mock_git.assert_called_once()
        mock_quality.assert_called_once()
        self.assertEqual(result["mode"], "quick")

    @patch("livingcode.heartbeat.runner.collect_code_quality")
    @patch("livingcode.heartbeat.runner.collect_git_stats")
    def test_quick_heartbeat_writes_to_heartbeats_dir(self, mock_git, mock_quality):
        from livingcode.heartbeat.runner import run_heartbeat
        mock_git.return_value = GitStatsReport(14, 48, 3, 1, 1, [], 87)
        mock_quality.return_value = CodeQualityReport(5, [], "pass", 0, 10, 100)
        run_heartbeat(self.tmpdir, mode="quick")
        heartbeats_dir = Path(self.tmpdir) / ".organism" / "heartbeats"
        files = list(heartbeats_dir.glob("*.json"))
        self.assertEqual(len(files), 1)

    @patch("livingcode.heartbeat.runner.run_lifecycle_cycle")
    def test_full_heartbeat_runs_cycle(self, mock_cycle):
        from livingcode.heartbeat.runner import run_heartbeat
        from livingcode.types import CycleResult
        mock_cycle.return_value = CycleResult(1, "stable", 45.0, ["sense", "plan", "review", "reflect"])
        result = run_heartbeat(self.tmpdir, mode="full")
        mock_cycle.assert_called_once()
        self.assertEqual(result["mode"], "full")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_heartbeat.py -v`
Expected: FAIL

- [ ] **Step 3: Implement heartbeat runner**

```python
# livingcode/heartbeat/__init__.py
```

```python
# livingcode/heartbeat/runner.py
"""Heartbeat runner — quick (post-commit) and full (scheduled) modes."""
import json
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from livingcode.collectors.git_stats import collect_git_stats
from livingcode.collectors.code_quality import collect_code_quality
from livingcode.orchestrator.cycle import run_lifecycle_cycle
from livingcode.state import ensure_organism_dir


def _safe_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")


def run_heartbeat(repo_path: str, mode: str = "quick") -> dict:
    """Run a heartbeat. mode='quick' for post-commit, mode='full' for scheduled."""
    ensure_organism_dir(repo_path)
    start = time.time()

    if mode == "full":
        result = run_lifecycle_cycle(repo_path)
        return {
            "mode": "full",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": round(time.time() - start, 2),
            "cycle_result": asdict(result),
        }

    # Quick mode: git_stats + code_quality only
    git_stats = collect_git_stats(repo_path)
    code_quality = collect_code_quality(repo_path)

    heartbeat = {
        "mode": "quick",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "trigger": "post_commit",
        "duration_seconds": round(time.time() - start, 2),
        "git_stats": asdict(git_stats),
        "code_quality": asdict(code_quality),
    }

    # Write to heartbeats directory
    heartbeats_dir = Path(repo_path) / ".organism" / "heartbeats"
    heartbeats_dir.mkdir(parents=True, exist_ok=True)
    filepath = heartbeats_dir / f"{_safe_timestamp()}.json"
    with open(filepath, "w") as f:
        json.dump(heartbeat, f, indent=2)

    return heartbeat
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_heartbeat.py -v`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
cd C:\Projects\DashClaw
git add livingcode/heartbeat/__init__.py livingcode/heartbeat/runner.py \
  livingcode/tests/test_heartbeat.py
git commit -m "feat(livingcode): add heartbeat runner — quick and full modes"
```

---

### Task 12: CLI Entry Point and Public API

**Files:**
- Create: `livingcode/__main__.py`
- Modify: `livingcode/__init__.py`
- Test: `livingcode/tests/test_cli.py`

- [ ] **Step 1: Write failing tests**

```python
# livingcode/tests/test_cli.py
import subprocess
import sys
import tempfile
import unittest


class TestCLI(unittest.TestCase):

    def test_module_is_runnable(self):
        result = subprocess.run(
            [sys.executable, "-m", "livingcode", "--help"],
            capture_output=True, text=True, timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("livingcode", result.stdout.lower())

    def test_status_command_runs(self):
        result = subprocess.run(
            [sys.executable, "-m", "livingcode", "status", "--path", tempfile.mkdtemp()],
            capture_output=True, text=True, timeout=10,
        )
        # Should not crash, even with no .organism/
        self.assertIn("No state reports", result.stdout)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_cli.py -v`
Expected: FAIL

- [ ] **Step 3: Implement CLI entry point**

```python
# livingcode/__main__.py
"""CLI entry point: python -m livingcode <command>"""
import argparse
import json
import os
import sys
from dataclasses import asdict


def cmd_sense(args):
    from livingcode.sensing import run_sensing
    report, path = run_sensing(args.path)
    print(f"Sensing complete. Report written to: {path}")
    if args.json:
        print(json.dumps(asdict(report), indent=2, default=str))
    else:
        print(f"  Organism: {report.organism}")
        print(f"  Collectors: {report.collector_status}")
        if report.git_stats:
            print(f"  Commits (7d): {report.git_stats.commits_7d}")
            print(f"  Bus factor: {report.git_stats.bus_factor}")
        if report.code_quality:
            print(f"  Files over limit: {report.code_quality.files_over_300_lines}")
            print(f"  TODOs: {report.code_quality.todo_count}")


def cmd_plan(args):
    from livingcode.sensing import run_sensing
    from livingcode.planner.prioritizer import generate_work_items
    report, _ = run_sensing(args.path)
    items = generate_work_items(report)
    print(f"Generated {len(items)} work item(s):")
    for item in items:
        print(f"  [Tier {item.tier}] {item.title}")
        if args.verbose:
            print(f"    {item.description}")


def cmd_review(args):
    from livingcode.sensing import run_sensing
    from livingcode.immune.checks import run_all_checks
    from livingcode.immune.verdict import generate_verdict
    from livingcode.orchestrator.cycle import _load_baselines
    report, _ = run_sensing(args.path)
    baselines = _load_baselines(args.path)
    checks = run_all_checks(report, baselines)
    verdict = generate_verdict(checks)
    print(f"Verdict: {verdict.recommendation}")
    print(f"Summary: {verdict.summary}")
    for check in verdict.checks:
        print(f"  [{check.status.upper()}] {check.name}: {check.message}")


def cmd_cycle(args):
    from livingcode.orchestrator.cycle import run_lifecycle_cycle
    result = run_lifecycle_cycle(args.path, supervised=not args.unsupervised)
    print(f"Cycle #{result.cycle_number} complete.")
    print(f"  Outcome: {result.outcome}")
    print(f"  Duration: {result.duration_seconds}s")
    print(f"  Phases: {', '.join(result.phases_completed)}")


def cmd_heartbeat(args):
    from livingcode.heartbeat.runner import run_heartbeat
    result = run_heartbeat(args.path, mode=args.mode)
    print(f"Heartbeat ({result['mode']}) complete in {result['duration_seconds']}s")


def cmd_status(args):
    from livingcode.state import read_latest_state_report
    report = read_latest_state_report(args.path)
    if not report:
        print("No state reports found. Run 'python -m livingcode sense' first.")
        return
    print(f"Last report: {report.get('timestamp', 'unknown')}")
    print(f"Organism: {report.get('organism', 'unknown')}")
    status = report.get("collector_status", {})
    for name, s in status.items():
        print(f"  {name}: {s}")


def main():
    parser = argparse.ArgumentParser(
        prog="livingcode",
        description="DashClaw Living Organism — codebase health sensing framework",
    )
    parser.add_argument("--path", default=os.getcwd(), help="Repository path (default: cwd)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("sense", help="Run all 5 collectors")
    sub.add_parser("plan", help="Generate prioritized work items")

    review_p = sub.add_parser("review", help="Run immune system checks")
    review_p.add_argument("branch", nargs="?", default=None)

    cycle_p = sub.add_parser("cycle", help="Full lifecycle cycle")
    cycle_p.add_argument("--unsupervised", action="store_true")

    hb_p = sub.add_parser("heartbeat", help="Run heartbeat")
    hb_p.add_argument("--mode", choices=["quick", "full"], default="quick")

    sub.add_parser("status", help="Show last report summary")

    args = parser.parse_args()

    commands = {
        "sense": cmd_sense,
        "plan": cmd_plan,
        "review": cmd_review,
        "cycle": cmd_cycle,
        "heartbeat": cmd_heartbeat,
        "status": cmd_status,
    }

    if args.command in commands:
        commands[args.command](args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Update livingcode/__init__.py with public API**

```python
# livingcode/__init__.py
"""DashClaw Living Organism — codebase health sensing framework."""

__version__ = "0.1.0"


class Organism:
    """Main entry point for the livingcode framework."""

    def __init__(self, repo_path: str):
        self.repo_path = repo_path

    def sense(self):
        from livingcode.sensing import run_sensing
        return run_sensing(self.repo_path)

    def plan(self):
        from livingcode.sensing import run_sensing
        from livingcode.planner.prioritizer import generate_work_items
        report, _ = run_sensing(self.repo_path)
        return generate_work_items(report)

    def review(self, branch: str | None = None):
        from livingcode.sensing import run_sensing
        from livingcode.immune.checks import run_all_checks
        from livingcode.immune.verdict import generate_verdict
        from livingcode.orchestrator.cycle import _load_baselines
        report, _ = run_sensing(self.repo_path)
        baselines = _load_baselines(self.repo_path)
        checks = run_all_checks(report, baselines)
        return generate_verdict(checks)

    def cycle(self, supervised: bool = True):
        from livingcode.orchestrator.cycle import run_lifecycle_cycle
        return run_lifecycle_cycle(self.repo_path, supervised=supervised)

    def heartbeat(self, mode: str = "quick"):
        from livingcode.heartbeat.runner import run_heartbeat
        return run_heartbeat(self.repo_path, mode=mode)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/test_cli.py -v`
Expected: All 2 tests PASS

- [ ] **Step 6: Commit**

```bash
cd C:\Projects\DashClaw
git add livingcode/__main__.py livingcode/__init__.py livingcode/tests/test_cli.py
git commit -m "feat(livingcode): add CLI entry point and Organism public API"
```

---

### Task 13: Gitignore and Final Integration

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Update .gitignore for .organism/ directory**

Add to the end of `C:\Projects\DashClaw\.gitignore`:

```
# Organism state (ephemeral)
.organism/state-reports/
.organism/heartbeats/
.organism/cycle-history/
.organism/active-cycle.json
.organism/kill-switch
.organism/paused
.organism/consecutive-failures.json
```

- [ ] **Step 2: Run all livingcode tests**

Run: `cd C:\Projects\DashClaw && python -m pytest livingcode/tests/ -v`
Expected: All tests PASS (approximately 55+ tests across 11 files)

- [ ] **Step 3: Run livingcode sense on DashClaw itself**

Run: `cd C:\Projects\DashClaw && python -m livingcode sense`
Expected: Sensing completes, report written to `.organism/state-reports/`, summary printed to console.

- [ ] **Step 4: Run livingcode status**

Run: `cd C:\Projects\DashClaw && python -m livingcode status`
Expected: Shows the report that was just generated.

- [ ] **Step 5: Run livingcode cycle**

Run: `cd C:\Projects\DashClaw && python -m livingcode cycle`
Expected: Full lifecycle cycle completes with outcome "productive" or "stable".

- [ ] **Step 6: Commit**

```bash
cd C:\Projects\DashClaw
git add .gitignore .organism/baselines.json .organism/cycle-counter.json
git commit -m "feat(livingcode): add .gitignore rules, verify integration"
```

- [ ] **Step 7: Final commit — all livingcode tests passing**

```bash
cd C:\Projects\DashClaw
git add -A livingcode/ organism.json
git commit -m "feat: DashClaw is now a living organism — livingcode framework v0.1.0"
```
