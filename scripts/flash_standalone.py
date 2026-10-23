"""
Standalone Firmware Flasher for ESP32-CAM
=========================================
Tu dong tim cong COM va nap Firmware ma khong can PlatformIO.
Hoat dong tren bat ky may tinh nao chi can co Python!
"""

import sys
import os
import subprocess
import time

try:
    import esptool
except ImportError:
    print("[INFO] esptool chua duoc cai dat. Dang cai dat tu dong...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "esptool"])
    import esptool

from auto_device_manager import wait_for_esp32_cam

def flash(port=None):
    if not port:
        port = wait_for_esp32_cam(timeout=30)
        if not port:
            print("[LOI] Khong tim thay thiet bi ESP32-CAM!")
            return False

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    bin_dir = os.path.join(base_dir, "bin")

    bootloader = os.path.join(bin_dir, "bootloader.bin")
    partitions = os.path.join(bin_dir, "partitions.bin")
    boot_app0  = os.path.join(bin_dir, "boot_app0.bin")
    firmware   = os.path.join(bin_dir, "firmware.bin")

    for f in [bootloader, partitions, boot_app0, firmware]:
        if not os.path.exists(f):
            print(f"[LOI] Thieu file binary: {f}")
            return False

    print("\n" + "="*60)
    print(f"   DANG NAP FIRMWARE VAO ESP32-CAM TAI CONG: {port}")
    print("="*60)

    # Giai phong cong COM neu co chuong trinh dang giu
    if sys.platform == "win32":
        try:
            subprocess.run(["powershell", "-Command", "Get-Process python -ErrorAction SilentlyContinue | Where-Object {$_.Id -ne $PID} | Stop-Process -Force"], timeout=3)
        except Exception:
            pass

    cmd = [
        sys.executable, "-m", "esptool",
        "--chip", "esp32",
        "--port", port,
        "--baud", "460800",
        "--before", "default_reset",
        "--after", "hard_reset",
        "write_flash", "-z",
        "--flash_mode", "dio",
        "--flash_freq", "40m",
        "--flash_size", "4MB",
        "0x1000", bootloader,
        "0x8000", partitions,
        "0xe000", boot_app0,
        "0x10000", firmware
    ]

    print("Lenh thuc thi:", " ".join(cmd))
    res = subprocess.run(cmd)
    if res.returncode == 0:
        print("\n" + "="*60)
        print(">>> NAP FIRMWARE THANH CONG 100%! <<<")
        print("Board da duoc Hard Reset va san sang hoat dong.")
        print("="*60)
        return True
    else:
        print("\n[THAT BAI] Nap firmware that bai. Vui long kiem tra ket noi cap USB va thu lai.")
        return False

if __name__ == "__main__":
    p = sys.argv[1] if len(sys.argv) > 1 else None
    flash(p)

