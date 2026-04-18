"""Events collector — extracts the EVENTS constant from app/lib/events.js.

The `EVENTS` object is the canonical list of realtime + webhook event
strings. Surfacing it in the skill answers "what can I subscribe to?"
without an LLM having to grep.
"""
import os
import re

from livingcode.types import EventInfo

EVENTS_FILE = "app/lib/events.js"

_BLOCK_RE = re.compile(
    r"export\s+const\s+EVENTS\s*=\s*\{(.*?)\};",
    re.DOTALL,
)
# Match `CONSTANT_NAME: 'event.name',` entries. Allow optional trailing
# comment or whitespace; single or double quoted values.
_ENTRY_RE = re.compile(
    r"([A-Z_][A-Z0-9_]*)\s*:\s*['\"]([a-z][a-z0-9_.]*)['\"]",
)


def collect_events(repo_path: str) -> list[EventInfo]:
    path = os.path.join(repo_path, EVENTS_FILE)
    if not os.path.isfile(path):
        return []
    try:
        with open(path, encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except OSError:
        return []

    m = _BLOCK_RE.search(content)
    if not m:
        return []

    results: list[EventInfo] = []
    for constant, event in _ENTRY_RE.findall(m.group(1)):
        results.append(EventInfo(constant=constant, event=event))
    return results
