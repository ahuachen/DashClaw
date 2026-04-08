import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "sdk-python"))

from dashclaw.client import DashClaw  # noqa: E402


class RecordingDashClaw(DashClaw):
    def __init__(self):
        super().__init__(
            base_url="https://example.test",
            api_key="test-key",
            agent_id="agent-1",
        )
        self.calls = []

    def _request(self, path, method="GET", body=None, json=None, **kwargs):
        payload = json if json is not None else body
        self.calls.append({
            "path": path,
            "method": method,
            "body": payload,
            "params": kwargs.get("params"),
        })
        return {"ok": True, "path": path, "method": method, "body": payload, "params": kwargs.get("params")}


class PythonCapabilityRuntimeTests(unittest.TestCase):
    def test_invoke_capability_posts_payload(self):
        client = RecordingDashClaw()

        client.invoke_capability("cap_1", payload={"message": "hello"}, actor="ops-agent", reason="incident")

        call = client.calls[-1]
        self.assertEqual(call["method"], "POST")
        self.assertEqual(call["path"], "/api/capabilities/cap_1/invoke")
        self.assertEqual(
            call["body"],
            {"payload": {"message": "hello"}, "actor": "ops-agent", "reason": "incident"},
        )

    def test_test_capability_posts_payload(self):
        client = RecordingDashClaw()

        client.test_capability("cap_1", payload={"channel": "#alerts"})

        call = client.calls[-1]
        self.assertEqual(call["method"], "POST")
        self.assertEqual(call["path"], "/api/capabilities/cap_1/test")
        self.assertEqual(call["body"], {"payload": {"channel": "#alerts"}})

    def test_get_capability_health_fetches_detail(self):
        client = RecordingDashClaw()

        client.get_capability_health("cap_1")

        call = client.calls[-1]
        self.assertEqual(call["method"], "GET")
        self.assertEqual(call["path"], "/api/capabilities/cap_1/health")
        self.assertIsNone(call["body"])

    def test_list_capability_health_passes_filters(self):
        client = RecordingDashClaw()

        client.list_capability_health(status="failing", certification_status="uncertified", stale_only=True, limit=10, offset=5)

        call = client.calls[-1]
        self.assertEqual(call["method"], "GET")
        self.assertEqual(call["path"], "/api/capabilities/health")
        self.assertEqual(
            call["params"],
            {
                "status": "failing",
                "certification_status": "uncertified",
                "stale_only": True,
                "limit": 10,
                "offset": 5,
            },
        )

    def test_get_capability_history_passes_filters(self):
        client = RecordingDashClaw()

        client.get_capability_history("cap_1", action_type="capability_test", status="failed", limit=15, offset=3)

        call = client.calls[-1]
        self.assertEqual(call["method"], "GET")
        self.assertEqual(call["path"], "/api/capabilities/cap_1/history")
        self.assertEqual(
            call["params"],
            {
                "action_type": "capability_test",
                "status": "failed",
                "limit": 15,
                "offset": 3,
            },
        )


if __name__ == "__main__":
    unittest.main()
