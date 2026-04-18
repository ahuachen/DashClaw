"""Tests for the dashboard HTML emitter."""
import unittest

from livingcode.emit import TARGETS
from livingcode.emitters.dashboard import emit_dashboard
from livingcode.types import (
    AdapterInfo, EnvVarInfo, EventInfo, RouteInfo,
    SettingKeyInfo, ShapeModel, TableInfo,
)


def _make_shape():
    return ShapeModel(
        timestamp="sha1:deadbeef",
        routes=[
            RouteInfo("/api/health", ["GET"], [], False, "app/api/health/route.js"),
            RouteInfo("/api/actions", ["GET", "POST"], [], False, "app/api/actions/route.js"),
            RouteInfo("/api/_archive/old", ["GET"], [], True, "app/api/_archive/old/route.js"),
        ],
        env_vars=[
            EnvVarInfo("DATABASE_URL", True, ["app/lib/db.js"], True),
            EnvVarInfo("OPTIONAL_KEY", False, ["app/lib/x.js"], True),
        ],
        tables=[TableInfo("guard_policies", "schema/schema.js", domain="governance")],
        setting_keys=[SettingKeyInfo("ai_default_model", section="AI Providers")],
        events=[EventInfo("ACTION_COST_EXCEEDED", "action.cost_exceeded")],
        adapters=[AdapterInfo("slack", ["SLACK_WEBHOOK_URL"])],
        signal_types=["cost_alert", "provider_health"],
    )


class TestDashboardEmitter(unittest.TestCase):

    def test_registered_target(self):
        self.assertIn("dashboard", TARGETS)

    def test_emits_html_document(self):
        html = emit_dashboard(_make_shape())
        self.assertTrue(html.startswith("<!doctype html>"))
        self.assertIn("</html>", html)

    def test_includes_shape_signature(self):
        html = emit_dashboard(_make_shape())
        self.assertIn("sha1:deadbeef", html)

    def test_counts_active_routes_only(self):
        html = emit_dashboard(_make_shape())
        self.assertIn(">2<", html)  # 2 active routes (archived excluded)

    def test_counts_required_env_vars(self):
        html = emit_dashboard(_make_shape())
        self.assertIn("Required env vars", html)

    def test_output_is_deterministic(self):
        a = emit_dashboard(_make_shape())
        b = emit_dashboard(_make_shape())
        self.assertEqual(a, b)

    def test_renders_timeline_with_snapshots(self):
        snapshots = [
            {"timestamp": "2026-04-10T00:00:00Z", "routes": [{"archived": False}] * 50,
             "env_vars": [{"required": True}] * 10, "tables": [{}] * 5,
             "events": [], "adapters": [], "signal_types": [], "setting_keys": []},
            {"timestamp": "2026-04-15T00:00:00Z", "routes": [{"archived": False}] * 55,
             "env_vars": [{"required": True}] * 12, "tables": [{}] * 6,
             "events": [], "adapters": [], "signal_types": [], "setting_keys": []},
        ]
        html = emit_dashboard(_make_shape(), snapshots=snapshots)
        self.assertIn("<svg", html)
        self.assertIn("Active routes over time", html)

    def test_timeline_absent_without_snapshots(self):
        html = emit_dashboard(_make_shape(), snapshots=[])
        self.assertNotIn("<svg", html)
        self.assertNotIn("<h2>Timeline</h2>", html)

    def test_timeline_absent_with_single_snapshot(self):
        snapshots = [
            {"timestamp": "2026-04-10T00:00:00Z", "routes": [{"archived": False}] * 50,
             "env_vars": [{"required": True}] * 10, "tables": [{}] * 5,
             "events": [], "adapters": [], "signal_types": [], "setting_keys": []},
        ]
        html = emit_dashboard(_make_shape(), snapshots=snapshots)
        self.assertNotIn("<h2>Timeline</h2>", html)

    def test_renders_health_strip(self):
        report = {
            "git_stats": {"commits_7d": 148, "bus_factor": 1},
            "test_health": {
                "js_tests": {"total": 500, "passed": 495, "failed": 5},
                "python_tests": {"total": 80, "passed": 80, "failed": 0},
            },
            "code_quality": {"todo_count": 42, "files_over_300_lines": 7},
        }
        html = emit_dashboard(_make_shape(), state_report=report)
        self.assertIn("Commits 7d", html)
        self.assertIn("148", html)
        self.assertIn("99.0%", html)  # JS pass rate 495/500

    def test_health_strip_absent_without_report(self):
        html = emit_dashboard(_make_shape())
        self.assertNotIn("Commits 7d", html)

    def test_lists_active_routes_in_table(self):
        html = emit_dashboard(_make_shape())
        self.assertIn("/api/health", html)
        self.assertIn("/api/actions", html)
        self.assertNotIn("/api/_archive/old", html)

    def test_renders_diff_when_provided(self):
        diff = {
            "changes": [
                {"category": "routes", "action": "added", "item": "/api/new", "detail": "methods: GET"},
                {"category": "env_vars", "action": "removed", "item": "LEGACY_KEY", "detail": ""},
            ]
        }
        html = emit_dashboard(_make_shape(), diff=diff)
        self.assertIn("Changed since last snapshot", html)
        self.assertIn("/api/new", html)
        self.assertIn("LEGACY_KEY", html)

    def test_tables_details_present(self):
        html = emit_dashboard(_make_shape())
        self.assertIn("<summary>Tables (1)</summary>", html)
        self.assertIn("guard_policies", html)

    def test_events_details_present(self):
        html = emit_dashboard(_make_shape())
        self.assertIn("<summary>Events (1)</summary>", html)
        self.assertIn("action.cost_exceeded", html)

    def test_adapters_details_present(self):
        html = emit_dashboard(_make_shape())
        self.assertIn("<summary>Adapters (1)</summary>", html)
        self.assertIn("SLACK_WEBHOOK_URL", html)

    def test_signals_details_present(self):
        html = emit_dashboard(_make_shape())
        self.assertIn("<summary>Signals (2)</summary>", html)
        self.assertIn("cost_alert", html)

    def test_setting_keys_details_present(self):
        html = emit_dashboard(_make_shape())
        self.assertIn("<summary>Setting keys (1)</summary>", html)
        self.assertIn("ai_default_model", html)
        self.assertIn("AI Providers", html)


if __name__ == "__main__":
    unittest.main()
