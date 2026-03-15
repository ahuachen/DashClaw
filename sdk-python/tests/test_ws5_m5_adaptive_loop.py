import unittest

from dashclaw.client import DashClaw


class RecordingDashClaw(DashClaw):
    def __init__(self, **kwargs):
        super().__init__(
            base_url="https://example.test",
            api_key="test-key",
            agent_id="agent-1",
            **kwargs,
        )
        self.calls = []
        self.recommendation_response = {"recommendations": []}
        self.guard_response = {"decision": "allow", "reasons": [], "warnings": []}

    def _request(self, path, method="GET", body=None, json=None):
        payload = json or body
        self.calls.append({"path": path, "method": method, "body": payload})
        if path.startswith("/api/learning/recommendations?"):
            return self.recommendation_response
        if path.startswith("/api/guard"):
            return self.guard_response
        if path == "/api/actions" and method == "POST":
            return {"action_id": "act_1", "action": payload or {}}
        if path == "/api/learning/recommendations/events" and method == "POST":
            return {"created_count": 1}
        return {"ok": True}


@unittest.skip("Adaptive loop feature removed in SDK refactor")
class AdaptiveLoopPythonTests(unittest.TestCase):
    def test_constructor_validates_auto_recommend_mode(self):
        with self.assertRaises(ValueError):
            RecordingDashClaw(auto_recommend="invalid")

    def test_create_action_applies_recommendation_in_enforce_mode(self):
        client = RecordingDashClaw(auto_recommend="enforce")
        client.recommendation_response = {
            "recommendations": [
                {
                    "id": "r1",
                    "confidence": 90,
                    "hints": {"preferred_risk_cap": 40},
                }
            ]
        }

        client.create_action(action_type="deploy", declared_goal="Ship", risk_score=90)
        action_call = next(call for call in client.calls if call["path"] == "/api/actions")

        self.assertEqual(action_call["body"]["recommendation_id"], "r1")
        self.assertEqual(action_call["body"]["recommendation_applied"], True)
        self.assertEqual(action_call["body"]["risk_score"], 40)

    def test_create_action_warn_mode_records_override(self):
        client = RecordingDashClaw(auto_recommend="warn")
        client.recommendation_response = {
            "recommendations": [
                {"id": "r1", "confidence": 95, "hints": {"preferred_risk_cap": 20}}
            ]
        }

        client.create_action(action_type="deploy", declared_goal="Ship", risk_score=80)
        action_call = next(call for call in client.calls if call["path"] == "/api/actions")

        self.assertEqual(action_call["body"]["recommendation_id"], "r1")
        self.assertEqual(action_call["body"]["recommendation_applied"], False)
        self.assertEqual(action_call["body"]["recommendation_override_reason"], "warn_mode_no_autoadapt")

    def test_confidence_threshold_prevents_autoadapt(self):
        client = RecordingDashClaw(
            auto_recommend="enforce",
            recommendation_confidence_min=85,
        )
        client.recommendation_response = {
            "recommendations": [
                {"id": "r2", "confidence": 60, "hints": {"preferred_risk_cap": 15}}
            ]
        }

        client.create_action(action_type="deploy", declared_goal="Ship", risk_score=70)
        action_call = next(call for call in client.calls if call["path"] == "/api/actions")
        event_call = next(call for call in client.calls if call["path"] == "/api/learning/recommendations/events")

        self.assertEqual(action_call["body"]["recommendation_applied"], False)
        self.assertIn("confidence_below_threshold", action_call["body"]["recommendation_override_reason"])
        self.assertEqual(event_call["body"]["event_type"], "overridden")


if __name__ == "__main__":
    unittest.main()
