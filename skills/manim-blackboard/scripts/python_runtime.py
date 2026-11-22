"""Prepare the Python environment for Manim builds and browser checks."""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from pathlib import Path
import json
import os
import re
import shutil
import subprocess
import sys
import sysconfig
import tempfile
import time
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".manim-blackboard"
PYPI = "https://pypi.org/simple"
DEFAULT_MIRROR = "https://pypi.tuna.tsinghua.edu.cn/simple"
MIRROR_SETTING = "MANIM_BLACKBOARD_PYPI_MIRRORS"
REPORT_SETTING = "MANIM_BLACKBOARD_REPORT_DIR"
PROFILES = {
    "manim": ("manim>=0.20.1,<0.23", (3, 11), (0, 20, 1), (0, 23, 0),
              "from manim import Scene, ValueTracker, VMobject, register_font, tempconfig"),
    "playwright": ("playwright>=1.57,<2", (3, 10), (1, 57, 0), (2, 0, 0),
                   "from playwright.sync_api import Page, sync_playwright; assert hasattr(Page, 'clock')"),
}
INDEX_FAILURE = re.compile(
    r"network is unreachable|could not (?:resolve|fetch)|connection (?:reset|refused|aborted)|"
    r"name resolution|name or service not known|getaddrinfo|failed to (?:download|fetch)|"
    r"error sending request|timed? ?out|proxyerror|newconnectionerror|certificate verify failed|"
    r"status code.{0,12}\b(?:429|50[0234])\b", re.IGNORECASE,
)
NATIVE_MANIM_FAILURE = re.compile(r"\b(?:cairo|pangocairo|pango|pkg-config)\b", re.IGNORECASE)
PIP_SOURCE_SETTINGS = {"index-url", "extra-index-url", "find-links", "no-index", "trusted-host"}
UV_SOURCE_SETTINGS = {"UV_INDEX", "UV_DEFAULT_INDEX", "UV_INDEX_URL", "UV_EXTRA_INDEX_URL",
                      "UV_FIND_LINKS", "UV_NO_INDEX", "UV_INSECURE_HOST", "UV_CONFIG_FILE"}


class RuntimeSetupError(Exception):
    pass


class NativeManimError(RuntimeSetupError):
    pass


def run(command, env=None, timeout=None):
    # Installer output can contain configured index URLs or proxy credentials.
    return subprocess.run(command, env=env, timeout=timeout, capture_output=True,
                          text=True, encoding="utf-8", errors="replace", check=False)


def query(command, env=None):
    try:
        result = run(command, env, timeout=15)
    except (OSError, subprocess.TimeoutExpired):
        return ""
    return result.stdout.strip() if result.returncode == 0 else ""


def usable(python, name):
    _, minimum_python, minimum, maximum, imports = PROFILES[name]
    code = (
        "import re, sys; from importlib.metadata import version; "
        f"assert sys.version_info >= {minimum_python!r}; "
        f"release = re.fullmatch(r'(\\d+)\\.(\\d+)\\.(\\d+)(?:\\+.+)?', version({name!r})); "
        f"assert release and {minimum!r} <= tuple(map(int, release.groups())) < {maximum!r}; "
        f"{imports}; print('ready')"
    )
    return query([python, "-I", "-B", "-c", code]).endswith("ready")


def venv_python(directory):
    return directory / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def runtime_env():
    env = os.environ.copy()
    env["UV_CACHE_DIR"] = str(CACHE / "uv-cache")
    env["PIP_CACHE_DIR"] = str(CACHE / "pip-cache")
    temp = CACHE / "tmp"
    temp.mkdir(parents=True, exist_ok=True)
    env.update(TMPDIR=str(temp), TMP=str(temp), TEMP=str(temp))
    env.setdefault("UV_HTTP_RETRIES", "1")
    env.setdefault("UV_HTTP_TIMEOUT", "15")
    env.setdefault("PIP_DISABLE_PIP_VERSION_CHECK", "1")
    env.setdefault("PIP_NO_INPUT", "1")
    for key in ("PIP_TARGET", "PIP_PREFIX", "PIP_ROOT", "PIP_USER", "PIP_PYTHON",
                "UV_TARGET", "UV_PREFIX", "UV_SYSTEM_PYTHON"):
        env.pop(key, None)
    return env


