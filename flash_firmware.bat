@echo off
title Nap Firmware ESP32-CAM (Tu Dong Tim Cong COM)
cd /d "%~dp0"

echo ==========================================================
echo    ESP32-CAM - CONG CU NAP FIRMWARE TU DONG
echo ==========================================================
echo.
echo 1. Giai phong cong COM neu bi chiem dung...
powershell -Command "Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force" 2>nul
timeout /t 1 /nobreak >nul

echo 2. Dang quet cong COM va tien hanh nap Firmware...
python "%~dp0scripts\flash_standalone.py" %*

echo.
pause

