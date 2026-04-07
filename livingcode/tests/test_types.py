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
