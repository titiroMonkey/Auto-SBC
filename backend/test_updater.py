import base64
import hashlib
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import updater


class UpdaterTests(unittest.TestCase):
    def release(self, tag="v27.10"):
        content = b"verified executable"
        return {
            "tag_name": tag,
            "assets": [{
                "name": updater.ASSET_NAME,
                "browser_download_url": f"{updater.RELEASE_DOWNLOAD}/{tag}/{updater.ASSET_NAME}",
                "size": len(content),
                "digest": "sha256:" + hashlib.sha256(content).hexdigest(),
            }],
        }

    def test_versions_are_numeric_and_only_stable_fc27_releases_are_selected(self):
        self.assertIsNotNone(updater.find_update(self.release(), "v27.9"))
        for tag in ["v27.1", "v27.9", "v27.10-rc1", "v28.1", "invalid"]:
            self.assertIsNone(updater.find_update(self.release(tag), "v27.9"))
        for flag in ["draft", "prerelease"]:
            self.assertIsNone(updater.find_update({**self.release(), flag: True}, "v27.9"))
        self.assertIsNone(updater.find_update(self.release(), "unknown"))

    def test_asset_url_size_and_checksum_are_required(self):
        for field, value in [("browser_download_url", "https://example.com/update.exe"),
                             ("size", 0), ("size", updater.MAX_DOWNLOAD_BYTES + 1), ("digest", None)]:
            release = self.release()
            release["assets"][0][field] = value
            with self.assertRaises(ValueError):
                updater.find_update(release, "v27.1")
        release = self.release()
        checksum = release["assets"][0].pop("digest").split(":")[1]
        release["body"] = f"SHA256: `{checksum}`\n"
        self.assertEqual(updater.find_update(release, "v27.1")["sha256"], checksum)
        release["assets"] = []
        self.assertIsNone(updater.find_update(release, "v27.1"))

    def test_download_is_verified_before_installation(self):
        update = updater.find_update(self.release(), "v27.1")
        for content, succeeds in [(b"verified executable", True), (b"corrupt", False),
                                  (b"x" * update["size"], False), (b"x" * (update["size"] + 1), False)]:
            with self.subTest(content=content), tempfile.TemporaryDirectory() as directory:
                response = MagicMock()
                response.__enter__.return_value = response
                response.iter_content.return_value = [content]
                destination = Path(directory) / "update.exe"
                with patch.object(updater.requests, "get", return_value=response):
                    if succeeds:
                        updater.download_update(update, destination)
                        self.assertEqual(destination.read_bytes(), content)
                    else:
                        with self.assertRaises(ValueError):
                            updater.download_update(update, destination)

    def test_source_and_disabled_runs_do_not_check_network(self):
        with patch.object(updater.requests, "get") as request:
            self.assertFalse(updater.check_for_update())
            with patch.object(updater.sys, "frozen", True, create=True), patch.dict(updater.os.environ, {"AUTOSBC_DISABLE_UPDATES": "1"}):
                self.assertFalse(updater.check_for_update())
            request.assert_not_called()

    def test_restart_skip_is_consumed_without_network_access(self):
        with patch.dict(updater.os.environ, {"AUTOSBC_SKIP_UPDATE_ONCE": "1"}), \
                patch.object(updater.requests, "get") as request:
            self.assertFalse(updater.check_for_update())
            self.assertNotIn("AUTOSBC_SKIP_UPDATE_ONCE", updater.os.environ)
            request.assert_not_called()

    @unittest.skipUnless(os.name == "nt", "Windows startup flow")
    def test_accepted_update_exits_only_after_verified_download_and_helper_start(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.json.return_value = self.release()
        for failure in [None, "download", "helper"]:
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as root:
                with patch.object(updater.sys, "frozen", True, create=True), \
                        patch.object(updater.sys, "executable", str(Path(root) / updater.ASSET_NAME)), \
                        patch.object(updater, "current_version", return_value="v27.1"), \
                        patch.object(updater.requests, "get", return_value=response), \
                        patch.object(updater, "show_message", return_value=6) as prompt, \
                        patch.object(updater, "download_update") as download, \
                        patch.object(updater, "launch_update_helper") as launch:
                    launch.return_value.poll.return_value = None
                    if failure == "download":
                        download.side_effect = ValueError("Checksum mismatch")
                    if failure == "helper":
                        launch.side_effect = OSError("Helper launch failed")
                    self.assertEqual(updater.check_for_update(), failure is None)
                    download.assert_called_once()
                    if failure == "download":
                        launch.assert_not_called()
                    else:
                        launch.assert_called_once()
                    if failure:
                        self.assertEqual(list(Path(root).iterdir()), [])
                        self.assertEqual(prompt.call_count, 2)

    @unittest.skipUnless(os.name == "nt", "Windows helper launch")
    def test_helper_launch_encodes_paths_and_waits_for_readiness(self):
        with tempfile.TemporaryDirectory(prefix="AutoSBC space ' ") as root:
            directory = Path(root)
            process = MagicMock()
            process.poll.return_value = None

            def ready(*args, **kwargs):
                (directory / "helper-ready").touch()
                return process

            update = updater.find_update(self.release(), "v27.1")
            with patch.object(updater.subprocess, "Popen", side_effect=ready) as launch:
                self.assertIs(updater.launch_update_helper(directory, update), process)
            command = launch.call_args.args[0]
            script = base64.b64decode(command[-1]).decode("utf-16-le")
            payload = updater.re.search(r"FromBase64String\('([^']+)'\)", script).group(1)
            metadata = json.loads(base64.b64decode(payload))
            self.assertEqual(metadata["directory"], root)
            self.assertEqual(metadata["sha256"], update["sha256"])
            self.assertEqual(command[-2], "-EncodedCommand")
            (directory / "helper-ready").unlink()
            process.poll.return_value = 1
            with patch.object(updater.subprocess, "Popen", return_value=process):
                with self.assertRaisesRegex(RuntimeError, "exited before becoming ready"):
                    updater.launch_update_helper(directory, update)

    def test_decline_and_offline_checks_keep_current_version(self):
        response = MagicMock()
        response.__enter__.return_value = response
        response.json.return_value = self.release()
        with patch.object(updater.sys, "frozen", True, create=True), patch.object(updater.os, "name", "nt"), \
                patch.object(updater, "current_version", return_value="v27.1"), \
                patch.object(updater.requests, "get", return_value=response) as request, \
                patch.object(updater, "show_message", return_value=7), \
                patch.object(updater, "download_update") as download:
            self.assertFalse(updater.check_for_update())
            download.assert_not_called()
            request.side_effect = updater.requests.ConnectionError("offline")
            self.assertFalse(updater.check_for_update())

    @unittest.skipUnless(os.name == "nt", "Windows replacement helper")
    def test_windows_helper_replaces_or_rolls_back_using_real_files(self):
        powershell = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
        helper = Path(updater.__file__).with_name("update-helper.ps1").read_text(encoding="utf-8")
        for scenario in ["success", "startup-failure", "launch-failure", "bad-checksum", "original-running"]:
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory(prefix="AutoSBC space ' ") as root:
                directory = Path(root) / "staging"
                directory.mkdir()
                target = Path(root) / "AutoSBCBackend.exe"
                target.write_bytes(b"old version")
                download = directory / updater.ASSET_NAME
                download.write_bytes(b"new version")
                metadata = {
                    "pid": 123456, "target": str(target), "download": str(download),
                    "backup": str(directory / "previous.exe"), "directory": str(directory),
                    "cwd": root, "sha256": hashlib.sha256(b"new version").hexdigest(),
                }
                if scenario == "bad-checksum":
                    metadata["sha256"] = "0" * 64
                metadata_path = Path(root) / "metadata.json"
                metadata_path.write_text(json.dumps(metadata), encoding="utf-8")
                script = helper + """
$global:starts = @()
function Get-Process {
    param($Id, $ErrorAction)
    if ($env:UPDATER_TEST_SCENARIO -eq 'original-running') {
        $original = [PSCustomObject]@{}
        $original | Add-Member -MemberType ScriptMethod -Name WaitForExit -Value { param($Timeout) return $false }
        return $original
    }
    return $null
}
function Start-Process {
    param($FilePath, $WorkingDirectory, [switch]$PassThru)
    $global:starts += $FilePath
    if ($env:UPDATER_TEST_SCENARIO -eq 'launch-failure' -and $global:starts.Count -eq 1) {
        throw 'Simulated launch failure'
    }
    if ($env:PYINSTALLER_RESET_ENVIRONMENT -ne '1') { throw 'Missing fresh PyInstaller environment' }
    if ($env:AUTOSBC_SKIP_UPDATE_ONCE -ne '1') { throw 'Missing update loop protection' }
    return [PSCustomObject]@{ Id = 123457; HasExited = $true }
}
function Wait-AutoSbcReady {
    param($Process)
    if ($env:UPDATER_TEST_SCENARIO -eq 'startup-failure') { throw 'Simulated startup failure' }
}
function Show-AutoSbcUpdateError { param($Text) }
$update = Get-Content -LiteralPath $env:UPDATER_TEST_METADATA -Raw | ConvertFrom-Json
Invoke-AutoSbcUpdate -Update $update
$expectedStarts = switch ($env:UPDATER_TEST_SCENARIO) {
    'startup-failure' { 2 }
    'launch-failure' { 2 }
    'original-running' { 0 }
    default { 1 }
}
if ($global:starts.Count -ne $expectedStarts) { throw 'Incorrect restart count' }
"""
                result = subprocess.run(
                    [str(powershell), "-NoProfile", "-NonInteractive", "-Command", script],
                    env={**os.environ, "UPDATER_TEST_METADATA": str(metadata_path), "UPDATER_TEST_SCENARIO": scenario},
                    capture_output=True, text=True, timeout=20,
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                self.assertEqual(target.read_bytes(), b"new version" if scenario == "success" else b"old version")
                self.assertEqual(directory.exists(), scenario != "success")


if __name__ == "__main__":
    unittest.main()