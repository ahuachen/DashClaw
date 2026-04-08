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


class PythonModelStrategiesRuntimeTests(unittest.TestCase):
    def test_complete_with_strategy_posts_expected_payload(self):
        client = RecordingDashClaw()

        client.complete_with_strategy(
            "mst_1",
            messages=[{"role": "user", "content": "Summarize this"}],
            max_tokens=256,
            temperature=0.7,
            task_mode="reasoning",
        )

        call = client.calls[-1]
        self.assertEqual(call["method"], "POST")
        self.assertEqual(call["path"], "/api/model-strategies/mst_1/complete")
        self.assertEqual(
            call["body"],
            {
                "messages": [{"role": "user", "content": "Summarize this"}],
                "max_tokens": 256,
                "temperature": 0.7,
                "task_mode": "reasoning",
            },
        )


if __name__ == "__main__":
    unittest.main()
