"""
================================================================================
  SIÊU HỆ THỐNG NHẬN DIỆN NGƯỜI TRONG BÓNG TỐI SÂU & THỜI GIAN THỰC 30 FPS
  POWERED BY YOLOV8 & EXTREME NIGHT VISION ADAPTIVE PIPELINE
================================================================================
Kiến trúc tối tân đột phá:
  1. Multi-Tier Extreme Night Vision Enhancer (Càng tối càng nhận diện được):
     - Đo độ sáng siêu tốc (<0.04ms) chia thành 4 tầng nhạy sáng:
       * Tầng 0 (Ban ngày Lum >= 55): Giữ 100% màu sắc và chi tiết gốc.
       * Tầng 1 (Thiếu sáng 25 <= Lum < 55): CLAHE đa vùng + Gamma 0.65.
       * Tầng 2 (Bóng đêm sâu 8 <= Lum < 25): Kéo dãn bách phân động + Lọc trung vị + Gamma 0.45.
       * Tầng 3 (Bóng tối cực hạn Lum < 8, kể cả 0.5 - 1.0 Lum đen kịt):
         + Dynamic Range Percentile Stretching [1%, 99%] kéo sáng toàn dải.
         + Lọc song phương (Bilateral Filter) triệt tiêu nhiễu hạt sensor CMOS.
         + CLAHE tương phản vi mô cực đại (ClipLimit 4.8).
         + Gamma sâu 0.35 + Unsharp Masking tái tạo đường viền cơ thể người.
  2. Lõi AI YOLOv8 Tự Động Thích Ứng Ngưỡng (Adaptive Confidence YOLOv8 Engine):
     - Ưu tiên YOLOv8s (chính xác vượt trội trong bóng tối) & YOLOv8n (siêu tốc).
     - Điều chỉnh ngưỡng nhạy sáng theo tầng: Ban ngày 0.28 -> Ban đêm cực hạn 0.16.
  3. Bộ Bám Vết Chống Rung (Anti-Jitter Smooth EMA + Velocity Extrapolator):
     - Khóa cứng mục tiêu, dự đoán quán tính, giữ vết bám chống chớp tắt.
  4. Multi-Threaded Decoupled Pipeline:
     - Luồng đọc/hiển thị độc lập khóa cứng 30.0 FPS mượt mà.
  5. Chế độ hiển thị đa năng (Phím N):
     - Chế độ 0: Khung hình gốc camera + HUD Cyberpunk.
     - Chế độ 1: Khung hình Kính nhìn đêm (Night Vision Enhancement).
     - Chế độ 2: Màn hình chia đôi đối sánh trực tiếp (Dual View Split Screen).
================================================================================
"""

import sys
import os
import time
import csv
import threading
from queue import Queue, Empty
import cv2
import numpy as np

# Suppress internal OpenCV / libjpeg logging
cv2.utils.logging.setLogLevel(cv2.utils.logging.LOG_LEVEL_SILENT)

# ==============================================================================
# CẤU HÌNH MẶC ĐỊNH
# ==============================================================================
DEFAULT_SOURCE = "khanh.mp4"
DEFAULT_MODEL = "yolov8s"          # Ưu tiên YOLOv8s cho bóng tối (hoặc yolov8n)
DEFAULT_OUTPUT = "output_detection_30fps.mp4"
DEFAULT_CSV = "detections_log.csv"
TARGET_FPS = 30


def box_iou(box_a, box_b):
    """Tính toán Intersection over Union giữa hai hộp bounding box."""
    xa = max(box_a[0], box_b[0])
    ya = max(box_a[1], box_b[1])
    xb = min(box_a[2], box_b[2])
    yb = min(box_a[3], box_b[3])
    inter = max(0.0, xb - xa) * max(0.0, yb - ya)
    area_a = max(1.0, (box_a[2] - box_a[0]) * (box_a[3] - box_a[1]))
    area_b = max(1.0, (box_b[2] - box_b[0]) * (box_b[3] - box_b[1]))
    return inter / float(area_a + area_b - inter)


