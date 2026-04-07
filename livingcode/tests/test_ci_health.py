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
            (0, json.dumps(runs)),
            (0, json.dumps(runs[:10])),
            (0, ""),
        ]
        result = collect_ci_health("/fake/repo")
        self.assertGreater(result.pass_rate_30d, 0.5)
        self.assertEqual(result.gate_count, 0)

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
