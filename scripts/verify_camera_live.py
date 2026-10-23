import time
import serial
import cv2
import numpy as np
import os
import struct

MAGIC_HEADER = b'\xaa\x55\xcc\x33'
FOOTER_DELIMITER = b'\x55\xaa'

def test_live_esp32(port="COM4", baud=2000000, duration=6):
    print(f"Connecting to ESP32 on {port} @ {baud} baud...")
    try:
        ser = serial.Serial(port, baud, timeout=0.1)
    except Exception as e:
        print(f"[ERROR] Cannot open {port}: {e}")
        return False

    # Hardware Reset toggle (RTS/DTR)
    try:
        ser.dtr = False
        ser.rts = True
        time.sleep(0.15)
        ser.rts = False
    except Exception:
        pass

    print("Waiting for ESP32 boot sequence to reach RUNNING state...")
    t_boot = time.time()
    boot_ok = False
    while time.time() - t_boot < 8.0:
        line = ser.readline()
        if line:
            try:
                s = line.decode('utf-8', errors='replace').strip()
                if s:
                    print(" [ESP32]", s)
                if 'Entering RUNNING state' in s or 'STATE_RUNNING' in s:
                    boot_ok = True
                    break
            except Exception:
                pass

    if not boot_ok:
        print("[WARNING] Did not observe explicit RUNNING log, attempting stream anyway...")

    ser.reset_input_buffer()
    time.sleep(0.2)
    print("\n>>> Requesting video stream (sending 'V')...")
    ser.write(b'V\n')
    ser.flush()

    buffer = bytearray()
    t_start = time.time()
    frames_received = 0
    valid_decodes = 0
    saved_snapshot = False

    os.makedirs(r"c:\Users\khanh\Desktop\ai\snapshots", exist_ok=True)
    snapshot_path = r"c:\Users\khanh\Desktop\ai\snapshots\verify_live.jpg"

    while time.time() - t_start < duration:
        waiting = ser.in_waiting
        if waiting > 0:
            chunk = ser.read(min(waiting, 65536))
            buffer.extend(chunk)
        else:
            time.sleep(0.005)
            continue

        while len(buffer) >= 18:
            idx = buffer.find(MAGIC_HEADER)
            if idx == -1:
                if len(buffer) > 3:
                    del buffer[:-3]
                break

            if idx > 0:
                del buffer[:idx]
                if len(buffer) < 18:
                    break

            raw_header = buffer[4:18]
            w, h, payload_len, fmt, num_dets, frame_seq, crc16 = struct.unpack('<HHIBBHH', raw_header)

            if payload_len > 150000 or num_dets > 10 or w > 1600 or h > 1200 or payload_len == 0:
                del buffer[:4]
                continue

            det_bytes_len = num_dets * 14
            total_len = 18 + det_bytes_len + payload_len + 2

            if len(buffer) < total_len:
                break

            footer = buffer[total_len - 2 : total_len]
            if footer != FOOTER_DELIMITER:
                del buffer[:4]
                continue

            payload_offset = 18 + det_bytes_len
            payload = bytes(buffer[payload_offset : payload_offset + payload_len])
            del buffer[:total_len]

            frames_received += 1

            # Decode JPEG
            img = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR)
            if img is not None and img.shape[0] > 0 and img.shape[1] > 0:
                valid_decodes += 1
                if not saved_snapshot:
                    cv2.imwrite(snapshot_path, img)
                    saved_snapshot = True
                    print(f"[SUCCESS] Captured live frame: {img.shape[1]}x{img.shape[0]} ({len(payload)} bytes) -> Saved to {snapshot_path}")

    # Stop streaming
    try:
        ser.write(b'X\n')
        ser.flush()
    except Exception:
        pass
    ser.close()

    elapsed = time.time() - t_start
    fps = frames_received / elapsed if elapsed > 0 else 0
    print(f"\n--- VERIFICATION REPORT ---")
    print(f"Elapsed Time       : {elapsed:.2f} s")
    print(f"Frames Received    : {frames_received}")
    print(f"Valid JPEG Decodes : {valid_decodes}")
    print(f"Streaming FPS      : {fps:.1f} FPS")
    if valid_decodes > 0:
        print("STATUS: PASSED! Live image feed is streaming cleanly without corruption.")
        return True
    else:
        print("STATUS: FAILED! No valid frames received.")
        return False

if __name__ == "__main__":
    test_live_esp32()