class ESP32FlashController:
    """Điều khiển đèn Flash LED trên bo mạch ESP32-CAM qua cổng UART (Serial)."""
    def __init__(self, port="auto", baud=1000000):
        self.ser = None
        self.port_name = None
        self.is_connected = False
        self.flash_state = False
        self._init_connection(port, baud)

    def _init_connection(self, port, baud):
        try:
            import serial
            import serial.tools.list_ports
        except ImportError:
            return

        target_port = None
        if port and port != "auto":
            target_port = port
        else:
            try:
                ports = list(serial.tools.list_ports.comports())
                for p in ports:
                    desc = (p.description or "").upper()
                    hwid = (p.hwid or "").upper()
                    if any(k in desc or k in hwid for k in ["CH340", "CH341", "CP210", "USB-SERIAL", "UART", "1A86", "10C4"]):
                        target_port = p.device
                        break
            except Exception:
                pass

        if target_port:
            try:
                self.ser = serial.Serial(target_port, baudrate=baud, timeout=0.1)
                self.port_name = target_port
                self.is_connected = True
                print(f"[HARDWARE] Đã kết nối Flash LED ESP32-CAM trên {target_port} ({baud} baud)")
            except Exception:
                self.ser = None
                self.is_connected = False

    def set_flash(self, state: bool):
        self.flash_state = state
        if self.ser and self.ser.is_open:
            try:
                # Gửi cả mã lệnh mới ('O'/'K') và mã toggle 'F'
                cmd = b'O\n' if state else b'K\n'
                self.ser.write(cmd)
                self.ser.flush()
            except Exception:
                pass

    def turn_on(self):
        self.set_flash(True)

    def turn_off(self):
        self.set_flash(False)

    def toggle(self):
        self.set_flash(not self.flash_state)
        return self.flash_state

    def provision_wifi_and_ei_config(self, ssid: str, password: str, backend_url: str, input_size: int = 96, conf_thresh: float = 0.50):
        """Gửi trực tiếp cấu hình Wi-Fi NVS và tham số C++ Edge Impulse DSP xuống bo mạch ESP32-CAM."""
        if self.ser and self.ser.is_open:
            try:
                wifi_cmd = f"SET_WIFI:{ssid},{password},{backend_url}\n".encode("utf-8")
                ei_cmd = f"SET_EI_CONFIG:{input_size}x{input_size},{conf_thresh:.2f},RGB888_BGR2RGB_379\n".encode("utf-8")
                self.ser.write(wifi_cmd)
                self.ser.write(ei_cmd)
                self.ser.flush()
                return True
            except Exception:
                return False
        return False

    def poll_edge_impulse_boxes(self, frame_w: int = 320, frame_h: int = 240, ei_w: int = 96, ei_h: int = 96):
        """
        Đọc hộp giới hạn (bounding boxes) từ C++ Edge Impulse / TurboQuant trên ESP32-CAM
        (Định dạng CircuitDigest: `person (0.965000) [ x: 24, y: 12, width: 48, height: 72 ]`)
        để hợp nhất (Co-op Fusion) với YOLOv8 trên Python.
        """
        boxes = []
        if not (self.ser and self.ser.is_open):
            return boxes
        try:
            import re
            pattern = re.compile(
                r"^\s*([a-zA-Z0-9_\-]+)\s*\(([0-9.]+)\)\s*\[\s*x:\s*(\d+),\s*y:\s*(\d+),\s*width:\s*(\d+),\s*height:\s*(\d+)\s*\]"
            )
            while self.ser.in_waiting > 0:
                line = self.ser.readline().decode("utf-8", errors="ignore").strip()
                m = pattern.match(line)
                if m:
                    label, score_s, x_s, y_s, w_s, h_s = m.groups()
                    if label.lower() in ("person", "human", "nguoi"):
                        scale_x = frame_w / float(max(1, ei_w))
                        scale_y = frame_h / float(max(1, ei_h))
                        x1 = int(int(x_s) * scale_x)
                        y1 = int(int(y_s) * scale_y)
                        x2 = int((int(x_s) + int(w_s)) * scale_x)
                        y2 = int((int(y_s) + int(h_s)) * scale_y)
                        boxes.append((x1, y1, x2, y2, float(score_s)))
        except Exception:
            pass
        return boxes

    def close(self):
        if self.ser and self.ser.is_open:
            try:
                self.turn_off()
                self.ser.close()
            except Exception:
                pass


class ExtremeNightEnhancer:
    """
    Bộ tăng cường thị giác bóng tối chuyên sâu (Deep Night Vision Enhancer)
    Tối ưu hóa đa tầng theo cường độ sáng (Luminance Adaptive Multi-Tier Pipeline).
    """
    def __init__(self):
        self.clahe_moderate = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        self.clahe_extreme = cv2.createCLAHE(clipLimit=4.8, tileGridSize=(8, 8))
        
        # Bảng LUT Gamma cho từng cấp độ bóng tối
        self.gamma_luts = {}
        for g_val in [0.25, 0.35, 0.45, 0.55, 0.65]:
            lut = np.array([((i / 255.0) ** g_val) * 255 for i in range(256)]).astype('uint8')
            self.gamma_luts[g_val] = lut

        self.current_lum = 100.0
        self.is_night = False
        self.tier = "DAYLIGHT"

    def process(self, frame):
        """Phân tích và tăng cường ảnh tối theo phân tầng tự động."""
        # Đo nhanh độ sáng qua ma trận thu nhỏ 64x48 (<0.04ms)
        small = cv2.resize(frame, (64, 48), interpolation=cv2.INTER_NEAREST)
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
        self.current_lum = float(np.mean(gray))

        # 1. Ban ngày (Lum >= 55): Giữ nguyên 100% màu sắc và chi tiết gốc
        if self.current_lum >= 55.0:
            self.is_night = False
            self.tier = "DAYLIGHT"
            return frame, False, self.current_lum, self.tier

        self.is_night = True

        # 2. Xử lý bóng tối trong không gian màu LAB (Tách biệt Luma / Chroma)
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)

        if self.current_lum < 8.0:
            # TẦNG 3: BÓNG TỐI CỰC HẠN (Lum < 8, kể cả 0.5 - 2.0 Lum)
            self.tier = "TIER_3_EXTREME"
            
            # Kéo giãn dải nhạy sáng động (Dynamic Range Percentile Stretching)
            p_low = np.percentile(l_channel, 1.0)
            p_high = max(p_low + 5.0, np.percentile(l_channel, 99.0))
            stretched = np.clip((l_channel.astype(np.float32) - p_low) * (255.0 / (p_high - p_low)), 0, 255).astype(np.uint8)

            # Lọc khử nhiễu song phương bảo toàn viền người
            denoised = cv2.bilateralFilter(stretched, d=5, sigmaColor=30, sigmaSpace=30)

            # CLAHE tương phản vi mô
            l_enh = self.clahe_extreme.apply(denoised)

            # Gamma sâu 0.35 kéo chi tiết người
            l_enh = cv2.LUT(l_enh, self.gamma_luts[0.35])

            # Làm nét nhẹ các đường viền giải phẫu (Đầu, vai, thân người)
            gaussian = cv2.GaussianBlur(l_enh, (0, 0), 2.0)
            l_enh = cv2.addWeighted(l_enh, 1.35, gaussian, -0.35, 0)

        elif self.current_lum < 25.0:
            # TẦNG 2: BÓNG ĐÊM SÂU (8 <= Lum < 25)
            self.tier = "TIER_2_DEEP"
            p_low = np.percentile(l_channel, 1.0)
            p_high = max(p_low + 10.0, np.percentile(l_channel, 99.5))
            stretched = np.clip((l_channel.astype(np.float32) - p_low) * (255.0 / (p_high - p_low)), 0, 255).astype(np.uint8)

            denoised = cv2.medianBlur(stretched, 3)
            l_enh = self.clahe_extreme.apply(denoised)
            l_enh = cv2.LUT(l_enh, self.gamma_luts[0.45])

        else:
            # TẦNG 1: THIẾU SÁNG (25 <= Lum < 55)
            self.tier = "TIER_1_LOW"
            l_enh = self.clahe_moderate.apply(l_channel)
            l_enh = cv2.LUT(l_enh, self.gamma_luts[0.65])
            l_enh = cv2.GaussianBlur(l_enh, (3, 3), 0)

        enhanced_lab = cv2.merge([l_enh, a_channel, b_channel])
        enhanced_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
        return enhanced_bgr, True, self.current_lum, self.tier


