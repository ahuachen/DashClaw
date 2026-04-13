"""Shape JSON emitter — serialize the shape model as committed JSON.

Node-side doctor code reads this file directly instead of hardcoding table or
env var names. The JSON is regenerated on every commit, so the generated JS
helpers (app/lib/doctor/shape.mjs) are always in sync with the codebase.

The wall-clock `timestamp` from the live shape model is replaced with a
content-derived signature (sha1 over routes/env_vars/tables). This keeps the
output byte-identical across runs when nothing changed — which is what the
pre-commit hook needs to avoid a churn diff on every commit.
"""
import hashlib
import json
from dataclasses import asdict

from livingcode.types import ShapeModel


def _content_signature(shape_dict: dict) -> str:
    """Stable sha1 of the shape content, excluding the live timestamp."""
    stripped = {k: v for k, v in shape_dict.items() if k != "timestamp"}
    payload = json.dumps(stripped, sort_keys=True, default=str)
    return "sha1:" + hashlib.sha1(payload.encode("utf-8")).hexdigest()


def emit_shape_json(shape: ShapeModel) -> str:
    """Render the shape model as a pretty-printed JSON string."""
    data = asdict(shape)
    data["timestamp"] = _content_signature(data)
    return json.dumps(data, indent=2, default=str, sort_keys=False) + "\n"
