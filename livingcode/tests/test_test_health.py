import unittest
from unittest.mock import patch


class TestTestHealthCollector(unittest.TestCase):

    @patch("livingcode.collectors.test_health._run_command")
    @patch("livingcode.collectors.test_health._find_untested_routes")
    @patch("livingcode.collectors.test_health._count_test_files")
    def test_collects_js_test_results(self, mock_count, mock_untested, mock_cmd):
        from livingcode.collectors.test_health import collect_test_health
        mock_cmd.side_effect = [
            (0, "Tests  107 passed (107)\nDuration  12.34s"),
            (0, "12 passed in 3.45s"),
        ]
        mock_count.return_value = (107, 250)
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