@contextmanager
def setup_lock(name):
    CACHE.mkdir(parents=True, exist_ok=True)
    with (CACHE / f"{name}.lock").open("a+b") as stream:
        if os.name == "nt":
            import msvcrt

            deadline = time.monotonic() + 600
            while True:
                stream.seek(0)
                try:
                    msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
                    break
                except OSError:
                    if time.monotonic() >= deadline:
                        raise RuntimeSetupError(f"Timed out waiting for {name} setup.") from None
                    time.sleep(0.25)
        else:
            import fcntl

            fcntl.flock(stream, fcntl.LOCK_EX)
        # Closing the file releases the lock even when installation fails.
        yield


def windows_arm64():
    return os.name == "nt" and (
        sysconfig.get_platform() == "win-arm64"
        or os.environ.get("PROCESSOR_ARCHITEW6432", "").upper() == "ARM64"
    )


def python_info(python):
    output = query([python, "-I", "-B", "-c",
                    "import json, sys, sysconfig; print(json.dumps([list(sys.version_info[:2]), sysconfig.get_platform()]))"])
    return json.loads(output) if output else ([], "")


def candidate_pythons(name, uv, env, x64):
    candidates = [Path(sys.executable)]
    for key in ("VIRTUAL_ENV", "CONDA_PREFIX"):
        if os.environ.get(key):
            location = Path(os.environ[key])
            candidates.extend((venv_python(location), location / "python.exe"))
    if uv:
        request = "cpython-3.12-windows-x86_64-none" if x64 else f">={'.'.join(map(str, PROFILES[name][1]))},<3.15"
        found = query([uv, "python", "find", "--no-python-downloads", request], env)
        if found:
            candidates.append(Path(found))
    launcher = shutil.which("py") if os.name == "nt" else None
    if launcher:
        arguments = ["-3.12-64"] if x64 else ["-3.12"]
        found = query([launcher, *arguments, "-I", "-B", "-c", "import sys; print(sys.executable)"], env)
        if found:
            candidates.append(Path(found))
    for command in ("python3.12", "python3.13", "python3.11", "python3.14", "python3", "python"):
        path = shutil.which(command)
        if path and "windowsapps" not in str(path).lower():
            candidates.append(Path(path))
    return list(dict.fromkeys(path for path in candidates if path.is_file()))


def local_uv(env):
    node = shutil.which("node")
    setup = ROOT / "scripts" / "setup.mjs"
    if not node or not setup.is_file():
        return None
    # Keep the setup command's dependency notice visible before its download.
    result = subprocess.run([node, setup, "--ensure-uv"], env=env, stdout=subprocess.PIPE,
                            text=True, encoding="utf-8", errors="replace", check=False)
    path = result.stdout.strip()
    return path if result.returncode == 0 and path and Path(path).is_file() else None


def base_python(name, candidates, uv, env, x64):
    minimum = PROFILES[name][1]
    for python in candidates:
        version, platform = python_info(python)
        if minimum <= tuple(version) < (3, 15) and (not x64 or platform == "win-amd64"):
            return python, uv, False
    if not uv and x64:
        uv = local_uv(env)
    if uv:
        managed_env = env.copy()
        managed_env["UV_PYTHON_INSTALL_DIR"] = str(CACHE / "interpreters")
        request = "cpython-3.12-windows-x86_64-none" if x64 else "3.12"
        lookup = [uv, "python", "find", "--managed-python", "--no-python-downloads", request]
        found = query(lookup, managed_env)
        if found:
            return Path(found), uv, False
        print(f"Downloading {'x64 ' if x64 else ''}Python 3.12 for {name} into {CACHE / 'interpreters'}.",
              file=sys.stderr, flush=True)
        install = [uv, "python", "install", "--no-bin"]
        if os.name == "nt":
            install.append("--no-registry")
        result = run([*install, request], managed_env)
        found = query(lookup, managed_env)
        if result.returncode == 0 and found:
            return Path(found), uv, True
    need = "an x64 CPython 3.12" if x64 else "Python 3.12"
    raise RuntimeSetupError(f"Could not find or set up {need}. Install it or check uv's Python download settings.")


