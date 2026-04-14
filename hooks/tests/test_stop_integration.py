"""Integration tests for .claude/hooks/dashclaw_stop.py.

Starts a mock HTTP server on a random port, prepares a fake session
transcript and turn-action file, runs the Stop hook as a subprocess,
and verifies the PATCH requests distribute token usage across the
recorded action_ids.

Uses only the Python standard library.
"""

import json
import os
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import HTTPServer, BaseHTTPRequestHandler

# ---------------------------------------------------------------------------
# Paths — Stop hook lives in .claude/hooks/, not the legacy hooks/ dir.
# ---------------------------------------------------------------------------

_HOOKS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_STOP_SCRIPT = os.path.join(_HOOKS_DIR, "dashclaw_stop.py")


# ---------------------------------------------------------------------------
# Mock HTTP server
# ---------------------------------------------------------------------------

class _RequestLog:
    def __init__(self):
        self.requests: list[dict] = []
        self._lock = threading.Lock()

    def add(self, method, path, body):
        with self._lock:
            self.requests.append({"method": method, "path": path, "body": body})

    def get_all(self):
        with self._lock:
            return list(self.requests)

    def clear(self):
        with self._lock:
            self.requests.clear()


def _make_handler(log):
    class Handler(BaseHTTPRequestHandler):
        def do_PATCH(self):
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length) if length else b""
            body = json.loads(raw) if raw else None
            log.add("PATCH", self.path, body)
            resp = json.dumps({"ok": True}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)

        def log_message(self, fmt, *args):
            pass

    return Handler


def _find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


# ---------------------------------------------------------------------------
# Helpers to stage fake transcript + turn file
# ---------------------------------------------------------------------------

def _write_transcript(entries):
    fd, path = tempfile.mkstemp(suffix=".jsonl", prefix="dashclaw_test_")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        for e in entries:
            f.write(json.dumps(e) + "\n")
    return path


def _turn_path(session_id):
    return os.path.join(tempfile.gettempdir(), "dashclaw_turn_" + session_id)


def _cursor_path(session_id):
    return os.path.join(tempfile.gettempdir(), "dashclaw_stop_cursor_" + session_id)


def _write_turn_actions(session_id, action_ids):
    with open(_turn_path(session_id), "w", encoding="utf-8") as f:
        for aid in action_ids:
            f.write(aid + "\n")


def _safe_remove(path):
    try:
        os.remove(path)
    except FileNotFoundError:
        pass


