"""Tests for the skill emitter and emit dispatcher."""
import unittest

from livingcode.emit import emit, TARGETS
from livingcode.emitters.skill import emit_skill, _group_routes_by_category
from livingcode.types import EnvVarInfo, RouteInfo, ShapeModel, TableInfo


def _make_shape():
    return ShapeModel(
        timestamp="2026-04-12T00:00:00Z",
        routes=[
            RouteInfo("/api/health", ["GET"], [], False, "app/api/health/route.js"),
            RouteInfo("/api/guard/decide", ["POST"], [], False, "app/api/guard/decide/route.js"),
            RouteInfo("/api/guard/decisions", ["GET"], [], False, "app/api/guard/decisions/route.js"),
            RouteInfo("/api/actions", ["GET", "POST"], [], False, "app/api/actions/route.js"),
            RouteInfo("/api/_archive/old", ["GET"], [], True, "app/api/_archive/old/route.js"),
        ],
        env_vars=[
            EnvVarInfo("DATABASE_URL", True, ["app/lib/db.js"], True),
            EnvVarInfo("NEXTAUTH_SECRET", True, ["middleware.js"], True),
            EnvVarInfo("OPTIONAL_VAR", False, ["app/lib/x.js"], False),
        ],
        tables=[
            TableInfo("users", "schema/schema.js"),
            TableInfo("guard_policies", "schema/schema.js"),
        ],
    )


class TestSkillEmitter(unittest.TestCase):

    def test_emits_valid_markdown(self):
        output = emit_skill(_make_shape())
        self.assertTrue(output.startswith("---\n"))
        self.assertIn("name: dashclaw-platform-intelligence", output)
        self.assertIn("# DashClaw Platform Intelligence", output)

    def test_includes_timestamp(self):
        output = emit_skill(_make_shape())
        self.assertIn("2026-04-12T00:00:00Z", output)

    def test_excludes_archived_routes(self):
        output = emit_skill(_make_shape())
        self.assertIn("/api/health", output)
        self.assertIn("/api/guard/decide", output)
        self.assertNotIn("/api/_archive/old", output)

    def test_groups_routes_by_category(self):
        groups = _group_routes_by_category(_make_shape())
        self.assertIn("guard", groups)
        self.assertEqual(len(groups["guard"]), 2)
        self.assertIn("actions", groups)
        self.assertIn("health", groups)

    def test_separates_required_and_optional_env(self):
        output = emit_skill(_make_shape())
        req_idx = output.index("## Required Environment Variables")
        opt_idx = output.index("## Optional Environment Variables")
        self.assertLess(req_idx, opt_idx)
        # DATABASE_URL appears in the required section (before optional)
        req_section = output[req_idx:opt_idx]
        self.assertIn("DATABASE_URL", req_section)
        self.assertNotIn("OPTIONAL_VAR", req_section)

    def test_flags_undocumented_env_vars(self):
        output = emit_skill(_make_shape())
        self.assertIn("undocumented", output)

    def test_includes_all_tables(self):
        output = emit_skill(_make_shape())
        self.assertIn("`users`", output)
        self.assertIn("`guard_policies`", output)

    def test_instructs_to_use_live_queries(self):
        output = emit_skill(_make_shape())
        self.assertIn("python -m livingcode query", output)
        self.assertIn("prefer live queries", output.lower())

    def test_includes_drift_detection_instructions(self):
        output = emit_skill(_make_shape())
        self.assertIn("livingcode diff", output)


class TestEmitDispatcher(unittest.TestCase):

    def test_unknown_target_raises(self):
        with self.assertRaises(ValueError):
            emit("/tmp", "bogus-target")

    def test_targets_list_is_populated(self):
        self.assertIn("skill", TARGETS)


if __name__ == "__main__":
    unittest.main()
