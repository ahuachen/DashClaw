"""Filesystem operations for .organism/ state directory."""
import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ORGANISM_DIR = ".organism"
SUBDIRS = ["state-reports", "heartbeats", "backlog", "cycle-history", "shape-snapshots"]

# Monotonic counter baked into every state-report filename. Previously,
# filenames used microsecond-precision timestamps and resolved collisions
# with a `-N` suffix — but `read_latest_state_report` sorted by `st_mtime`,
# which on Windows NTFS has ~15ms resolution. Two back-to-back writes
# therefore tied on mtime and the "most recent" file was non-deterministic.
# An always-present zero-padded counter gives a lexical sort order that
# matches insertion order regardless of filesystem timestamp granularity.
_counter_lock = threading.Lock()
_counter = 0


def ensure_organism_dir(repo_path: str) -> Path:
    """Create .organism/ directory structure if it doesn't exist."""
    base = Path(repo_path) / ORGANISM_DIR
    base.mkdir(exist_ok=True)
    for sub in SUBDIRS:
        (base / sub).mkdir(exist_ok=True)
    return base


def _safe_timestamp() -> str:
    """Generate a Windows-safe, monotonic filename stem.

    Format: `YYYY-MM-DDTHH-MM-SS-ffffff-NNNNNN` where NNNNNN is a process-local
    counter. Lexical sort of two stems always matches the order they were
    generated — no mtime dependency.
    """
    global _counter
    now = datetime.now(timezone.utc)
    with _counter_lock:
        _counter += 1
        seq = _counter
    return now.strftime("%Y-%m-%dT%H-%M-%S-%f") + f"-{seq:06d}"


def write_state_report(repo_path: str, data: dict[str, Any]) -> str:
    """Write a state report JSON file. Returns the file path."""
    reports_dir = Path(repo_path) / ORGANISM_DIR / "state-reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    filepath = reports_dir / f"{_safe_timestamp()}.json"
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, default=str)
    return str(filepath)


def read_latest_state_report(repo_path: str) -> dict[str, Any] | None:
    """Read the most recent state report. Returns None if none exist.

    Sorts by filename (lexical) — `_safe_timestamp()` guarantees monotonicity,
    so this ordering is stable on every filesystem. Do NOT switch back to
    mtime: NTFS coarse-granularity mtimes produced false ties that left the
    'latest' report ambiguous.
    """
    reports_dir = Path(repo_path) / ORGANISM_DIR / "state-reports"
    if not reports_dir.exists():
        return None
    files = sorted(reports_dir.glob("*.json"))
    if not files:
        return None
    with open(files[-1]) as f:
        return json.load(f)


def prune_old_reports(repo_path: str, max_reports: int = 100) -> int:
    """Delete oldest state reports beyond max_reports. Returns count deleted."""
    reports_dir = Path(repo_path) / ORGANISM_DIR / "state-reports"
    if not reports_dir.exists():
        return 0
    files = sorted(reports_dir.glob("*.json"))
    if len(files) <= max_reports:
        return 0
    to_delete = files[: len(files) - max_reports]
    for f in to_delete:
        f.unlink()
    return len(to_delete)


def read_json_file(path: Path) -> dict[str, Any] | None:
    """Read a JSON file. Returns None if it doesn't exist."""
    if not path.exists():
        return None
    with open(path) as f:
        return json.load(f)


def write_json_file(path: Path, data: dict[str, Any]) -> None:
    """Write a JSON file, creating parent dirs if needed."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)


def get_cycle_counter(repo_path: str) -> int:
    """Read the current cycle counter. Returns 0 if not set."""
    path = Path(repo_path) / ORGANISM_DIR / "cycle-counter.json"
    data = read_json_file(path)
    if data is None:
        return 0
    return data.get("cycle", 0)


def increment_cycle_counter(repo_path: str) -> int:
    """Increment and return the new cycle counter value."""
    path = Path(repo_path) / ORGANISM_DIR / "cycle-counter.json"
    current = get_cycle_counter(repo_path)
    new_val = current + 1
    write_json_file(path, {"cycle": new_val})
    return new_val
