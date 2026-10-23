"""
ESP32-CAM AI Vision - Auto Device Manager & Driver Installer
===========================================================
- Tu dong kiem tra va cai dat driver (CH340 / CP210x) neu may tinh moi chua co
- Tu dong lang nghe su kien cam cap USB (Hotplug Detection)
- Tu dong xac dinh dung cong COM cua ESP32-CAM tren bat ky may tinh nao
- Khoi dong Firmware truyen hinh anh 30 FPS mượt mà
"""

import sys
import os
import time
import subprocess
import glob

if sys.platform == "win32":
    import io
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("[INFO] Pyserial chua duoc cai dat. Dang tu dong cai dat...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pyserial"])
    import serial
    import serial.tools.list_ports

KNOWN_VID_PIDS = [
    ("1A86", "7523", "WCH CH340"),
    ("1A86", "5523", "WCH CH341"),
    ("1A86", "7522", "WCH CH342"),
    ("10C4", "EA60", "Silicon Labs CP210x"),
    ("0403", "6001", "FTDI FT232R"),
    ("303A", "1001", "Espressif USB JTAG/Serial"),
    ("303A", "0002", "Espressif ESP32-S2/S3"),
]

KNOWN_NAMES = ["CH340", "CH341", "CP210", "USB-SERIAL", "UART", "USB SERIAL"]


def check_and_install_missing_drivers():
    """Kiem tra xem may tinh co thiet bi bi thieu driver (Code 28) khong."""
    if sys.platform != "win32":
        return

    try:
        # Kiem tra xem co thiet bi nao loi driver (Problem 28) khong
        cmd = "pnputil /enum-devices /problem 28"
        out = subprocess.check_output(cmd, shell=True, text=True, errors="ignore")
        
        needs_ch340 = False
        needs_cp210 = False

        if "1A86" in out or "CH34" in out or "USB2.0-Serial" in out:
            needs_ch340 = True
        if "10C4" in out or "CP210" in out:
            needs_cp210 = True

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        driver_ch340 = os.path.join(base_dir, "drivers", "CH340", "CH341SER", "CH341SER.INF")
        if not os.path.exists(driver_ch340):
            driver_ch340 = os.path.join(base_dir, "drivers", "CH340", "ch341ser.inf")
        driver_cp210 = os.path.join(base_dir, "drivers", "cp210x", "silabser.inf")

        if needs_ch340 and os.path.exists(driver_ch340):
            print("\n" + "="*60)
            print("[CANH BAO] Phat hien chip USB-UART CH340 nhung may tinh chua co driver!")
            print(f">> Dang tu dong nap driver Microsoft Certified tu: {driver_ch340}")
            install_inf(driver_ch340)

        if needs_cp210 and os.path.exists(driver_cp210):
            print("\n" + "="*60)
            print("[CANH BAO] Phat hien chip USB-UART CP210x nhung may tinh chua co driver!")
            print(f">> Dang tu dong nap driver tu: {driver_cp210}")
            install_inf(driver_cp210)

    except Exception:
        pass


def install_inf(inf_path):
    """Cai dat file INF qua pnputil (ho tro auto UAC elevation)."""
    try:
        # Thu cai dat truc tiep
        res = subprocess.run(f'pnputil /add-driver "{inf_path}" /install', shell=True, capture_output=True, text=True)
        if "successfully added" in res.stdout.lower() or "installed" in res.stdout.lower():
            print(">> Cai dat driver thanh cong!")
            time.sleep(1.5)
            return True
        else:
            # Can quyen Administrator, goi qua PowerShell RunAs
            ps_cmd = f'Start-Process pnputil -ArgumentList \'/add-driver "{inf_path}" /install\' -Verb RunAs -Wait'
            subprocess.run(["powershell", "-Command", ps_cmd], check=True)
            print(">> Da cap quyen va cai dat driver thanh cong!")
            time.sleep(2.0)
            return True
    except Exception as e:
        print(f"[LOI] Khong the tu cai driver tu dong: {e}")
        print(f">> Huong dan: Vao thu muc '{os.path.dirname(inf_path)}', click chuot phai vao file .inf chon 'Install'.")
        return False


def get_current_com_ports():
    """Lay danh sach cac cong COM hien co tren may."""
    ports = []
    for p in serial.tools.list_ports.comports():
        ports.append({
            "device": p.device,
            "description": p.description,
            "hwid": p.hwid,
            "vid": f"{p.vid:04X}" if p.vid else "",
            "pid": f"{p.pid:04X}" if p.pid else ""
        })
    return ports


