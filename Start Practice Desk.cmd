@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 "%~dp0start_practice.py"
) else (
  python "%~dp0start_practice.py"
)
if errorlevel 1 pause

