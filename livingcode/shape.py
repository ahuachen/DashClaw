"""Shape model — the structured representation of what DashClaw IS right now.

Health collectors tell you "is the codebase doing well?"
Shape collectors tell you "what does the codebase consist of?"

The shape model is the foundation for generated artifacts:
doctor checks, skill content, MCP definitions, and drift detection.
"""
from datetime import datetime, timezone

from livingcode.collectors.env_vars import collect_env_vars
from livingcode.collectors.routes import collect_routes
from livingcode.collectors.schema import collect_schema
from livingcode.types import ShapeModel


def build_shape(repo_path: str) -> ShapeModel:
    """Build the complete shape model by running all shape collectors."""
    return ShapeModel(
        timestamp=datetime.now(timezone.utc).isoformat(),
        routes=collect_routes(repo_path),
        env_vars=collect_env_vars(repo_path),
        tables=collect_schema(repo_path),
    )
