@echo off
title ESP32-CAM AI Vision - Realtime 30 FPS Stream
cd /d "%~dp0"
echo ==========================================================
echo       ESP32-CAM AI VISION - REALTIME 30 FPS VIEWER
echo ==========================================================
echo Giai phong cong COM6 neu co tien trinh cu dang giu...
powershell -Command "Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force" 2>nul
timeout /t 1 /nobreak >nul

echo Dang ket noi toi ESP32-CAM tren COM6 @ 2000000 baud...
python "%~dp0python\live_viewer.py" --port COM6 --baud 2000000
if %errorlevel% neq 0 (
    pause
)
