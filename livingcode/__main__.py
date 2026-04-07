"""CLI entry point: python -m livingcode <command>"""
import argparse
import json
import os
import sys
from dataclasses import asdict


def cmd_sense(args):
    from livingcode.sensing import run_sensing
    report, path = run_sensing(args.path)
    print(f"Sensing complete. Report written to: {path}")
    if args.json:
        print(json.dumps(asdict(report), indent=2, default=str))
    else:
        print(f"  Organism: {report.organism}")
        print(f"  Collectors: {report.collector_status}")
        if report.git_stats:
            print(f"  Commits (7d): {report.git_stats.commits_7d}")
            print(f"  Bus factor: {report.git_stats.bus_factor}")
        if report.code_quality:
            print(f"  Files over limit: {report.code_quality.files_over_300_lines}")
            print(f"  TODOs: {report.code_quality.todo_count}")


def cmd_plan(args):
    from livingcode.sensing import run_sensing
    from livingcode.planner.prioritizer import generate_work_items
    report, _ = run_sensing(args.path)
    items = generate_work_items(report)
    print(f"Generated {len(items)} work item(s):")
    for item in items:
        print(f"  [Tier {item.tier}] {item.title}")
        if args.verbose:
            print(f"    {item.description}")


def cmd_review(args):
    from livingcode.sensing import run_sensing
    from livingcode.immune.checks import run_all_checks
    from livingcode.immune.verdict import generate_verdict
    from livingcode.orchestrator.cycle import _load_baselines
    report, _ = run_sensing(args.path)
    baselines = _load_baselines(args.path)
    checks = run_all_checks(report, baselines)
    verdict = generate_verdict(checks)
    print(f"Verdict: {verdict.recommendation}")
    print(f"Summary: {verdict.summary}")
    for check in verdict.checks:
        print(f"  [{check.status.upper()}] {check.name}: {check.message}")


def cmd_cycle(args):
    from livingcode.orchestrator.cycle import run_lifecycle_cycle
    result = run_lifecycle_cycle(args.path, supervised=not args.unsupervised)
    print(f"Cycle #{result.cycle_number} complete.")
    print(f"  Outcome: {result.outcome}")
    print(f"  Duration: {result.duration_seconds}s")
    print(f"  Phases: {', '.join(result.phases_completed)}")


def cmd_heartbeat(args):
    from livingcode.heartbeat.runner import run_heartbeat
    result = run_heartbeat(args.path, mode=args.mode)
    print(f"Heartbeat ({result['mode']}) complete in {result['duration_seconds']}s")


def cmd_status(args):
    from livingcode.state import read_latest_state_report
    report = read_latest_state_report(args.path)
    if not report:
        print("No state reports found. Run 'python -m livingcode sense' first.")
        return
    print(f"Last report: {report.get('timestamp', 'unknown')}")
    print(f"Organism: {report.get('organism', 'unknown')}")
    status = report.get("collector_status", {})
    for name, s in status.items():
        print(f"  {name}: {s}")


def main():
    # Shared parent so --path/--json/--verbose work both before and after subcommand
    shared = argparse.ArgumentParser(add_help=False)
    shared.add_argument("--path", default=os.getcwd(), help="Repository path (default: cwd)")
    shared.add_argument("--json", action="store_true", help="Output as JSON")
    shared.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    parser = argparse.ArgumentParser(
        prog="livingcode",
        description="DashClaw Living Organism — codebase health sensing framework",
        parents=[shared],
    )
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("sense", parents=[shared], help="Run all 5 collectors")
    sub.add_parser("plan", parents=[shared], help="Generate prioritized work items")

    review_p = sub.add_parser("review", parents=[shared], help="Run immune system checks")
    review_p.add_argument("branch", nargs="?", default=None)

    cycle_p = sub.add_parser("cycle", parents=[shared], help="Full lifecycle cycle")
    cycle_p.add_argument("--unsupervised", action="store_true")

    hb_p = sub.add_parser("heartbeat", parents=[shared], help="Run heartbeat")
    hb_p.add_argument("--mode", choices=["quick", "full"], default="quick")

    sub.add_parser("status", parents=[shared], help="Show last report summary")

    args = parser.parse_args()

    commands = {
        "sense": cmd_sense,
        "plan": cmd_plan,
        "review": cmd_review,
        "cycle": cmd_cycle,
        "heartbeat": cmd_heartbeat,
        "status": cmd_status,
    }

    if args.command in commands:
        commands[args.command](args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
