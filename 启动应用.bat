@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required on the first run.
  echo Opening the download page now. Install the LTS version, then double-click this file again.
  start "" "https://nodejs.org/zh-cn/download"
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo First run: installing the application. This may take a minute.
  call npm install
  if errorlevel 1 (
    echo Installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

start "Readmap server" cmd /k "cd /d ""%~dp0"" && npm run dev -- --host 127.0.0.1 --port 5173 --strictPort"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5173"

endlocal
