import subprocess
import sys
import tempfile
import unittest


class TestCLI(unittest.TestCase):

    def test_module_is_runnable(self):
        result = subprocess.run(
            [sys.executable, "-m", "livingcode", "--help"],
            capture_output=True, text=True, timeout=10,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("livingcode", result.stdout.lower())

    def test_status_command_runs(self):
        result = subprocess.run(
            [sys.executable, "-m", "livingcode", "status", "--path", tempfile.mkdtemp()],
            capture_output=True, text=True, timeout=10,
        )
        # Should not crash, even with no .organism/
        self.assertIn("No state reports", result.stdout)


if __name__ == "__main__":
    unittest.main()
