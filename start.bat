@echo off
chcp 65001 >nul
set "NODE=C:\Users\AMANBOL\AppData\Local\Programs\node-portable\node-v24.20.0-win-x64"
set "PATH=%NODE%;%PATH%"
cd /d "%~dp0"
echo ???? ?????... ???????? http://localhost:5173
call npm run dev
pause

