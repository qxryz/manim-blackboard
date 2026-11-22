# Runtime setup and restore

## Install and update

From a Git checkout, run `node scripts/install.mjs --target PATH` with Node.js 20+ and npm. The target is the installed **skill folder**. Running the same command after pulling an update preserves its runtime. The installer copies tracked skill files and checks all modes by default. To provision a particular mode, append `--mode interactive`, `three`, `manim` or `check`. Builders can prepare additional modes on demand.

For a host using `npx skills add qxryz/manim-blackboard --skill manim-blackboard` or another file-copy installer, run `node scripts/setup.mjs` from the installed skill after installation and after each update. A host that replaces the whole directory can remove its private runtime. The repository installer preserves it. To prepare one mode from the installed directory, e.g. SVG, run `node scripts/setup.mjs interactive`.

## Dependency selection

The scripts announce the check and the absolute destination before probing. They try installed packages against the APIs the builders use. Missing packages, managed Python interpreters and downloaded browsers live under `.manim-blackboard/` in the skill. Keep this directory writable throughout installation. Allow network access on the first run that needs a download.

If your shell has no working `python` command, run any documented Python builder or checker through the same launcher. For example, run `node scripts/setup.mjs run-python scripts/build.py assets/starters/distance.py -o build/lesson.html` from the installed skill directory. This uses an existing interpreter or provisions a private one.

- Interactive SVG uses esbuild. Scenes that import Three.js also need Three.js and OrbitControls. Node.js and npm can be reused across projects.
- The Manim builder tries installed Python environments and a private virtual environment. Windows on ARM can use an x64 Python when a native Manim installation is unavailable. When setup needs a Python interpreter, it can use uv to acquire it locally. If both Python and uv are missing, the Node setup command can fetch a checksum-verified uv binary on supported x64 and ARM64 hosts using curl and tar.
- On a connectivity failure with public PyPI, Python setup tries the Tsinghua PyPI mirror. Set `MANIM_BLACKBOARD_PYPI_MIRRORS` to a comma-separated list of HTTPS mirror URLs to replace the default. An empty value disables mirror retries. Private package-index settings take precedence. On macOS and Linux a public installation that encounters a missing native Cairo/Pango build dependency can acquire a private conda-forge environment. Setup can reuse an existing Pixi installation or download a checksum-verified Pixi executable into the skill. [Manim installation notes](https://docs.manim.community/en/stable/installation/uv.html)
- Browser checks try Playwright and an existing browser before downloading Chromium. Pass `--channel chrome` or `--channel msedge` to select an installed browser explicitly.

The latest report is private to the installation at `.manim-blackboard/install-report.md`. Dated copies are in `.manim-blackboard/reports/`. Each run records the mode, status, resolved package versions, purpose and absolute paths, including runs that reused everything. A partial failure still records completed profiles. Open the report after setup and retry the same command after correcting the failure.

## Restore

Close active builds and checks. Double-click `restore.cmd` on Windows or `restore.command` on macOS. On Linux run `./restore.command`. All three run `node scripts/restore.mjs` from the installed skill. This removes the skill's private runtime, caches and report. The managed installer also records the previous contents of files it changes. Restore undoes its most recent file-changing installation or update. A repeated setup with identical files retains that restore point. If a managed file has since been edited, the script identifies it before changing files. Lessons and separately installed tools keep their own locations.
