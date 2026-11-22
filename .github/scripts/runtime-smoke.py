"""Verify the installed skill through its public build and check commands."""

import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory


REPO = Path(__file__).resolve().parents[2]
SKILL = REPO / "skills" / "manim-blackboard"
INSTALLER = REPO / "scripts" / "install.mjs"
STARTERS = (
    ("interactive", "node", "build-interactive.mjs", "scale-deck.mjs", "check-interactive.py"),
    ("three", "node", "build-three.mjs", "quarter-turn.mjs", "check-three.py"),
    ("manim", sys.executable, "build.py", "distance.py", "check.py"),
)


def run(*args, cwd, env):
    command = [os.fspath(argument) for argument in args]
    print(subprocess.list2cmdline(command), flush=True)
    subprocess.run(command, cwd=cwd, env=env, check=True, timeout=900)


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def offline_environment(env):
    unavailable = "http://127.0.0.1:1"
    return {
        **env,
        "UV_OFFLINE": "1",
        "PIP_NO_INDEX": "1",
        "npm_config_offline": "true",
        "HTTP_PROXY": unavailable,
        "http_proxy": unavailable,
        "HTTPS_PROXY": unavailable,
        "https_proxy": unavailable,
        "ALL_PROXY": unavailable,
        "all_proxy": unavailable,
        "NO_PROXY": "",
        "no_proxy": "",
    }


def build_and_check(target, parent, env):
    parent.mkdir()
    for mode, runtime, builder, starter, checker in STARTERS:
        output = parent / f"{mode} lesson.html"
        run(runtime, Path("scripts") / builder, Path("assets/starters") / starter,
            "-o", output, cwd=target, env=env)
        require(output.is_file() and output.stat().st_size > 0, f"No {mode} HTML was built")
        run("node", Path("scripts") / "setup.mjs", "run-python", Path("scripts") / checker, output, cwd=target, env=env)


def check_install_report(report, expected):
    require(report.is_file(), "The installer did not write install-report.md")
    content = report.read_text(encoding="utf-8")
    rows = [
        [cell.strip().strip("`") for cell in line.strip().strip("|").split("|")]
        for line in content.splitlines() if line.lstrip().startswith("|")
    ]
    for dependency in expected:
        row = next((row for row in rows if row[0].lower() == dependency), None)
        require(row is not None and len(row) >= 5, f"Report omitted {dependency}")
        _, version, status, location, source = row[:5]
        require(re.fullmatch(r"v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?", version) is not None,
                f"Report did not record a version for {dependency}")
        require(status.lower() in {"reused", "installed"}, f"Report omitted setup status for {dependency}")
        path = Path(location)
        require(path.is_absolute() and path.exists(), f"Report did not record a usable path for {dependency}")
        require(bool(source), f"Report omitted the source for {dependency}")
    return content


def restore(target, env):
    run("node", target / "scripts" / "restore.mjs", cwd=target.parent, env=env)
    require(not (target / ".manim-blackboard").exists(), "Restore left the private runtime or report")


def main():
    env = {**os.environ, "PYTHONUTF8": "1"}
    print(f"uv already on PATH: {bool(shutil.which('uv'))}", flush=True)
    with TemporaryDirectory(prefix="Manim Blackboard ", dir=os.environ.get("RUNNER_TEMP")) as temp:
        work = Path(temp)
        target = work / "Installed Skills" / "manim-blackboard"
        runtime = target / ".manim-blackboard"
        report = runtime / "install-report.md"
        install = ("node", INSTALLER, "--target", target)

        # Install just enough to author SVG first. Other builders must prepare themselves.
        run(*install, "--mode", "interactive", cwd=REPO, env=env)
        require(runtime.is_dir(), "The install did not create a reusable skill runtime")
        require(not list((runtime / "js").glob("three-*")), "SVG-only setup installed Three.js")
        check_install_report(report, ("esbuild",))
        build_and_check(target, work / "First builds", env)

        # Model an earlier installation with stale instructions and an existing runtime.
        instructions = target / "SKILL.md"
        stale_instructions = instructions.read_bytes() + b"\nStale skill instructions\n"
        instructions.write_bytes(stale_instructions)
        report.write_text("Stale install report\n", encoding="utf-8")
        sentinel = runtime / "runtime-smoke-sentinel"
        sentinel.write_text("Preserve installed state\n", encoding="utf-8")
        user_file = target / "User notes.txt"
        user_file.write_text("Unrelated user file\n", encoding="utf-8")
        offline = offline_environment(env)
        run(*install, cwd=REPO, env=offline)
        require(instructions.read_bytes() == (SKILL / "SKILL.md").read_bytes(),
                "Update did not deliver the current skill instructions")
        require(sentinel.read_text(encoding="utf-8") == "Preserve installed state\n",
                "Update did not preserve the existing runtime directory")
        updated_report = check_install_report(report, ("esbuild", "three", "manim", "playwright"))
        require("Stale install report" not in updated_report, "Update kept the stale report")
        build_and_check(target, work / "Builds after update", offline)

        restore(target, offline)
        require(instructions.read_bytes() == stale_instructions,
                "Restore did not roll back to the previous skill files")
        require(user_file.read_text(encoding="utf-8") == "Unrelated user file\n", "Restore changed a user file")

        first = work / "Clean restore fixture" / "manim-blackboard"
        run("node", INSTALLER, "--target", first, "--mode", "interactive", cwd=REPO, env=env)
        first_user_file = first / "User notes.txt"
        first_user_file.write_text("Another unrelated file\n", encoding="utf-8")
        restore(first, offline)
        require(not (first / "SKILL.md").exists(), "Restore left files from the first installation")
        require(first_user_file.read_text(encoding="utf-8") == "Another unrelated file\n",
                "Restore of the first installation changed a user file")


if __name__ == "__main__":
    main()
