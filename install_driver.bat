@echo off
title Cai dat Driver ESP32-CAM (CH340 / CP210x)
cd /d "%~dp0"

echo ==========================================================
echo    CAI DAT DRIVER USB-UART ESP32-CAM (CH340 / CP210x)     
echo ==========================================================
echo.

:: Kiem tra quyen Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [THONG BAO] Dang yeu cau quyen Administrator de cai driver vao Windows...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [1/2] Dang cai dat Driver WCH CH340 (Microsoft Certified WHQL)...
if exist "drivers\ch340\ch341ser.inf" (
    pnputil /add-driver "drivers\ch340\ch341ser.inf" /install
) else (
    echo [LOI] Khong tim thay file drivers\ch340\ch341ser.inf
)

echo.
echo [2/2] Dang cai dat Driver Silicon Labs CP210x (Microsoft Certified)...
if exist "drivers\cp210x\silabser.inf" (
    pnputil /add-driver "drivers\cp210x\silabser.inf" /install
) else (
    echo [LOI] Khong tim thay file drivers\cp210x\silabser.inf
)

echo.
echo ==========================================================
echo   HOAN TAT CAI DAT DRIVER!
echo   Bay gio ban co the cam ESP32-CAM vao bat ky cong USB nao.
echo ==========================================================
pause

