"""Schema collector — reads Drizzle schema to extract table definitions."""
import os
import re

from livingcode.types import TableInfo

TABLE_RE = re.compile(r"pgTable\(\s*['\"](\w+)['\"]")


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
        for match in TABLE_RE.finditer(content):
            tables.append(TableInfo(name=match.group(1), file_path=rel_path))
    except OSError:
        pass

    tables.sort(key=lambda t: t.name)
    return tables
