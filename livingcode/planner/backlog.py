"""Backlog management — read/write work items to .organism/backlog/."""
import json
from dataclasses import asdict
from pathlib import Path
from livingcode.types import WorkItem


def write_backlog_item(repo_path: str, item: WorkItem) -> str:
    """Write a work item to .organism/backlog/. Returns file path."""
    backlog_dir = Path(repo_path) / ".organism" / "backlog"
    backlog_dir.mkdir(parents=True, exist_ok=True)
    filepath = backlog_dir / f"{item.id}.json"
    with open(filepath, "w") as f:
        json.dump(asdict(item), f, indent=2)
    return str(filepath)


def read_backlog_items(repo_path: str) -> list[WorkItem]:
    """Read all backlog items from .organism/backlog/."""
    backlog_dir = Path(repo_path) / ".organism" / "backlog"
    if not backlog_dir.exists():
        return []
    items = []
    for filepath in sorted(backlog_dir.glob("*.json")):
        with open(filepath) as f:
            data = json.load(f)
        items.append(WorkItem(**data))
    return items
