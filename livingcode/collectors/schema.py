"""Schema collector — reads Drizzle schema to extract table definitions.

Picks up an optional `// @domain <name>` annotation sitting on a line before a
`pgTable(...)` call and attaches it to the resulting TableInfo, so downstream
consumers (shape.mjs, doctor checks) can filter tables by domain without a
hand-curated lookup in the Node code.
"""
import os
import re

from livingcode.types import TableInfo

TABLE_RE = re.compile(r"pgTable\(\s*['\"](\w+)['\"]")
DOMAIN_RE = re.compile(r"@domain\s+([A-Za-z_][A-Za-z0-9_-]*)")


def collect_schema(repo_path: str) -> list[TableInfo]:
    """Parse schema/schema.js for pgTable() definitions."""
    schema_file = os.path.join(repo_path, "schema", "schema.js")
    if not os.path.isfile(schema_file):
        return []

    tables: list[TableInfo] = []
    try:
        with open(schema_file, encoding="utf-8", errors="ignore") as f:
            content = f.read()

        rel_path = "schema/schema.js"
        pending_domain: str | None = None
        for raw_line in content.splitlines():
            # Comment line carrying a @domain tag — remember it for the next pgTable.
            dm = DOMAIN_RE.search(raw_line)
            if dm:
                pending_domain = dm.group(1)
                continue
            # pgTable call — take any pending domain, then reset so the
            # annotation doesn't bleed into subsequent unannotated tables.
            tm = TABLE_RE.search(raw_line)
            if tm:
                tables.append(
                    TableInfo(
                        name=tm.group(1),
                        file_path=rel_path,
                        domain=pending_domain,
                    )
                )
                pending_domain = None
    except OSError:
        pass

    tables.sort(key=lambda t: t.name)
    return tables
