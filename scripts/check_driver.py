import subprocess
import sys
import os

def check_serial_driver():
    print("=" * 60)
    print("      KIEM TRA DRIVER USB SERIAL CHO ESP32-CAM")
    print("=" * 60)

    # 1. Check active COM ports via pyserial if available
    has_active_port = False
    try:
        import serial.tools.list_ports
        ports = list(serial.tools.list_ports.comports())
        for p in ports:
            desc = (p.description or "") + " " + (p.hwid or "")
            if any(k in desc.upper() for k in ["CH340", "1A86:7523", "CP210", "10C4:EA60", "USB-SERIAL", "FTDI"]):
                print(f"[OK] Da tim thay thiet bi hoat dong: {p.description} ({p.device})")
                has_active_port = True
                return True
    except Exception:
        pass

    if has_active_port:
        return True

    # 2. Check Windows PnP via PowerShell
    print("[INFO] Dang kiem tra trang thai thiet bi Windows PnP...")
    ps_cmd = 'Get-CimInstance Win32_PnPEntity | Where-Object { $_.DeviceID -match "VID_1A86" -or $_.Name -match "CH340|USB-SERIAL" } | Select-Object Name, DeviceID, ConfigManagerErrorCode, Status | ConvertTo-Json'
    try:
        res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_cmd], capture_output=True, text=True, timeout=10)
        out = res.stdout.strip()
        if out:
            print("[INFO] Thong tin thiet bi phat hien:")
            print(out)
    except Exception as e:
        print(f"[WARN] Khong the truy van Win32_PnPEntity: {e}")

    # 3. If no working port found, attempt driver installation
    inf_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "drivers", "CH340", "CH341SER", "CH341SER.INF")
    setup_exe = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "drivers", "CH340", "CH341SER", "SETUP.EXE")

    if os.path.exists(inf_path):
        print("\n[INFO] Tien hanh cai dat Driver CH340 tu dong vao Windows...")
        try:
            pnp_res = subprocess.run(["pnputil.exe", "/add-driver", inf_path, "/install"], capture_output=True, text=True)
            print(pnp_res.stdout)
            if pnp_res.returncode == 0:
                print("[SUCCESS] Cai dat Driver CH340 thanh cong qua Windows pnputil!")
                return True
        except Exception as e:
            print(f"[WARN] pnputil loi ({e}), thu chay SETUP.EXE...")

    if os.path.exists(setup_exe):
        print(f"[INFO] Khoi chay trinh cai dat driver: {setup_exe}")
        subprocess.Popen([setup_exe])
        return True

    return False

if __name__ == "__main__":
    check_serial_driver()
