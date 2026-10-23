@echo off
chcp 65001 >nul
title ESP32-CAM AI Vision - Nhận Diện Người Ngày & Đêm 30 FPS
cd /d "%~dp0"

:MENU
cls
echo ==============================================================================
echo      HỆ THỐNG AI VISION - NHẬN DIỆN NGƯỜI TRONG BÓNG TỐI SÂU 30 FPS (YOLOV8)
echo ==============================================================================
echo.
echo   [1] KHỞI ĐỘNG NHẬN DIỆN NGƯỜI BÓNG TỐI (YOLOv8 + Extreme Night Vision 30 FPS)
echo   [2] KIỂM TRA ĐÁNH GIÁ ĐỘ NHẠY BÓNG TỐI (Stress-Test tự động từ 100%% -> 1%% tối)
echo   [3] KẾT NỐI CAMERA ESP32-CAM TRỰC TIẾP (Tự quét cổng COM + Nhận diện thời gian thực)
echo   [4] TỰ ĐỘNG NẠP FIRMWARE VÀO ESP32 (Nhanh, không cần cài PlatformIO)
echo   [5] CÀI ĐẶT DRIVER USB-SERIAL CH340 (Dành cho máy tính cắm lần đầu)
echo   [6] CÀI ĐẶT THƯ VIỆN PYTHON (Tự động cài đặt opencv, ultralytics, onnxruntime)
echo   [0] THOÁT
echo.
echo ==============================================================================
set /p opt=">>> Nhập lựa chọn của bạn [1/2/3/4/5/6/0] (Mặc định nhấn Enter để chạy 1): "

if "%opt%"=="" goto RUN_DETECTOR
if "%opt%"=="1" goto RUN_DETECTOR
if "%opt%"=="2" goto RUN_TEST_NIGHT
if "%opt%"=="3" goto RUN_ESP32
if "%opt%"=="4" goto FLASH_FIRMWARE
if "%opt%"=="5" goto INSTALL_DRIVER
if "%opt%"=="6" goto INSTALL_DEPS
if "%opt%"=="0" exit /b 0

echo Lựa chọn không hợp lệ. Vui lòng thử lại!
timeout /t 2 >nul
goto MENU

:RUN_DETECTOR
echo.
echo ==============================================================================
echo [BƯỚC 1] Khởi chạy Hệ Thống Nhận Diện Người Trong Bóng Tối (YOLOv8 30 FPS)...
echo ==============================================================================
python "%~dp0human_detector.py" --model yolov8s --fps 30
if %errorlevel% neq 0 (
    echo.
    echo [THÔNG BÁO] Đã kết thúc hoặc có lỗi. Nếu thiếu thư viện, hãy chọn mục [6].
    pause
)
goto MENU

:RUN_TEST_NIGHT
echo.
echo ==============================================================================
echo [BƯỚC 1] Chạy bộ kiểm tra đánh giá độ nhạy bóng tối lũy tiến...
echo ==============================================================================
python "%~dp0test_night_vision.py"
echo.
pause
goto MENU

:RUN_ESP32
echo.
echo ==============================================================================
echo [BƯỚC 1] Quét cổng COM và kết nối trực tiếp ESP32-CAM...
echo ==============================================================================
python "%~dp0scripts\auto_device_manager.py"
if %errorlevel% neq 0 (
    echo.
    echo [THÔNG BÁO] Kiểm tra cáp USB hoặc chọn mục [5] để cài Driver.
    pause
)
goto MENU

:FLASH_FIRMWARE
echo.
echo ==============================================================================
echo [BƯỚC 1] Tự động quét cổng COM và nạp Firmware đã fix vào ESP32...
echo ==============================================================================
python "%~dp0scripts\flash_firmware.py" --port auto --baud 460800
echo.
pause
goto MENU

:INSTALL_DRIVER
echo.
echo ==============================================================================
echo [BƯỚC 1] Cài đặt Driver USB-Serial CH340 cho Windows...
echo ==============================================================================
call "%~dp0drivers\install_driver.bat"
goto MENU

:INSTALL_DEPS
echo.
echo ==============================================================================
echo [BƯỚC 1] Cài đặt thư viện Python từ requirements.txt...
echo ==============================================================================
pip install -r "%~dp0requirements.txt"
echo.
echo Hoàn tất cài đặt thư viện!
pause
goto MENU
