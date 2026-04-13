"""Emit dispatcher — route an emit target to the right emitter module."""
from livingcode.shape import build_shape

TARGETS = ("skill",)


def emit(repo_path: str, target: str) -> str:
    """Build the current shape and render it as the requested artifact."""
    shape = build_shape(repo_path)

    if target == "skill":
        from livingcode.emitters.skill import emit_skill
        return emit_skill(shape)

    raise ValueError(f"Unknown emit target: {target}. Available: {', '.join(TARGETS)}")
