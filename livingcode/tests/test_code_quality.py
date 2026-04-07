import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class TestCodeQualityCollector(unittest.TestCase):

    def setUp(self):
        self.tmpdir = tempfile.mkdtemp()

    def tearDown(self):
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    def test_counts_files_over_300_lines(self):
        from livingcode.collectors.code_quality import collect_code_quality
        app_dir = Path(self.tmpdir) / "app"
        app_dir.mkdir()
        big_file = app_dir / "big.js"
        big_file.write_text("\n".join([f"// line {i}" for i in range(350)]))
        small_file = app_dir / "small.js"
        small_file.write_text("// small\n")
        with patch("livingcode.collectors.code_quality._run_lint") as mock_lint:
            mock_lint.return_value = "pass"
            result = collect_code_quality(self.tmpdir, max_file_length=300)
        self.assertEqual(result.files_over_300_lines, 1)

    def test_finds_largest_files_sorted(self):
        from livingcode.collectors.code_quality import collect_code_quality
        app_dir = Path(self.tmpdir) / "app"
        app_dir.mkdir()
        for i, size in enumerate([500, 200, 800]):
            f = app_dir / f"file{i}.js"
            f.write_text("\n".join([f"// line {j}" for j in range(size)]))
        with patch("livingcode.collectors.code_quality._run_lint") as mock_lint:
            mock_lint.return_value = "pass"
            result = collect_code_quality(self.tmpdir, max_file_length=300)
        self.assertEqual(result.largest_files[0].lines, 800)
        self.assertEqual(len(result.largest_files), 3)

    def test_counts_todos(self):
        from livingcode.collectors.code_quality import collect_code_quality
        app_dir = Path(self.tmpdir) / "app"
        app_dir.mkdir()
        f = app_dir / "code.js"
        f.write_text("// TODO: fix this\n// FIXME: broken\nconst x = 1;\n// TODO: later\n")
        with patch("livingcode.collectors.code_quality._run_lint") as mock_lint:
            mock_lint.return_value = "pass"
            result = collect_code_quality(self.tmpdir, max_file_length=300)
        self.assertEqual(result.todo_count, 3)

    def test_measures_archive_size(self):
        from livingcode.collectors.code_quality import collect_code_quality
        archive_dir = Path(self.tmpdir) / "app" / "api" / "_archive"
        archive_dir.mkdir(parents=True)
        f = archive_dir / "old.js"
        f.write_text("x" * 10240)  # 10KB
        with patch("livingcode.collectors.code_quality._run_lint") as mock_lint:
            mock_lint.return_value = "pass"
            result = collect_code_quality(self.tmpdir, max_file_length=300)
        self.assertEqual(result.archive_size_kb, 10)

    def test_reports_eslint_status(self):
        from livingcode.collectors.code_quality import collect_code_quality
        with patch("livingcode.collectors.code_quality._run_lint") as mock_lint:
            mock_lint.return_value = "fail"
            result = collect_code_quality(self.tmpdir, max_file_length=300)
        self.assertEqual(result.eslint_status, "fail")

    def test_skips_node_modules_and_dist(self):
        from livingcode.collectors.code_quality import collect_code_quality
        nm_dir = Path(self.tmpdir) / "node_modules" / "pkg"
        nm_dir.mkdir(parents=True)
        (nm_dir / "huge.js").write_text("\n" * 1000)
        with patch("livingcode.collectors.code_quality._run_lint") as mock_lint:
            mock_lint.return_value = "pass"
            result = collect_code_quality(self.tmpdir, max_file_length=300)
        self.assertEqual(result.files_over_300_lines, 0)


if __name__ == "__main__":
    unittest.main()
