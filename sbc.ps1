Set-Location $PSScriptRoot
$PYTHON = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $PYTHON)) { $PYTHON = "python" }
& $PYTHON -m uvicorn backend.main:app --reload --reload-dir backend --reload-dir frontend --reload-include "*.py" --reload-include "*.js" --reload-include "*.json" --reload-include "*.css"
