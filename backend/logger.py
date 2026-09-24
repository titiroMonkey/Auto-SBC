"""Shared logging utilities for the Auto-SBC backend."""

import csv
import json
import os
import time
from threading import Lock

# Initialize an empty list for solver logs
solver_logs = []

_log_lock = Lock()
_log_dir = os.path.join(os.path.dirname(__file__), "logs")
_log_file = os.path.join(_log_dir, "solver_log.csv")
_file_logging_enabled = os.getenv("AUTO_SBC_FILE_LOGS", "1") == "1"


def _ensure_log_file_header():
    if not _file_logging_enabled:
        return

    os.makedirs(_log_dir, exist_ok=True)
    needs_header = not os.path.exists(_log_file) or os.path.getsize(_log_file) == 0
    if not needs_header:
        return

    with open(_log_file, "w", newline="", encoding="utf-8") as f:
        csv_writer = csv.writer(f)
        csv_writer.writerow(["time", "message", "result"])


# Function to add a log entry
def add_log(message, result=None):
    """Add a log entry with current timestamp"""

    if result is None:
        result = []

    log_entry = {"time": time.time(), "message": message, "result": result}
    with _log_lock:
        solver_logs.append(log_entry)

        if not _file_logging_enabled:
            return

        _ensure_log_file_header()
        with open(_log_file, "a", newline="", encoding="utf-8") as f:
            csv_writer = csv.writer(f)
            csv_writer.writerow(
                [
                    log_entry["time"],
                    log_entry["message"],
                    json.dumps(log_entry["result"]),
                ]
            )


# Function to clear logs
def clear_logs():
    """Clear all logs"""
    global solver_logs

    with _log_lock:
        solver_logs = []

        if not _file_logging_enabled:
            return

        _ensure_log_file_header()
        with open(_log_file, "w", newline="", encoding="utf-8") as f:
            csv_writer = csv.writer(f)
            csv_writer.writerow(["time", "message", "result"])
