import sys
import time
import argparse
import serial

def run_monitor(port, baud, logfile, duration):
    print(f"=== Opening Serial Monitor on {port} @ {baud} baud ===")
    if duration > 0:
        print(f"Auto-exit configured after {duration} seconds. (Press Ctrl+C to terminate earlier)")
    else:
        print("Press Ctrl+C to terminate.")

    try:
        s = serial.Serial(port, baud, timeout=1)
    except Exception as e:
        print(f"[MONITOR ERROR] Could not open {port}: {e}")
        sys.exit(1)

    # Perform RTS toggle to release reset line cleanly
    try:
        s.dtr = False
        s.rts = True
        time.sleep(0.15)
        s.rts = False
        time.sleep(0.1)
    except Exception:
        pass

    log_handle = None
    if logfile:
        try:
            log_handle = open(logfile, 'a', encoding='utf-8', errors='replace')
        except Exception as e:
            print(f"[LOG ERROR] Could not open logfile: {e}")

    start_time = time.time()
    try:
        while True:
            if duration > 0 and (time.time() - start_time) >= duration:
                print(f"\n=== Monitor reached timeout duration of {duration}s ===")
                break

            line_bytes = s.readline()
            if line_bytes:
                line_str = line_bytes.decode('utf-8', errors='replace').rstrip('\r\n')
                print(line_str)
                if log_handle:
                    log_handle.write(line_str + '\n')
                    log_handle.flush()
    except KeyboardInterrupt:
        print("\n=== Monitor terminated by user ===")
    finally:
        s.close()
        if log_handle:
            log_handle.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Live Resilient Serial Monitor for ESP32-CAM")
    parser.add_argument("--port", required=True, help="COM Port (e.g. COM4)")
    parser.add_argument("--baud", type=int, default=115200, help="Baud rate")
    parser.add_argument("--logfile", default="", help="Path to write log output")
    parser.add_argument("--duration", type=int, default=0, help="Monitoring duration in seconds (0 = infinite)")
    args = parser.parse_args()

    run_monitor(args.port, args.baud, args.logfile, args.duration)
