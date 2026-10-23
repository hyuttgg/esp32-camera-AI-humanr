"""
ESP32-CAM AI Vision — Diagnostic and Evaluation Tool
Parses Serial logs or real-time UART streams to evaluate:
1. Camera stability (Valid frames, Black screen ratio, DMA dropouts)
2. PSRAM and Heap watermark stability (Memory leak detection)
3. Inference latency and FPS benchmarks
4. Object & Human detection rates
"""

import sys
import re
import argparse

def evaluate_log_file(filepath):
    print(f"=== Evaluating Firmware Diagnostic Log: {filepath} ===")

    total_frames = 0
    black_screens = 0
    corrupt_frames = 0
    human_detections = 0
    phone_detections = 0
    handheld_verified = 0

    infer_latencies = []
    fps_measurements = []
    heap_measurements = []

    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            # Match stability test lines
            if "Test Progress:" in line or "Stability Test Results:" in line:
                m_black = re.search(r"Black Frames\s*:\s*(\d+)", line)
                m_valid = re.search(r"Valid Frames\s*:\s*(\d+)", line)
                if m_black:
                    black_screens = int(m_black.group(1))
                if m_valid:
                    total_frames = int(m_valid.group(1))

            # Match Detection lines
            if "[DETECTION]" in line:
                if "Class: Human" in line:
                    human_detections += 1
                elif "Class: Cell Phone" in line or "Class: Handheld Item" in line:
                    phone_detections += 1
                    if "Held: YES" in line:
                        handheld_verified += 1

                lat_m = re.search(r"Latency:\s*(\d+)\s*ms", line)
                if lat_m:
                    infer_latencies.append(int(lat_m.group(1)))

            # Match Telemetry lines
            if "[TELEMETRY]" in line:
                fps_m = re.search(r"FPS:\s*([\d\.]+)", line)
                heap_m = re.search(r"Heap Free:\s*(\d+)\s*KB", line)
                if fps_m:
                    fps_measurements.append(float(fps_m.group(1)))
                if heap_m:
                    heap_measurements.append(int(heap_m.group(1)))

    print("\n--- Summary Evaluation Report ---")
    if total_frames > 0:
        black_ratio = (black_screens / (total_frames + black_screens)) * 100.0
        print(f"Camera Stability Score : {(100.0 - black_ratio):.1f}%")
        print(f"Black Screen Ratio     : {black_ratio:.1f}% ({black_screens} frames)")
    else:
        print("Camera Stability       : Log contains continuous running stream")

    if infer_latencies:
        avg_lat = sum(infer_latencies) / len(infer_latencies)
        print(f"Average Inference Time : {avg_lat:.1f} ms (Min: {min(infer_latencies)} ms, Max: {max(infer_latencies)} ms)")
    
    if fps_measurements:
        avg_fps = sum(fps_measurements) / len(fps_measurements)
        print(f"Average Pipeline FPS   : {avg_fps:.1f} FPS")

    if heap_measurements:
        print(f"Memory Watermark       : Min Free Heap = {min(heap_measurements)} KB, End Free Heap = {heap_measurements[-1]} KB")
        if heap_measurements[0] - heap_measurements[-1] > 15:
            print("WARNING: Possible memory leakage observed (>15 KB drop across session)!")
        else:
            print("Memory Integrity       : STABLE (No heap drift detected)")

    print(f"Human Detections       : {human_detections}")
    print(f"Phone/Object Detections: {phone_detections} (Handheld Verified: {handheld_verified})")
    print("==================================================")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Evaluate ESP32-CAM AI Vision Logs")
    parser.add_argument("logfile", help="Path to log file in logs/ directory")
    args = parser.parse_args()
    evaluate_log_file(args.logfile)