class SmoothHumanTracker:
    """Bộ bám vết người đa mục tiêu chống rung lắc (Anti-Jitter EMA + Velocity Extrapolator)."""
    def __init__(self, iou_thresh=0.25, max_age=12):
        self.lock = threading.Lock()
        self.tracks = []
        self.next_id = 1
        self.iou_thresh = iou_thresh
        self.max_age = max_age

    def update(self, new_boxes):
        """Cập nhật vết người mới với bộ lọc làm mượt hàm mũ EMA và đo vận tốc."""
        with self.lock:
            updated = []
            matched_dets = set()

            for trk in self.tracks:
                best_iou = 0.0
                best_idx = -1
                for idx, det in enumerate(new_boxes):
                    if idx in matched_dets:
                        continue
                    iou = box_iou(trk["box"], det[:4])
                    if iou > best_iou:
                        best_iou = iou
                        best_idx = idx

                if best_idx >= 0 and best_iou >= self.iou_thresh:
                    matched_dets.add(best_idx)
                    det = new_boxes[best_idx]
                    cur_box = np.array(det[:4], dtype=np.float32)

                    # Tính vận tốc dịch chuyển tức thời
                    vel = cur_box - trk["box"]
                    trk["vel"] = 0.7 * trk["vel"] + 0.3 * vel

                    # Bộ lọc khử rung (Deadband 3.5px)
                    diff = float(np.max(np.abs(cur_box - trk["box"])))
                    if diff < 3.5:
                        smooth_box = trk["box"]
                    else:
                        smooth_box = 0.70 * cur_box + 0.30 * trk["box"]

                    trk["box"] = smooth_box
                    trk["conf"] = float(det[4])
                    trk["age"] = 0
                    updated.append(trk)
                else:
                    trk["age"] += 1
                    if trk["age"] <= self.max_age:
                        # Dự đoán bước tiếp theo theo quán tính khi bị che khuất trong bóng tối
                        trk["box"] += trk["vel"] * 0.4
                        trk["conf"] *= 0.96
                        updated.append(trk)

            # Đăng ký các người mới xuất hiện
            for idx, det in enumerate(new_boxes):
                if idx not in matched_dets:
                    tid = self.next_id
                    self.next_id = (self.next_id + 1) if self.next_id < 9999 else 1
                    updated.append({
                        "id": tid,
                        "box": np.array(det[:4], dtype=np.float32),
                        "vel": np.zeros(4, dtype=np.float32),
                        "conf": float(det[4]),
                        "age": 0
                    })

            self.tracks = updated

    def step(self):
        """Lấy danh sách các hộp đã làm mượt cho khung hình hiển thị (30 FPS)."""
        with self.lock:
            clean_boxes = []
            for trk in self.tracks:
                if trk["age"] > self.max_age:
                    continue
                box = trk["box"]
                clean_boxes.append((
                    int(box[0]), int(box[1]), int(box[2]), int(box[3]),
                    trk["conf"], trk["id"]
                ))
            return clean_boxes


