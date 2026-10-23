import base64
import ctypes
import hashlib
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from threading import Event

import requests


RELEASE_API = "https://api.github.com/repos/titiroMonkey/Auto-SBC/releases/latest"
RELEASE_DOWNLOAD = "https://github.com/titiroMonkey/Auto-SBC/releases/download"
ASSET_NAME = "AutoSBCBackend.exe"
MAX_DOWNLOAD_BYTES = 512 * 1024 * 1024


def parse_version(value):
    match = re.fullmatch(r"v?(27)\.(\d+)", str(value))
    return tuple(map(int, match.groups())) if match else None


def current_version():
    try:
        return Path(__file__).with_name("release-version.txt").read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return "development"


def find_update(release, installed):
    installed_version = parse_version(installed)
    latest_version = parse_version(release.get("tag_name"))
    if (not installed_version or not latest_version or latest_version <= installed_version
            or release.get("draft") or release.get("prerelease")):
        return None
    tag = release["tag_name"]
    asset = next((asset for asset in release.get("assets", []) if asset.get("name") == ASSET_NAME), None)
    if not asset:
        return None
    expected_url = f"{RELEASE_DOWNLOAD}/{tag}/{ASSET_NAME}"
    if asset.get("browser_download_url") != expected_url:
        raise ValueError("Unexpected update download URL")
    size = asset.get("size")
    if not isinstance(size, int) or not 0 < size <= MAX_DOWNLOAD_BYTES:
        raise ValueError("Invalid update size")
    digest = asset.get("digest") or ""
    match = re.fullmatch(r"sha256:([0-9a-fA-F]{64})", digest)
    if not match:
        match = re.search(r"^SHA256: `([0-9a-fA-F]{64})`\s*$", release.get("body") or "", re.MULTILINE)
    if not match:
        raise ValueError("Release has no SHA256 checksum")
    return {"tag": tag, "url": expected_url, "size": size, "sha256": match.group(1).lower()}


def download_update(update, destination):
    digest = hashlib.sha256()
    size = 0
    deadline = time.monotonic() + 180
    with requests.get(update["url"], stream=True, timeout=(5, 15)) as response:
        response.raise_for_status()
        with destination.open("xb") as output:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if time.monotonic() > deadline:
                    raise TimeoutError("Update download timed out")
                size += len(chunk)
                if size > update["size"]:
                    raise ValueError("Update exceeds its published size")
                digest.update(chunk)
                output.write(chunk)
    if size != update["size"] or digest.hexdigest() != update["sha256"]:
        raise ValueError("Update checksum or size does not match the release")


def show_message(text, flags):
    return ctypes.windll.user32.MessageBoxW(None, text, "AutoSBC update", flags)


def launch_update_helper(directory, update):
    metadata = {
        "pid": os.getpid(),
        "target": str(Path(sys.executable).resolve()),
        "download": str(directory / ASSET_NAME),
        "backup": str(directory / "previous.exe"),
        "directory": str(directory),
        "cwd": os.getcwd(),
        "sha256": update["sha256"],
    }
    payload = base64.b64encode(json.dumps(metadata).encode("utf-8")).decode("ascii")
    script = Path(__file__).with_name("update-helper.ps1").read_text(encoding="utf-8")
    script += (
        "\n$update = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('"
        + payload + "')) | ConvertFrom-Json\nInvoke-AutoSbcUpdate -Update $update\n"
    )
    encoded = base64.b64encode(script.encode("utf-16-le")).decode("ascii")
    powershell = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
    helper = subprocess.Popen(
        [str(powershell), "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
        cwd=str(directory), stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=subprocess.CREATE_NO_WINDOW | subprocess.CREATE_NEW_PROCESS_GROUP,
        close_fds=True,
    )
    deadline = time.monotonic() + 15
    ready = directory / "helper-ready"
    while time.monotonic() < deadline:
        if helper.poll() is not None:
            raise RuntimeError("The update helper exited before becoming ready")
        if ready.exists():
            return helper
        Event().wait(0.1)
    helper.kill()
    helper.wait(timeout=5)
    raise TimeoutError("The update helper did not become ready")


def check_for_update():
    if os.environ.pop("AUTOSBC_SKIP_UPDATE_ONCE", None) == "1":
        return False
    if not getattr(sys, "frozen", False) or os.name != "nt" or os.getenv("AUTOSBC_DISABLE_UPDATES") == "1":
        return False
    try:
        installed = current_version()
        with requests.get(RELEASE_API, timeout=(3, 5), headers={"Accept": "application/vnd.github+json"}) as response:
            response.raise_for_status()
            update = find_update(response.json(), installed)
    except Exception as error:
        logging.warning("Update check skipped: %s", error)
        return False
    if not update:
        return False
    choice = show_message(
        f"AutoSBC {update['tag']} is available. You are running {installed}.\n\n"
        "Download and install it now? AutoSBC will restart when the update is ready.",
        0x4 | 0x20 | 0x100,
    )
    if choice != 6:
        return False
    directory = None
    try:
        directory = Path(tempfile.mkdtemp(prefix=".autosbc-update-", dir=Path(sys.executable).resolve().parent))
        download_update(update, directory / ASSET_NAME)
        helper = launch_update_helper(directory, update)
        if helper.poll() is not None:
            raise RuntimeError("The update helper could not start")
        return True
    except Exception as error:
        if directory:
            shutil.rmtree(directory, ignore_errors=True)
        logging.warning("Update installation failed: %s", error)
        show_message(f"The update could not be installed. Your current version will continue.\n\n{error}", 0x10)
        return False