def public_mirrors():
    mirrors = []
    for url in os.environ.get(MIRROR_SETTING, DEFAULT_MIRROR).split(","):
        url = url.strip().rstrip("/")
        if not url:
            continue
        try:
            parts = urlsplit(url)
            valid = (parts.scheme == "https" and parts.hostname and not parts.username
                     and not parts.password and "@" not in parts.netloc and not parts.query
                     and not parts.fragment and not any(character.isspace() for character in url))
        except ValueError:
            valid = False
        if not valid:
            raise RuntimeSetupError(f"{MIRROR_SETTING} requires public HTTPS URLs without credentials, queries or fragments.")
        if url != PYPI and url not in mirrors:
            mirrors.append(url)
    return mirrors


def configured_pip(python, env):
    settings = query([python, "-m", "pip", "config", "list"], env)
    keys = {line.partition("=")[0].split(".")[-1] for line in settings.splitlines()}
    if keys.intersection({"target", "prefix", "root", "user", "python"}):
        raise RuntimeSetupError("pip is configured to override the install destination. Use standard venv settings for local setup.")
    return bool(env.get("PIP_CONFIG_FILE")) or any(
        f"PIP_{setting.upper().replace('-', '_')}" in env for setting in PIP_SOURCE_SETTINGS
    ) or bool(keys.intersection(PIP_SOURCE_SETTINGS))


def configured_uv(env):
    configured = bool(UV_SOURCE_SETTINGS.intersection(env)) or any(key.startswith("UV_INDEX_") for key in env)
    # uv also discovers project, user and system configuration. Detect index
    # settings there without reading any configured values into output.
    config_home = Path(env.get("APPDATA") or env.get("XDG_CONFIG_HOME") or Path.home() / ".config")
    system_dirs = (Path(env.get("PROGRAMDATA", "C:/ProgramData")) / "uv",) if os.name == "nt" else (
        Path(directory) / "uv" for directory in env.get("XDG_CONFIG_DIRS", "/etc/xdg").split(os.pathsep)
    )
    files = [folder / "uv.toml" for folder in (config_home / "uv", *system_dirs)]
    if env.get("UV_CONFIG_FILE"):
        files.append(Path(env["UV_CONFIG_FILE"]))
    for directory in (Path.cwd(), *Path.cwd().parents):
        files.extend((directory / "pyproject.toml", directory / "uv.toml"))
    pattern = re.compile(r"(?m)^\s*(?:\[\[(?:tool\.uv\.)?index\]\]|(?:index-url|extra-index-url|"
                         r"index|default-index|find-links|no-index|allow-insecure-host)\s*=)")
    for path in files:
        if path.is_file():
            text = path.read_text(encoding="utf-8")
            if re.search(r"(?m)^\s*(?:system|target|prefix)\s*=", text):
                raise RuntimeSetupError("uv is configured to override the install destination. Use standard venv settings for local setup.")
            configured = configured or bool(pattern.search(text))
    return configured


def install_packages(name, command, env, configured):
    requirement = PROFILES[name][0]
    locations = [None] if configured else [PYPI, *public_mirrors()]
    for index, url in enumerate(locations):
        attempt_env = env.copy()
        options = []
        if url:
            options = ["--index-url", url]
        if index:
            print(f"Installing {name} from public Python package mirror {index} into {CACHE / name}.",
                  file=sys.stderr, flush=True)
            attempt_env["NETRC"] = os.devnull
        result = run([*command, *options, requirement], attempt_env)
        if result.returncode == 0:
            if configured:
                return "Configured package index"
            return urlsplit(url).hostname if index else "PyPI"
        if not INDEX_FAILURE.search(result.stderr):
            break
    detail = result.stdout + result.stderr
    if name == "manim" and os.name != "nt" and NATIVE_MANIM_FAILURE.search(detail) and not INDEX_FAILURE.search(detail):
        raise NativeManimError("Could not build the native Cairo or Pango packages for Manim.")
    location = "the configured package index" if configured else "PyPI or a configured public mirror"
    raise RuntimeSetupError(f"Could not install {name} from {location}. Check package availability and network access.")


