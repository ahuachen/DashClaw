import json
import os
import tempfile
import unittest
from pathlib import Path
from livingcode.types import (
    StateReport, CollectorStatus, GitStatsReport, TestHealthReport,
    TestSuiteResult, CodeQualityReport, DependencyHealthReport,
    CIHealthReport, FileInfo,
)


def _make_report(**overrides):
    defaults = dict(
        organism="dashclaw",
        timestamp="2026-04-07T06:30:00Z",
        collector_status={k: CollectorStatus.OK for k in
                          ["git_stats", "test_health", "code_quality", "dependency_health", "ci_health"]},
        git_stats=GitStatsReport(14, 48, 3, 1, 1, [{"name": "Wes", "commits": 46}], 87),
        test_health=TestHealthReport(
            TestSuiteResult(107, 107, 0), TestSuiteResult(12, 12, 0), 0.42,
            ["api/cron/signals", "api/cron/reset-meters"],
        ),
        code_quality=CodeQualityReport(
            12, [FileInfo("app/docs/page.js", 1703), FileInfo("app/policies/page.js", 1504)],
            "pass", 1, 16, 245,
        ),
        dependency_health=DependencyHealthReport(25, 3, 2, 0, 2),
        ci_health=CIHealthReport(0.94, ["pass"] * 10, None, None, 11),
    )
    defaults.update(overrides)
    return StateReport(**defaults)


class TestPrioritizer(unittest.TestCase):

    def test_generates_work_items_from_report(self):
        from livingcode.planner.prioritizer import generate_work_items
        report = _make_report()
        items = generate_work_items(report)
        self.assertGreater(len(items), 0)

    def test_tier1_for_vulnerabilities(self):
        from livingcode.planner.prioritizer import generate_work_items
        report = _make_report()
        items = generate_work_items(report)
        vuln_items = [i for i in items if i.tier == 1]
        self.assertGreater(len(vuln_items), 0)

    def test_tier3_for_untested_routes(self):
        from livingcode.planner.prioritizer import generate_work_items
        report = _make_report()
        items = generate_work_items(report)
        untested = [i for i in items if "untested" in i.title.lower()]
        self.assertGreater(len(untested), 0)

    def test_tier4_for_bus_factor(self):
        from livingcode.planner.prioritizer import generate_work_items
        report = _make_report()
        items = generate_work_items(report)
        bus = [i for i in items if "bus factor" in i.title.lower()]
        self.assertGreater(len(bus), 0)

    def test_max_10_items(self):
        from livingcode.planner.prioritizer import generate_work_items
        report = _make_report()
        items = generate_work_items(report, max_items=10)
        self.assertLessEqual(len(items), 10)

    def test_sorted_by_tier(self):
        from livingcode.planner.prioritizer import generate_work_items
        report = _make_report()
        items = generate_work_items(report)
        tiers = [i.tier for i in items]
        self.assertEqual(tiers, sorted(tiers))


class TestBacklog(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_write_backlog_item(self):
        from livingcode.planner.backlog import write_backlog_item
        from livingcode.types import WorkItem
        from livingcode.state import ensure_organism_dir
        ensure_organism_dir(self.tmpdir)
        item = WorkItem(
            id="wk-001", tier=2, title="Test", description="Desc",
            affected_files=[], metric="test", status="proposed",
        )
        path = write_backlog_item(self.tmpdir, item)
        self.assertTrue(Path(path).exists())
        with open(path) as f:
            data = json.load(f)
        self.assertEqual(data["id"], "wk-001")

    def test_read_backlog_items(self):
        from livingcode.planner.backlog import write_backlog_item, read_backlog_items
        from livingcode.types import WorkItem
        from livingcode.state import ensure_organism_dir
        ensure_organism_dir(self.tmpdir)
        for i in range(3):
            write_backlog_item(self.tmpdir, WorkItem(
                id=f"wk-{i}", tier=i+1, title=f"Item {i}", description="",
                affected_files=[], metric="test", status="proposed",
            ))
        items = read_backlog_items(self.tmpdir)
        self.assertEqual(len(items), 3)


if __name__ == "__main__":
    unittest.main()
