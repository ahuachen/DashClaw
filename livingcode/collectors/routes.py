"""Route collector — scans app/api/ to extract the API surface."""
import os
import re

from livingcode.types import RouteInfo

METHOD_RE = re.compile(
    r"export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b"
)
DYNAMIC_PARAM_RE = re.compile(r"\[([^\]]+)\]")


def collect_routes(repo_path: str) -> list[RouteInfo]:
    """Scan app/api/ for route.js files and extract the API surface."""
    api_dir = os.path.join(repo_path, "app", "api")
    if not os.path.isdir(api_dir):
        return []

    routes: list[RouteInfo] = []
    for root, _dirs, files in os.walk(api_dir):
        if "route.js" not in files:
            continue

        route_file = os.path.join(root, "route.js")

        # Convert filesystem path to API path: app/api/guard/decide → /api/guard/decide
        rel_dir = os.path.relpath(root, os.path.join(repo_path, "app"))
        api_path = "/" + rel_dir.replace("\\", "/")

        archived = "/_archive/" in api_path or api_path.startswith("/api/_archive/")

        # Extract dynamic params from [bracket] segments
        raw_params = DYNAMIC_PARAM_RE.findall(api_path)
        dynamic_params = [p.lstrip(".") for p in raw_params]  # strip ...catchAll

        # Read file and extract exported HTTP methods
        methods: list[str] = []
        try:
            with open(route_file, encoding="utf-8", errors="ignore") as f:
                content = f.read()
            methods = sorted(set(METHOD_RE.findall(content)))
        except OSError:
            pass

        rel_file = os.path.relpath(route_file, repo_path).replace("\\", "/")

        routes.append(
            RouteInfo(
                path=api_path,
                methods=methods,
                dynamic_params=dynamic_params,
                archived=archived,
                file_path=rel_file,
            )
        )

    routes.sort(key=lambda r: r.path)
    return routes
