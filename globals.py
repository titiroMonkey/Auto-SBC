"""
Shared global variables for the Auto-SBC project
"""

# Initialize an empty list for solver logs
solver_logs = []

# Function to add a log entry
def add_log(message,result = []):
    """Add a log entry with current timestamp"""
    import time
    solver_logs.append({
        "time": time.time(),
        "message": message,
        "result": result
    })

# Function to clear logs
def clear_logs():
    """Clear all logs"""
    global solver_logs
    solver_logs = []
