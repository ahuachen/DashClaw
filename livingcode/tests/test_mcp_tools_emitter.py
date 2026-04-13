"""Tests for the mcp-tools inventory emitter."""
import json
import unittest

from livingcode.emit import TARGETS, emit
from livingcode.emitters.mcp_tools import emit_mcp_tools
from livingcode.types import EnvVarInfo, RouteInfo, ShapeModel, TableInfo


def _make_shape():
    return ShapeModel(
        timestamp="2026-04-12T00:00:00Z",
        routes=[
            RouteInfo("/api/health", ["GET"], [], False, "app/api/health/route.js"),
            RouteInfo(
                "/api/actions",
                ["GET", "POST"],
                [],
                False,
                "app/api/actions/route.js",
            ),
            RouteInfo(
                "/api/actions/[actionId]",
                ["GET", "PATCH"],
                ["actionId"],
                False,
                "app/api/actions/[actionId]/route.js",
            ),
            RouteInfo(
                "/api/_archive/old",
                ["GET"],
                [],
                True,
                "app/api/_archive/old/route.js",
            ),
        ],
        env_vars=[EnvVarInfo("DATABASE_URL", True, ["app/lib/db.js"], True)],
        tables=[TableInfo("guard_policies", "schema/schema.js")],
    )


class TestMcpToolsEmitter(unittest.TestCase):

    def test_emits_valid_json(self):
        parsed = json.loads(emit_mcp_tools(_make_shape()))
        self.assertIn("all_routes", parsed)
        self.assertIn("mutation_routes", parsed)
        self.assertIn("read_routes", parsed)

    def test_excludes_archived_routes(self):
        parsed = json.loads(emit_mcp_tools(_make_shape()))
        paths = {r["path"] for r in parsed["all_routes"]}
        self.assertNotIn("/api/_archive/old", paths)

    def test_counts_only_active_routes(self):
        parsed = json.loads(emit_mcp_tools(_make_shape()))
        self.assertEqual(parsed["total_active_routes"], 3)

    def test_mutation_routes_contain_post_patch_put_delete(self):
        parsed = json.loads(emit_mcp_tools(_make_shape()))
        mutation_paths = {r["path"] for r in parsed["mutation_routes"]}
        self.assertIn("/api/actions", mutation_paths)
        self.assertIn("/api/actions/[actionId]", mutation_paths)
        self.assertNotIn("/api/health", mutation_paths)

    def test_read_routes_contain_get_only_endpoints(self):
        parsed = json.loads(emit_mcp_tools(_make_shape()))
        read_paths = {r["path"] for r in parsed["read_routes"]}
        self.assertIn("/api/health", read_paths)

    def test_preserves_dynamic_params(self):
        parsed = json.loads(emit_mcp_tools(_make_shape()))
        entry = next(
            r for r in parsed["mutation_routes"] if r["path"] == "/api/actions/[actionId]"
        )
        self.assertEqual(entry["dynamic_params"], ["actionId"])

    def test_note_warns_against_regeneration_of_tools_js(self):
        parsed = json.loads(emit_mcp_tools(_make_shape()))
        self.assertIn("hand-", parsed["note"])
        self.assertIn("tools.js", parsed["note"])

    def test_output_is_deterministic(self):
        a = emit_mcp_tools(_make_shape())
        b = emit_mcp_tools(_make_shape())
        self.assertEqual(a, b)


class TestEmitDispatcherForMcpTools(unittest.TestCase):

    def test_mcp_tools_is_registered_target(self):
        self.assertIn("mcp-tools", TARGETS)

    def test_dispatcher_rejects_unknown_target(self):
        with self.assertRaises(ValueError):
            emit("/tmp", "bogus-target")


if __name__ == "__main__":
    unittest.main()
