"""Tests for `livingcode start` (the one-shot dashboard launcher)."""
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class TestStartCommand(unittest.TestCase):
    """Verify the start subcommand sequences sense → snapshot → refresh → open."""

    def _fake_repo(self, tmp: Path) -> Path:
        (tmp / "app" / "api" / "health").mkdir(parents=True)
        (tmp / "app" / "api" / "health" / "route.js").write_text(
            "export async function GET(){return new Response('ok')}\n"
        )
        (tmp / "schema").mkdir()
        (tmp / "schema" / "schema.js").write_text("")
        (tmp / ".env.example").write_text("")
        return tmp

    def test_start_registered_in_cli_help(self):
        result = subprocess.run(
            [sys.executable, "-m", "livingcode", "--help"],
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn("start", result.stdout)

    def test_start_runs_pipeline_and_opens_browser(self):
        """With mocks in place for all side effects, cmd_start sequences correctly."""
        from livingcode.__main__ import cmd_start

        class Args:
            pass

        with tempfile.TemporaryDirectory() as tmp:
            repo = self._fake_repo(Path(tmp))
            (repo / "public" / "livingcode").mkdir(parents=True)
            (repo / "public" / "livingcode" / "index.html").write_text("<!doctype html>")

            args = Args()
            args.path = str(repo)
            args.no_open = False

            with patch("livingcode.sensing.run_sensing") as sense, \
                 patch("livingcode.diff.save_snapshot") as snapshot, \
                 patch("shutil.which", return_value="/fake/npm"), \
                 patch("subprocess.run") as run, \
                 patch("webbrowser.open") as browse:
                sense.return_value = ({}, str(repo / ".organism" / "fake-report.json"))
                snapshot.return_value = str(repo / ".organism" / "fake-snap.json")
                run.return_value = subprocess.CompletedProcess([], 0)

                cmd_start(args)

                sense.assert_called_once_with(str(repo))
                snapshot.assert_called_once_with(str(repo))
                run.assert_called_once()
                self.assertEqual(run.call_args[0][0][1:], ["run", "livingcode:refresh"])
                browse.assert_called_once()

    def test_start_respects_no_open_flag(self):
        from livingcode.__main__ import cmd_start

        class Args:
            pass

        with tempfile.TemporaryDirectory() as tmp:
            repo = self._fake_repo(Path(tmp))
            (repo / "public" / "livingcode").mkdir(parents=True)
            (repo / "public" / "livingcode" / "index.html").write_text("<!doctype html>")

            args = Args()
            args.path = str(repo)
            args.no_open = True

            with patch("livingcode.sensing.run_sensing", return_value=({}, "r")), \
                 patch("livingcode.diff.save_snapshot", return_value="s"), \
                 patch("shutil.which", return_value="/fake/npm"), \
                 patch("subprocess.run", return_value=subprocess.CompletedProcess([], 0)), \
                 patch("webbrowser.open") as browse:
                cmd_start(args)
                browse.assert_not_called()


if __name__ == "__main__":
    unittest.main()
