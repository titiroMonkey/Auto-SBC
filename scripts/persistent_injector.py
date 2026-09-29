from __future__ import annotations

import atexit
import argparse
import os
import shutil
import sys
import time
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


DEFAULT_TARGET_URL = "https://www.ea.com/ea-sports-fc/ultimate-team/web-app/"
DEFAULT_SCRIPT_URL = "http://127.0.0.1:8000/plainjavascript.js"
DEFAULT_BACKEND_SHUTDOWN_URL = "http://127.0.0.1:8000/shutdown"
DEFAULT_PROFILE_DIR = "C://Chrome dev session"
TARGET_PATH_FRAGMENT = "ea-sports-fc/ultimate-team/web-app"
KNOWN_WRONG_PATH_FRAGMENT = "/ea-sp/games/library/sports"
INJECTOR_INSTANCE_PID_FILE = ".injector.instance.pid"


def resolve_chrome_executable(chrome_exe: str) -> str | None:
    if chrome_exe and Path(chrome_exe).exists():
        return str(Path(chrome_exe))

    found = shutil.which(chrome_exe)
    if found:
        return found

    if sys.platform.startswith("win"):
        candidates = [
            Path("C:/Program Files/Google/Chrome/Application/chrome.exe"),
            Path("C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"),
            Path.home() / "AppData/Local/Google/Chrome/Application/chrome.exe",
        ]
        for candidate in candidates:
            if candidate.exists():
                return str(candidate)

    return None


