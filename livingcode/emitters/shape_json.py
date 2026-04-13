"""Shape JSON emitter — serialize the shape model as committed JSON.

Node-side doctor code reads this file directly instead of hardcoding table or
env var names. The JSON is regenerated on every commit, so the generated JS
helpers (app/lib/doctor/shape.mjs) are always in sync with the codebase.
"""
import json
from dataclasses import asdict

from livingcode.types import ShapeModel


def emit_shape_json(shape: ShapeModel) -> str:
    """Render the shape model as a pretty-printed JSON string."""
    return json.dumps(asdict(shape), indent=2, default=str, sort_keys=False) + "\n"
