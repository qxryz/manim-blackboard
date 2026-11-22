"""Prepare native Cairo/Pango dependencies in a private conda-forge environment."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.error import URLError
from urllib.request import urlopen


CONDA_FORGE = "https://conda.anaconda.org/conda-forge"
RELEASE = "2.9.0-0"
RELEASE_BASE = f"https://github.com/mamba-org/micromamba-releases/releases/download/{RELEASE}"
# SHA-256 digests of the raw executables on the official release above.
ASSETS = {
    ("Linux", "x86_64"): ("linux-64", "366cd9cd8be14df1ab8ed50352a82111082a36686b2d389fdb79a92c3fafb3e3"),
    ("Linux", "aarch64"): ("linux-aarch64", "9f93b974adcb4d166996af969b6cd371287d1a3e52733704727884d9b74cb7a7"),
    ("Linux", "ppc64le"): ("linux-ppc64le", "af28181e62239dcc94ae23eefac3dce24b3d7b17a769810cbee99b183333f9a3"),
    ("Darwin", "x86_64"): ("osx-64", "1e71054bb3ac9a076e21f7ec48acfef536f9b3f1408f371a942784bf5ef83d8a"),
    ("Darwin", "aarch64"): ("osx-arm64", "ec2a072f028e1a7cf20f3e2e74d5a8127cf5a5f27636375b5359811565f4e5be"),
}


def _conda_root(skill_root: Path) -> Path:
    return skill_root.resolve() / ".manim-blackboard" / "conda"


def _environment_python(root: Path, generation: str) -> Path:
    return root / "envs" / generation / "environment" / "bin" / "python"


def conda_manim_python(skill_root: Path) -> Path:
    """Return the previously prepared interpreter, or a missing candidate path."""
    root = _conda_root(skill_root)
    try:
        generation = (root / "active-env").read_text(encoding="utf-8").strip()
    except (OSError, UnicodeError):
        generation = ""
    if not re.fullmatch(r"manim-[A-Za-z0-9_-]+", generation):
        generation = "unavailable"
    return _environment_python(root, generation)


def _run(argv, env, timeout):
    return subprocess.run(argv, env=env, stdin=subprocess.DEVNULL, capture_output=True,
                          text=True, encoding="utf-8", errors="replace", timeout=timeout)


def _output(argv, env):
    try:
        result = _run(argv, env, timeout=20)
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return result.stdout.strip() if result.returncode == 0 else ""


def _config_environment(root, inherited):
    for directory in ("pkgs", "envs", "tmp", "xdg-cache"):
        (root / directory).mkdir(parents=True, exist_ok=True)
    config = root / "condarc"
    config.write_text("register_envs: false\n", encoding="utf-8")
    return {
        **inherited,
        "MAMBA_ROOT_PREFIX": str(root),
        "CONDA_ROOT_PREFIX": str(root),
        "CONDA_PKGS_DIRS": str(root / "pkgs"),
        "CONDA_ENVS_PATH": str(root / "envs"),
        "CONDARC": str(config),
        "CONDA_REGISTER_ENVS": "false",
        "MAMBA_REGISTER_ENVS": "false",
        "CONDA_ADD_ANACONDA_TOKEN": "false",
        "CONDA_REPORT_ERRORS": "false",
        "TMPDIR": str(root / "tmp"),
        "XDG_CACHE_HOME": str(root / "xdg-cache"),
    }


def _manager_argv(executable, kind, env):
    if kind == "micromamba":
        return [executable, "--rc-file", env["CONDARC"]]
    return [executable]


def _manager_ready(executable, kind, env):
    if not executable or not _output([executable, "--version"], env):
        return False
    command = _manager_argv(executable, kind, env)
    query = ["list"] if kind == "micromamba" else ["--show", "register_envs"]
    config = _output([*command, "config", *query], env)
    return bool(re.search(r"(?im)^\s*register_envs:\s*false\s*$", config))


def _verified_binary(binary: Path, expected: str) -> bool:
    try:
        with binary.open("rb") as file:
            return hashlib.file_digest(file, "sha256").hexdigest() == expected
    except OSError:
        return False


def _download_micromamba(binary: Path, asset: str, expected: str):
    binary.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading micromamba {RELEASE} from the official GitHub release\nInstall path {binary}",
          file=sys.stderr, flush=True)
    temp = None
    try:
        with tempfile.NamedTemporaryFile(dir=binary.parent, delete=False) as file:
            temp = Path(file.name)
            with urlopen(f"{RELEASE_BASE}/micromamba-{asset}", timeout=60) as response:
                shutil.copyfileobj(response, file)
        if not _verified_binary(temp, expected):
            raise RuntimeError("The micromamba download did not match the official SHA-256 checksum.")
        temp.chmod(0o755)
        temp.replace(binary)
    except (OSError, URLError, TimeoutError) as error:
        raise RuntimeError("Could not download the official micromamba release from GitHub.") from error
    finally:
        if temp is not None:
            temp.unlink(missing_ok=True)


def _select_manager(root, env, asset):
    cache_binary = root / "bin" / f"micromamba-{RELEASE}-{asset[0]}"
    if _verified_binary(cache_binary, asset[1]) and _manager_ready(cache_binary, "micromamba", env):
        return cache_binary, "micromamba"
    candidates = (
        (shutil.which("micromamba", path=env.get("PATH")), "micromamba"),
        (env.get("CONDA_EXE"), "conda"),
        (shutil.which("conda", path=env.get("PATH")), "conda"),
    )
    for executable, kind in candidates:
        if _manager_ready(executable, kind, env):
            return Path(executable).resolve(), kind
    _download_micromamba(cache_binary, *asset)
    if not _manager_ready(cache_binary, "micromamba", env):
        raise RuntimeError("The verified micromamba binary could not run on this host with local configuration.")
    return cache_binary, "micromamba"


def _publish_environment(root, generation):
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=root, delete=False) as marker:
        marker.write(generation + "\n")
        temporary = Path(marker.name)
    try:
        temporary.replace(root / "active-env")
    finally:
        temporary.unlink(missing_ok=True)


def prepare_conda_manim(skill_root: Path, *, min_python="3.12", manim_spec="manim>=0.20.1,<0.23",
                        probe, env=None) -> Path:
    """Reuse or create a conda-forge Manim runtime and verify its Python."""
    system = platform.system()
    machine = platform.machine().lower()
    machine = {"amd64": "x86_64", "arm64": "aarch64"}.get(machine, machine)
    asset = ASSETS.get((system, machine))
    if asset is None:
        raise RuntimeError(f"No conda-forge native Manim setup is available for {system} {machine}.")

    root = _conda_root(skill_root)
    print(f"Checking the private Cairo/Pango runtime and environment managers\nManaged runtime directory {root}",
          file=sys.stderr, flush=True)
    existing = conda_manim_python(skill_root)
    if existing.is_file() and probe(existing):
        return existing

    environ = _config_environment(root, os.environ if env is None else env)
    executable, kind = _select_manager(root, environ, asset)
    generation = Path(tempfile.mkdtemp(prefix="manim-", dir=root / "envs"))
    prefix = generation / "environment"
    python = _environment_python(root, generation.name)
    command = _manager_argv(executable, kind, environ)
    command += ["create", "--yes", "--prefix", str(prefix), "--override-channels", "--channel", CONDA_FORGE]
    if kind == "conda":
        command += ["--no-default-packages"]
    command += [f"python={min_python}", manim_spec]
    print(f"Installing Python, Manim, Cairo, and Pango from conda-forge using {executable}\nInstall directory {prefix}",
          file=sys.stderr, flush=True)
    try:
        result = _run(command, environ, timeout=900)
        if result.returncode:
            raise RuntimeError(f"{kind} could not resolve or install the conda-forge runtime (exit {result.returncode}).")
        if not python.is_file() or not probe(python):
            raise RuntimeError("The conda-forge environment did not pass the Manim import check.")
        _publish_environment(root, generation.name)
        return python
    except (OSError, subprocess.TimeoutExpired) as error:
        raise RuntimeError(f"{kind} could not finish the local conda-forge setup.") from error
    finally:
        if conda_manim_python(skill_root) != python:
            shutil.rmtree(generation, ignore_errors=True)
