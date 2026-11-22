"""Build the Manim starter without system Cairo/Pango development files."""

import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory


SKILL = Path(__file__).resolve().parents[2] / "skills" / "manim-blackboard"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def build(target, output, facts, env):
    command = (sys.executable, "scripts/build.py", "assets/starters/distance.py", "-o", str(output))
    subprocess.run(command, cwd=target, env={**env, "MANIM_BLACKBOARD_REPORT_DIR": str(facts)},
                   check=True, timeout=1200)
    data = re.search(r'<script id="lesson" type="application/json">(.*?)</script>',
                     output.read_text(encoding="utf-8"), re.DOTALL)
    require(data is not None and len(json.loads(data[1])["captions"]) == 2,
            "The native starter did not produce its two playable stops")
    dependencies = json.loads((facts / "manim.json").read_text(encoding="utf-8"))
    return next(dep for dep in dependencies if dep["name"] == "Manim")


def main():
    registry = Path.home() / ".conda" / "environments.txt"
    previous_registry = registry.read_bytes() if registry.is_file() else None
    with TemporaryDirectory(prefix="blackboard-conda-", dir=os.environ.get("RUNNER_TEMP")) as temporary:
        work = Path(temporary).resolve()
        target = work / "skill"
        shutil.copytree(SKILL, target, ignore=shutil.ignore_patterns(".manim-blackboard", "node_modules", "__pycache__"))
        private = target / ".manim-blackboard"
        conda = private / "conda"
        missing_pc_files = work / "empty-pkg-config"
        missing_pc_files.mkdir()

        # Hide system .pc files and require native source packages for the first attempt.
        # Leave the actual conda-forge download, resolver, and Manim build unmocked.
        env = {key: value for key, value in os.environ.items()
               if not key.startswith(("CONDA", "MAMBA", "PIP_", "UV_", "XDG_"))
               and key not in {"PKG_CONFIG_PATH", "PYTHONPATH", "VIRTUAL_ENV"}}
        env.update(PATH=os.defpath, PKG_CONFIG_LIBDIR=str(missing_pc_files),
                   PIP_NO_BINARY="manimpango,pycairo", MANIM_BLACKBOARD_PYPI_MIRRORS="")
        first = build(target, work / "first.html", private / "first-build", env)
        require(first["source"] == "conda-forge" and first["action"] == "installed",
                "The public builder did not provision the conda-forge fallback")

        active = conda / "active-env"
        generation = active.read_text(encoding="utf-8").strip()
        package = Path(first["path"]).resolve()
        prefix = next((parent for parent in package.parents if (parent / "conda-meta").is_dir()), None)
        require(prefix is not None and prefix.is_relative_to(conda / "envs" / generation),
                "Manim is outside the private prefix")
        records = [json.loads(path.read_text(encoding="utf-8")) for path in (prefix / "conda-meta").glob("*.json")]
        need = {"cairo", "pango", "manim", "python"}
        require(need <= {record["name"] for record in records}, "The prefix lacks its native libraries")
        require(all("conda-forge" in record.get("url", "") for record in records if record["name"] in need),
                "A fallback dependency was fetched outside conda-forge")
        caches = (conda / "pkgs", conda / "pixi-cache")
        require(any(path for cache in caches for path in cache.rglob("manim-*")),
                "The package cache is outside the skill")

        unavailable = "http://127.0.0.1:1"
        offline = {**env, "CONDA_OFFLINE": "1", "UV_OFFLINE": "1", "PIP_NO_INDEX": "1",
                   "HTTP_PROXY": unavailable, "http_proxy": unavailable,
                   "HTTPS_PROXY": unavailable, "https_proxy": unavailable,
                   "ALL_PROXY": unavailable, "all_proxy": unavailable, "NO_PROXY": "", "no_proxy": ""}
        second = build(target, work / "second.html", private / "second-build", offline)
        require(second["source"] == "conda-forge" and second["action"] == "reused" and second["path"] == first["path"],
                "The public builder did not reuse the same conda-forge Manim offline")
        require(active.read_text(encoding="utf-8").strip() == generation, "The offline build replaced the private prefix")
        current_registry = registry.read_bytes() if registry.is_file() else None
        require(current_registry == previous_registry, "The private prefix changed the user's Conda registry")
        print("PASS conda-forge native fallback, local dependencies, and offline reuse")


if __name__ == "__main__":
    main()
