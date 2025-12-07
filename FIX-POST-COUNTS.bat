@echo off
echo ========================================
echo   FIX HARDCODED POST COUNTS
echo ========================================
echo.
echo This will:
echo 1. Count actual posts from database
echo 2. Fix hardcoded post_count values
echo 3. Verify feed visibility rules
echo.
pause

node fix-hardcoded-post-counts.js

echo.
echo ========================================
echo   VERIFYING FEED VISIBILITY
echo ========================================
echo.

node verify-feed-visibility.js

echo.
echo ========================================
echo   DONE!
echo ========================================
pause
