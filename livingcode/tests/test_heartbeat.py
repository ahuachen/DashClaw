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