def _run_hook(stdin_data, env_overrides=None, timeout=10):
    env = os.environ.copy()
    for key in list(env.keys()):
        if key.startswith("DASHCLAW_"):
            del env[key]
    if env_overrides:
        env.update(env_overrides)
    proc = subprocess.run(
        [sys.executable, _STOP_SCRIPT],
        input=json.dumps(stdin_data).encode("utf-8"),
        capture_output=True,
        timeout=timeout,
        env=env,
    )
    return proc.returncode, proc.stdout.decode("utf-8", errors="replace"), proc.stderr.decode("utf-8", errors="replace")


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestStopHook(unittest.TestCase):
    server: HTTPServer
    server_thread: threading.Thread
    log: _RequestLog
    base_url: str

    @classmethod
    def setUpClass(cls):
        cls.log = _RequestLog()
        port = _find_free_port()
        handler = _make_handler(cls.log)
        cls.server = HTTPServer(("127.0.0.1", port), handler)
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.base_url = "http://127.0.0.1:%d" % port

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server_thread.join(timeout=5)

    def setUp(self):
        self.log.clear()

    def _env(self):
        return {
            "DASHCLAW_BASE_URL": self.base_url,
            "DASHCLAW_API_KEY": "test-key",
        }

    def test_sums_cache_tokens_and_distributes_evenly(self):
        """Two actions + one assistant message: tokens split evenly, cache tokens counted."""
        session_id = "sess-test-001"
        entries = [
            {"type": "user", "uuid": "u1", "message": {"role": "user", "content": "hello"}},
            {
                "type": "assistant",
                "uuid": "a1",
                "message": {
                    "model": "claude-opus-4-6",
                    "usage": {
                        "input_tokens": 100,
                        "cache_creation_input_tokens": 50,
                        "cache_read_input_tokens": 200,
                        "output_tokens": 40,
                    },
                },
            },
        ]
        transcript = _write_transcript(entries)
        self.addCleanup(_safe_remove, transcript)
        _write_turn_actions(session_id, ["act-A", "act-B"])
        self.addCleanup(_safe_remove, _turn_path(session_id))
        self.addCleanup(_safe_remove, _cursor_path(session_id))

        code, _, err = _run_hook(
            {"session_id": session_id, "transcript_path": transcript},
            self._env(),
        )
        self.assertEqual(code, 0, msg=err)

        patches = [r for r in self.log.get_all() if r["method"] == "PATCH"]
        self.assertEqual(len(patches), 2)
        bodies = sorted(patches, key=lambda r: r["path"])
        # tokens_in total = 100+50+200 = 350 → split 175/175; tokens_out 40 → 20/20
        self.assertEqual(bodies[0]["path"], "/api/actions/act-A")
        self.assertEqual(bodies[0]["body"]["tokens_in"], 175)
        self.assertEqual(bodies[0]["body"]["tokens_out"], 20)
        self.assertEqual(bodies[0]["body"]["model"], "claude-opus-4-6")
        self.assertEqual(bodies[1]["path"], "/api/actions/act-B")
        self.assertEqual(bodies[1]["body"]["tokens_in"], 175)
        self.assertEqual(bodies[1]["body"]["tokens_out"], 20)

    def test_uneven_split_remainders_go_to_first_buckets(self):
        """Three actions, total=7 → 3,2,2 (earliest buckets absorb remainders)."""
        session_id = "sess-test-002"
        entries = [
            {"type": "user", "uuid": "u1", "message": {"role": "user", "content": "go"}},
            {
                "type": "assistant",
                "uuid": "a1",
                "message": {
                    "model": "sonnet-4-6",
                    "usage": {"input_tokens": 7, "output_tokens": 5},
                },
            },
        ]
        transcript = _write_transcript(entries)
        self.addCleanup(_safe_remove, transcript)
        _write_turn_actions(session_id, ["act-1", "act-2", "act-3"])
        self.addCleanup(_safe_remove, _turn_path(session_id))
        self.addCleanup(_safe_remove, _cursor_path(session_id))

        code, _, err = _run_hook(
            {"session_id": session_id, "transcript_path": transcript},
            self._env(),
        )
        self.assertEqual(code, 0, msg=err)

        patches = sorted(
            [r for r in self.log.get_all() if r["method"] == "PATCH"],
            key=lambda r: r["path"],
        )
        self.assertEqual(len(patches), 3)
        in_vals = [p["body"]["tokens_in"] for p in patches]
        out_vals = [p["body"]["tokens_out"] for p in patches]
        self.assertEqual(sum(in_vals), 7)
        self.assertEqual(sum(out_vals), 5)
        self.assertEqual(in_vals, [3, 2, 2])
        self.assertEqual(out_vals, [2, 2, 1])

    def test_no_actions_in_turn_is_noop(self):
        """No turn-action file → no PATCHes, no crash."""
        session_id = "sess-test-003"
        entries = [
            {"type": "user", "uuid": "u1", "message": {"role": "user", "content": "hi"}},
            {
                "type": "assistant",
                "uuid": "a1",
                "message": {"model": "opus", "usage": {"input_tokens": 1, "output_tokens": 1}},
            },
        ]
        transcript = _write_transcript(entries)
        self.addCleanup(_safe_remove, transcript)
        self.addCleanup(_safe_remove, _cursor_path(session_id))

        code, _, err = _run_hook(
            {"session_id": session_id, "transcript_path": transcript},
            self._env(),
        )
        self.assertEqual(code, 0, msg=err)
        self.assertEqual([r for r in self.log.get_all() if r["method"] == "PATCH"], [])

    def test_cursor_advances_and_next_turn_only_sees_new_usage(self):
        """Second Stop only counts usage that appeared after the first cursor."""
        session_id = "sess-test-004"
        entries_turn_one = [
            {"type": "user", "uuid": "u1", "message": {"role": "user", "content": "q1"}},
            {
                "type": "assistant",
                "uuid": "a1",
                "message": {
                    "model": "opus",
                    "usage": {"input_tokens": 10, "output_tokens": 5},
                },
            },
        ]
        transcript = _write_transcript(entries_turn_one)
        self.addCleanup(_safe_remove, transcript)
        _write_turn_actions(session_id, ["act-X"])
        self.addCleanup(_safe_remove, _turn_path(session_id))
        self.addCleanup(_safe_remove, _cursor_path(session_id))

        code, _, err = _run_hook(
            {"session_id": session_id, "transcript_path": transcript},
            self._env(),
        )
        self.assertEqual(code, 0, msg=err)
        first = [r for r in self.log.get_all() if r["method"] == "PATCH"]
        self.assertEqual(len(first), 1)
        self.assertEqual(first[0]["body"]["tokens_in"], 10)

        # Append a new turn to the transcript, stage a new action, re-run Stop.
        self.log.clear()
        turn_two = entries_turn_one + [
            {"type": "user", "uuid": "u2", "message": {"role": "user", "content": "q2"}},
            {
                "type": "assistant",
                "uuid": "a2",
                "message": {
                    "model": "opus",
                    "usage": {"input_tokens": 3, "output_tokens": 2},
                },
            },
        ]
        with open(transcript, "w", encoding="utf-8") as f:
            for e in turn_two:
                f.write(json.dumps(e) + "\n")
        _write_turn_actions(session_id, ["act-Y"])

        code, _, err = _run_hook(
            {"session_id": session_id, "transcript_path": transcript},
            self._env(),
        )
        self.assertEqual(code, 0, msg=err)
        second = [r for r in self.log.get_all() if r["method"] == "PATCH"]
        self.assertEqual(len(second), 1)
        self.assertEqual(second[0]["path"], "/api/actions/act-Y")
        self.assertEqual(second[0]["body"]["tokens_in"], 3)
        self.assertEqual(second[0]["body"]["tokens_out"], 2)

    def test_missing_env_exits_silently(self):
        """No DASHCLAW_BASE_URL/API_KEY → exit 0, no PATCHes."""
        session_id = "sess-test-005"
        entries = [
            {"type": "assistant", "uuid": "a1", "message": {"model": "opus", "usage": {"input_tokens": 1, "output_tokens": 1}}},
        ]
        transcript = _write_transcript(entries)
        self.addCleanup(_safe_remove, transcript)
        _write_turn_actions(session_id, ["act-Z"])
        self.addCleanup(_safe_remove, _turn_path(session_id))

        code, _, err = _run_hook(
            {"session_id": session_id, "transcript_path": transcript},
            env_overrides={},  # No DASHCLAW_* vars
        )
        self.assertEqual(code, 0, msg=err)
        self.assertEqual([r for r in self.log.get_all() if r["method"] == "PATCH"], [])


if __name__ == "__main__":
    unittest.main()
