"""T4 validation runner for BUG-04.

Invokes hooks/dashclaw_pretool.py as a subprocess across four scenarios
with /api/guard pointed at an unreachable URL (127.0.0.1:1). Captures
exit code, stderr, and the orphan-log record for each scenario. Results
are emitted as a single JSON blob that 01.5-BUG04-VALIDATION.md consumes.

Scoped to a tempdir — does not touch the real ~/.dashclaw/.
"""

import json
import os
import subprocess
import sys
import tempfile


HOOK = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "hooks", "dashclaw_pretool.py")
UNREACHABLE = "http://127.0.0.1:1"

TOOL_INPUT = {
    "session_id": "sess_bug04_validation",
    "tool_name": "Bash",
    "tool_input": {"command": "rm -rf .planning/phases/02-claude-code-beachhead/02-DISCUSS-CHECKPOINT.json"},
    "tool_use_id": "tu_bug04_validation",
}


def run(scenario_name, overrides):
    home = tempfile.mkdtemp(prefix="bug04-home-")
    tmp = tempfile.mkdtemp(prefix="bug04-tmp-")
    env = {k: v for k, v in os.environ.items() if not k.startswith("DASHCLAW_")}
    env.update({
        "HOME": home,
        "USERPROFILE": home,
        "TEMP": tmp, "TMP": tmp, "TMPDIR": tmp,
        "DASHCLAW_BASE_URL": UNREACHABLE,
        "DASHCLAW_API_KEY": "stub-key-validation",
        "DASHCLAW_AGENT_ID": "claude-code",
        "DASHCLAW_WORKSPACE": os.getcwd(),
        "DASHCLAW_PERMISSION_MODE": "danger",
        "DASHCLAW_GUARD_TIMEOUT": "0.5",
    })
    env.update(overrides)

    proc = subprocess.run(
        [sys.executable, HOOK],
        input=json.dumps(TOOL_INPUT).encode("utf-8"),
        capture_output=True,
        timeout=15,
        env=env,
    )
    stderr = proc.stderr.decode("utf-8", errors="replace").strip()

    orphan_path = os.path.join(home, ".dashclaw", "orphan-actions.jsonl")
    orphan_records = []
    if os.path.exists(orphan_path):
        with open(orphan_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    orphan_records.append(json.loads(line))

    return {
        "scenario": scenario_name,
        "env_overrides": overrides,
        "exit_code": proc.returncode,
        "stderr_lines": [ln for ln in stderr.splitlines() if ln],
        "orphan_records": orphan_records,
    }


def main():
    results = [
        run("1. enforce + block (default)", {}),
        run("2. enforce + warn", {"DASHCLAW_GUARD_UNAVAILABLE_POLICY": "warn"}),
        run("3. enforce + allow", {"DASHCLAW_GUARD_UNAVAILABLE_POLICY": "allow"}),
        run("4. observe mode", {"DASHCLAW_HOOK_MODE": "observe"}),
    ]
    out_path = os.environ.get("BUG04_OUT") or "/tmp/bug04-val/results.json"
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    sys.stdout.write("wrote " + out_path + "\n")


if __name__ == "__main__":
    main()
