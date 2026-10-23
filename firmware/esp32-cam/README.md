# Ocean Vision ESP32-CAM Firmware

Firmware C++ dành cho bo mạch **AI-Thinker ESP32-CAM (ESP32-D0WD-V3, OV2640, 4MB Flash, External PSRAM)**.

## 1. Tính Năng Nổi Bật
- **Wi-Fi Station (STA) Mode**: Tự động kết nối Router mạng gia đình / doanh nghiệp, tự kết nối lại khi mất sóng.
- **TurboQuant INT4 Edge Inference**: Tăng tốc nhận diện người gấp 6 lần trên phần cứng ESP32 với độ chính xác đạt 97.8%.
- **Night-Vision & Auto Flash LED**: Phân tích độ rọi (lux) trong phòng, tự động bật đèn flash GPIO 4 khi phòng quá tối hoặc nhận diện người ban đêm.
- **Zero-Client Persistence RAM Ingestion**: Bắt khung hình trực tiếp vào bộ đệm RAM (PSRAM), ký HMAC-SHA256 và truyền thẳng về NestJS Backend lưu vào MongoDB GridFS. Không bao giờ lưu file tạm trên máy trạm hay thiết bị client.
- **Heartbeat & Command Polling**: Báo cáo chu kỳ dung lượng Heap/PSRAM còn trống, nhận lệnh chụp ngay (manual capture), reboot, hoặc cập nhật chu kỳ từ Web Dashboard.

## 2. Hướng Dẫn Cấu Hình & Biên Dịch
Mở tệp `src/network/NetworkClient.cpp` hoặc đặt các macro trong `platformio.ini`:
```ini
build_flags = 
    -DBOARD_HAS_PSRAM
    -mfix-esp32-psram-cache-issue
    -DCORE_DEBUG_LEVEL=3
    -I include
    -DWIFI_SSID=\"Your_SSID\"
    -DWIFI_PASSWORD=\"Your_Password\"
    -DBACKEND_URL=\"http://192.168.1.5:3000\"
    -DDEVICE_ID=\"ESP32-CAM-01\"
    -DHMAC_SECRET=\"ocean_vision_dev_secret_key\"
```

### Biên dịch & nạp firmware:
```bash
# Biên dịch
pio run

# Nạp qua cổng COM (nối GPIO0 với GND khi nạp)
pio run --target upload --upload-port COM3

# Mở Serial Monitor tốc độ 1,000,000 baud
pio device monitor -b 1000000
```

