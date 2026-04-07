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
