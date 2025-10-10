from fastapi.middleware.cors import CORSMiddleware
import time
import json
from fastapi import Request, FastAPI, BackgroundTasks
import setup
import asyncio
from concurrent.futures import ThreadPoolExecutor
import functools
import signal
import sys
import uvicorn
import logging
import logger  # Import the logger module
import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)

# Global variables
app = FastAPI()
thread_pool = ThreadPoolExecutor(max_workers=10)
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
            thread_pool, 
            functools.partial(func, *args, **kwargs)
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
    
    # Force terminate the process
    import os
    logging.critical(f"Killing {os.getpid()} - process will terminate immediately")
    os.kill(os.getpid(), signal.SIGTERM)
    
    
    

# Register the shutdown handler
@app.on_event("shutdown")
async def app_shutdown():
    await shutdown()

# Synchronous function that will be run in a thread
def get_logs():
    # Return the logs from the shared module
    return {"logs": logger.solver_logs}

@app.get('/solver-logs')
async def get_solver_logs():
    # Run the blocking operation in a separate thread
    return await run_in_threadpool(get_logs)()

# Synchronous function that will be run in a thread
def process_solve_request(request_data):
    # Use the globals module
    logger.clear_logs()  # Clear previous logs
    logger.add_log("SBC Solver started in thread")
    
    sbcData = request_data['sbcData']
    clubPlayers = request_data['clubPlayers']
    maxSolveTime = request_data['maxSolveTime']
    
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

@app.post('/solve')
async def get_body(request: Request):
    # Parse the request data and clear logs on new solve
    request_data = await request.json()
    logger.clear_logs()  # Clear previous logs
    
    # Run the CPU-intensive task in a thread pool
    result = await run_in_threadpool(process_solve_request)(request_data)
    return result

# Add endpoint to clear logs in a separate thread
def clear_logs_handler():
    logger.clear_logs()
    return {"status": "success"}

@app.post('/clear-logs')
async def clear_solver_logs():
    return await run_in_threadpool(clear_logs_handler)()

def process_relay_request(body):
    logging.info("Received relay request")
    logging.debug("Relay request data: %s", body)
    url     = body.get("url")
    method  = body.get("method", "GET").upper()
    headers = body.get("headers", {})
    data    = body.get("data", None)
    resp    = requests.request(method, url, headers=headers, data=data)
    logging.info(f"Relay request completed with {url} {resp.text}")
    return {
        "status":       resp.status_code,
        "responseText": resp.text
    }

@app.post("/relay")
async def relay(request: Request):
    body = await request.json()
    # forward the HTTP call to threadpool so it doesn't block the event loop
    # return await run_in_threadpool(process_relay_request)(body)
    return {"data":[]}  # Placeholder for relay functionality

def start():
    """Start the server using the uvicorn runner with proper signal handling"""
    config = uvicorn.Config(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        reload=False,
        workers=1
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
        logging.info("Application terminated")
    sys.exit(0)

