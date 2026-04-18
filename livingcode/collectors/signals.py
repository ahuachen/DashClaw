"""Signal-type collector.

Signals are the vocabulary webhooks subscribe to and native adapters render.
Unlike EVENTS and VALID_SETTING_KEYS (which live in one file each), signal
types are authored inline wherever something decides to alert — `signals.js`,
`cost-alerts.js`, `health-change-alerts.js`, and future alerters.

Rather than ask authors to register into a central list, we detect signal-
emitting files by the call sites they use (`fireWebhooksForOrg(` or
`deliverNativeNotifications(`) and harvest every `type: '<snake_case>'`
literal from those files. That keeps the collector drift-proof: any new
alerter wired through the canonical delivery pipeline is discovered
automatically, while unrelated `type:` strings in other files are ignored.
"""
import os
import re

from livingcode.types import SettingKeyInfo  # noqa: F401 (kept for parity)

SCAN_ROOTS = ["app/lib", "app/api"]
SKIP_DIRS = {"node_modules", ".next", "__pycache__", "_archive"}
SCAN_EXTENSIONS = {".js", ".mjs", ".ts", ".tsx"}

_DELIVERY_CALL_RE = re.compile(
    r"\b(?:fireWebhooksForOrg|deliverNativeNotifications)\s*\("
)
_TYPE_RE = re.compile(r"type:\s*['\"]([a-z][a-z0-9_]*)['\"]")
# Signal-shape probe: type + severity ('red' or 'amber') within a small window.
# `severity: 'red'|'amber'` is unique to signal objects in this codebase,
# which lets us detect files that BUILD signals without delivering them
# (e.g. signals.js, which returns signals for the cron to later deliver).
_SIGNAL_SHAPE_WINDOW = 200  # characters — roughly 6-8 lines
_SEVERITY_LITERAL_RE = re.compile(r"severity:\s*['\"](?:red|amber)['\"]")


def _signal_types_in_file(content: str, scrape_all: bool) -> set[str]:
    """Extract signal `type:` names from one file.

    If `scrape_all` is True (the file calls the delivery pipeline directly),
    every `type:` literal is treated as a signal — the delivery call site
    is strong evidence that this file authors signals.

    Otherwise, only `type:` literals that have a red/amber `severity:`
    literal within a short proximity window are kept. This is the
    signal-shape heuristic: it catches authored-elsewhere signals
    (e.g. signals.js returning arrays the cron later delivers) while
    rejecting unrelated `type:` literals that happen to share a file
    with fixture/demo signals.
    """
    out: set[str] = set()
    for m in _TYPE_RE.finditer(content):
        if scrape_all:
            out.add(m.group(1))
            continue
        start = max(0, m.start() - _SIGNAL_SHAPE_WINDOW)
        end = min(len(content), m.end() + _SIGNAL_SHAPE_WINDOW)
        if _SEVERITY_LITERAL_RE.search(content[start:end]):
            out.add(m.group(1))
    return out


def collect_signal_types(repo_path: str) -> list[str]:
    """Return sorted unique signal `type` strings.

    Two detection modes applied per file:
      1. Files calling `fireWebhooksForOrg` / `deliverNativeNotifications`
         are assumed to be signal call sites — every `type:` is kept.
      2. Other files contribute only `type:` literals that pair with a
         red/amber `severity:` in close proximity. Catches signal-builder
         modules (signals.js) without pulling in demo fixtures or unrelated
         `type:` fields elsewhere in the same file.
    """
    types: set[str] = set()

    for rel_root in SCAN_ROOTS:
        root = os.path.join(repo_path, rel_root)
        if not os.path.isdir(root):
            continue
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
            for fname in filenames:
                ext = os.path.splitext(fname)[1]
                if ext not in SCAN_EXTENSIONS:
                    continue
                fpath = os.path.join(dirpath, fname)
                try:
                    with open(fpath, encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                except OSError:
                    continue
                delivers = bool(_DELIVERY_CALL_RE.search(content))
                types |= _signal_types_in_file(content, scrape_all=delivers)

    return sorted(types)
