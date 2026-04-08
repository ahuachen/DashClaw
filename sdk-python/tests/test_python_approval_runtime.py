import pathlib
import sys
import time
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "sdk-python"))

from dashclaw.client import DashClaw  # noqa: E402


class SlowSSEApprovalDashClaw(DashClaw):
    def __init__(self):
        super().__init__(
            base_url="https://example.test",
            api_key="test-key",
            agent_id="agent-1",
        )
        self.action_requests = 0

    def _connect_sse(self, action_id, timeout):
        time.sleep(0.02)
        return None

    def get_action(self, action_id):
        self.action_requests += 1
        return {"action": {"status": "running", "approved_by": "operator"}}


class PythonApprovalRuntimeTests(unittest.TestCase):
    def test_wait_for_approval_polls_once_even_if_sse_consumes_timeout_budget(self):
        client = SlowSSEApprovalDashClaw()

        result = client.wait_for_approval("act_1", timeout=0.01, interval=0)

        self.assertEqual(client.action_requests, 1)
        self.assertEqual(result["action"]["approved_by"], "operator")


if __name__ == "__main__":
    unittest.main()