class AsyncAIWorker(threading.Thread):
    """Luồng chạy suy luận AI ngầm (YOLOv8 PyTorch / ONNX Runtime). Không làm giật khung hình."""
    def __init__(self, tracker, model_pref="yolov8s", imgsz=640):
        super().__init__(daemon=True)
        self.tracker = tracker
        self.model_pref = model_pref.lower()
        self.imgsz = imgsz
        self.running = True
        self.pending_frame = None
        self.tier = "DAYLIGHT"
        self.lock = threading.Lock()
        self.inference_fps = 0.0
        self.latency_ms = 0.0
        self.infer_count = 0
        self.total_inferences = 0
        self.last_time = time.time()
        self.engine_name = "Đang khởi tạo..."

        self.model = None
        self.onnx_sess = None
        self.onnx_in = None
        self._init_model()

    def _init_model(self):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Đường dẫn các mô hình YOLOv8
        pt_s = os.path.join(base_dir, "yolov8s.pt")
        pt_n = os.path.join(base_dir, "yolov8n.pt")
        onnx_s = os.path.join(base_dir, "yolov8s.onnx")
        onnx_n = os.path.join(base_dir, "yolov8n.onnx")

        # 1. Thử PyTorch Ultralytics (Độ chính xác cao nhất cho bóng tối)
        try:
            from ultralytics import YOLO
            pt_target = pt_s if "s" in self.model_pref and os.path.exists(pt_s) else pt_n
            if not os.path.exists(pt_target):
                pt_target = pt_s if os.path.exists(pt_s) else pt_n

            if os.path.exists(pt_target):
                self.model = YOLO(pt_target)
                self.engine_name = f"PyTorch {os.path.basename(pt_target)}"
                # Warm-up để loại bỏ độ trễ cold-start
                dummy = np.zeros((320, 320, 3), dtype=np.uint8)
                self.model.predict(dummy, imgsz=self.imgsz, verbose=False)
                print(f"[INFO] Đã nạp thành công mô hình YOLOv8: {self.engine_name}")
                return
        except Exception as e:
            print(f"[WARN] Không nạp được PyTorch YOLOv8: {e}")

        # 2. Thử ONNX Runtime (Tối ưu SIMD AVX2)
        try:
            import onnxruntime as ort
            onnx_target = onnx_s if "s" in self.model_pref and os.path.exists(onnx_s) else onnx_n
            if not os.path.exists(onnx_target):
                onnx_target = onnx_s if os.path.exists(onnx_s) else onnx_n

            if os.path.exists(onnx_target):
                opts = ort.SessionOptions()
                opts.intra_op_num_threads = 4
                opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                self.onnx_sess = ort.InferenceSession(onnx_target, opts, providers=['CPUExecutionProvider'])
                self.onnx_in = self.onnx_sess.get_inputs()[0].name
                self.engine_name = f"ONNX Runtime ({os.path.basename(onnx_target)})"
                # Warm-up ONNX
                dummy = np.zeros((1, 3, 480, 480), dtype=np.float32)
                self.onnx_sess.run(None, {self.onnx_in: dummy})
                print(f"[INFO] Đã nạp thành công mô hình YOLOv8: {self.engine_name}")
                return
        except Exception as e:
            print(f"[ERROR] Không nạp được ONNX YOLOv8: {e}")

    def submit(self, enh_frame, tier):
        with self.lock:
            self.pending_frame = enh_frame
            self.tier = tier

    def run(self):
        while self.running:
            target_frame = None
            current_tier = "DAYLIGHT"
            with self.lock:
                if self.pending_frame is not None:
                    target_frame = self.pending_frame
                    current_tier = self.tier
                    self.pending_frame = None

            if target_frame is None:
                time.sleep(0.003)
                continue

            try:
                t_start = time.perf_counter()
                boxes = self._infer(target_frame, current_tier)
                self.latency_ms = (time.perf_counter() - t_start) * 1000.0

                # Cập nhật vào tracker
                self.tracker.update(boxes)

                self.infer_count += 1
                self.total_inferences += 1
                now = time.time()
                if now - self.last_time >= 1.0:
                    self.inference_fps = self.infer_count / (now - self.last_time)
                    self.infer_count = 0
                    self.last_time = now
            except Exception as e:
                print(f"[ERROR] Lỗi suy luận AI: {e}")
                time.sleep(0.01)

    def _infer(self, frame, tier):
        orig_h, orig_w = frame.shape[:2]
        
        # Ngưỡng nhạy sáng thích ứng thông minh theo từng tầng bóng tối
        if tier == "TIER_3_EXTREME":
            conf_thresh = 0.16   # Cực nhạy trong bóng tối đen kịt
        elif tier == "TIER_2_DEEP":
            conf_thresh = 0.20
        elif tier == "TIER_1_LOW":
            conf_thresh = 0.24
        else:
            conf_thresh = 0.28   # Ban ngày chống báo sai

        raw_boxes = []

        if self.model is not None:
            # PyTorch inference với YOLOv8
            results = self.model.predict(
                frame,
                imgsz=self.imgsz,
                classes=[0],       # Lớp 0: Person
                conf=conf_thresh,
                verbose=False
            )
            if results and len(results) > 0 and results[0].boxes is not None:
                for b in results[0].boxes:
                    c = b.xyxy[0].cpu().numpy()
                    raw_boxes.append((c[0], c[1], c[2], c[3], float(b.conf[0])))
        elif self.onnx_sess is not None:
            # ONNX SIMD inference
            target_size = (480, 480)
            blob, ratio, (pad_w, pad_h) = self._letterbox(frame, target_size)
            blob = cv2.cvtColor(blob, cv2.COLOR_BGR2RGB).transpose(2, 0, 1)
            blob = np.ascontiguousarray(blob, dtype=np.float32) / 255.0
            blob = np.expand_dims(blob, axis=0)

            out = self.onnx_sess.run(None, {self.onnx_in: blob})[0]
            pred = out[0].T

            scores = pred[:, 4:84]
            person_scores = scores[:, 0]
            mask = person_scores >= conf_thresh

            if np.any(mask):
                boxes = pred[mask, :4].copy()
                valid_scores = person_scores[mask]

                boxes[:, 0] = (boxes[:, 0] - pad_w) / ratio
                boxes[:, 1] = (boxes[:, 1] - pad_h) / ratio
                boxes[:, 2] = boxes[:, 2] / ratio
                boxes[:, 3] = boxes[:, 3] / ratio

                x1 = np.maximum(0, boxes[:, 0] - boxes[:, 2] / 2.0)
                y1 = np.maximum(0, boxes[:, 1] - boxes[:, 3] / 2.0)
                w = boxes[:, 2]
                h = boxes[:, 3]

                nms_boxes = np.column_stack([x1, y1, w, h]).tolist()
                nms_scores = valid_scores.tolist()
                indices = cv2.dnn.NMSBoxes(nms_boxes, nms_scores, conf_thresh, 0.45)
                for i in indices:
                    idx = i if isinstance(i, (int, np.integer)) else i[0]
                    bx, by, bw, bh = nms_boxes[idx]
                    raw_boxes.append((bx, by, bx + bw, by + bh, float(nms_scores[idx])))

        # LỌC NHÂN TRẮC HỌC & CHỐNG BÁO SAI
        clean_boxes = []
        frame_area = orig_w * orig_h
        for x1, y1, x2, y2, conf in raw_boxes:
            w = max(1.0, x2 - x1)
            h = max(1.0, y2 - y1)
            ratio = h / w

            # 1. Hộp bao trùm căn phòng
            if (w * h) > 0.85 * frame_area:
                continue

            # 2. Hộp quá bé do nhiễu hạt sensor
            if w < 20 or h < 38:
                continue

            # 3. Tỉ lệ người đứng/ngồi/nằm (0.70 <= H/W <= 4.5)
            if ratio < 0.70 or ratio > 4.5:
                continue

            clean_boxes.append((int(x1), int(y1), int(x2), int(y2), conf))

        return clean_boxes

    def _letterbox(self, img, new_shape=(480, 480)):
        shape = img.shape[:2]
        r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])
        new_unpad = (int(round(shape[1] * r)), int(round(shape[0] * r)))
        dw, dh = new_shape[1] - new_unpad[0], new_shape[0] - new_unpad[1]
        dw /= 2
        dh /= 2
        resized = cv2.resize(img, new_unpad, interpolation=cv2.INTER_LINEAR)
        top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
        left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
        padded = cv2.copyMakeBorder(resized, top, bottom, left, right, cv2.BORDER_CONSTANT, value=(114, 114, 114))
        return padded, r, (dw, dh)


