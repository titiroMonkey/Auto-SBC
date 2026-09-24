import asyncio
import functools
import json
import logging
import os
import queue
import signal
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event, Thread, Timer

import collection_book  # Collection Book (fut.gg) scraper + cache
import logger  # Import the logger module
import optimize
import requests
import setup
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


# Build plainJavascript.js from frontend modules
def build_plainjavascript():
    """Rebuild plainJavascript.js from frontend/src modules"""
    try:
        repo_root = Path(__file__).resolve().parents[1]
        manifest_path = repo_root / "frontend" / "manifest.json"
        output_path = repo_root / "plainJavascript.js"
        src_root = repo_root / "frontend" / "src"
        
        if not manifest_path.exists():
            logging.warning(f"Frontend manifest not found: {manifest_path}")
            return
        
        parts = json.loads(manifest_path.read_text(encoding="utf-8"))
        chunks = []
        
        for rel_path in parts:
            chunk_path = src_root / rel_path
            if not chunk_path.exists():
                logging.error(f"Missing frontend module: {chunk_path}")
                return
            chunks.append(chunk_path.read_text(encoding="utf-8"))
        
        output_path.write_text("".join(chunks), encoding="utf-8")
        logging.info(f"Built plainJavascript.js from {len(parts)} modules")
    except Exception as e:
        logging.error(f"Failed to build plainJavascript.js: {e}")


def _injector_pid_file() -> Path:
    repo_root = Path(__file__).resolve().parents[1]
    return repo_root / ".injector.pid"


def _is_pid_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def start_persistent_injector() -> None:
    if os.getenv("AUTO_SBC_DISABLE_INJECTOR", "0") == "1":
        logging.info("Injector auto-start disabled via AUTO_SBC_DISABLE_INJECTOR=1")
        return

    repo_root = Path(__file__).resolve().parents[1]
    script_path = repo_root / "scripts" / "persistent_injector.py"
    if not script_path.exists():
        logging.warning(f"Injector script not found: {script_path}")
        return

    pid_file = _injector_pid_file()
    if pid_file.exists():
        try:
            existing_pid = int(pid_file.read_text(encoding="utf-8").strip())
            if _is_pid_running(existing_pid):
                logging.info(f"Injector already running with PID {existing_pid}")
                return
        except Exception:
            pass

    # Prefer repo virtualenv interpreter so injector dependencies (playwright)
    # are resolved consistently even when backend starts from system Python.
    python_executable = sys.executable
    if os.name == "nt":
        repo_venv_pythonw = repo_root / ".venv" / "Scripts" / "pythonw.exe"
        repo_venv_python = repo_root / ".venv" / "Scripts" / "python.exe"

        if repo_venv_pythonw.exists():
            python_executable = str(repo_venv_pythonw)
        elif repo_venv_python.exists():
            python_executable = str(repo_venv_python)
        elif python_executable.lower().endswith("python.exe"):
            pythonw_candidate = Path(python_executable).with_name("pythonw.exe")
            if pythonw_candidate.exists():
                python_executable = str(pythonw_candidate)

    command = [python_executable, str(script_path), "--headed"]
    try:
        logs_dir = Path(__file__).resolve().parent / "logs"
        logs_dir.mkdir(parents=True, exist_ok=True)
        log_path = logs_dir / "injector.log"
        log_file = open(log_path, "a", encoding="utf-8")

        if os.name == "nt":
            creationflags = (
                subprocess.DETACHED_PROCESS
                | subprocess.CREATE_NEW_PROCESS_GROUP
                | subprocess.CREATE_NO_WINDOW
            )
            startupinfo = subprocess.STARTUPINFO()
            startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            startupinfo.wShowWindow = 0
            process = subprocess.Popen(
                command,
                cwd=str(repo_root),
                stdout=log_file,
                stderr=log_file,
                creationflags=creationflags,
                startupinfo=startupinfo,
            )
        else:
            process = subprocess.Popen(
                command,
                cwd=str(repo_root),
                stdout=log_file,
                stderr=log_file,
                preexec_fn=os.setsid,
            )

        log_file.close()

        pid_file.write_text(str(process.pid), encoding="utf-8")
        logging.info(f"Started persistent injector (PID {process.pid}), log: {log_path}")
    except Exception as e:
        logging.error(f"Failed to auto-start injector: {e}")


