# Hướng Dẫn Kết Nối ESP32-CAM Với Mạng Wi-Fi Máy Chủ Khi Deploy

Tài liệu này hướng dẫn cách kết nối bo mạch **ESP32-CAM** với backend NestJS thông qua mạng Wi-Fi của máy chủ một cách ổn định, mượt mà và bảo mật nhất.

---

## Cách 1: Sử Dụng Tính Năng Mobile Hotspot Của Máy Chủ (Khuyên Dùng Khi Triển Khai Độc Lập)

Nếu máy chủ là laptop hoặc máy tính bàn Windows có card Wi-Fi, bạn có thể biến máy chủ thành một trạm phát Wi-Fi riêng cho các camera ESP32:

1. **Bật Mobile Hotspot trên Windows**:
   - Mở **Settings** > **Network & Internet** > **Mobile hotspot**.
   - Bật chuyển trạng thái sang **On**.
   - Bấm **Edit**, đặt thông số:
     - **Network name (SSID)**: `OceanVision_Host`
     - **Network password**: `ocean_secure_pass`
     - **Network band**: `2.4 GHz` (bắt buộc chọn 2.4 GHz vì ESP32-CAM không hỗ trợ băng tần 5 GHz).

2. **Xác định địa chỉ IP của Máy Chủ Hotspot**:
   - Mở PowerShell / Command Prompt, gõ `ipconfig`.
   - Tìm mục **Wireless LAN adapter Local Area Connection\* X**:
     - `IPv4 Address`: thường là `192.168.137.1`.

3. **Cấu hình trên Firmware ESP32-CAM (`platformio.ini` hoặc `Config.h`)**:
   ```cpp
   NetworkConfig config;
   config.wifi_ssid = "OceanVision_Host";
   config.wifi_password = "ocean_secure_pass";
   config.backend_url = "http://192.168.137.1:3000";
   config.device_id = "ESP32-CAM-01";
   config.hmac_secret = "dev_secret_key_change_in_production";
   ```

---

## Cách 2: Kết Nối Cùng Router Wi-Fi Gia Đình / Doanh Nghiệp (Local LAN)

Nếu cả máy chủ và ESP32-CAM cùng bắt chung vào một Router Wi-Fi:

1. Mở PowerShell trên máy tính chạy Backend, gõ `ipconfig` để lấy địa chỉ IPv4 (ví dụ: `192.168.1.25`).
2. Cấu hình firmware:
   ```cpp
   config.wifi_ssid = "Ten_WiFi_Nha_Ban";
   config.wifi_password = "Mat_Khau_WiFi";
   config.backend_url = "http://192.168.1.25:3000";
   ```
3. Mở cổng Firewall trên Windows (nếu bị chặn):
   ```powershell
   New-NetFirewallRule -DisplayName "OceanVision_API_3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```

---

## Luồng Tự Động Ghép Nối Khi Khởi Chạy
1. ESP32-CAM khởi động trong 1.5 giây, nạp nhân **TurboQuant INT4**, khởi tạo cảm biến ảnh **OV2640**.
2. ESP32-CAM kết nối vào Wi-Fi của máy chủ và gửi ngay gói tin:
   `POST http://<SERVER_IP>:3000/api/ingestion/heartbeat`
3. Trạng thái trên Web Dashboard tự động đổi từ `DEMO DATA` sang `ONLINE` tức thì!
4. Cứ mỗi 3 giây, ESP32 gửi thông số phần cứng chính xác 100%:
   `POST http://<SERVER_IP>:3000/api/ingestion/telemetry`
   (Bao gồm: Tần số CPU, DRAM, 4MB PSRAM flam, dung lượng Flash, Uptime, RSSI).

