import unittest

from dashclaw.client import DashClaw


class RecordingDashClaw(DashClaw):
    def __init__(self):
        super().__init__(
            base_url="https://example.test",
            api_key="test-key",
            agent_id="agent-1",
        )
        self.calls = []

    def _request(self, path, method="GET", body=None, json=None):
        payload = json or body
        self.calls.append({"path": path, "method": method, "body": payload})
        return {"ok": True, "path": path, "method": method, "body": payload}


class WS5M2ParityTests(unittest.TestCase):
    def test_approve_action_posts_expected_payload(self):
        client = RecordingDashClaw()
        response = client.approve_action("act_123", "allow", reasoning="safe to proceed")

        self.assertEqual(response["method"], "POST")
        self.assertEqual(response["path"], "/api/actions/act_123/approve")
        self.assertEqual(response["body"], {"decision": "allow", "reasoning": "safe to proceed"})

    def test_approve_action_rejects_invalid_decision(self):
        client = RecordingDashClaw()
        with self.assertRaises(ValueError):
            client.approve_action("act_123", "maybe")

    def test_get_pending_approvals_uses_actions_filters(self):
        client = RecordingDashClaw()
        client.get_pending_approvals(limit=10, offset=5)

        call = client.calls[-1]
        self.assertEqual(call["method"], "GET")
        self.assertIn("/api/actions?", call["path"])
        self.assertIn("status=pending_approval", call["path"])
        self.assertIn("limit=10", call["path"])
        self.assertIn("offset=5", call["path"])

    def test_get_guard_decisions_defaults_to_agent_context(self):
        client = RecordingDashClaw()
        client.get_guard_decisions()

        call = client.calls[-1]
        self.assertEqual(call["method"], "GET")
        self.assertIn("/api/guard?", call["path"])
        self.assertIn("agent_id=agent-1", call["path"])
        self.assertIn("limit=20", call["path"])
        self.assertIn("offset=0", call["path"])

    def test_get_guard_decisions_supports_filters(self):
        client = RecordingDashClaw()
        client.get_guard_decisions(decision="block", limit=50, offset=10, agent_id="agent-2")

        call = client.calls[-1]
        self.assertIn("decision=block", call["path"])
        self.assertIn("limit=50", call["path"])
        self.assertIn("offset=10", call["path"])
        self.assertIn("agent_id=agent-2", call["path"])

    def test_webhook_endpoints_cover_all_operations(self):
        client = RecordingDashClaw()

        client.get_webhooks()
        self.assertEqual(client.calls[-1], {"path": "/api/webhooks", "method": "GET", "body": None})

        client.create_webhook("https://hooks.example.test/inbound", events=["all"])
        self.assertEqual(client.calls[-1]["method"], "POST")
        self.assertEqual(client.calls[-1]["path"], "/api/webhooks")
        self.assertEqual(
            client.calls[-1]["body"],
            {"url": "https://hooks.example.test/inbound", "events": ["all"]},
        )

        client.delete_webhook("wh_test/123")
        self.assertEqual(client.calls[-1]["method"], "DELETE")
        self.assertEqual(client.calls[-1]["path"], "/api/webhooks?id=wh_test%2F123")

        client.test_webhook("wh_test")
        self.assertEqual(client.calls[-1], {"path": "/api/webhooks/wh_test/test", "method": "POST", "body": None})

        client.get_webhook_deliveries("wh_test")
        self.assertEqual(
            client.calls[-1], {"path": "/api/webhooks/wh_test/deliveries", "method": "GET", "body": None}
        )


if __name__ == "__main__":
    unittest.main()
