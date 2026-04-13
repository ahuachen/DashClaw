"""Tests for the doctor-checks emitter."""
import unittest

from livingcode.emit import TARGETS, emit
from livingcode.emitters.doctor_checks import FIXABLE_ENV_VARS, emit_doctor_checks
from livingcode.types import EnvVarInfo, RouteInfo, ShapeModel, TableInfo


def _make_shape(*, tables=None, env_vars=None):
    return ShapeModel(
        timestamp="2026-04-12T00:00:00Z",
        routes=[
            RouteInfo("/api/health", ["GET"], [], False, "app/api/health/route.js"),
        ],
        env_vars=env_vars
        if env_vars is not None
        else [
            EnvVarInfo("DATABASE_URL", True, ["app/lib/db.js"], True),
            EnvVarInfo("NEXTAUTH_SECRET", True, ["middleware.js"], True),
            EnvVarInfo("ENCRYPTION_KEY", True, ["app/lib/crypto.js"], True),
            EnvVarInfo("DASHCLAW_API_KEY", True, ["app/lib/auth.js"], True),
            EnvVarInfo("OPTIONAL_VAR", False, ["app/lib/x.js"], False),
        ],
        tables=tables
        if tables is not None
        else [
            TableInfo("guard_policies", "schema/schema.js"),
            TableInfo("action_records", "schema/schema.js"),
            TableInfo("api_keys", "schema/schema.js"),
        ],
    )


class TestDoctorChecksEmitter(unittest.TestCase):

    def test_emits_valid_esm_module(self):
        output = emit_doctor_checks(_make_shape())
        self.assertIn("export async function runShapeChecks", output)
        self.assertIn("import { getSql }", output)
        self.assertIn("import { getSetupStatus }", output)

    def test_emits_all_tables(self):
        output = emit_doctor_checks(_make_shape())
        for name in ("guard_policies", "action_records", "api_keys"):
            self.assertIn(f'"{name}"', output)

    def test_emits_all_required_env_vars(self):
        output = emit_doctor_checks(_make_shape())
        for name in ("DATABASE_URL", "NEXTAUTH_SECRET", "ENCRYPTION_KEY", "DASHCLAW_API_KEY"):
            self.assertIn(f'"{name}"', output)

    def test_omits_optional_env_vars(self):
        output = emit_doctor_checks(_make_shape())
        self.assertNotIn('"OPTIONAL_VAR"', output)

    def test_includes_shape_prefixed_check_ids(self):
        output = emit_doctor_checks(_make_shape())
        self.assertIn("`shape_table_${table}`", output)
        self.assertIn("`shape_env_${name}`", output)

    def test_includes_fix_actions_for_fixable_env_vars(self):
        output = emit_doctor_checks(_make_shape())
        for name, info in FIXABLE_ENV_VARS.items():
            self.assertIn(f'"{name}"', output)
            self.assertIn(f'"{info["action"]}"', output)

    def test_category_is_shape(self):
        output = emit_doctor_checks(_make_shape())
        self.assertIn("category: 'shape'", output)

    def test_migrate_action_for_missing_tables(self):
        output = emit_doctor_checks(_make_shape())
        self.assertIn("action: 'migrate'", output)

    def test_output_is_deterministic(self):
        a = emit_doctor_checks(_make_shape())
        b = emit_doctor_checks(_make_shape())
        self.assertEqual(a, b)

    def test_tables_are_sorted(self):
        shape = _make_shape(
            tables=[
                TableInfo("zeta", "schema/schema.js"),
                TableInfo("alpha", "schema/schema.js"),
                TableInfo("mu", "schema/schema.js"),
            ],
        )
        output = emit_doctor_checks(shape)
        a_idx = output.index('"alpha"')
        m_idx = output.index('"mu"')
        z_idx = output.index('"zeta"')
        self.assertLess(a_idx, m_idx)
        self.assertLess(m_idx, z_idx)


class TestEmitDispatcherForDoctorChecks(unittest.TestCase):

    def test_doctor_checks_is_registered_target(self):
        self.assertIn("doctor-checks", TARGETS)

    def test_dispatcher_rejects_bogus_target(self):
        with self.assertRaises(ValueError):
            emit("/tmp", "bogus-target")


if __name__ == "__main__":
    unittest.main()
