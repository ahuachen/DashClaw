import unittest


class TestValidator(unittest.TestCase):

    def test_valid_organism_json(self):
        from livingcode.schema.validator import validate_organism
        config = {
            "identity": {
                "name": "dashclaw",
                "purpose": "Decision infrastructure",
                "philosophy": "Control before execution",
            },
            "boundaries": {
                "growth_zone": ["governance"],
                "forbidden_zone": ["secrets"],
            },
            "quality_standards": {
                "test_coverage_floor": 80,
                "max_complexity_per_function": 15,
                "max_file_length": 300,
            },
        }
        errors = validate_organism(config)
        self.assertEqual(errors, [])

    def test_missing_identity_returns_error(self):
        from livingcode.schema.validator import validate_organism
        config = {
            "boundaries": {"growth_zone": [], "forbidden_zone": []},
            "quality_standards": {"test_coverage_floor": 80, "max_complexity_per_function": 15, "max_file_length": 300},
        }
        errors = validate_organism(config)
        self.assertTrue(any("identity" in e for e in errors))

    def test_missing_boundaries_returns_error(self):
        from livingcode.schema.validator import validate_organism
        config = {
            "identity": {"name": "test", "purpose": "test", "philosophy": "test"},
            "quality_standards": {"test_coverage_floor": 80, "max_complexity_per_function": 15, "max_file_length": 300},
        }
        errors = validate_organism(config)
        self.assertTrue(any("boundaries" in e for e in errors))

    def test_missing_quality_standards_returns_error(self):
        from livingcode.schema.validator import validate_organism
        config = {
            "identity": {"name": "test", "purpose": "test", "philosophy": "test"},
            "boundaries": {"growth_zone": [], "forbidden_zone": []},
        }
        errors = validate_organism(config)
        self.assertTrue(any("quality_standards" in e for e in errors))

    def test_missing_identity_name_returns_error(self):
        from livingcode.schema.validator import validate_organism
        config = {
            "identity": {"purpose": "test", "philosophy": "test"},
            "boundaries": {"growth_zone": [], "forbidden_zone": []},
            "quality_standards": {"test_coverage_floor": 80, "max_complexity_per_function": 15, "max_file_length": 300},
        }
        errors = validate_organism(config)
        self.assertTrue(any("name" in e for e in errors))

    def test_load_organism_from_file(self):
        import json
        import tempfile
        import os
        from livingcode.schema.validator import load_organism
        config = {
            "identity": {"name": "test", "purpose": "test", "philosophy": "test"},
            "boundaries": {"growth_zone": [], "forbidden_zone": []},
            "quality_standards": {"test_coverage_floor": 80, "max_complexity_per_function": 15, "max_file_length": 300},
        }
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json.dump(config, f)
            tmp_path = f.name
        try:
            loaded, errors = load_organism(tmp_path)
            self.assertEqual(errors, [])
            self.assertEqual(loaded["identity"]["name"], "test")
        finally:
            os.unlink(tmp_path)

    def test_load_organism_missing_file_returns_error(self):
        from livingcode.schema.validator import load_organism
        loaded, errors = load_organism("/nonexistent/organism.json")
        self.assertIsNone(loaded)
        self.assertTrue(len(errors) > 0)

    def test_optional_ci_gates_accepted(self):
        from livingcode.schema.validator import validate_organism
        config = {
            "identity": {"name": "test", "purpose": "test", "philosophy": "test"},
            "boundaries": {"growth_zone": [], "forbidden_zone": []},
            "quality_standards": {"test_coverage_floor": 80, "max_complexity_per_function": 15, "max_file_length": 300},
            "ci_gates": ["lint", "test", "build"],
        }
        errors = validate_organism(config)
        self.assertEqual(errors, [])


if __name__ == "__main__":
    unittest.main()