def score_port(p):
    """Danh gia do uu tien cua cong COM de tim dung ESP32-CAM."""
    score = 0
    desc = p["description"].upper()
    hwid = p["hwid"].upper()

    # Kiem tra VID & PID dac trung
    for vid, pid, name in KNOWN_VID_PIDS:
        if vid in hwid and pid in hwid:
            score += 100
            break

    # Kiem tra ten chip quen thuoc
    for kw in KNOWN_NAMES:
        if kw in desc or kw in hwid:
            score += 50
            break

    # Tru diem cac cong COM ao bluetooth
    if "BLUETOOTH" in desc or "BTHENUM" in hwid:
        score -= 200

    return score


def find_esp32_cam_port():
    """Tim cong COM cua ESP32-CAM trong danh sach hien tai."""
    ports = get_current_com_ports()
    if not ports:
        return None

    scored = []
    for p in ports:
        s = score_port(p)
        if s > 0:
            scored.append((s, p))

    if scored:
        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]

    # Neu chi co dung 1 cong COM duy nhat (khong phai bluetooth)
    valid_ports = [p for p in ports if score_port(p) >= 0]
    if len(valid_ports) == 1:
        return valid_ports[0]

    return None


def wait_for_esp32_cam(timeout=60):
    """
    Theo doi va cho nguoi dung cam cap USB ESP32-CAM (Hotplug auto-detect).
    Tu dong bat ngay khi vua cam vao bat ky cong USB nao!
    """
    check_and_install_missing_drivers()

    # Kiem tra truoc xem da cam san chua
    detected = find_esp32_cam_port()
    if detected:
        print(f"[PHAT HIEN] Da tim thay ESP32-CAM tai cong: {detected['device']} ({detected['description']})")
        return detected["device"]

    initial_ports = {p["device"] for p in get_current_com_ports()}

    print("\n" + "="*62)
    print("      ESP32-CAM AI VISION - TU DONG NHAN DIEN PHAN CUNG      ")
    print("="*62)
    print("[CHO KET NOI] Chua thay ESP32-CAM duoc cam vao may tinh.")
    print(">>> VUI LONG CAM CAP USB CUA ESP32-CAM VAO MAY TINH BAY GIO... <<<")
    print("Dang quet cong COM tu dong ", end="", flush=True)

    spinner = ["|", "/", "-", "\\"]
    spinner_idx = 0
    start_time = time.time()

    while time.time() - start_time < timeout:
        time.sleep(0.5)
        current = get_current_com_ports()
        current_map = {p["device"]: p for p in current}
        new_ports = set(current_map.keys()) - initial_ports

        # Neu co cong COM moi xuat hien
        if new_ports:
            print("\n")
            new_dev = list(new_ports)[0]
            info = current_map[new_dev]
            print(f"[KET NOI MOI] Phat hien thiet bi vua cam vao: {new_dev} ({info['description']})")
            print(">> Cho he dieu hanh on dinh duong truyen (1.5 giay)...")
            time.sleep(1.5)
            return new_dev

        # Kiem tra lai danh sach hien tai
        cand = find_esp32_cam_port()
        if cand:
            print(f"\n[PHAT HIEN] Da ket noi thanh cong: {cand['device']} ({cand['description']})")
            return cand["device"]

        # Hien thi spinner
        sys.stdout.write(f"\rDang quet cong COM tu dong [{spinner[spinner_idx % len(spinner)]}] ")
        sys.stdout.flush()
        spinner_idx += 1

    print("\n\n[HET THOI GIAN CHO] Khong tim thay ESP32-CAM sau 60 giay.")
    print(">> Goi y kiem tra:")
    print("   1. Cap USB co truyen duoc du lieu khong (tranh cap chi co 2 day sac).")
    print("   2. Den LED do hoac nguon tren board ESP32-CAM co sang khong.")
    return None


def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Check if flashing firmware is requested
    if "--flash" in sys.argv or "-flash" in sys.argv:
        flash_script = os.path.join(base_dir, "scripts", "flash_standalone.py")
        cmd = [sys.executable, flash_script]
        sys.exit(subprocess.run(cmd).returncode)

    port = wait_for_esp32_cam()
    if not port:
        input("\nNhan Enter de thoat...")
        sys.exit(1)

    print(f"\n[KHOI DONG] Dang khoi dong he thong thi giac AI tren cong {port} @ 1,000,000 baud...")
    
    # Chay truc tiep trong process nay de loai bo zombie process va khoa cong COM
    sys.path.insert(0, os.path.join(base_dir, "scripts", "python"))
    import live_viewer

    # Trich xuat cac tham so tuy chon neu co
    duration = 0
    scale = 1.0
    for i, arg in enumerate(sys.argv):
        if arg == "--duration" and i + 1 < len(sys.argv):
            duration = float(sys.argv[i + 1])
        elif arg == "--scale" and i + 1 < len(sys.argv):
            scale = float(sys.argv[i + 1])

    try:
        live_viewer.run_viewer(port=port, baud=1000000, scale=scale, duration=duration)
    except KeyboardInterrupt:
        print("\n[INFO] Nguoi dung da dung chuong trinh.")


if __name__ == "__main__":
    main()

