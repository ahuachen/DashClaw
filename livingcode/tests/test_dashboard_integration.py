"""End-to-end test: dashboard emit with context from disk."""
import json
import tempfile
import unittest
from pathlib import Path

from livingcode.emit import emit


class TestDashboardWithContext(unittest.TestCase):

    def test_emit_dashboard_reads_snapshots_and_state_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            (repo / "app" / "api" / "health").mkdir(parents=True)
            (repo / "app" / "api" / "health" / "route.js").write_text(
                "export async function GET(){return new Response('ok')}\n"
            )
            (repo / "schema").mkdir()
            (repo / "schema" / "schema.js").write_text("")
            (repo / ".env.example").write_text("")

            # Fake snapshot
            snapdir = repo / ".organism" / "shape-snapshots"
            snapdir.mkdir(parents=True)
            (snapdir / "2026-04-01T00-00-00.json").write_text(json.dumps({
                "timestamp": "2026-04-01T00:00:00Z",
                "routes": [{"path": "/api/health", "methods": ["GET"],
                            "dynamic_params": [], "archived": False,
                            "file_path": "app/api/health/route.js"}],
                "env_vars": [], "tables": [], "setting_keys": [],
                "events": [], "adapters": [], "signal_types": [],
            }))

            # Fake state report
            rptdir = repo / ".organism" / "state-reports"
            rptdir.mkdir(parents=True)
            (rptdir / "2026-04-10T00-00-00.json").write_text(json.dumps({
                "organism": "dashclaw",
                "timestamp": "2026-04-10T00:00:00Z",
                "collector_status": {},
                "git_stats": {"commits_7d": 10, "bus_factor": 1,
                              "commits_30d": 50, "active_branches": 2,
                              "stale_branches": 0, "top_contributors_30d": [],
                              "files_changed_7d": 5},
                "test_health": None, "code_quality": None,
                "dependency_health": None, "ci_health": None,
            }))

            html = emit(str(repo), "dashboard", with_context=True)
            self.assertIn("Commits 7d", html)
            self.assertIn("10", html)


class TestEmitKeywordValidation(unittest.TestCase):
    def test_unknown_kwarg_raises_typeerror(self):
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            (repo / "app" / "api").mkdir(parents=True)
            (repo / "schema").mkdir()
            (repo / "schema" / "schema.js").write_text("")
            (repo / ".env.example").write_text("")
            with self.assertRaises(TypeError):
                emit(str(repo), "dashboard", with_contxt=True)  # typo


if __name__ == "__main__":
    unittest.main()
