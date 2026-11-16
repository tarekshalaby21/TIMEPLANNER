@echo off
setlocal
cd /d "%~dp0"
set PORT=8765
where py >nul 2>nul
if %errorlevel%==0 (
  start "BalanceOS" http://127.0.0.1:%PORT%/
  py -m http.server %PORT%
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "BalanceOS" http://127.0.0.1:%PORT%/
  python -m http.server %PORT%
  goto :eof
)
echo Python was not found. Install Python 3, or host this folder on an HTTPS static host.
pause