# Global variables
app = FastAPI()
thread_pool = ThreadPoolExecutor(max_workers=10)
solve_thread_pool = ThreadPoolExecutor(max_workers=1)
shutdown_event = asyncio.Event()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def run_in_threadpool(func):
    """Decorator to run a function in a thread pool"""

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        if shutdown_event.is_set():
            logging.warning("Server is shutting down, rejecting new requests")
            raise RuntimeError("Server is shutting down")

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            thread_pool, functools.partial(func, *args, **kwargs)
        )

    return wrapper


def run_solve_in_threadpool(func):
    """Decorator to run solve functions in a single-worker thread pool."""

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        if shutdown_event.is_set():
            logging.warning("Server is shutting down, rejecting new solve request")
            raise RuntimeError("Server is shutting down")

        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            solve_thread_pool, functools.partial(func, *args, **kwargs)
        )

    return wrapper


# Shutdown handler that properly cleans up resources
async def shutdown():
    logging.info("Initiating graceful shutdown")

    # Set shutdown event to prevent new requests
    shutdown_event.set()

    # Wait for active tasks to complete (with a timeout)
    logging.info("Waiting for active tasks to complete")
    try:
        # Give active tasks up to 5 seconds to complete
        await asyncio.wait_for(asyncio.sleep(2), timeout=5)
    except asyncio.TimeoutError:
        logging.warning("Some tasks didn't complete in time")

    # Don't wait for all tasks - faster shutdown for reloads
    thread_pool.shutdown(wait=False)
    solve_thread_pool.shutdown(wait=False)

    # Force terminate the process
    import os

    logging.critical(f"Killing {os.getpid()} - process will terminate immediately")
    os.kill(os.getpid(), signal.SIGTERM)


# Register the startup handler
@app.on_event("startup")
async def app_startup():
    """Build plainJavascript.js on server startup/reload"""
    build_plainjavascript()
    start_persistent_injector()


# Register the shutdown handler
@app.on_event("shutdown")
async def app_shutdown():
    await shutdown()


# Synchronous function that will be run in a thread
def get_logs():
    # Return the logs from the shared module
    return {"logs": logger.solver_logs}


@app.get("/solver-logs")
async def get_solver_logs():
    # Run the blocking operation in a separate thread
    return await run_in_threadpool(get_logs)()


