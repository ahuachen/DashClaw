"""Notification-adapter collector — enumerates the native signal adapters.

The adapter registry lives in `app/lib/notification-adapters/index.js`. Each
adapter file exports an object with `name` and `requiredKeys`. We parse each
sibling `.js` file rather than the registry index so order-independence
holds and the list reflects the filesystem.
"""
import os
import re

from livingcode.types import AdapterInfo

ADAPTERS_DIR = "app/lib/notification-adapters"

_NAME_RE = re.compile(r"name:\s*['\"]([a-zA-Z0-9_-]+)['\"]")
_KEYS_RE = re.compile(r"requiredKeys:\s*\[([^\]]+)\]", re.DOTALL)
_STRING_RE = re.compile(r"['\"]([A-Z_][A-Z0-9_]*)['\"]")


def _parse_adapter_file(path: str) -> AdapterInfo | None:
    try:
        with open(path, encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except OSError:
        return None

    name_match = _NAME_RE.search(content)
    if not name_match:
        return None
    name = name_match.group(1)

    keys_match = _KEYS_RE.search(content)
    required_keys: list[str] = []
    if keys_match:
        required_keys = _STRING_RE.findall(keys_match.group(1))

    return AdapterInfo(name=name, required_keys=required_keys)


def collect_adapters(repo_path: str) -> list[AdapterInfo]:
    dir_path = os.path.join(repo_path, ADAPTERS_DIR)
    if not os.path.isdir(dir_path):
        return []

    results: list[AdapterInfo] = []
    for fname in sorted(os.listdir(dir_path)):
        if not fname.endswith(".js") or fname == "index.js":
            continue
        info = _parse_adapter_file(os.path.join(dir_path, fname))
        if info:
            results.append(info)
    return results
