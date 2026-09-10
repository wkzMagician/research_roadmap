@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto missing_runtime
where npm >nul 2>nul
if errorlevel 1 goto missing_runtime

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm ci
  if errorlevel 1 goto failed
)

echo Starting Readmap. Press Ctrl+C to stop.
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --open
if errorlevel 1 goto failed
exit /b 0

:missing_runtime
echo Node.js and npm are required. Install a supported Node.js LTS version:
echo https://nodejs.org/en/download
pause
exit /b 1

:failed
echo Readmap could not start. See the error above.
pause
exit /b 1
