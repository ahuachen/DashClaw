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


class PythonWorkflowRuntimeTests(unittest.TestCase):
    def test_execute_workflow_template_posts_runtime_payload(self):
        client = RecordingDashClaw()

        client.execute_workflow_template(
            "wf_1",
            variables={"env": "prod"},
            agent_id="forge",
            declared_goal="Run release flow",
        )

        call = client.calls[-1]
        self.assertEqual(call["method"], "POST")
        self.assertEqual(call["path"], "/api/workflows/templates/wf_1/execute")
        self.assertEqual(
            call["body"],
            {
                "variables": {"env": "prod"},
                "agent_id": "forge",
                "declared_goal": "Run release flow",
            },
        )

    def test_execute_workflow_template_omits_unset_fields(self):
        client = RecordingDashClaw()

        client.execute_workflow_template("wf_1")

        call = client.calls[-1]
        self.assertEqual(call["method"], "POST")
        self.assertEqual(call["path"], "/api/workflows/templates/wf_1/execute")
        self.assertEqual(call["body"], {})


if __name__ == "__main__":
    unittest.main()
