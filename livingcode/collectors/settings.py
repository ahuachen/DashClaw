"""Setting keys collector — parses VALID_SETTING_KEYS from settings.repository.js.

The source file lists allowed keys in an array, with `// <section>` comments
grouping related keys (AI Providers, Databases, Communication, etc.). We
preserve the section grouping so the skill can render a structured
"Configuration Knobs" section instead of a flat 70-item list.
"""
import os
import re

from livingcode.types import SettingKeyInfo

SETTINGS_FILE = "app/lib/repositories/settings.repository.js"

# Match the full `export const VALID_SETTING_KEYS = [ ... ];` block.
_BLOCK_RE = re.compile(
    r"export\s+const\s+VALID_SETTING_KEYS\s*=\s*\[(.*?)\];",
    re.DOTALL,
)
_STRING_RE = re.compile(r"'([A-Z_][A-Z0-9_]*)'")
_SECTION_RE = re.compile(r"^\s*//\s*(.+?)\s*$")


def collect_setting_keys(repo_path: str) -> list[SettingKeyInfo]:
    path = os.path.join(repo_path, SETTINGS_FILE)
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
    body = m.group(1)

    results: list[SettingKeyInfo] = []
    current_section: str | None = None
    seen: set[str] = set()

    for raw_line in body.splitlines():
        section_match = _SECTION_RE.match(raw_line)
        if section_match:
            current_section = section_match.group(1)
            continue
        # One line may carry multiple quoted keys.
        for key in _STRING_RE.findall(raw_line):
            if key in seen:
                continue
            seen.add(key)
            results.append(SettingKeyInfo(name=key, section=current_section))

    return results
