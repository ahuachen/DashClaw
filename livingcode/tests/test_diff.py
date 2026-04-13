"""Tests for shape diff — snapshot saving, loading, and change detection."""
import json
import os
import tempfile
import unittest

from livingcode.diff import compute_diff, save_snapshot, load_latest_snapshot, format_diff
from livingcode.types import (
    EnvVarInfo,
    RouteInfo,
    ShapeChange,
    ShapeDiff,
    ShapeModel,
    TableInfo,
)


def _make_shape(
    routes=None, env_vars=None, tables=None, timestamp="2026-01-01T00:00:00Z"
):
    return ShapeModel(
        timestamp=timestamp,
        routes=routes or [],
        env_vars=env_vars or [],
        tables=tables or [],
    )


class TestComputeDiff(unittest.TestCase):

    def test_no_changes(self):
        shape = _make_shape(
            routes=[RouteInfo("/api/health", ["GET"], [], False, "app/api/health/route.js")],
        )
        diff = compute_diff(shape, shape)
        self.assertEqual(diff.changes, [])

    def test_route_added(self):
        old = _make_shape()
        new = _make_shape(
            routes=[RouteInfo("/api/doctor", ["GET", "POST"], [], False, "app/api/doctor/route.js")],
        )
        diff = compute_diff(old, new)
        self.assertEqual(len(diff.changes), 1)
        self.assertEqual(diff.changes[0].action, "added")
        self.assertEqual(diff.changes[0].item, "/api/doctor")
        self.assertIn("GET, POST", diff.changes[0].detail)

    def test_route_removed(self):
        old = _make_shape(
            routes=[RouteInfo("/api/old", ["GET"], [], False, "app/api/old/route.js")],
        )
        new = _make_shape()
        diff = compute_diff(old, new)
        self.assertEqual(len(diff.changes), 1)
        self.assertEqual(diff.changes[0].action, "removed")
        self.assertEqual(diff.changes[0].item, "/api/old")

    def test_route_methods_changed(self):
        old = _make_shape(
            routes=[RouteInfo("/api/actions", ["GET"], [], False, "app/api/actions/route.js")],
        )
        new = _make_shape(
            routes=[RouteInfo("/api/actions", ["GET", "POST"], [], False, "app/api/actions/route.js")],
        )
        diff = compute_diff(old, new)
        self.assertEqual(len(diff.changes), 1)
        self.assertEqual(diff.changes[0].action, "changed")
        self.assertIn("GET -> GET, POST", diff.changes[0].detail)

    def test_env_var_added(self):
        old = _make_shape()
        new = _make_shape(
            env_vars=[EnvVarInfo("NEW_VAR", False, ["app/lib/x.js"], True)],
        )
        diff = compute_diff(old, new)
        self.assertEqual(len(diff.changes), 1)
        self.assertEqual(diff.changes[0].category, "env_vars")
        self.assertEqual(diff.changes[0].action, "added")
        self.assertEqual(diff.changes[0].item, "NEW_VAR")

    def test_env_var_removed(self):
        old = _make_shape(
            env_vars=[EnvVarInfo("OLD_VAR", False, ["app/lib/x.js"], False)],
        )
        new = _make_shape()
        diff = compute_diff(old, new)
        self.assertEqual(len(diff.changes), 1)
        self.assertEqual(diff.changes[0].action, "removed")

    def test_env_var_required_changed(self):
        old = _make_shape(
            env_vars=[EnvVarInfo("DB_URL", False, ["db.js"], True)],
        )
        new = _make_shape(
            env_vars=[EnvVarInfo("DB_URL", True, ["db.js"], True)],
        )
        diff = compute_diff(old, new)
        self.assertEqual(len(diff.changes), 1)
        self.assertEqual(diff.changes[0].action, "changed")
        self.assertIn("required", diff.changes[0].detail)

    def test_table_added(self):
        old = _make_shape()
        new = _make_shape(tables=[TableInfo("new_table", "schema/schema.js")])
        diff = compute_diff(old, new)
        self.assertEqual(len(diff.changes), 1)
        self.assertEqual(diff.changes[0].category, "tables")
        self.assertEqual(diff.changes[0].item, "new_table")

    def test_table_removed(self):
        old = _make_shape(tables=[TableInfo("old_table", "schema/schema.js")])
        new = _make_shape()
        diff = compute_diff(old, new)
        self.assertEqual(len(diff.changes), 1)
        self.assertEqual(diff.changes[0].action, "removed")

    def test_multiple_changes(self):
        old = _make_shape(
            routes=[RouteInfo("/api/old", ["GET"], [], False, "x")],
            env_vars=[EnvVarInfo("REMOVED_VAR", False, ["x.js"], False)],
            tables=[TableInfo("users", "schema/schema.js")],
        )
        new = _make_shape(
            routes=[
                RouteInfo("/api/old", ["GET"], [], False, "x"),
                RouteInfo("/api/new", ["POST"], [], False, "y"),
            ],
            env_vars=[EnvVarInfo("ADDED_VAR", True, ["y.js"], True)],
            tables=[TableInfo("users", "schema/schema.js"), TableInfo("sessions", "schema/schema.js")],
        )
        diff = compute_diff(old, new)
        # 1 route added, 1 env removed, 1 env added, 1 table added = 4
        self.assertEqual(len(diff.changes), 4)


class TestSnapshotPersistence(unittest.TestCase):

    def test_save_and_load_roundtrip(self):
        tmpdir = tempfile.mkdtemp()
        # Create minimal app/api structure so route collector runs
        api_dir = os.path.join(tmpdir, "app", "api", "health")
        os.makedirs(api_dir)
        with open(os.path.join(api_dir, "route.js"), "w") as f:
            f.write("export async function GET(req) { }\n")

        path = save_snapshot(tmpdir)
        self.assertTrue(os.path.isfile(path))

        loaded = load_latest_snapshot(tmpdir)
        self.assertIsNotNone(loaded)
        self.assertEqual(len(loaded.routes), 1)
        self.assertEqual(loaded.routes[0].path, "/api/health")

    def test_load_no_snapshot(self):
        tmpdir = tempfile.mkdtemp()
        self.assertIsNone(load_latest_snapshot(tmpdir))


class TestFormatDiff(unittest.TestCase):

    def test_no_changes(self):
        diff = ShapeDiff("t1", "t2", [])
        output = format_diff(diff)
        self.assertIn("No shape changes", output)

    def test_formats_changes(self):
        diff = ShapeDiff("t1", "t2", [
            ShapeChange("routes", "added", "/api/new", "New route: GET"),
            ShapeChange("tables", "removed", "old_table", "Table removed from schema"),
        ])
        output = format_diff(diff)
        self.assertIn("+ /api/new", output)
        self.assertIn("- old_table", output)
        self.assertIn("1 added", output)
        self.assertIn("1 removed", output)


if __name__ == "__main__":
    unittest.main()
