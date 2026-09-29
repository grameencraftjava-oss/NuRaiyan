@echo off
title Nuraiyan Social Network - Launcher
echo =======================================================
echo   Nuraiyan Social Network - Automatic Server Launcher
echo =======================================================
echo.
set "PATH=C:\Program Files\nodejs;%PATH%"

echo [1/2] Starting Backend Server (Port 5000)...
start "Nuraiyan Backend API (Port 5000)" cmd /k "cd /d ""%~dp0backend"" && node dist/index.js"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend Next.js (Port 3000)...
start "Nuraiyan Frontend Next.js (Port 3000)" cmd /k "cd /d ""%~dp0frontend"" && node node_modules/next/dist/bin/next start -p 3000"

echo.
echo =======================================================
echo   ✅ All Servers are running!
echo   👉 Frontend: http://localhost:3000
echo   👉 Backend API: http://localhost:5000
echo =======================================================
pause
