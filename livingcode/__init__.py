"""DashClaw Living Organism — codebase health sensing framework."""

__version__ = "0.1.0"


class Organism:
    """Main entry point for the livingcode framework."""

    def __init__(self, repo_path: str):
        self.repo_path = repo_path

    def sense(self):
        from livingcode.sensing import run_sensing
        return run_sensing(self.repo_path)

    def plan(self):
        from livingcode.sensing import run_sensing
        from livingcode.planner.prioritizer import generate_work_items
        report, _ = run_sensing(self.repo_path)
        return generate_work_items(report)

    def review(self, branch: str | None = None):
        from livingcode.sensing import run_sensing
        from livingcode.immune.checks import run_all_checks
        from livingcode.immune.verdict import generate_verdict
        from livingcode.orchestrator.cycle import _load_baselines
        report, _ = run_sensing(self.repo_path)
        baselines = _load_baselines(self.repo_path)
        checks = run_all_checks(report, baselines)
        return generate_verdict(checks)

    def cycle(self, supervised: bool = True):
        from livingcode.orchestrator.cycle import run_lifecycle_cycle
        return run_lifecycle_cycle(self.repo_path, supervised=supervised)

    def heartbeat(self, mode: str = "quick"):
        from livingcode.heartbeat.runner import run_heartbeat
        return run_heartbeat(self.repo_path, mode=mode)
