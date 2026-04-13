"""Emit dispatcher — route an emit target to the right emitter module."""
from livingcode.shape import build_shape

TARGETS = ("skill", "shape-json", "doctor-checks")


def emit(repo_path: str, target: str) -> str:
    """Build the current shape and render it as the requested artifact."""
    shape = build_shape(repo_path)

    if target == "skill":
        from livingcode.emitters.skill import emit_skill
        return emit_skill(shape)

    if target == "shape-json":
        from livingcode.emitters.shape_json import emit_shape_json
        return emit_shape_json(shape)

    if target == "doctor-checks":
        from livingcode.emitters.doctor_checks import emit_doctor_checks
        return emit_doctor_checks(shape)

    raise ValueError(f"Unknown emit target: {target}. Available: {', '.join(TARGETS)}")
