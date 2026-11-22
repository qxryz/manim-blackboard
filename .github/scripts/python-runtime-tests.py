"""Exercise Python package source selection without making network requests."""

import os
from pathlib import Path
from subprocess import CompletedProcess
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch


sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "skills" / "manim-blackboard" / "scripts"))
import python_runtime as runtime


COMMAND = ["python", "-m", "pip", "install"]
MIRROR = "https://mirror.example.test/simple"
PRIVATE = "https://packages.example.test/simple"
REQUIREMENT = runtime.PROFILES["manim"][0]
NETWORK_FAILURE = CompletedProcess(COMMAND, 1, "", "Could not fetch packages: connection reset")


class PackageSourceTests(unittest.TestCase):
    def test_public_network_failure_retries_with_public_mirror(self):
        env = {"NETRC": "test-home-credentials"}
        success = CompletedProcess(COMMAND, 0, "", "")
        with (patch.dict(os.environ, {runtime.MIRROR_SETTING: MIRROR}, clear=True),
              patch.object(runtime, "run", side_effect=[NETWORK_FAILURE, success]) as run):
            self.assertEqual(runtime.install_packages("manim", COMMAND, env, configured=False), "mirror.example.test")
        self.assertEqual([call.args for call in run.call_args_list], [
            ([*COMMAND, "--index-url", runtime.PYPI, REQUIREMENT], env),
            ([*COMMAND, "--index-url", MIRROR, REQUIREMENT], {**env, "NETRC": os.devnull}),
        ])

    def test_private_pip_and_uv_configuration_never_retries_public_indexes(self):
        with TemporaryDirectory() as temporary:
            for setting, configured in (("PIP_INDEX_URL", runtime.configured_pip), ("UV_INDEX_URL", runtime.configured_uv)):
                with self.subTest(setting=setting):
                    env = {setting: PRIVATE, "APPDATA": temporary, "PROGRAMDATA": temporary,
                           "XDG_CONFIG_HOME": temporary, "XDG_CONFIG_DIRS": temporary}
                    with (patch.dict(os.environ, {runtime.MIRROR_SETTING: MIRROR}, clear=True),
                          patch.object(runtime, "query", return_value=""),
                          patch.object(runtime, "public_mirrors") as mirrors,
                          patch.object(runtime, "run", return_value=NETWORK_FAILURE) as run):
                        supplied = configured("python", env) if setting.startswith("PIP_") else configured(env)
                        self.assertTrue(supplied)
                        with self.assertRaisesRegex(runtime.RuntimeSetupError, "configured package index"):
                            runtime.install_packages("manim", COMMAND, env, configured=supplied)
                    run.assert_called_once_with([*COMMAND, REQUIREMENT], env)
                    mirrors.assert_not_called()

    def test_public_package_resolution_failure_is_not_retried(self):
        missing = CompletedProcess(COMMAND, 1, "", "No matching distribution found for manim")
        with (patch.dict(os.environ, {runtime.MIRROR_SETTING: MIRROR}, clear=True),
              patch.object(runtime, "run", return_value=missing) as run):
            with self.assertRaisesRegex(runtime.RuntimeSetupError, "Could not install manim from PyPI"):
                runtime.install_packages("manim", COMMAND, {}, configured=False)
        run.assert_called_once_with([*COMMAND, "--index-url", runtime.PYPI, REQUIREMENT], {})


if __name__ == "__main__":
    unittest.main()
