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
