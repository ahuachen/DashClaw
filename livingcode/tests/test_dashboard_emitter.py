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

    def test_health_uses_test_file_ratio_when_pass_rate_absent(self):
        report = {
            "git_stats": {"commits_7d": 10, "bus_factor": 1},
            "test_health": {
                "js_tests": {"total": 0, "passed": 0, "failed": 0},
                "python_tests": {"total": 0, "passed": 0, "failed": 0},
                "test_file_ratio": 0.82,
                "untested_routes": ["/api/orphan-1", "/api/orphan-2"],
            },
            "code_quality": {"todo_count": 5, "files_over_300_lines": 3},
        }
        html = emit_dashboard(_make_shape(), state_report=report)
        self.assertIn("Test file ratio", html)
        self.assertIn("0.82", html)
        self.assertIn("Untested routes", html)
        self.assertIn("2", html)

    def test_health_includes_dependency_and_ci_chips(self):
        report = {
            "git_stats": {"commits_7d": 100, "bus_factor": 2,
                          "top_contributors_30d": [{"name": "Wes", "commits": 200}]},
            "dependency_health": {"js_vulnerabilities": 3, "lockfile_age_days": 42},
            "ci_health": {"pass_rate_30d": 0.94, "last_failure_reason": "timeout"},
            "code_quality": {"todo_count": 8, "files_over_300_lines": 10},
        }
        html = emit_dashboard(_make_shape(), state_report=report)
        self.assertIn("Vulnerabilities", html)
        self.assertIn(">3<", html)  # vulnerability count
        self.assertIn("Lockfile age", html)
        self.assertIn("42d", html)
        self.assertIn("CI pass 30d", html)
        self.assertIn("94.0%", html)
        self.assertIn("Top contributor", html)
        self.assertIn("Wes", html)

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

    def test_routes_grouped_by_prefix(self):
        html = emit_dashboard(_make_shape())
        self.assertIn("<summary>", html)
        self.assertIn('id="route-filter"', html)
        self.assertIn("oninput", html)

    def test_routes_filter_attribute_present_per_row(self):
        html = emit_dashboard(_make_shape())
        self.assertIn('data-path="/api/health"', html)

    def test_chip_danger_class_on_low_bus_factor(self):
        report = {"git_stats": {"commits_7d": 10, "bus_factor": 1}}
        html = emit_dashboard(_make_shape(), state_report=report)
        self.assertIn('class="cell danger"', html)

    def test_chip_danger_class_on_vulnerabilities(self):
        report = {"dependency_health": {"js_vulnerabilities": 2, "lockfile_age_days": 10}}
        html = emit_dashboard(_make_shape(), state_report=report)
        self.assertIn('class="cell danger"', html)

    def test_chip_no_danger_when_healthy(self):
        report = {
            "git_stats": {"commits_7d": 10, "bus_factor": 3},
            "dependency_health": {"js_vulnerabilities": 0, "lockfile_age_days": 10},
        }
        html = emit_dashboard(_make_shape(), state_report=report)
        self.assertNotIn('class="cell danger"', html)

    def test_chip_shows_trend_arrow_vs_previous(self):
        report = {"git_stats": {"commits_7d": 120, "bus_factor": 2}}
        prior = {"git_stats": {"commits_7d": 100, "bus_factor": 2}}
        html = emit_dashboard(_make_shape(), state_report=report, previous_state_report=prior)
        self.assertIn("↑", html)
        self.assertIn(">→<", html)

    def test_chip_trend_absent_without_previous(self):
        report = {"git_stats": {"commits_7d": 120, "bus_factor": 2}}
        html = emit_dashboard(_make_shape(), state_report=report)
        self.assertNotIn("↑", html)
        self.assertNotIn("↓", html)

    def test_timeline_extended_with_health_trends(self):
        history = [
            {"timestamp": "2026-04-10T00:00:00Z",
             "code_quality": {"todo_count": 5, "files_over_300_lines": 10},
             "dependency_health": {"lockfile_age_days": 100}},
            {"timestamp": "2026-04-15T00:00:00Z",
             "code_quality": {"todo_count": 8, "files_over_300_lines": 12},
             "dependency_health": {"lockfile_age_days": 105}},
        ]
        html = emit_dashboard(_make_shape(), state_history=history)
        self.assertIn("TODOs over time", html)
        self.assertIn("Files &gt;300 lines over time", html)
        self.assertIn("Lockfile age over time", html)

    def test_diff_kicker_summarizes_changes(self):
        diff = {"changes": [
            {"category": "routes", "action": "added", "item": "/api/new", "detail": ""},
            {"category": "routes", "action": "added", "item": "/api/new2", "detail": ""},
            {"category": "env_vars", "action": "removed", "item": "LEGACY", "detail": ""},
        ]}
        html = emit_dashboard(_make_shape(), diff=diff)
        self.assertIn("2</b> routes added", html)
        self.assertIn("1</b> env_vars removed", html)

    def test_diff_kicker_absent_without_diff(self):
        html = emit_dashboard(_make_shape())
        self.assertNotIn("since last snapshot", html)

    def test_dark_mode_styles_present(self):
        html = emit_dashboard(_make_shape())
        self.assertIn("prefers-color-scheme: dark", html)
        self.assertIn("--bg-dark", html)


if __name__ == "__main__":
    unittest.main()
