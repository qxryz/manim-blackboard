"""Prepare native Cairo/Pango dependencies in a private conda-forge environment."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from urllib.request import urlopen


CONDA_FORGE = "https://conda.anaconda.org/conda-forge"
RELEASE = "v0.84.2"
RELEASE_BASE = f"https://github.com/prefix-dev/pixi/releases/download/{RELEASE}"
PLATFORMS = {("Linux", "x86_64"): "linux-64", ("Linux", "aarch64"): "linux-aarch64",
             ("Linux", "ppc64le"): "linux-ppc64le", ("Darwin", "x86_64"): "osx-64",
             ("Darwin", "aarch64"): "osx-arm64"}
# The two SHA-256 digests are for the archive and its executable respectively.
ASSETS = {
    "linux-64": ("x86_64-unknown-linux-musl", "6d2a576bde0a7b26533a068fec0aea6e4ee21c36668efc1dc73fce90110906ae",
                 "32523b4d1f43ca1583579252bbf7f977f83e4ce16f1333225379ece9f46bff0c"),
    "linux-aarch64": ("aarch64-unknown-linux-musl", "0957b6352d077bb3ffcce913f90b1e6cfbc6b98888a45d59ee2910e8c4811110",
                      "68995ac4a33d821f0080c1af4fb6fec4efd6dc3022c490d9dd904a2a7065610c"),
    "osx-64": ("x86_64-apple-darwin", "a633a4f8276955b73248397c17ce77380eb7133dc96c54bc271239b7dc9b8837",
               "134bce0a41861e59d0981b5c0b6e750c2b7837a80d114954390b0486df6253aa"),
    "osx-arm64": ("aarch64-apple-darwin", "039d4b48c7e17bc62a36faa2af1b13d0d187f5dd6e8fea17e0587302438df6e6",
                  "86b4e47c6fbbf3da8aa47a2ad8ea2e1ec3f505ecf6d7d4c4fdaa203071690148"),
}


def _conda_root(skill_root: Path) -> Path:
    return skill_root.resolve() / ".manim-blackboard" / "conda"


def _environment_python(root: Path, generation: str, kind: str) -> Path:
    parent = root / "envs" / generation
    prefix = parent / "project" / ".pixi" / "envs" / "default" if kind == "pixi" else parent / "environment"
    return prefix / "bin" / "python"


def conda_manim_python(skill_root: Path) -> Path:
    """Return the previously prepared interpreter, or a missing candidate path."""
    root = _conda_root(skill_root)
    try:
        generation = (root / "active-env").read_text(encoding="utf-8").strip()
    except (OSError, UnicodeError):
        generation = ""
    if not re.fullmatch(r"manim-[A-Za-z0-9_-]+", generation):
        generation = "unavailable"
    conda_python = _environment_python(root, generation, "conda")
    if conda_python.is_file():
        return conda_python
    return _environment_python(root, generation, "pixi")


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
    for directory in ("pkgs", "envs", "tmp", "xdg-cache", "pixi-cache", "pixi-home"):
        (root / directory).mkdir(parents=True, exist_ok=True)
    config = root / "condarc"
    _write_atomically(config, "register_envs: false\n")
    env = {
        **inherited,
        "MAMBA_ROOT_PREFIX": str(root),
        "CONDA_ROOT_PREFIX": str(root),
        "CONDA_PKGS_DIRS": str(root / "pkgs"),
        "CONDA_ENVS_PATH": str(root / "envs"),
        "CONDARC": str(config),
        "CONDA_REGISTER_ENVS": "false",
        "MAMBA_REGISTER_ENVS": "false",
        "CONDA_ADD_ANACONDA_TOKEN": "false",
        "CONDA_NOTIFY_OUTDATED_CONDA": "false",
        "CONDA_REPORT_ERRORS": "false",
        "TMPDIR": str(root / "tmp"),
        "XDG_CACHE_HOME": str(root / "xdg-cache"),
        "PIXI_CACHE_DIR": str(root / "pixi-cache"),
        "RATTLER_CACHE_DIR": str(root / "pixi-cache"),
        "PIXI_HOME": str(root / "pixi-home"),
        "PIXI_FROZEN": "false",
        "PIXI_LOCKED": "false",
        "PIXI_NO_INSTALL": "false",
    }
    env.pop("PIXI_CONFIG_FILE", None)
    return env


def _manager_argv(executable, kind, env):
    if kind == "micromamba":
        return [executable, f"--rc-file={env['CONDARC']}"]
    return [executable]


def _manager_version(executable, kind, env):
    if not executable:
        return None
    match = re.search(r"\b\d+(?:\.\d+){1,3}\b", _output([executable, "--version"], env))
    if not match:
        return None
    if kind == "pixi":
        help_text = _output([executable, "install", "--help"], env)
        return match.group() if "--no-config" in help_text and "--manifest-path" in help_text else None
    command = _manager_argv(executable, kind, env)
    query = ["list"] if kind == "micromamba" else ["--show", "register_envs"]
    config = _output([*command, "config", *query], env)
    if re.search(r"(?im)^\s*register_envs:\s*false\s*$", config):
        return match.group()
    return None


def _verified_binary(binary: Path, expected: str) -> bool:
    try:
        digest = hashlib.sha256()
        with binary.open("rb") as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest() == expected
    except OSError:
        return False


def _download_pixi(binary: Path, asset: str, archive_digest: str, executable_digest: str):
    binary.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading Pixi {RELEASE} from the official GitHub release\nInstall path {binary}",
          file=sys.stderr, flush=True)
    archive_path = executable_path = None
    try:
        with tempfile.NamedTemporaryFile(dir=binary.parent, delete=False) as file:
            archive_path = Path(file.name)
            with urlopen(f"{RELEASE_BASE}/pixi-{asset}.tar.gz", timeout=60) as response:
                shutil.copyfileobj(response, file)
        if not _verified_binary(archive_path, archive_digest):
            raise RuntimeError("The Pixi archive did not match the official SHA-256 checksum.")
        with tarfile.open(archive_path, "r:gz") as archive:
            member = archive.getmember("pixi")
            if not member.isfile():
                raise RuntimeError("The verified Pixi archive did not contain a regular executable.")
            with archive.extractfile(member) as source, tempfile.NamedTemporaryFile(dir=binary.parent, delete=False) as file:
                executable_path = Path(file.name)
                shutil.copyfileobj(source, file)
        if not _verified_binary(executable_path, executable_digest):
            raise RuntimeError("The Pixi executable did not match the official SHA-256 checksum.")
        executable_path.chmod(0o755)
        executable_path.replace(binary)
    except (OSError, tarfile.TarError, KeyError) as error:
        raise RuntimeError("Could not download or read the official Pixi release from GitHub.") from error
    finally:
        for temporary in (archive_path, executable_path):
            if temporary is not None:
                temporary.unlink(missing_ok=True)


def _select_manager(root, env, subdir):
    path = env.get("PATH")
    configured_conda = env.get("CONDA_EXE")
    candidates = ((shutil.which("micromamba", path=path), "micromamba"),
                  (shutil.which(configured_conda, path=path) if configured_conda else None, "conda"),
                  (shutil.which("conda", path=path), "conda"),
                  (shutil.which("pixi", path=path), "pixi"))
    for executable, kind in dict.fromkeys(candidates):
        version = _manager_version(executable, kind, env)
        if version:
            return Path(executable).resolve(), kind, version, "existing installation"
    asset = ASSETS.get(subdir)
    if not asset:
        raise RuntimeError(f"No portable Pixi release is available for {subdir}.")
    cache_binary = root / "bin" / f"pixi-{RELEASE}-{asset[0]}"
    if _verified_binary(cache_binary, asset[2]):
        version = _manager_version(cache_binary, "pixi", env)
        if version:
            return cache_binary, "pixi", version, "managed runtime"
    _download_pixi(cache_binary, *asset)
    version = _manager_version(cache_binary, "pixi", env)
    if not version:
        raise RuntimeError("The verified Pixi executable could not run on this host.")
    return cache_binary, "pixi", version, "official GitHub release"


def _write_atomically(path, content):
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as file:
        file.write(content)
        temporary = Path(file.name)
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def _record_manager(env, executable, kind, version, source):
    if report_path := env.get("MANIM_BLACKBOARD_REPORT_DIR"):
        folder = Path(report_path)
        folder.mkdir(parents=True, exist_ok=True)
        action = "installed" if source == "official GitHub release" else "reused"
        fact = {"name": kind, "version": version, "path": str(executable), "action": action, "source": source}
        _write_atomically(folder / "conda.json", json.dumps([fact], indent=2) + "\n")


def _install_command(executable, kind, generation, prefix, subdir, min_python, manim_spec, env):
    if kind == "pixi":
        project = generation / "project"
        project.mkdir()
        manifest = project / "pixi.toml"
        manifest.write_text(
            "[workspace]\nname = 'manim-blackboard-native'\n"
            f"channels = [{json.dumps(CONDA_FORGE)}]\nplatforms = [{json.dumps(subdir)}]\n"
            "[dependencies]\n"
            f"python = {json.dumps(min_python + '.*')}\nmanim = {json.dumps(manim_spec.removeprefix('manim'))}\n",
            encoding="utf-8",
        )
        return [executable, "install", "--no-config", "--manifest-path", str(manifest)]
    command = _manager_argv(executable, kind, env)
    command += ["create", "--yes", "--prefix", str(prefix), "--override-channels", "--channel", CONDA_FORGE]
    if kind == "conda":
        command += ["--no-default-packages"]
    return command + [f"python={min_python}", manim_spec]


def prepare_conda_manim(skill_root: Path, *, min_python="3.12", manim_spec="manim>=0.20.1,<0.23",
                        probe, env=None) -> Path:
    """Reuse or create a conda-forge Manim runtime and verify its Python."""
    system = platform.system()
    machine = platform.machine().lower()
    machine = {"amd64": "x86_64", "arm64": "aarch64"}.get(machine, machine)
    subdir = PLATFORMS.get((system, machine))
    if subdir is None:
        raise RuntimeError(f"No conda-forge native Manim setup is available for {system} {machine}.")

    root = _conda_root(skill_root)
    print(f"Checking the private Cairo/Pango runtime and environment managers\nManaged runtime directory {root}",
          file=sys.stderr, flush=True)
    existing = conda_manim_python(skill_root)
    if existing.is_file() and probe(existing):
        return existing

    try:
        environ = _config_environment(root, os.environ if env is None else env)
        executable, kind, version, source = _select_manager(root, environ, subdir)
        _record_manager(environ, executable, kind, version, source)
        generation = Path(tempfile.mkdtemp(prefix="manim-", dir=root / "envs"))
    except OSError as error:
        raise RuntimeError("Could not prepare the private conda-forge runtime directory.") from error
    python = _environment_python(root, generation.name, kind)
    prefix = python.parent.parent
    ready = False
    try:
        command = _install_command(executable, kind, generation, prefix, subdir, min_python, manim_spec, environ)
        print(f"Installing Python, Manim, Cairo, and Pango from conda-forge using {executable}\nInstall directory {prefix}",
              file=sys.stderr, flush=True)
        result = _run(command, environ, timeout=900)
        if result.returncode:
            raise RuntimeError(f"{kind} could not resolve or install the conda-forge runtime (exit {result.returncode}).")
        if not python.is_file() or not probe(python):
            raise RuntimeError("The conda-forge environment did not pass the Manim import check.")
        _write_atomically(root / "active-env", generation.name + "\n")
        ready = True
        return python
    except (OSError, subprocess.TimeoutExpired) as error:
        raise RuntimeError(f"{kind} could not finish the local conda-forge setup.") from error
    finally:
        if not ready and generation.resolve().parent == (root / "envs").resolve():
            shutil.rmtree(generation, ignore_errors=True)
