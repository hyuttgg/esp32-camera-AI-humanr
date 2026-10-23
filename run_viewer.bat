@echo off
title ESP32-CAM AI Vision - Realtime 30 FPS Stream
cd /d "%~dp0"

echo ==========================================================
echo    ESP32-CAM AI VISION - 30 FPS REALTIME VIEWER
echo ==========================================================

:: 1. Kiem tra Python
python --version >nul 2>&1
if errorlevel 1 goto :NO_PYTHON

:: 2. Giai phong cong COM neu bi chiem dung boi tien trinh cu
powershell -Command "Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID } | Stop-Process -Force" 2>nul
ping 127.0.0.1 -n 2 >nul

:: 3. Kiem tra va tu dong cai thu vien con thieu
echo [1/3] Dang kiem tra thu vien Python...
python -c "import cv2, serial, numpy, onnxruntime" >nul 2>&1
if errorlevel 1 (
    echo [THONG BAO] Phat hien thieu thu vien, dang tu dong cai dat tu requirements.txt...
    python -m pip install -r "%~dp0requirements.txt"
)

:: 4. Tu dong kiem tra Driver, quet cong COM (ho tro cam nong USB) va khoi chay
echo [2/3] Dang kiem tra Driver va quet cong COM cua ESP32-CAM...
echo [3/3] Dang khoi chay he thong thi giac AI 30 FPS...
python "%~dp0scripts\auto_device_manager.py" %*

if errorlevel 1 (
    echo.
    echo [THONG BAO] Chuong trinh da ket thuc hoac xay ra loi.
    pause
)
exit /b 0

:NO_PYTHON
echo.
echo ==========================================================
echo [LOI] May tinh nay chua cai dat Python!
echo Vui long tai va cai dat Python tu: https://www.python.org/downloads/
echo Luu y: Nho tich chon "Add Python to PATH" trong qua trinh cai dat.
echo ==========================================================
echo.
pause
exit /b 1

:NO_PYTHON
echo.
echo ==========================================================
echo [LOI] May tinh nay chua cai dat Python!
echo Vui long tai va cai dat Python tu: https://www.python.org/downloads/
echo Luu y: Nho tich chon "Add Python to PATH" trong qua trinh cai dat.
echo ==========================================================
echo.
pause
exit /b 1 