@app.get("/plainjavascript.js")
async def get_plainjavascript():
    """Serve the plainJavascript.js file for injection via fetch"""
    script_path = Path(__file__).parent.parent / "plainJavascript.js"
    
    if not script_path.exists():
        return Response(
            content="// plainJavascript.js not found",
            media_type="application/javascript",
            status_code=404
        )
    
    content = script_path.read_text(encoding="utf-8")
    return Response(
        content=content,
        media_type="application/javascript",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


# Synchronous function that will be run in a thread
def process_solve_request(request_data):
    # Use the globals module
    logger.clear_logs()  # Clear previous logs
    logger.add_log("SBC Solver started in thread")

    sbcData = request_data["sbcData"]
    clubPlayers = request_data["clubPlayers"]
    maxSolveTime = request_data["maxSolveTime"]

    # Log received data
    logger.add_log(f"Processing {len(clubPlayers)} players, max time: {maxSolveTime}s")

    try:
        result = setup.runAutoSBC(sbcData, clubPlayers, maxSolveTime)

        # Log completion
        logger.add_log("Solver thread completed successfully")

        return result
    except Exception as e:
        # Log errors
        logger.add_log(f"Error in solver thread: {str(e)}")
        raise e


@app.post("/solve")
async def get_body(request: Request):
    # Parse the request data and clear logs on new solve
    request_data = await request.json()

    # Preempt currently running solve if present, then run latest request.
    if optimize.request_cancel_active_solve():
        logging.info("Cancelled active solve due to newer incoming /solve request")

    logger.clear_logs()  # Clear previous logs

    # Run the CPU-intensive task in a thread pool
    result = await run_solve_in_threadpool(process_solve_request)(request_data)
    return result


# Add endpoint to clear logs in a separate thread
def clear_logs_handler():
    logger.clear_logs()
    return {"status": "success"}


@app.post("/clear-logs")
async def clear_solver_logs():
    return await run_in_threadpool(clear_logs_handler)()


def process_relay_request(body):
    logging.info("Received relay request")
    logging.debug("Relay request data: %s", body)
    url = body.get("url")
    method = body.get("method", "GET").upper()
    headers = body.get("headers", {})
    data = body.get("data", None)
    resp = requests.request(method, url, headers=headers, data=data)
    logging.info(f"Relay request completed with {url} {resp.text}")
    return {"status": resp.status_code, "responseText": resp.text}


def _terminate_current_process() -> None:
    logging.info("Shutdown endpoint requested; terminating backend process")
    os.kill(os.getpid(), signal.SIGTERM)


@app.post("/shutdown")
async def shutdown_backend():
    Timer(0.2, _terminate_current_process).start()
    return {"status": "shutting_down"}


# Settings file persistence endpoints
def get_settings_file_path() -> Path:
    """Get the path to settings.json file in backend directory"""
    return Path(__file__).resolve().parent / "settings.json"


def read_settings_from_file() -> dict:
    """Read settings from file, return empty dict if file doesn't exist"""
    settings_file = get_settings_file_path()
    if settings_file.exists():
        try:
            return json.loads(settings_file.read_text(encoding="utf-8"))
        except Exception as e:
            logging.error(f"Failed to read settings file: {e}")
            return {}
    return {}


def write_settings_to_file(settings: dict) -> bool:
    """Write settings to file, return True on success"""
    try:
        settings_file = get_settings_file_path()
        settings_file.write_text(json.dumps(settings, indent=2), encoding="utf-8")
        return True
    except Exception as e:
        logging.error(f"Failed to write settings file: {e}")
        return False


@app.get("/api/settings")
async def get_settings():
    """Retrieve all settings from file"""
    return await run_in_threadpool(read_settings_from_file)()


@app.post("/api/settings")
async def save_settings(request: Request):
    """Save settings to file"""
    try:
        settings_data = await request.json()
        success = await run_in_threadpool(write_settings_to_file)(settings_data)
        if success:
            return {"status": "success"}
        else:
            return {"status": "error", "message": "Failed to write settings"}
    except Exception as e:
        logging.error(f"Settings save error: {e}")
        return {"status": "error", "message": str(e)}


# Collection Book (fut.gg) endpoints
@app.get("/api/collections")
async def get_collections():
    """Return the cached fut.gg collections (players + eaId lists)."""
    return await run_in_threadpool(collection_book.read_collections_cache)()


@app.post("/api/collections/refresh")
async def refresh_collections(request: Request):
    """Re-scrape fut.gg collections. Respects a TTL unless ``force`` is set."""
    force = False
    try:
        body = await request.json()
        force = bool(body.get("force"))
    except Exception:
        force = False
    try:
        data = await run_in_threadpool(collection_book.refresh_collections)(
            force=force
        )
        return {
            "status": "success",
            "updatedAt": data.get("updatedAt"),
            "count": len(data.get("collections") or []),
            "collections": data.get("collections") or [],
        }
    except Exception as e:
        logging.error(f"Collections refresh error: {e}")
        return {"status": "error", "message": str(e)}


# Unassigned rules file persistence endpoints
def get_unassigned_rules_file_path() -> Path:
    """Get the path to unassigned_rules.json file in backend directory"""
    return Path(__file__).resolve().parent / "unassigned_rules.json"


def read_unassigned_rules_from_file() -> dict:
    """Read unassigned rules from file, return empty dict if file doesn't exist"""
    rules_file = get_unassigned_rules_file_path()
    if rules_file.exists():
        try:
            return json.loads(rules_file.read_text(encoding="utf-8"))
        except Exception as e:
            logging.error(f"Failed to read unassigned rules file: {e}")
            return {}
    return {}


def write_unassigned_rules_to_file(rules: dict) -> bool:
    """Write unassigned rules to file, return True on success"""
    try:
        rules_file = get_unassigned_rules_file_path()
        rules_file.write_text(json.dumps(rules, indent=2), encoding="utf-8")
        return True
    except Exception as e:
        logging.error(f"Failed to write unassigned rules file: {e}")
        return False


@app.get("/api/unassigned-rules")
async def get_unassigned_rules():
    """Retrieve all unassigned rules from file"""
    return await run_in_threadpool(read_unassigned_rules_from_file)()


@app.post("/api/unassigned-rules")
async def save_unassigned_rules(request: Request):
    """Save unassigned rules to file"""
    try:
        rules_data = await request.json()
        success = await run_in_threadpool(write_unassigned_rules_to_file)(rules_data)
        if success:
            return {"status": "success"}
        else:
            return {"status": "error", "message": "Failed to write unassigned rules"}
    except Exception as e:
        logging.error(f"Unassigned rules save error: {e}")
        return {"status": "error", "message": str(e)}


# Collection Book ownership cache: definitionId -> list of distinct entity
# (instance) ids ever observed as owned. Players pass through the unassigned
# pile before reaching the club and can be moved to transfer list / storage, so
# ownership is tracked by unique entity id across both club and unassigned
# searches. The owned count for a definitionId is the number of distinct entity
# ids recorded for it, so duplicates increment the Collection Book counter.
def get_collection_book_ownership_file_path() -> Path:
    """Path to the collection_book_ownership.json file in backend directory."""
    return Path(__file__).resolve().parent / "collection_book_ownership.json"


def read_collection_book_ownership() -> dict:
    """Read the ownership store (definitionId -> [entityId]); {} if missing."""
    store_file = get_collection_book_ownership_file_path()
    if store_file.exists():
        try:
            data = json.loads(store_file.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
        except Exception as e:
            logging.error(f"Failed to read collection book ownership file: {e}")
    return {}


def write_collection_book_ownership(store: dict) -> bool:
    """Persist the ownership store, return True on success."""
    try:
        store_file = get_collection_book_ownership_file_path()
        store_file.write_text(json.dumps(store, indent=2), encoding="utf-8")
        return True
    except Exception as e:
        logging.error(f"Failed to write collection book ownership file: {e}")
        return False


def _collection_book_ownership_counts(store: dict) -> dict:
    """Reduce the store to definitionId -> distinct entity id count."""
    return {
        def_id: len(entity_ids)
        for def_id, entity_ids in store.items()
        if isinstance(entity_ids, list)
    }


# Serializes ownership writes through a single background worker. Ownership is
# recorded from several frontend paths (club fetch, unassigned fetch, solver)
# that fire concurrently; without serialization parallel requests read the same
# array, each append their own id, and the last write wins — silently dropping
# every other request's ids and capping each definitionId at a single stored
# entity id. Requests queue up here and are applied one at a time in order.
_collection_book_ownership_queue: "queue.Queue" = queue.Queue()


def _apply_collection_book_ownership(pairs: list) -> dict:
    """Merge {definitionId, entityId} pairs into the store, deduping entity ids
    per definitionId. Runs only on the ownership worker thread."""
    store = read_collection_book_ownership()
    for pair in pairs or []:
        if not isinstance(pair, dict):
            continue
        try:
            def_id = str(int(pair.get("definitionId")))
        except (TypeError, ValueError):
            continue
        entity_id = pair.get("entityId")
        if entity_id is None:
            continue
        entity_id = str(entity_id)
        entity_ids = store.get(def_id)
        if not isinstance(entity_ids, list):
            entity_ids = []
        if entity_id not in entity_ids:
            entity_ids.append(entity_id)
        store[def_id] = entity_ids
    write_collection_book_ownership(store)
    return _collection_book_ownership_counts(store)


def _collection_book_ownership_worker() -> None:
    """Drain the ownership queue, applying one merge job at a time in order."""
    while True:
        pairs, result = _collection_book_ownership_queue.get()
        try:
            counts = _apply_collection_book_ownership(pairs)
            result["counts"] = counts
        except Exception as e:  # noqa: BLE001 - propagate to waiting caller
            result["error"] = e
        finally:
            result["done"].set()
            _collection_book_ownership_queue.task_done()


Thread(
    target=_collection_book_ownership_worker,
    name="collection-book-ownership-worker",
    daemon=True,
).start()


def merge_collection_book_ownership(pairs: list) -> dict:
    """Queue {definitionId, entityId} pairs for merging and wait for the result.
    Returns the updated definitionId -> count map once the worker applies it."""
    result = {"done": Event()}
    _collection_book_ownership_queue.put((pairs, result))
    result["done"].wait()
    if "error" in result:
        raise result["error"]
    return result["counts"]


@app.get("/api/collection-book-ownership")
async def get_collection_book_ownership():
    """Return the persisted definitionId -> owned count map."""
    store = await run_in_threadpool(read_collection_book_ownership)()
    return {"counts": _collection_book_ownership_counts(store)}


@app.post("/api/collection-book-ownership")
async def save_collection_book_ownership(request: Request):
    """Merge observed {definitionId, entityId} pairs and return updated counts."""
    try:
        body = await request.json()
        pairs = body.get("pairs") if isinstance(body, dict) else None
        counts = await run_in_threadpool(merge_collection_book_ownership)(pairs or [])
        return {"status": "success", "counts": counts}
    except Exception as e:
        logging.error(f"Collection book ownership save error: {e}")
        return {"status": "error", "message": str(e)}


@app.post("/save-asset")
async def save_asset(request: Request):
    """Save a binary asset posted from the frontend (base64 encoded)."""
    body = await request.json()
    folder = body.get("folder", "")
    filename = body.get("filename", "")
    data_b64 = body.get("data", "")

    if not filename or not data_b64:
        return {"status": "error", "message": "Missing filename or data"}

    import base64
    repo_root = Path(__file__).resolve().parents[1]
    # Sanitize folder/filename to prevent path traversal
    safe_folder = Path(folder).name if folder else ""
    safe_filename = Path(filename).name
    assets_dir = repo_root / "docs" / "assets"
    if safe_folder:
        assets_dir = assets_dir / safe_folder
    assets_dir.mkdir(parents=True, exist_ok=True)

    dest = assets_dir / safe_filename
    dest.write_bytes(base64.b64decode(data_b64))
    return {"status": "ok", "path": str(dest.relative_to(repo_root))}


def _restart_python_app() -> None:
    logging.info("Restart endpoint requested; relaunching Python app")
    repo_root = Path(__file__).resolve().parents[1]

    try:
        if os.name == "nt":
            launcher = repo_root / "sbc.cmd"
            if launcher.exists():
                launch_cmd = (
                    f'timeout /t 2 /nobreak >nul && start "" "{launcher}"'
                )
                subprocess.Popen(
                    ["cmd.exe", "/c", launch_cmd],
                    cwd=str(repo_root),
                    creationflags=(
                        subprocess.DETACHED_PROCESS
                        | subprocess.CREATE_NEW_PROCESS_GROUP
                        | subprocess.CREATE_NO_WINDOW
                    ),
                )
            else:
                logging.warning("Could not find Windows launcher: %s", launcher)
        else:
            launcher = repo_root / "sbc"
            if launcher.exists():
                subprocess.Popen(
                    ["/bin/sh", "-c", f"sleep 2; '{launcher}' >/dev/null 2>&1 &"],
                    cwd=str(repo_root),
                )
            else:
                logging.warning("Could not find launcher: %s", launcher)
    except Exception as exc:
        logging.error("Failed to relaunch Python app: %s", exc)
    finally:
        os.kill(os.getpid(), signal.SIGTERM)


@app.post("/restart")
async def restart_backend():
    Timer(0.2, _restart_python_app).start()
    return {"status": "restarting"}


@app.post("/relay")
async def relay(request: Request):
    body = await request.json()
    # forward the HTTP call to threadpool so it doesn't block the event loop
    # return await run_in_threadpool(process_relay_request)(body)
    return {"data": []}  # Placeholder for relay functionality


def start():
    """Start the server using the uvicorn runner with proper signal handling"""
    config = uvicorn.Config(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=False,
        reload=False,
        workers=1,
    )

    server = uvicorn.Server(config)

    # Override the server's signal handlers with our own
    server.install_signal_handlers = lambda: None

    # Define our own signal handlers
    def handle_exit(signum, frame):
        logging.info(f"Received exit signal {signum}")
        # Tell the server to exit
        server.should_exit = True

    # Register our signal handlers
    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)

    # Start the server
    logging.info("Starting server...")
    server.run()
    logging.info("Server stopped")


if __name__ == "__main__":
    try:
        start()
    except KeyboardInterrupt:
        logging.info("Keyboard interrupt received")
    except Exception as e:
        logging.error(f"Error starting server: {str(e)}")
    finally:
        # Ensure thread pool is always shut down
        if thread_pool:
            thread_pool.shutdown(wait=False)
        if solve_thread_pool:
            solve_thread_pool.shutdown(wait=False)
        logging.info("Application terminated")
    sys.exit(0)
