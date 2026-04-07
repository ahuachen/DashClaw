import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class TestDependencyHealthCollector(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_counts_js_dependencies(self):
        from livingcode.collectors.dependency_health import collect_dependency_health
        pkg = {"dependencies": {"react": "18.0.0", "next": "16.0.0"}, "devDependencies": {"vitest": "4.0.0"}}
        (Path(self.tmpdir) / "package.json").write_text(json.dumps(pkg))
        (Path(self.tmpdir) / "package-lock.json").write_text("{}")
        with patch("livingcode.collectors.dependency_health._run_npm") as mock:
            mock.side_effect = [
                (0, "{}"),
                (0, json.dumps({"vulnerabilities": {}})),
            ]
            result = collect_dependency_health(self.tmpdir)
        self.assertEqual(result.js_dependencies, 3)

    def test_counts_outdated_packages(self):
        from livingcode.collectors.dependency_health import collect_dependency_health
        pkg = {"dependencies": {"react": "17.0.0"}}
        (Path(self.tmpdir) / "package.json").write_text(json.dumps(pkg))
        (Path(self.tmpdir) / "package-lock.json").write_text("{}")
        outdated = {"react": {"current": "17.0.0", "wanted": "17.0.2", "latest": "18.2.0"}}
        with patch("livingcode.collectors.dependency_health._run_npm") as mock:
            mock.side_effect = [
                (1, json.dumps(outdated)),
                (0, json.dumps({"vulnerabilities": {}})),
            ]
            result = collect_dependency_health(self.tmpdir)
        self.assertEqual(result.js_outdated, 1)

    def test_counts_vulnerabilities(self):
        from livingcode.collectors.dependency_health import collect_dependency_health
        pkg = {"dependencies": {"bad-pkg": "1.0.0"}}
        (Path(self.tmpdir) / "package.json").write_text(json.dumps(pkg))
        (Path(self.tmpdir) / "package-lock.json").write_text("{}")
        audit = {"vulnerabilities": {"bad-pkg": {"severity": "high"}}}
        with patch("livingcode.collectors.dependency_health._run_npm") as mock:
            mock.side_effect = [
                (0, "{}"),
                (1, json.dumps(audit)),
            ]
            result = collect_dependency_health(self.tmpdir)
        self.assertEqual(result.js_vulnerabilities, 1)

    def test_detects_python_zero_dependencies(self):
        from livingcode.collectors.dependency_health import collect_dependency_health
        pkg = {"dependencies": {}}
        (Path(self.tmpdir) / "package.json").write_text(json.dumps(pkg))
        (Path(self.tmpdir) / "package-lock.json").write_text("{}")
        sdk_dir = Path(self.tmpdir) / "sdk-python"
        sdk_dir.mkdir()
        (sdk_dir / "pyproject.toml").write_text("[project]\ndependencies = []\n")
        with patch("livingcode.collectors.dependency_health._run_npm") as mock:
            mock.side_effect = [(0, "{}"), (0, json.dumps({"vulnerabilities": {}}))]
            result = collect_dependency_health(self.tmpdir)
        self.assertEqual(result.python_dependencies, 0)

    def test_lockfile_age_days(self):
        from livingcode.collectors.dependency_health import collect_dependency_health
        pkg = {"dependencies": {}}
        (Path(self.tmpdir) / "package.json").write_text(json.dumps(pkg))
        lock = Path(self.tmpdir) / "package-lock.json"
        lock.write_text("{}")
        with patch("livingcode.collectors.dependency_health._run_npm") as mock:
            mock.side_effect = [(0, "{}"), (0, json.dumps({"vulnerabilities": {}}))]
            result = collect_dependency_health(self.tmpdir)
        self.assertGreaterEqual(result.lockfile_age_days, 0)


if __name__ == "__main__":
    unittest.main()
