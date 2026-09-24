@echo off
setlocal
cd /d "%~dp0"
set PYTHON=%~dp0.venv\Scripts\python.exe
if not exist "%PYTHON%" set PYTHON=python
"%PYTHON%" -m uvicorn backend.main:app --reload --reload-dir backend --reload-dir frontend --reload-include "*.py" --reload-include "*.js" --reload-include "*.json" --reload-include "*.css"
