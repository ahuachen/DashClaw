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
