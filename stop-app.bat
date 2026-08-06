@echo off
:: Stop PharmD Exam Scheduler
:: Kills all Node.js processes (backend and frontend servers)

color 0E
echo ========================================
echo   Stopping PharmD Exam Scheduler
echo ========================================
echo.

echo Stopping all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1

if %errorlevel% equ 0 (
    color 0A
    echo [OK] All servers stopped successfully
) else (
    echo [INFO] No running servers found
)

echo.
echo You can now close this window.
timeout /t 3 /nobreak >nul

