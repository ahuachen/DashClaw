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


class PythonKnowledgeRuntimeTests(unittest.TestCase):
    def test_add_knowledge_collection_item_posts_item_payload(self):
        client = RecordingDashClaw()

        client.add_knowledge_collection_item(
            "kc_1",
            source_uri="https://docs.example.com/runbook.md",
            title="Runbook",
        )

        call = client.calls[-1]
        self.assertEqual(call["method"], "POST")
        self.assertEqual(call["path"], "/api/knowledge/collections/kc_1/items")
        self.assertEqual(
            call["body"],
            {
                "source_uri": "https://docs.example.com/runbook.md",
                "title": "Runbook",
            },
        )

    def test_sync_knowledge_collection_posts_empty_body(self):
        client = RecordingDashClaw()

        client.sync_knowledge_collection("kc_1")

        call = client.calls[-1]
        self.assertEqual(call["method"], "POST")
        self.assertEqual(call["path"], "/api/knowledge/collections/kc_1/sync")
        self.assertEqual(call["body"], {})

    def test_search_knowledge_collection_posts_query_and_limit(self):
        client = RecordingDashClaw()

        client.search_knowledge_collection("kc_1", "rollback steps", limit=3)

        call = client.calls[-1]
        self.assertEqual(call["method"], "POST")
        self.assertEqual(call["path"], "/api/knowledge/collections/kc_1/search")
        self.assertEqual(
            call["body"],
            {
                "query": "rollback steps",
                "limit": 3,
            },
        )


if __name__ == "__main__":
    unittest.main()
