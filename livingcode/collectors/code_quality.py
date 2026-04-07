"""Code quality collector — file length, lint status, TODO count, archive size."""
import os
import re
import subprocess
from pathlib import Path
from livingcode.types import CodeQualityReport, FileInfo

SKIP_DIRS = {"node_modules", ".next", "dist", ".git", "__pycache__", ".organism", "coverage"}
CODE_EXTENSIONS = {".js", ".ts", ".jsx", ".tsx"}
PYTHON_EXTENSIONS = {".py"}


def _run_lint(repo_path: str) -> str:
    """Run ESLint via npm run lint. Returns 'pass' or 'fail'."""
    try:
        result = subprocess.run(
            ["npm", "run", "lint"],
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=60,
        )
        return "pass" if result.returncode == 0 else "fail"
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return "unknown"


def collect_code_quality(repo_path: str, max_file_length: int = 300) -> CodeQualityReport:
    """Collect code quality metrics."""
    files_over_limit = 0
    all_files: list[FileInfo] = []
    todo_count = 0
    python_over_limit = 0

    for root, dirs, files in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for fname in files:
            ext = os.path.splitext(fname)[1]
            if ext not in CODE_EXTENSIONS and ext not in PYTHON_EXTENSIONS:
                continue
            if fname.endswith(".d.ts"):
                continue
            filepath = os.path.join(root, fname)
            try:
                with open(filepath, encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                lines = content.count("\n") + (1 if content and not content.endswith("\n") else 0)
            except OSError:
                continue

            rel_path = os.path.relpath(filepath, repo_path).replace("\\", "/")

            if ext in CODE_EXTENSIONS:
                all_files.append(FileInfo(path=rel_path, lines=lines))
                if lines > max_file_length:
                    files_over_limit += 1
            elif ext in PYTHON_EXTENSIONS:
                if lines > max_file_length:
                    python_over_limit += 1

            # Count TODOs and FIXMEs
            todo_count += len(re.findall(r"\bTODO\b|\bFIXME\b", content))

    # Sort largest files descending, take top 10
    all_files.sort(key=lambda f: f.lines, reverse=True)
    largest = all_files[:10]

    # Archive size
    archive_dir = Path(repo_path) / "app" / "api" / "_archive"
    archive_kb = 0
    if archive_dir.exists():
        total_bytes = sum(
            f.stat().st_size for f in archive_dir.rglob("*") if f.is_file()
        )
        archive_kb = total_bytes // 1024

    # ESLint
    eslint_status = _run_lint(repo_path)

    return CodeQualityReport(
        files_over_300_lines=files_over_limit,
        largest_files=largest,
        eslint_status=eslint_status,
        python_files_over_300=python_over_limit,
        todo_count=todo_count,
        archive_size_kb=archive_kb,
    )
