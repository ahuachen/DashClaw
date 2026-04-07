"""Safety systems — kill switch, cycle lock, failure tracking, pause."""
from pathlib import Path
from livingcode.state import read_json_file, write_json_file
from datetime import datetime, timezone

ORGANISM_DIR = ".organism"


def is_kill_switch_active(repo_path: str) -> bool:
    return (Path(repo_path) / ORGANISM_DIR / "kill-switch").exists()


def activate_kill_switch(repo_path: str) -> None:
    path = Path(repo_path) / ORGANISM_DIR / "kill-switch"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.touch()


def deactivate_kill_switch(repo_path: str) -> None:
    path = Path(repo_path) / ORGANISM_DIR / "kill-switch"
    if path.exists():
        path.unlink()


def is_cycle_locked(repo_path: str) -> bool:
    path = Path(repo_path) / ORGANISM_DIR / "active-cycle.json"
    return path.exists()


def acquire_cycle_lock(repo_path: str) -> None:
    path = Path(repo_path) / ORGANISM_DIR / "active-cycle.json"
    write_json_file(path, {"started": datetime.now(timezone.utc).isoformat()})


def release_cycle_lock(repo_path: str) -> None:
    path = Path(repo_path) / ORGANISM_DIR / "active-cycle.json"
    if path.exists():
        path.unlink()


def get_consecutive_failures(repo_path: str) -> int:
    path = Path(repo_path) / ORGANISM_DIR / "consecutive-failures.json"
    data = read_json_file(path)
    return data.get("count", 0) if data else 0


def increment_failures(repo_path: str) -> int:
    current = get_consecutive_failures(repo_path)
    new_count = current + 1
    path = Path(repo_path) / ORGANISM_DIR / "consecutive-failures.json"
    write_json_file(path, {"count": new_count})
    if new_count >= 3:
        _set_paused(repo_path)
    return new_count


def reset_failures(repo_path: str) -> None:
    path = Path(repo_path) / ORGANISM_DIR / "consecutive-failures.json"
    write_json_file(path, {"count": 0})
    _clear_paused(repo_path)


def is_paused(repo_path: str) -> bool:
    return (Path(repo_path) / ORGANISM_DIR / "paused").exists()


def _set_paused(repo_path: str) -> None:
    (Path(repo_path) / ORGANISM_DIR / "paused").touch()


def _clear_paused(repo_path: str) -> None:
    path = Path(repo_path) / ORGANISM_DIR / "paused"
    if path.exists():
        path.unlink()
