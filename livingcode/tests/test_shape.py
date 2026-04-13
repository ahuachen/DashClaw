"""Tests for shape collectors — routes, env vars, schema, and the query interface."""
import os
import tempfile
import unittest

from livingcode.types import RouteInfo, EnvVarInfo, TableInfo, ShapeModel


class TestRouteCollector(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        # Build a mini app/api/ tree
        api = os.path.join(self.tmpdir, "app", "api")
        os.makedirs(os.path.join(api, "health"))
        os.makedirs(os.path.join(api, "guard", "decide"))
        os.makedirs(os.path.join(api, "actions", "[actionId]"))
        os.makedirs(os.path.join(api, "_archive", "old"))

        # health — GET only
        with open(os.path.join(api, "health", "route.js"), "w") as f:
            f.write("export async function GET(request) { return 'ok'; }\n")

        # guard/decide — POST
        with open(os.path.join(api, "guard", "decide", "route.js"), "w") as f:
            f.write("export async function POST(request) { return 'decided'; }\n")

        # actions/[actionId] — GET + PATCH
        with open(os.path.join(api, "actions", "[actionId]", "route.js"), "w") as f:
            f.write(
                "export async function GET(request, { params }) { }\n"
                "export async function PATCH(request, { params }) { }\n"
            )

        # _archive/old — archived
        with open(os.path.join(api, "_archive", "old", "route.js"), "w") as f:
            f.write("export async function GET(request) { }\n")

    def test_finds_all_routes(self):
        from livingcode.collectors.routes import collect_routes
        routes = collect_routes(self.tmpdir)
        self.assertEqual(len(routes), 4)

    def test_extracts_methods(self):
        from livingcode.collectors.routes import collect_routes
        routes = {r.path: r for r in collect_routes(self.tmpdir)}
        self.assertEqual(routes["/api/health"].methods, ["GET"])
        self.assertEqual(routes["/api/guard/decide"].methods, ["POST"])
        self.assertEqual(routes["/api/actions/[actionId]"].methods, ["GET", "PATCH"])

    def test_detects_dynamic_params(self):
        from livingcode.collectors.routes import collect_routes
        routes = {r.path: r for r in collect_routes(self.tmpdir)}
        self.assertEqual(routes["/api/actions/[actionId]"].dynamic_params, ["actionId"])
        self.assertEqual(routes["/api/health"].dynamic_params, [])

    def test_detects_archived(self):
        from livingcode.collectors.routes import collect_routes
        routes = {r.path: r for r in collect_routes(self.tmpdir)}
        self.assertFalse(routes["/api/health"].archived)
        self.assertTrue(routes["/api/_archive/old"].archived)

    def test_empty_api_dir(self):
        from livingcode.collectors.routes import collect_routes
        empty = tempfile.mkdtemp()
        self.assertEqual(collect_routes(empty), [])


class TestEnvVarCollector(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        # A JS file referencing env vars
        os.makedirs(os.path.join(self.tmpdir, "app", "lib"))
        with open(os.path.join(self.tmpdir, "app", "lib", "db.js"), "w") as f:
            f.write("const url = process.env.DATABASE_URL;\n")
            f.write("const secret = process.env.NEXTAUTH_SECRET;\n")
            f.write("const opt = process.env.SOME_OPTIONAL || 'default';\n")

        # .env.example documenting some vars
        with open(os.path.join(self.tmpdir, ".env.example"), "w") as f:
            f.write("DATABASE_URL=postgresql://...\n")
            f.write("NEXTAUTH_SECRET=change-me\n")
            f.write("# SOME_OPTIONAL is optional\n")

    def test_finds_env_vars(self):
        from livingcode.collectors.env_vars import collect_env_vars
        env = collect_env_vars(self.tmpdir)
        names = {e.name for e in env}
        self.assertIn("DATABASE_URL", names)
        self.assertIn("NEXTAUTH_SECRET", names)
        self.assertIn("SOME_OPTIONAL", names)

    def test_marks_required(self):
        from livingcode.collectors.env_vars import collect_env_vars
        env = {e.name: e for e in collect_env_vars(self.tmpdir)}
        self.assertTrue(env["DATABASE_URL"].required)
        self.assertTrue(env["NEXTAUTH_SECRET"].required)
        self.assertFalse(env["SOME_OPTIONAL"].required)

    def test_marks_documented(self):
        from livingcode.collectors.env_vars import collect_env_vars
        env = {e.name: e for e in collect_env_vars(self.tmpdir)}
        self.assertTrue(env["DATABASE_URL"].in_env_example)
        # SOME_OPTIONAL is only in a comment, not as a key=value
        self.assertFalse(env["SOME_OPTIONAL"].in_env_example)

    def test_tracks_files(self):
        from livingcode.collectors.env_vars import collect_env_vars
        env = {e.name: e for e in collect_env_vars(self.tmpdir)}
        self.assertIn("app/lib/db.js", env["DATABASE_URL"].files)


class TestSchemaCollector(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()
        os.makedirs(os.path.join(self.tmpdir, "schema"))
        with open(os.path.join(self.tmpdir, "schema", "schema.js"), "w") as f:
            f.write(
                "export const users = pgTable('users', { id: serial() });\n"
                "export const apiKeys = pgTable('api_keys', { id: serial() });\n"
                "export const actions = pgTable('action_records', { id: serial() });\n"
            )

    def test_finds_tables(self):
        from livingcode.collectors.schema import collect_schema
        tables = collect_schema(self.tmpdir)
        names = [t.name for t in tables]
        self.assertEqual(names, ["action_records", "api_keys", "users"])

    def test_no_schema_file(self):
        from livingcode.collectors.schema import collect_schema
        empty = tempfile.mkdtemp()
        self.assertEqual(collect_schema(empty), [])


class TestShapeModel(unittest.TestCase):

    def test_shape_types(self):
        model = ShapeModel(
            timestamp="2026-04-12T00:00:00Z",
            routes=[RouteInfo("/api/health", ["GET"], [], False, "app/api/health/route.js")],
            env_vars=[EnvVarInfo("DATABASE_URL", True, ["app/lib/db.js"], True)],
            tables=[TableInfo("users", "schema/schema.js")],
        )
        self.assertEqual(len(model.routes), 1)
        self.assertEqual(len(model.env_vars), 1)
        self.assertEqual(len(model.tables), 1)


if __name__ == "__main__":
    unittest.main()
