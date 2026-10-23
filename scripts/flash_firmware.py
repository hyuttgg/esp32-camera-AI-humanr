import sys
import os
import time
import subprocess
import argparse

if sys.platform == "win32":
    import io
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

def find_esp32_port():
    try:
        import serial.tools.list_ports
        ports = list(serial.tools.list_ports.comports())
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pyserial"])
        import serial.tools.list_ports
        ports = list(serial.tools.list_ports.comports())

    # Priority 1: Match known USB-UART chips used on ESP32-CAM-MB
    for p in ports:
        desc = (p.description or "") + " " + (p.hwid or "")
        if any(k in desc.upper() for k in ["CH340", "1A86:7523", "CP210", "10C4:EA60", "USB-SERIAL", "FTDI", "UART"]):
            return p.device, p.description

    # Priority 2: Fallback to any COM port if single
    if len(ports) == 1:
        return ports[0].device, ports[0].description

    return None, None

def wait_for_esp32_port(timeout=60):
    port, desc = find_esp32_port()
    if port:
        return port, desc

    print("\n" + "=" * 65)
    print(" [CHỜ KẾT NỐI] Chưa phát hiện cổng COM của ESP32-CAM!")
    print(" -> Hãy CẮM CÁP USB của ESP32-CAM vào máy tính.")
    print(" -> Hệ thống đang tự động quét tìm thiết bị (thử lại mỗi 1s)...")
    print("=" * 65)

    start = time.time()
    while time.time() - start < timeout:
        time.sleep(1.0)
        port, desc = find_esp32_port()
        if port:
            print(f"\n[THÀNH CÔNG] Đã phát hiện ESP32-CAM: {desc} ({port})!\n")
            return port, desc
        print(".", end="", flush=True)

    print("\n[LỖI] Hết thời gian chờ kết nối. Vui lòng kiểm tra lại cáp USB và Driver.")
    return None, None

def flash_firmware(port=None, baud=460800, rebuild=False):
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    firmware_dir = os.path.join(base_dir, "firmware_bin")
    
    # Auto-detect port if not provided
    if not port or port == "auto":
        port, desc = wait_for_esp32_port()
        if not port:
            return False
    else:
        print(f"[INFO] Cổng đích được chọn: {port}")

    # If rebuild is requested and PlatformIO is installed
    if rebuild:
        print("\n--- BIÊN DỊCH FIRMWARE BẰNG PLATFORMIO ---")
        try:
            res = subprocess.run(["pio", "run", "--target", "upload", "--upload-port", port], cwd=base_dir)
            return (res.returncode == 0)
        except Exception as e:
            print(f"[WARN] Không thể chạy 'pio' ({e}), chuyển sang nạp bằng esptool...")

    # Portable Flash using precompiled binaries in firmware_bin/
    print("\n" + "=" * 65)
    print(f"      TIẾN HÀNH NẠP FIRMWARE VÀO ESP32-CAM QUA {port}")
    print("=" * 65)

    bootloader = os.path.join(firmware_dir, "bootloader.bin")
    partitions = os.path.join(firmware_dir, "partitions.bin")
    boot_app0 = os.path.join(firmware_dir, "boot_app0.bin")
    firmware = os.path.join(firmware_dir, "firmware.bin")

    for fpath in [bootloader, partitions, boot_app0, firmware]:
        if not os.path.exists(fpath):
            print(f"[LỖI] Không tìm thấy file binary: {fpath}")
            return False

    # Ensure esptool is available
    try:
        import esptool
    except ImportError:
        print("[INFO] Đang cài đặt thư viện nạp esptool...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "esptool"])

    cmd = [
        sys.executable, "-m", "esptool",
        "--chip", "esp32",
        "--port", port,
        "--baud", str(baud),
        "--before", "default-reset",
        "--after", "hard-reset",
        "write-flash", "-z",
        "--flash-mode", "dio",
        "--flash-freq", "40m",
        "--flash-size", "4MB",
        "0x1000", bootloader,
        "0x8000", partitions,
        "0xe000", boot_app0,
        "0x10000", firmware
    ]

    print(f"[INFO] Đang nạp firmware tốc độ cao ({baud} baud)...")
    res = subprocess.run(cmd)

    if res.returncode == 0:
        print("\n" + "=" * 65)
        print(" [THÀNH CÔNG] ĐÃ NẠP XONG FIRMWARE VÀO ESP32-CAM!")
        print(f" Cổng {port} hiện đã sẵn sàng để truyền hình ảnh trực tiếp.")
        print("=" * 65)
        return True
    else:
        print("\n" + "=" * 65)
        print(" [LỖI NẠP] Không thể nạp firmware. Hướng dẫn khắc phục:")
        print(" 1. Nếu dùng mạch ESP32-CAM không có mạch nạp auto-reset MB:")
        print("    -> Hãy nối chân IO0 (GPIO0) xuống GND trước khi cắm USB.")
        print(" 2. Nhấn nút RESET trên mạch ESP32-CAM rồi thử lại.")
        print(" 3. Đảm bảo không có phần mềm nào khác (Arduino IDE, Serial Monitor) đang chiếm cổng COM.")
        print("=" * 65)
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Auto ESP32-CAM Firmware Flasher")
    parser.add_argument("--port", default="auto", help="COM port (default: auto)")
    parser.add_argument("--baud", type=int, default=460800, help="Flash baud rate")
    parser.add_argument("--build", action="store_true", help="Recompile with PlatformIO before flashing")
    args = parser.parse_args()

    success = flash_firmware(port=args.port, baud=args.baud, rebuild=args.build)
    sys.exit(0 if success else 1)
