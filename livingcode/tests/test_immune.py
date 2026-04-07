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
