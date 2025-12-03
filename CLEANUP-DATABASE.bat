@echo off
echo ========================================
echo DATABASE CLEANUP TOOL
echo ========================================
echo.
echo This tool will help you remove test users
echo and clean up your database.
echo.
echo Press any key to start...
pause >nul

node cleanup-database.js

pause