def write_facts(profile, facts):
    directory = os.environ.get(REPORT_SETTING)
    if not directory:
        return
    target = Path(directory) / f"{profile}.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    prior = json.loads(target.read_text(encoding="utf-8")) if target.is_file() else []
    entries = {entry["name"]: entry for entry in prior}
    for fact in facts:
        previous = entries.get(fact["name"], {})
        if (previous.get("action") == "installed" and previous.get("path") == fact["path"]
                and previous.get("version") == fact["version"]):
            fact["action"] = "installed"
            fact["source"] = previous.get("source", fact["source"])
        entries[fact["name"]] = fact
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent, delete=False) as stream:
        staged = Path(stream.name)
        json.dump(list(entries.values()), stream, ensure_ascii=False)
    try:
        staged.replace(target)
    finally:
        staged.unlink(missing_ok=True)


def record_python(name, python, package_source=None, installed_python=False, native=False):
    if os.environ.get(REPORT_SETTING):
        code = ("import json, platform, sys; from importlib.metadata import version; "
                "from importlib.util import find_spec; name = sys.argv[1]; "
                "print(json.dumps([platform.python_version(), sys.executable, sys._base_executable, "
                "version(name), find_spec(name).origin]))")
        result = query([python, "-I", "-B", "-c", code, name])
        if result:
            python_version, python_path, base_path, version, package_path = json.loads(result)
            managed = Path(base_path).is_relative_to(CACHE / "interpreters")
            write_facts(name, [
                {"name": "Python", "version": python_version, "path": python_path,
                 "action": "installed" if installed_python else "reused",
                 "source": "conda-forge" if native else "uv-managed CPython" if managed else "Existing Python installation"},
                {"name": "Manim" if name == "manim" else "Playwright", "version": version, "path": package_path,
                 "action": "installed" if package_source else "reused",
                 "source": package_source or ("conda-forge" if native else "Existing Python environment")},
            ])
    return python


def select_python(name):
    location = CACHE / name
    print(f"Checking for usable {name}. If missing, it will be installed into {location}.",
          file=sys.stderr, flush=True)
    current = Path(sys.executable)
    native = None
    if name == "manim" and os.name != "nt":
        from conda_runtime import conda_manim_python, prepare_conda_manim

        native = conda_manim_python(ROOT)
    if usable(current, name):
        return record_python(name, current, native=current == native)
    cached = venv_python(location)
    with setup_lock(name):
        if cached.is_file() and usable(cached, name):
            return record_python(name, cached)
        if native is not None and native.is_file() and usable(native, name):
            return record_python(name, native, native=True)
        env = runtime_env()
        uv = shutil.which("uv")
        # ManimPango has Windows x64 wheels, while a native ARM64 install
        # requires building Pango. Keep using any working native installation.
        x64 = name == "manim" and windows_arm64()
        candidates = candidate_pythons(name, uv, env, x64)
        for candidate in candidates[1:]:
            if usable(candidate, name):
                return record_python(name, candidate)
        python, uv, installed_python = base_python(name, candidates, uv, env, x64)
        pip_config = configured_pip(python, env)
        uv_config = configured_uv(env) if uv else False
        use_uv = bool(uv and (uv_config or not pip_config))
        print(f"Creating the Python environment at {location}.", file=sys.stderr, flush=True)
        if use_uv:
            setup = run([uv, "venv", "--allow-existing", "--python", python, location], env)
            command = [uv, "pip", "install", "--python", cached]
        else:
            setup = run([python, "-m", "venv", location], env)
            command = [cached, "-m", "pip", "install", "--retries", "1", "--timeout", "15"]
        if setup.returncode:
            raise RuntimeSetupError(f"Could not create the local {name} environment. Check Python's venv support and directory permissions.")
        package_cache = env["UV_CACHE_DIR" if use_uv else "PIP_CACHE_DIR"]
        print(f"Installing {name} into {location}. Package cache is {package_cache}.",
              file=sys.stderr, flush=True)
        configured = uv_config if use_uv else pip_config
        try:
            package_source = install_packages(name, command, env, configured)
        except NativeManimError:
            offline = any(env.get(key, "").lower() not in ("", "0", "false", "no")
                          for key in ("UV_OFFLINE", "PIP_NO_INDEX", "CONDA_OFFLINE", "MAMBA_OFFLINE"))
            if native is None or configured or offline:
                raise
            try:
                ready = prepare_conda_manim(ROOT, manim_spec=PROFILES[name][0],
                                           probe=lambda candidate: usable(candidate, name), env=env)
            except RuntimeError as error:
                raise RuntimeSetupError(str(error)) from None
            return record_python(name, ready, "conda-forge", installed_python=True, native=True)
        if not usable(cached, name):
            raise RuntimeSetupError(f"Installed {name} failed its import check. Check native libraries and Python architecture.")
        return record_python(name, cached, package_source, installed_python)


