"""
Shared global variables for the Auto-SBC project
"""
import time
import json
import os
import csv
# Initialize an empty list for solver logs
solver_logs = []

# Function to add a log entry
def add_log(message,result = []):
    """Add a log entry with current timestamp"""

    log_entry = {
        "time": time.time(),
        "message": message,
        "result": result
    }
    solver_logs.append(log_entry)
    
    # Save log to file
    
    log_dir = "logs"
    if not os.path.exists(log_dir):
        os.makedirs(log_dir)
        
    log_file = os.path.join(log_dir, f"solver_log.csv")
    with open(log_file, 'w', newline='', encoding='utf-8') as f:
        csv_writer = csv.writer(f)
        # Write header
        csv_writer.writerow(["time", "message", "result"])
        # Write data
        for entry in solver_logs:
            csv_writer.writerow([
                entry['time'], 
                entry['message'], 
                json.dumps(entry['result'])  # Convert complex result to string
            ])

# Function to clear logs
def clear_logs():
    """Clear all logs"""
    global solver_logs
    
    # Delete log files in the log directory
    log_dir = "logs"
    if os.path.exists(log_dir):
        for file in os.listdir(log_dir):
            if file.startswith("solver_log_"):
                os.remove(os.path.join(log_dir, file))
    
    solver_logs = []
