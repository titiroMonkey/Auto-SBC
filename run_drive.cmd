@echo off
cd /d "%~dp0"
".venv\Scripts\python.exe" -u "scripts\drive_webapp_test.py" %*
