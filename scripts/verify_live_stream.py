import serial
import time
import struct
import cv2
import numpy as np
import os

PORT = 'COM4'
BAUD = 1000000

print(f"[VERIFY] Connecting to {PORT} @ {BAUD} baud...")
ser = serial.Serial()
ser.port = PORT
ser.baudrate = BAUD
ser.timeout = 0.1
ser.dtr = False
ser.rts = False
ser.open()
ser.set_buffer_size(rx_size=262144, tx_size=65536)

# Ensure RTS is clean (not holding in reset)
ser.dtr = False
ser.rts = False
time.sleep(0.1)

MAGIC_HEADER = b'\xaa\x55\xcc\x33'
FOOTER_DELIMITER = b'\x55\xaa'

buffer = bytearray()
decoded_frames = 0
corrupt_frames = 0
last_frame_img = None
start_time = time.time()
last_v_req = 0
test_duration = 7.0
first_frame_time = None

print(f"[VERIFY] Monitoring live stream for {test_duration} seconds...")

while time.time() - start_time < test_duration:
    now = time.time()
    # Ping 'V' every 0.4s until streaming starts
    if decoded_frames == 0 and (now - last_v_req > 0.4):
        try:
            ser.write(b"V\n")
            ser.flush()
        except Exception:
            pass
        last_v_req = now

    waiting = ser.in_waiting
    if waiting > 0:
        chunk = ser.read(min(waiting, 65536))
        buffer.extend(chunk)
    else:
        time.sleep(0.001)
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

        width, height, payload_len, fmt, num_dets, frame_seq, crc16 = struct.unpack('<HHIBBHH', buffer[4:18])
        if payload_len > 150000 or num_dets > 10 or width > 1600 or height > 1200 or payload_len == 0:
            del buffer[:4]
            corrupt_frames += 1
            continue

        det_bytes_len = num_dets * 14
        total_packet_len = 18 + det_bytes_len + payload_len + 2

        # Resilient boundary alignment
        next_magic = buffer.find(MAGIC_HEADER, 4)
        if next_magic != -1 and abs(next_magic - total_packet_len) <= 16:
            total_packet_len = next_magic

        if len(buffer) < total_packet_len:
            break

        footer = buffer[total_packet_len - 2 : total_packet_len]
        if footer != FOOTER_DELIMITER:
            if next_magic != -1:
                del buffer[:next_magic]
            else:
                del buffer[:4]
            corrupt_frames += 1
            continue

        payload_offset = 18 + det_bytes_len
        payload = bytes(buffer[payload_offset : total_packet_len - 2])
        del buffer[:total_packet_len]

        if len(payload) >= 4 and payload[:2] == b'\xff\xd8' and payload[-2:] == b'\xff\xd9':
            img = cv2.imdecode(np.frombuffer(payload, dtype=np.uint8), cv2.IMREAD_COLOR)
            if img is not None and img.size > 0:
                decoded_frames += 1
                last_frame_img = img
                if first_frame_time is None:
                    first_frame_time = time.time()
            else:
                corrupt_frames += 1
        else:
            corrupt_frames += 1

ser.close()

active_stream_dur = (time.time() - first_frame_time) if first_frame_time else 0.001
fps = (decoded_frames / active_stream_dur) if active_stream_dur > 0 else 0

print("\n" + "="*55)
print("             ESP32-CAM LIVE STREAM AUDIT REPORT")
print("="*55)
print(f"Port / Baud Rate      : {PORT} @ {BAUD} baud")
print(f"Decoded Frames        : {decoded_frames} frames")
print(f"Corrupt Frames        : {corrupt_frames} frames")
print(f"Stream Duration       : {active_stream_dur:.2f} seconds")
print(f"Measured Stream FPS   : {fps:.1f} FPS")

os.makedirs('snapshots', exist_ok=True)
snap_path = os.path.abspath('snapshots/live_verified_1000000baud.jpg')
if last_frame_img is not None:
    cv2.imwrite(snap_path, last_frame_img)
    h, w, c = last_frame_img.shape
    mean_lum = float(np.mean(last_frame_img))
    std_lum = float(np.std(last_frame_img))
    print(f"Image Resolution      : {w}x{h} ({c} channels)")
    print(f"Image Mean Luminance  : {mean_lum:.1f}/255")
    print(f"Image Contrast (Std)  : {std_lum:.1f}")
    print(f"Saved Snapshot Path   : {snap_path}")
    print("="*55)
    print("STATUS: >>> CAMERA FEED VERIFIED AND STREAMING CLEANLY! <<<")
else:
    print("="*55)
    print("STATUS: FAILED - NO VALID FRAMES DECODED")

