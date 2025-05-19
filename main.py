from fastapi.middleware.cors import CORSMiddleware
import time
from fastapi import Request, FastAPI, BackgroundTasks
import setup
import asyncio
from concurrent.futures import ThreadPoolExecutor
import functools
import logger  

app = FastAPI()

# Create a thread pool executor
thread_pool = ThreadPoolExecutor(max_workers=10)

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
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            thread_pool, 
            functools.partial(func, *args, **kwargs)
        )
    return wrapper

# Synchronous function that will be run in a thread
def get_logs():
    # Return the logs from the shared module
    return {"logs": globals.solver_logs}

@app.get('/solver-logs')
async def get_solver_logs():
    # Run the blocking operation in a separate thread
    return await run_in_threadpool(get_logs)()

# Synchronous function that will be run in a thread
def process_solve_request(request_data):
    # Use the globals module
    globals.clear_logs()  # Clear previous logs
    globals.add_log("SBC Solver started in thread")
    
    sbcData = request_data['sbcData']
    clubPlayers = request_data['clubPlayers']
    maxSolveTime = request_data['maxSolveTime']
    
    # Log received data
    globals.add_log(f"Processing {len(clubPlayers)} players, max time: {maxSolveTime}s")
    
    try:
        result = setup.runAutoSBC(sbcData, clubPlayers, maxSolveTime)
        
        # Log completion
        globals.add_log("Solver thread completed successfully")
        
        return result
    except Exception as e:
        # Log errors
        globals.add_log(f"Error in solver thread: {str(e)}")
        raise e

@app.post('/solve')
async def get_body(request: Request):
    # Parse the request data and clear logs on new solve
    request_data = await request.json()
    
    # Run the CPU-intensive task in a thread pool
    result = await run_in_threadpool(process_solve_request)(request_data)
    return result

# Add endpoint to clear logs in a separate thread
def clear_logs_handler():
    globals.clear_logs()
    return {"status": "success"}

@app.post('/clear-logs')
async def clear_solver_logs():
    return await run_in_threadpool(clear_logs_handler)()

# Graceful shutdown
@app.on_event("shutdown")
def shutdown_event():
    thread_pool.shutdown(wait=True)