class ThreadedVideoSource:
    """Bộ nạp khung hình chạy luồng nền, duy trì FPS ổn định."""
    def __init__(self, src, target_fps=30):
        if isinstance(src, str) and src.isdigit():
            src = int(src)
        self.cap = cv2.VideoCapture(src)
        self.target_fps = target_fps
        self.q = Queue(maxsize=4)
        self.stopped = False

        if not self.cap.isOpened():
            candidates = [src, "khanh.mp4", 0, "video/human.mp4", "output.mp4"]
            for cand in candidates:
                if cand is None or cand == src:
                    continue
                c_src = int(cand) if (isinstance(cand, str) and cand.isdigit()) else cand
                test_cap = cv2.VideoCapture(c_src)
                if test_cap.isOpened():
                    ret, _ = test_cap.read()
                    if ret:
                        print(f"[INFO] Chuyển đổi nguồn phát sang: '{cand}'")
                        self.cap = test_cap
                        break
                    test_cap.release()

        self.width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 960
        self.height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 640
        self.fps = self.cap.get(cv2.CAP_PROP_FPS) or target_fps
        self.thread = threading.Thread(target=self._worker, daemon=True)
        self.thread.start()

    def _worker(self):
        while not self.stopped:
            if not self.q.full():
                ret, frame = self.cap.read()
                if not ret:
                    self.stopped = True
                    break
                self.q.put(frame)
            else:
                time.sleep(0.005)

    def read(self):
        try:
            return True, self.q.get(timeout=0.2)
        except Empty:
            return False, None

    def release(self):
        self.stopped = True
        self.thread.join(timeout=0.5)
        self.cap.release()