def _is_pid_running(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def acquire_injector_instance_lock(repo_root: Path) -> bool:
    pid_file = repo_root / INJECTOR_INSTANCE_PID_FILE
    current_pid = os.getpid()

    if pid_file.exists():
        try:
            existing_pid = int(pid_file.read_text(encoding="utf-8").strip())
            if existing_pid != current_pid and _is_pid_running(existing_pid):
                print(
                    f"[Auto-SBC] Injector already running with PID {existing_pid}; exiting duplicate process.",
                    flush=True,
                )
                return False
        except Exception:
            pass

    pid_file.write_text(str(current_pid), encoding="utf-8")

    def cleanup_pid_file() -> None:
        try:
            if not pid_file.exists():
                return
            recorded_pid = int(pid_file.read_text(encoding="utf-8").strip())
            if recorded_pid == current_pid:
                pid_file.unlink()
        except Exception:
            pass

    atexit.register(cleanup_pid_file)
    return True


def fetch_script(script_url: str, timeout: float = 5.0) -> str | None:
    try:
        with urlopen(script_url, timeout=timeout) as response:
            return response.read().decode("utf-8")
    except (URLError, TimeoutError):
        return None
    except Exception as exc:
        print(f"[Auto-SBC] Failed to fetch script: {exc}", flush=True)
        return None


def wait_for_eafc_runtime(page, timeout_seconds: float = 15.0) -> bool:
    deadline = time.time() + timeout_seconds

    while time.time() < deadline:
        try:
            if TARGET_PATH_FRAGMENT not in (page.url or ""):
                return False

            # FC 27 does not expose every service during the initial boot.
            # Localization is the same readiness signal used by the frontend
            # init path; requiring Item/repository services here can prevent
            # the script from ever being injected on the new web app.
            runtime_ready = page.evaluate(
                """
                () => Boolean(
                    typeof window !== 'undefined' &&
                    window.services &&
                    window.services.Localization
                )
                """
            )
            if runtime_ready:
                return True
        except Exception as exc:
            if "Execution context was destroyed" not in str(exc):
                print(f"[Auto-SBC] Runtime readiness check failed: {exc}", flush=True)

        time.sleep(0.25)

    print(
        "[Auto-SBC] EA runtime was not ready before injection timeout; will retry on the next page event.",
        flush=True,
    )
    return False


def inject_script(page, script_url: str, script_path: Path | None) -> bool:
    if not wait_for_eafc_runtime(page):
        return False

    try:
        if page.evaluate("() => Boolean(window.__autoSbcPlainJsInjected)"):
            return True
    except Exception:
        pass

    script_source = fetch_script(script_url)

    if not script_source and script_path and script_path.exists():
        script_source = script_path.read_text(encoding="utf-8")

    if not script_source:
        print(
            "[Auto-SBC] Could not load script from backend and no local fallback found.",
            flush=True,
        )
        return False

    try:
        # Execute via Runtime.evaluate (CDP) rather than a <script> tag. EA's
        # Content-Security-Policy blocks injected inline scripts, so add_script_tag
        # hangs; evaluating the source string runs it in page context and bypasses
        # script-src. The whole bundle shares one script scope, so its top-level
        # lexical declarations resolve across modules as before.
        page.evaluate(script_source)
        page.evaluate("window.__autoSbcPlainJsInjected = true;")
        try:
            compatibility = page.evaluate(
                "JSON.stringify(window.__fcCompat || {ran:false})"
            )
            print(f"[Auto-SBC] FC27 compatibility snapshot: {compatibility}", flush=True)
        except Exception as snap_exc:
            print(f"[Auto-SBC] Compatibility snapshot unavailable: {snap_exc}", flush=True)
        print("[Auto-SBC] Injected plainJavascript.js", flush=True)
        return True
    except Exception as exc:
        try:
            page.evaluate("() => { window.__autoSbcPlainJsInjected = false; }")
        except Exception:
            pass
        print(f"[Auto-SBC] Injection failed: {exc}", flush=True)
        return False


def wait_until_page_ready(page, max_attempts: int = 20, delay_seconds: float = 0.2) -> bool:
    for _ in range(max_attempts):
        try:
            ready_state = page.evaluate("() => document.readyState")
            if ready_state in ("interactive", "complete"):
                return True
        except Exception:
            pass
        time.sleep(delay_seconds)
    return False


def navigate_to_target(page, target_url: str, max_attempts: int = 3) -> bool:
    for attempt in range(1, max_attempts + 1):
        try:
            page.bring_to_front()
            page.goto(target_url, wait_until="domcontentloaded", timeout=45000)
            current_url = page.url or ""
            if TARGET_PATH_FRAGMENT in current_url:
                return True
            print(
                f"[Auto-SBC] Navigation attempt {attempt}/{max_attempts} landed on unexpected URL: {current_url}",
                flush=True,
            )
        except PlaywrightTimeoutError:
            print(
                f"[Auto-SBC] Navigation attempt {attempt}/{max_attempts} timed out.",
                flush=True,
            )
        except Exception as exc:
            print(
                f"[Auto-SBC] Navigation attempt {attempt}/{max_attempts} failed: {exc}",
                flush=True,
            )
    return False


def close_first_tab_after_second(context, keep_page) -> None:
    try:
        pages = list(context.pages)
        if len(pages) < 2:
            return
        first_page = pages[0]
        if first_page == keep_page:
            return
        first_url = (first_page.url or "").strip().lower()
        if first_url != "about:blank":
            return
        first_page.close()
        print(
            "[Auto-SBC] Closed about:blank tab after opening second tab.",
            flush=True,
        )
    except Exception as exc:
        print(f"[Auto-SBC] Failed to close first tab: {exc}", flush=True)


def notify_backend_shutdown(shutdown_url: str, timeout: float = 5.0) -> None:
    try:
        req = Request(shutdown_url, method="POST")
        with urlopen(req, timeout=timeout):
            pass
        print("[Auto-SBC] Requested backend shutdown.", flush=True)
    except Exception as exc:
        print(f"[Auto-SBC] Backend shutdown request failed: {exc}", flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Launch EAFC web app and auto-inject plainJavascript.js on every refresh"
    )
    parser.add_argument("--url", default=DEFAULT_TARGET_URL, help="Target URL to open")
    parser.add_argument(
        "--script-url",
        default=DEFAULT_SCRIPT_URL,
        help="URL serving plainJavascript.js (backend endpoint)",
    )
    parser.add_argument(
        "--shutdown-url",
        default=DEFAULT_BACKEND_SHUTDOWN_URL,
        help="Backend shutdown endpoint called when Chrome closes",
    )
    parser.add_argument(
        "--profile-dir",
        default=DEFAULT_PROFILE_DIR,
        help="Persistent browser profile directory",
    )
    parser.add_argument(
        "--chrome-exe",
        default="chrome.exe",
        help="Chrome executable path/name (default: chrome.exe)",
    )
    parser.add_argument(
        "--headed",
        dest="headed",
        action="store_true",
        help="Run browser with visible UI",
    )
    parser.add_argument(
        "--headless",
        dest="headed",
        action="store_false",
        help="Run browser in headless mode",
    )
    parser.set_defaults(headed=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    if not acquire_injector_instance_lock(repo_root):
        return 0

    local_plainjavascript = repo_root / "plainJavascript.js"
    profile_dir = Path(args.profile_dir)
    profile_dir.mkdir(parents=True, exist_ok=True)

    chrome_path = resolve_chrome_executable(args.chrome_exe)

    with sync_playwright() as playwright:
        launch_kwargs = {
            "user_data_dir": str(profile_dir),
            "headless": not args.headed,
            "no_viewport": True,
            "args": [
                "--start-maximized",
                "--disable-web-security",
                "--disable-blink-features=AutomationControlled",
            ],
        }

        if chrome_path:
            launch_kwargs["executable_path"] = chrome_path
            print(f"[Auto-SBC] Launching Chrome from: {chrome_path}", flush=True)
        else:
            launch_kwargs["channel"] = "chrome"
            print(
                "[Auto-SBC] chrome.exe not found on PATH; falling back to Playwright chrome channel.",
                flush=True,
            )

        try:
            context = playwright.chromium.launch_persistent_context(**launch_kwargs)
        except Exception as exc:
            print(f"[Auto-SBC] Failed to launch Chrome: {exc}", flush=True)
            print(
                "[Auto-SBC] Run: python -m playwright install chrome (and/or set --chrome-exe to full chrome.exe path).",
                flush=True,
            )
            return 1

        page = context.new_page()
        close_first_tab_after_second(context, page)

        # Never replace FC27's live runtime bundle with a stale capture. The
        # EA bundle defines the constructors that the compatibility layer must
        # resolve, so serving an older ocompiled.js silently breaks overrides.
        # Legacy bundle interception can still be enabled explicitly when
        # debugging a matching capture.
        patched_ocompiled = repo_root / "js Test Files" / "ocompiled.js"
        if os.getenv("AUTO_SBC_PATCH_OCOMPILED", "0") == "1" and patched_ocompiled.exists():
            patched_body = patched_ocompiled.read_bytes()

            def serve_patched_ocompiled(route, request):
                route.fulfill(
                    status=200,
                    headers={"Content-Type": "application/javascript; charset=utf-8"},
                    body=patched_body,
                )

            page.route("**/ocompiled.js*", serve_patched_ocompiled)
            print(
                f"[Auto-SBC] Routing ocompiled.js to opt-in local copy ({len(patched_body):,} bytes).",
                flush=True,
            )
        else:
            print("[Auto-SBC] Using EA's live ocompiled.js bundle.", flush=True)

        last_redirect_attempt = 0.0
        main_frame_nav_seq = 0
        last_injected_nav_seq = -1

        def on_navigation(frame):
            nonlocal last_redirect_attempt, main_frame_nav_seq
            if frame != page.main_frame:
                return
            current_url = frame.url or ""
            main_frame_nav_seq += 1

            if KNOWN_WRONG_PATH_FRAGMENT in current_url:
                now = time.time()
                if now - last_redirect_attempt > 2:
                    last_redirect_attempt = now
                    print(
                        "[Auto-SBC] Detected EA library redirect, sending browser to FC web app.",
                        flush=True,
                    )
                    try:
                        page.goto(args.url, wait_until="domcontentloaded", timeout=45000)
                    except Exception as exc:
                        print(f"[Auto-SBC] Redirect retry failed: {exc}", flush=True)
                return

            if TARGET_PATH_FRAGMENT not in current_url:
                return

        def on_dom_content_loaded():
            nonlocal last_injected_nav_seq
            try:
                current_url = page.url or ""
                if TARGET_PATH_FRAGMENT not in current_url:
                    return

                if last_injected_nav_seq == main_frame_nav_seq:
                    return

                wait_until_page_ready(page)

                if inject_script(page, args.script_url, local_plainjavascript):
                    last_injected_nav_seq = main_frame_nav_seq
            except Exception as exc:
                print(f"[Auto-SBC] domcontentloaded handler error: {exc}", flush=True)

        page.on("framenavigated", on_navigation)
        page.on("domcontentloaded", on_dom_content_loaded)
        page.on("load", on_dom_content_loaded)

        if not navigate_to_target(page, args.url, max_attempts=3):
            print(
                "[Auto-SBC] Could not automatically reach EA FC web app URL; waiting for manual navigation.",
                flush=True,
            )

        if KNOWN_WRONG_PATH_FRAGMENT in page.url:
            print(
                "[Auto-SBC] Startup landed on EA library; retrying target FC web app URL.",
                flush=True,
            )
            navigate_to_target(page, args.url, max_attempts=2)

        if (
            TARGET_PATH_FRAGMENT in page.url
            and last_injected_nav_seq != main_frame_nav_seq
        ):
            wait_until_page_ready(page)
            if inject_script(page, args.script_url, local_plainjavascript):
                last_injected_nav_seq = main_frame_nav_seq

        print(
            "[Auto-SBC] Browser running. Close all Chrome windows from this profile to stop.",
            flush=True,
        )

        context.wait_for_event("close", timeout=0)

        notify_backend_shutdown(args.shutdown_url)

    return 0


if __name__ == "__main__":
    sys.exit(main())
