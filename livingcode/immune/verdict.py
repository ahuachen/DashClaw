"""Verdict logic — translates immune check results into a recommendation."""
from livingcode.types import CheckResult, CheckStatus, Verdict
from livingcode.immune.checks import HARD_BLOCK_CHECKS


def generate_verdict(checks: list[CheckResult]) -> Verdict:
    """Generate a verdict from immune check results."""
    blocking: list[str] = []
    warnings: list[str] = []

    for check in checks:
        if check.status == CheckStatus.FAIL:
            if check.name in HARD_BLOCK_CHECKS:
                blocking.append(check.name)
            else:
                warnings.append(check.name)
        elif check.status == CheckStatus.WARN:
            warnings.append(check.name)

    if blocking:
        recommendation = "fix_required"
        summary = f"Blocked by: {', '.join(blocking)}"
    elif warnings:
        recommendation = "needs_discussion"
        summary = f"Warnings: {', '.join(warnings)}"
    else:
        recommendation = "merge"
        summary = "All checks passed"

    return Verdict(
        recommendation=recommendation,
        checks=checks,
        blocking=blocking,
        summary=summary,
    )
