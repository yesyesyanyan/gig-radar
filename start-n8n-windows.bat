@echo off
chcp 65001 >nul
title n8n - Gig Radar
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Please install the LTS version from https://nodejs.org and run this file again.
  start https://nodejs.org
  pause
  exit /b 1
)
echo Node.js version:
node -v
echo.
echo Starting n8n... first start can take a few minutes. Keep this window open.
echo When you see "Editor is now accessible via: http://localhost:5678" it is ready.
echo.
call npx --yes n8n
pause
