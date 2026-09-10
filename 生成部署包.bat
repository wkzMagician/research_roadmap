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

call npm run build
if errorlevel 1 (
  echo Build failed. Please keep this window open and share the error message.
  pause
  exit /b 1
)

echo.
echo Deployment package created in the dist folder.
echo You can drag the dist folder to Netlify Drop: https://app.netlify.com/drop
start "" "%~dp0dist"
pause

endlocal
