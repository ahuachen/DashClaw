import unittest
from unittest.mock import patch, MagicMock
import json

from dashclaw.client import DashClaw


class TestActionContext(unittest.TestCase):
    def setUp(self):
        self.claw = DashClaw(
            base_url="http://localhost:3000",
            api_key="test-key",
            agent_id="agent-1",
        )

    @patch.object(DashClaw, '_request')
    def test_context_manager_send_message_injects_action_id(self, mock_req):
        mock_req.return_value = {"success": True}
        with self.claw.action_context("act_123") as ctx:
            ctx.send_message("Hello", to="agent-b")

        mock_req.assert_called_once()
        args, kwargs = mock_req.call_args
        # The call goes to /api/messages with POST
        self.assertEqual(args[0], "/api/messages")
        body = kwargs.get("body") or (args[2] if len(args) > 2 else kwargs.get("json"))
        self.assertEqual(body["action_id"], "act_123")
        self.assertEqual(body["from_agent_id"], "agent-1")
        self.assertEqual(body["to_agent_id"], "agent-b")

    @patch.object(DashClaw, '_request')
    def test_context_manager_record_assumption_injects_action_id(self, mock_req):
        mock_req.return_value = {"success": True}
        with self.claw.action_context("act_123") as ctx:
            ctx.record_assumption({"assumption": "Staging is clear"})

        args, kwargs = mock_req.call_args
        body = kwargs.get("json") or (args[2] if len(args) > 2 else None)
        self.assertEqual(body["action_id"], "act_123")
        self.assertEqual(body["assumption"], "Staging is clear")

    @patch.object(DashClaw, '_request')
    def test_context_manager_update_outcome(self, mock_req):
        mock_req.return_value = {"success": True}
        with self.claw.action_context("act_123") as ctx:
            ctx.update_outcome(status="completed", output_summary="Done")

        args, kwargs = mock_req.call_args
        self.assertIn("act_123", args[0])  # URL contains action_id

    @patch.object(DashClaw, '_request')
    def test_explicit_action_id_kwarg_on_send_message(self, mock_req):
        mock_req.return_value = {"success": True}
        self.claw.send_message("Direct", to="agent-b", action_id="act_456")

        args, kwargs = mock_req.call_args
        body = kwargs.get("body") or (args[2] if len(args) > 2 else None)
        self.assertEqual(body["action_id"], "act_456")


if __name__ == "__main__":
    unittest.main()
