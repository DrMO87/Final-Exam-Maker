@echo off
setlocal enabledelayedexpansion

:: PharmD Exam Scheduler - Startup Script
color 0B
echo ========================================
echo   PharmD Exam Scheduler - Startup
echo ========================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Check backend dependencies
echo Checking backend dependencies...
if not exist "backend\node_modules\" (
    echo Installing backend dependencies...
    cd backend
    call npm install
    cd ..
)

:: Check frontend dependencies
echo Checking frontend dependencies...
if not exist "frontend\node_modules\" (
    echo Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
)

echo.
color 0A
echo ========================================
echo   Starting servers...
echo ========================================
echo.

:: Start backend in new window
start "PharmD Scheduler - Backend" cmd /c "cd /d "%~dp0backend" && npm run dev"

:: Wait a moment for backend to start
ping 127.0.0.1 -n 4 > nul

:: Start frontend in new window
start "PharmD Scheduler - Frontend" cmd /c "cd /d "%~dp0frontend" && npm run dev"

:: Wait a moment for frontend to start
ping 127.0.0.1 -n 4 > nul

:: Open browser
start http://localhost:3000

echo Application Started Successfully!
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Two new terminal windows have opened for the servers.
echo You can close this startup window.
ping 127.0.0.1 -n 4 > nul
