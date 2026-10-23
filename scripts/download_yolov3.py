"""
================================================================================
  YOLOv3 / YOLOv3-Tiny Downloader Script for ESP32-CAM AI Vision
================================================================================
Downloads official Darknet weights and configuration files for OpenCV DNN:
  - yolov3-tiny.cfg    (~3 KB)
  - yolov3-tiny.weights (~34 MB)
  - coco.names         (~1 KB)
Usage:
  python scripts/download_yolov3.py
  python scripts/download_yolov3.py --full  (Downloads 236MB full YOLOv3)
================================================================================
"""

import os
import sys
import argparse
import urllib.request

FILES_TINY = {
    "yolov3-tiny.cfg": "https://raw.githubusercontent.com/pjreddie/darknet/master/cfg/yolov3-tiny.cfg",
    "yolov3-tiny.weights": "https://pjreddie.com/media/files/yolov3-tiny.weights",
    "coco.names": "https://raw.githubusercontent.com/pjreddie/darknet/master/data/coco.names"
}

FILES_FULL = {
    "yolov3.cfg": "https://raw.githubusercontent.com/pjreddie/darknet/master/cfg/yolov3.cfg",
    "yolov3.weights": "https://pjreddie.com/media/files/yolov3.weights",
    "coco.names": "https://raw.githubusercontent.com/pjreddie/darknet/master/data/coco.names"
}

def download_with_progress(url, dest_path):
    print(f"Downloading {os.path.basename(dest_path)} from {url}...")
    try:
        def reporthook(block_num, block_size, total_size):
            downloaded = block_num * block_size
            if total_size > 0:
                percent = min(100.0, (downloaded / total_size) * 100.0)
                mb_down = downloaded / (1024 * 1024)
                mb_total = total_size / (1024 * 1024)
                sys.stdout.write(f"\r  Progress: {percent:5.1f}% [{mb_down:6.2f}MB / {mb_total:6.2f}MB]")
                sys.stdout.flush()

        urllib.request.urlretrieve(url, dest_path, reporthook=reporthook)
        print(f"\n[OK] Saved to: {dest_path}")
        return True
    except Exception as e:
        print(f"\n[ERROR] Failed to download {url}: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Download YOLOv3 / YOLOv3-Tiny files for OpenCV DNN")
    parser.add_argument("--full", action="store_true", help="Download full YOLOv3 (236 MB) instead of YOLOv3-Tiny (34 MB)")
    args = parser.parse_args()

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_files = FILES_FULL if args.full else FILES_TINY

    print("==========================================================")
    print(f"  DOWNLOADING {'YOLOv3 Full (236MB)' if args.full else 'YOLOv3-Tiny (34MB)'} FOR OPENCV DNN")
    print("==========================================================")
    print(f"Destination: {base_dir}\n")

    for filename, url in target_files.items():
        dest = os.path.join(base_dir, filename)
        if os.path.exists(dest) and os.path.getsize(dest) > 100:
            print(f"[EXISTS] {filename} already exists ({os.path.getsize(dest) / 1024:.1f} KB). Skipping.")
        else:
            download_with_progress(url, dest)

    print("\n[SUCCESS] Hoan tat! Bay gio ban co the chay:")
    print("  .\\scripts\\run_viewer.ps1 -Port COM6 --model yolov3-tiny")
    print("  python scripts/python/live_viewer.py --model yolov3-tiny\n")

if __name__ == "__main__":
    main()
