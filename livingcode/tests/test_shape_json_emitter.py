"""Tests for the shape-json emitter."""
import json
import unittest

from livingcode.emit import TARGETS, emit
from livingcode.emitters.shape_json import emit_shape_json
from livingcode.types import EnvVarInfo, RouteInfo, ShapeModel, TableInfo


def _make_shape():
    return ShapeModel(
        timestamp="2026-04-12T00:00:00Z",
        routes=[
            RouteInfo("/api/health", ["GET"], [], False, "app/api/health/route.js"),
            RouteInfo("/api/_archive/old", ["GET"], [], True, "app/api/_archive/old/route.js"),
        ],
        env_vars=[
            EnvVarInfo("DATABASE_URL", True, ["app/lib/db.js"], True),
            EnvVarInfo("OPTIONAL_VAR", False, ["app/lib/x.js"], False),
        ],
        tables=[
            TableInfo("guard_policies", "schema/schema.js"),
            TableInfo("users", "schema/schema.js"),
        ],
    )


class TestShapeJsonEmitter(unittest.TestCase):

    def test_emits_valid_json(self):
        output = emit_shape_json(_make_shape())
        parsed = json.loads(output)  # Will raise if invalid
        self.assertIsInstance(parsed, dict)

    def test_top_level_keys_present(self):
        parsed = json.loads(emit_shape_json(_make_shape()))
        for key in ("timestamp", "routes", "env_vars", "tables"):
            self.assertIn(key, parsed)

    def test_timestamp_is_deterministic_content_signature(self):
        # The emitter replaces the wall-clock timestamp with a content-hash
        # signature so pre-commit diffs stay empty when nothing changed.
        a = json.loads(emit_shape_json(_make_shape()))
        b = json.loads(emit_shape_json(_make_shape()))
        self.assertEqual(a["timestamp"], b["timestamp"])
        self.assertTrue(a["timestamp"].startswith("sha1:"))

    def test_timestamp_changes_when_content_changes(self):
        base = _make_shape()
        mutated = _make_shape()
        mutated.tables.append(TableInfo("new_table", "schema/schema.js"))
        a = json.loads(emit_shape_json(base))
        b = json.loads(emit_shape_json(mutated))
        self.assertNotEqual(a["timestamp"], b["timestamp"])

    def test_routes_are_serialized_with_all_fields(self):
        parsed = json.loads(emit_shape_json(_make_shape()))
        self.assertEqual(len(parsed["routes"]), 2)
        route = parsed["routes"][0]
        for field in ("path", "methods", "dynamic_params", "archived", "file_path"):
            self.assertIn(field, route)

    def test_env_vars_preserve_required_and_documented(self):
        parsed = json.loads(emit_shape_json(_make_shape()))
        required = next(e for e in parsed["env_vars"] if e["name"] == "DATABASE_URL")
        self.assertTrue(required["required"])
        self.assertTrue(required["in_env_example"])
        optional = next(e for e in parsed["env_vars"] if e["name"] == "OPTIONAL_VAR")
        self.assertFalse(optional["required"])

    def test_tables_serialize_name_and_file(self):
        parsed = json.loads(emit_shape_json(_make_shape()))
        names = {t["name"] for t in parsed["tables"]}
        self.assertEqual(names, {"guard_policies", "users"})
        self.assertTrue(all("file_path" in t for t in parsed["tables"]))

    def test_output_ends_with_newline(self):
        output = emit_shape_json(_make_shape())
        self.assertTrue(output.endswith("\n"))

    def test_pretty_printed(self):
        output = emit_shape_json(_make_shape())
        self.assertIn("\n", output)
        self.assertIn("  ", output)


class TestEmitDispatcherForShapeJson(unittest.TestCase):

    def test_shape_json_is_registered_target(self):
        self.assertIn("shape-json", TARGETS)

    def test_dispatcher_rejects_unknown_target(self):
        with self.assertRaises(ValueError):
            emit("/tmp", "bogus-target")


if __name__ == "__main__":
    unittest.main()
