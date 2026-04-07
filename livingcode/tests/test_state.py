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
