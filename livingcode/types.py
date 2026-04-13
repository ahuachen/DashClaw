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


# --- Shape model types (what the codebase IS, not how healthy it is) ---


@dataclass
class RouteInfo:
    path: str
    methods: list[str]
    dynamic_params: list[str]
    archived: bool
    file_path: str


@dataclass
class EnvVarInfo:
    name: str
    required: bool
    files: list[str]
    in_env_example: bool


@dataclass
class TableInfo:
    name: str
    file_path: str
    # Optional functional domain ("governance", "messaging", ...) sourced from
    # `// @domain <name>` comments directly above `pgTable(...)` calls in
    # schema.js. None when unannotated. Lets shape.mjs filter by domain
    # without a hand-maintained lookup.
    domain: str | None = None


@dataclass
class ShapeModel:
    timestamp: str
    routes: list[RouteInfo]
    env_vars: list[EnvVarInfo]
    tables: list[TableInfo]


@dataclass
class ShapeChange:
    category: str  # "routes", "env_vars", "tables"
    action: str  # "added", "removed", "changed"
    item: str  # route path, env var name, or table name
    detail: str  # human-readable description


@dataclass
class ShapeDiff:
    previous_timestamp: str
    current_timestamp: str
    changes: list[ShapeChange]