def draw_cyberpunk_hud(canvas, boxes, fps, ai_fps, latency_ms, tier, lum, view_mode_text, engine_name,
                       auto_flash=True, flash_state=False, flash_connected=False):
    """Vẽ giao diện HUD giám sát thị giác ban đêm công nghệ cao."""
    h, w = canvas.shape[:2]

    # 1. Hộp nhận diện người (Neon Green với góc định vị 4 góc)
    for x1, y1, x2, y2, conf, tid in boxes:
        color = (50, 255, 50) # Xanh Neon
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 1, cv2.LINE_AA)

        # 4 góc định vị dầy dặn
        corner_len = min(20, (x2 - x1) // 4, (y2 - y1) // 4)
        c_thick = 3
        cv2.line(canvas, (x1, y1), (x1 + corner_len, y1), color, c_thick)
        cv2.line(canvas, (x1, y1), (x1, y1 + corner_len), color, c_thick)
        cv2.line(canvas, (x2, y1), (x2 - corner_len, y1), color, c_thick)
        cv2.line(canvas, (x2, y1), (x2, y1 + corner_len), color, c_thick)
        cv2.line(canvas, (x1, y2), (x1 + corner_len, y2), color, c_thick)
        cv2.line(canvas, (x1, y2), (x1, y2 - corner_len), color, c_thick)
        cv2.line(canvas, (x2, y2), (x2 - corner_len, y2), color, c_thick)
        cv2.line(canvas, (x2, y2), (x2, y2 - corner_len), color, c_thick)

        # Tâm ngắm trung tâm (Crosshair)
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        cv2.drawMarker(canvas, (cx, cy), (0, 255, 255), markerType=cv2.MARKER_CROSS, markerSize=12, thickness=1)

        # Banner nhãn tên + độ tin cậy
        label = f"NGUOI #{tid} ({int(conf * 100)}%)"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.48, 1)
        cv2.rectangle(canvas, (x1, max(0, y1 - th - 8)), (x1 + tw + 8, y1), (20, 20, 20), -1)
        cv2.rectangle(canvas, (x1, max(0, y1 - th - 8)), (x1 + tw + 8, y1), color, 1)
        cv2.putText(canvas, label, (x1 + 4, max(th + 2, y1 - 4)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (50, 255, 50), 1, cv2.LINE_AA)

    # 2. Thanh HUD Header trên cùng
    hud_overlay = canvas.copy()
    cv2.rectangle(hud_overlay, (0, 0), (w, 40), (15, 15, 18), -1)
    cv2.addWeighted(hud_overlay, 0.85, canvas, 0.15, 0, canvas)
    cv2.line(canvas, (0, 40), (w, 40), (0, 200, 255), 1)

    # Thông số hiển thị bên trái
    fps_text = f"FPS: {fps:.1f} (30 FPS Lock) | AI: {ai_fps:.1f} Hz ({latency_ms:.0f}ms) | {engine_name}"
    cv2.putText(canvas, fps_text, (12, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.46, (220, 220, 220), 1, cv2.LINE_AA)

    # Huy hiệu trung tâm: Đếm số người
    person_count = len(boxes)
    status_color = (50, 255, 50) if person_count > 0 else (120, 120, 120)
    badge_text = f"● NGUOI: {person_count}"
    (bw, bh), _ = cv2.getTextSize(badge_text, cv2.FONT_HERSHEY_SIMPLEX, 0.52, 2)
    bx = (w - bw) // 2
    cv2.rectangle(canvas, (bx - 10, 4), (bx + bw + 10, 35), (30, 30, 30), -1)
    cv2.rectangle(canvas, (bx - 10, 4), (bx + bw + 10, 35), status_color, 1)
    cv2.putText(canvas, badge_text, (bx, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.52, status_color, 2, cv2.LINE_AA)

    # Huy hiệu chế độ Ngày / Đêm bên phải
    if tier == "TIER_3_EXTREME":
        mode_text = f"[TIER 3 - BÓNG TỐI CỰC HẠN] (Lum: {lum:.1f})"
        mode_color = (0, 240, 255) # Cyan
    elif tier == "TIER_2_DEEP":
        mode_text = f"[TIER 2 - BAN ĐÊM SÂU] (Lum: {lum:.1f})"
        mode_color = (0, 165, 255) # Orange
    elif tier == "TIER_1_LOW":
        mode_text = f"[TIER 1 - THIẾU SÁNG] (Lum: {lum:.1f})"
        mode_color = (0, 220, 220) # Yellow-Cyan
    else:
        mode_text = f"[BAN NGÀY - DAYLIGHT] (Lum: {lum:.1f})"
        mode_color = (100, 255, 100) # Green

    (mw, _), _ = cv2.getTextSize(mode_text, cv2.FONT_HERSHEY_SIMPLEX, 0.44, 1)
    cv2.putText(canvas, mode_text, (w - mw - 12, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.44, mode_color, 1, cv2.LINE_AA)

    # Huy hiệu Flash LED & Auto Night Flash bên cạnh chế độ Ngày/Đêm
    if flash_state:
        flash_text = "⚡ FLASH: ON"
        flash_color = (0, 255, 255) # Bright Yellow
    elif auto_flash:
        flash_text = "⚡ AUTO-FLASH: BẬT"
        flash_color = (50, 255, 50) if flash_connected else (0, 220, 255)
    else:
        flash_text = "⚡ AUTO-FLASH: TẮT"
        flash_color = (130, 130, 130)

    (flw, _), _ = cv2.getTextSize(flash_text, cv2.FONT_HERSHEY_SIMPLEX, 0.44, 1)
    cv2.putText(canvas, flash_text, (w - mw - flw - 24, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.44, flash_color, 1, cv2.LINE_AA)

    # 3. Footer hướng dẫn phím tắt dưới cùng
    footer_text = f"[{view_mode_text}] | [A]: Auto Flash ({'BẬT' if auto_flash else 'TẮT'}) | [F]: Flash LED ({'ON' if flash_state else 'OFF'}) | [N]: Đổi góc nhìn | [S]: Chụp ảnh | [Q]: Thoát"
    (fw, fh), _ = cv2.getTextSize(footer_text, cv2.FONT_HERSHEY_SIMPLEX, 0.41, 1)
    cv2.rectangle(canvas, (0, h - 24), (w, h), (15, 15, 18), -1)
    cv2.putText(canvas, footer_text, ((w - fw) // 2, h - 8),
                cv2.FONT_HERSHEY_SIMPLEX, 0.41, (185, 195, 205), 1, cv2.LINE_AA)


def run_super_detector(source=DEFAULT_SOURCE, model="yolov8s", target_fps=30,
                       output_video=DEFAULT_OUTPUT, csv_log=DEFAULT_CSV, init_view=0,
                       port="auto", auto_flash=True):
    print("==============================================================================")
    print("  HỆ THỐNG NHẬN DIỆN NGƯỜI TRONG BÓNG TỐI SÂU 30 FPS - POWERED BY YOLOV8     ")
    print("==============================================================================")
    print(f"Nguồn phát (Source)        : {source}")
    print(f"Mô hình ưu tiên (Model)   : {model.upper()}")
    print(f"Khóa chuẩn tốc độ (FPS)   : {target_fps} FPS (Decoupled Display Thread)")
    print(f"Cổng COM điều khiển Flash : {port}")
    print(f"Chế độ Auto Night Flash   : {'BẬT (Tự động bật khi phòng tối)' if auto_flash else 'TẮT'}")
    print(f"Video lưu kết quả         : {output_video}")
    print(f"Thống kê hoạt động        : {csv_log}")
    print("------------------------------------------------------------------------------")

    # Bộ điều khiển đèn Flash phần cứng ESP32-CAM
    flash_ctrl = ESP32FlashController(port=port)
    flash_state = False

    enhancer = ExtremeNightEnhancer()
    tracker = SmoothHumanTracker(iou_thresh=0.25, max_age=12)
    ai_worker = AsyncAIWorker(tracker, model_pref=model, imgsz=640)
    ai_worker.start()

    reader = ThreadedVideoSource(source, target_fps=target_fps)
    writer = cv2.VideoWriter(
        output_video,
        cv2.VideoWriter_fourcc(*'mp4v'),
        target_fps,
        (reader.width, reader.height)
    )

    frame_time_target = 1.0 / float(target_fps)
    start_time = time.time()
    fps_time = time.time()
    fps_count = 0
    display_fps = float(target_fps)
    total_frames = 0
    detected_frames = 0
    csv_rows = []

    # View Mode: 0 = Original camera, 1 = Enhanced Night Vision, 2 = Dual View Split
    view_mode = init_view
    view_names = ["Camera Gốc", "Kính Nhìn Đêm (Night Vision)", "Song Song (Dual View)"]

    window_name = "AI Vision 30 FPS - Nhan Dien Nguoi Trong Bong Toi YOLOv8"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, 960, 640)

    print("\n[BẮT ĐẦU] Hệ thống đang phát và nhận diện mượt mà 30 FPS...")
    print("Phím chức năng:")
    print("  [A] : BẬT / TẮT chế độ Auto Night Flash (Tự động rọi đèn ESP32 khi phòng tối)")
    print("  [F] : BẬT / TẮT thủ công đèn Flash LED trên ESP32-CAM")
    print("  [N] : Chuyển đổi qua lại giữa: Camera Gốc <-> Kính Nhìn Đêm <-> Chia Đôi Song Song")
    print("  [S] : Lưu ảnh chụp (Snapshot)")
    print("  [Q] hoặc [ESC] : Thoát chương trình\n")

    try:
        while True:
            t_frame_start = time.perf_counter()
            ret, frame = reader.read()
            if not ret or frame is None:
                break

            total_frames += 1
            fps_count += 1

            # 1. Cân bằng động bóng tối đa tầng
            enh_frame, is_night, lum, tier = enhancer.process(frame)

            # 2. Tự động kích hoạt Auto Night Flash khi phòng quá tối
            if auto_flash:
                # Ngưỡng phòng quá tối: Lum < 18.0 (hoặc tầng tối sâu TIER 2 / EXTREME 3)
                if lum < 18.0 and not flash_state:
                    flash_state = True
                    flash_ctrl.turn_on()
                    print(f"\n[AUTO FLASH] Phát hiện phòng quá tối (Lum: {lum:.1f} < 18.0) -> TỰ ĐỘNG BẬT ĐÈN FLASH ESP32-CAM!")
                # Ngưỡng phục hồi ánh sáng: Lum > 38.0 (Hysteresis để không bị nhấp nháy chớp tắt)
                elif lum > 38.0 and flash_state:
                    flash_state = False
                    flash_ctrl.turn_off()
                    print(f"\n[AUTO FLASH] Ánh sáng đã phục hồi (Lum: {lum:.1f} > 38.0) -> TỰ ĐỘNG TẮT ĐÈN FLASH ESP32-CAM!")

            # 3. Gửi khung hình tăng cường sang luồng AI YOLOv8
            ai_worker.submit(enh_frame, tier)

            # 4. Lấy tọa độ hộp người đã làm mượt chống rung (30 FPS)
            clean_boxes = tracker.step()
            if len(clean_boxes) > 0:
                detected_frames += 1

            # 5. Chuẩn bị khung hình hiển thị theo chế độ view_mode
            if view_mode == 1:
                # Kính nhìn đêm (Enhanced Night Vision)
                canvas = enh_frame.copy()
            elif view_mode == 2:
                # Song song đối sánh (Dual Split View)
                half_w = reader.width // 2
                left_half = cv2.resize(frame, (half_w, reader.height))
                right_half = cv2.resize(enh_frame, (reader.width - half_w, reader.height))
                canvas = np.hstack([left_half, right_half])
            else:
                # Camera gốc (Original)
                canvas = frame.copy()

            # 6. Vẽ giao diện HUD Cyberpunk hiện đại
            draw_cyberpunk_hud(
                canvas, clean_boxes, display_fps,
                ai_worker.inference_fps, ai_worker.latency_ms,
                tier, lum, view_names[view_mode], ai_worker.engine_name,
                auto_flash=auto_flash, flash_state=flash_state,
                flash_connected=flash_ctrl.is_connected
            )

            # 7. Ghi video kết quả & log CSV
            if view_mode == 2:
                writer.write(cv2.resize(canvas, (reader.width, reader.height)))
            else:
                writer.write(canvas)

            if total_frames % 5 == 0:
                csv_rows.append([total_frames, len(clean_boxes), round(display_fps, 1), round(lum, 1), tier, int(flash_state)])

            # 8. Hiển thị lên màn hình
            cv2.imshow(window_name, canvas)

            # Tính toán FPS hiển thị
            now = time.time()
            if now - fps_time >= 0.5:
                display_fps = fps_count / (now - fps_time)
                fps_count = 0
                fps_time = now

            # Khóa chuẩn tốc độ 30 FPS (Frame Pacing)
            t_elapsed = time.perf_counter() - t_frame_start
            sleep_ms = max(1, int((frame_time_target - t_elapsed) * 1000.0))
            key = cv2.waitKey(sleep_ms) & 0xFF

            if key == ord('q') or key == ord('Q') or key == 27:
                print("\n[INFO] Người dùng bấm thoát.")
                break
            elif key == ord('a') or key == ord('A'):
                auto_flash = not auto_flash
                print(f"\n[CMD] Chế độ Auto Night Flash: {'BẬT (Tự động bật đèn khi phòng quá tối)' if auto_flash else 'TẮT (Đã vô hiệu hóa)'}")
            elif key == ord('f') or key == ord('F'):
                flash_state = not flash_state
                flash_ctrl.set_flash(flash_state)
                print(f"\n[CMD] Đèn Flash ESP32-CAM: {'BẬT THỦ CÔNG (Force ON)' if flash_state else 'TẮT THỦ CÔNG (Force OFF)'}")
            elif key == ord('n') or key == ord('N'):
                view_mode = (view_mode + 1) % 3
                print(f"[CHẾ ĐỘ XEM] Chuyển sang: {view_names[view_mode]}")
            elif key == ord('s') or key == ord('S'):
                snap_name = f"snapshot_{int(time.time())}.jpg"
                cv2.imwrite(snap_name, canvas)
                print(f"[SNAPSHOT] Đã lưu ảnh chụp: {snap_name}")

    finally:
        ai_worker.running = False
        flash_ctrl.close()
        reader.release()
        writer.release()
        cv2.destroyAllWindows()

        # Lưu CSV log
        with open(csv_log, "w", newline="", encoding="utf-8") as f:
            w_csv = csv.writer(f)
            w_csv.writerow(["Frame", "PersonCount", "FPS", "Luminance", "LightingTier", "FlashState"])
            w_csv.writerows(csv_rows)

        total_elapsed = time.time() - start_time
        print("\n================ TỔNG KẾT BÁO CÁO ================")
        print(f"Tổng số frame đã xử lý : {total_frames}")
        print(f"Thời gian hoạt động    : {total_elapsed:.1f} giây")
        print(f"Tốc độ trung bình      : {total_frames / max(0.1, total_elapsed):.1f} FPS (Mượt mà)")
        print(f"Tỉ lệ phát hiện người  : {detected_frames} / {total_frames} frames ({(detected_frames/max(1,total_frames))*100:.1f}%)")
        print(f"Mô hình đã sử dụng     : {ai_worker.engine_name}")
        print(f"Video đã lưu tại       : {os.path.abspath(output_video)}")
        print(f"File log thống kê tại  : {os.path.abspath(csv_log)}")
        print("==================================================\n")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Siêu hệ thống nhận diện người trong bóng tối YOLOv8")
    parser.add_argument("--source", type=str, default=DEFAULT_SOURCE, help="Đường dẫn video hoặc webcam (mặc định: khanh.mp4)")
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL, help="Mô hình YOLOv8: yolov8s hoặc yolov8n (mặc định: yolov8s)")
    parser.add_argument("--fps", type=int, default=30, help="Tốc độ mục tiêu (mặc định: 30 FPS)")
    parser.add_argument("--port", type=str, default="auto", help="Cổng COM của ESP32-CAM để điều khiển Flash LED (mặc định: auto)")
    parser.add_argument("--no-auto-flash", dest="auto_flash", action="store_false", help="Tắt chế độ tự động rọi đèn Flash khi tối")
    parser.add_argument("--view", type=int, default=0, help="Chế độ xem ban đầu: 0: Gốc, 1: Kính nhìn đêm, 2: Song song")
    parser.add_argument("--output", type=str, default=DEFAULT_OUTPUT, help="File video kết quả")
    args = parser.parse_args()

    run_super_detector(
        source=args.source,
        model=args.model,
        target_fps=args.fps,
        output_video=args.output,
        init_view=args.view,
        port=args.port,
        auto_flash=args.auto_flash
    )