def ensure_profile(name, script):
    """Reinvoke the same command with the selected interpreter when necessary."""
    python = select_python(name)
    if python != Path(sys.executable):
        raise SystemExit(subprocess.call([python, "-B", str(Path(script).resolve()), *sys.argv[1:]]))


def record_browser(browser, channel, installed=False):
    if not os.environ.get(REPORT_SETTING):
        return
    from playwright.sync_api import Error

    try:
        session = browser.new_browser_cdp_session()
        try:
            path = session.send("Browser.getBrowserCommandLine")["arguments"][0]
        finally:
            session.detach()
    except (Error, IndexError, KeyError):
        return
    path = Path(path)
    if not (path.is_absolute() and path.is_file()):
        return
    write_facts("playwright", [
        {"name": {"chrome": "Google Chrome", "msedge": "Microsoft Edge"}.get(channel, "Chromium"),
         "version": browser.version, "path": str(path), "action": "installed" if installed else "reused",
         "source": "Installed browser channel" if channel else "Playwright browser distribution"},
    ])


@contextmanager
def chromium_browser(channel=None, **launch_options):
    from playwright.sync_api import Error, sync_playwright

    setting = "PLAYWRIGHT_BROWSERS_PATH"
    original = os.environ.get(setting)
    local = str(CACHE / "chromium")
    if channel:
        print(f"Checking the installed {channel} browser for Playwright.", file=sys.stderr, flush=True)
    else:
        print(f"Checking for an existing Chromium, Chrome or Edge browser. If needed, Chromium will be downloaded into {local}.",
              file=sys.stderr, flush=True)
    try:
        candidates = [(channel, original)]
        if not channel:
            if original != local:
                candidates.append((None, local))
            candidates.extend((name, original) for name in ("chrome", "msedge"))
        for selected, location in candidates:
            if location is None:
                os.environ.pop(setting, None)
            else:
                os.environ[setting] = location
            with sync_playwright() as engine:
                try:
                    browser = engine.chromium.launch(channel=selected, **launch_options)
                except Error as error:
                    message = str(error).lower()
                    if channel or ("executable doesn't exist" not in message and "is not found at" not in message):
                        raise
                    continue
                record_browser(browser, selected)
                yield browser
                return
        os.environ[setting] = local
        print(f"Downloading Chromium for Playwright into {local}.", file=sys.stderr, flush=True)
        result = run([sys.executable, "-m", "playwright", "install", "chromium"], runtime_env())
        if result.returncode:
            raise RuntimeSetupError("Could not download Chromium. Use --channel chrome or --channel msedge with an installed browser, or check PLAYWRIGHT_DOWNLOAD_HOST.")
        with sync_playwright() as engine:
            browser = engine.chromium.launch(**launch_options)
            record_browser(browser, channel, installed=True)
            yield browser
    finally:
        if original is None:
            os.environ.pop(setting, None)
        else:
            os.environ[setting] = original


def main():
    parser = argparse.ArgumentParser(description=__doc__, epilog="Append -- SCRIPT [ARG ...] to run an example.")
    parser.add_argument("profile", choices=PROFILES)
    parser.add_argument("--channel", choices=("chrome", "msedge"), help="reuse an installed browser for Playwright")
    arguments = sys.argv[1:]
    script = []
    if "--" in arguments:
        separator = arguments.index("--")
        arguments, script = arguments[:separator], arguments[separator + 1:]
    options = parser.parse_args(arguments)
    try:
        if script:
            return subprocess.call([select_python(options.profile), "-B", *script])
        ensure_profile(options.profile, __file__)
        if options.profile == "playwright":
            from playwright.sync_api import Error

            try:
                with chromium_browser(options.channel) as browser:
                    browser.close()
            except Error as error:
                raise RuntimeSetupError(str(error).strip().splitlines()[0]) from None
        print(f"{options.profile} is ready.")
    except (RuntimeSetupError, OSError) as error:
        parser.exit(1, f"Setup failed: {error}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
