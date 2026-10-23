#pragma once
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Preferences.h>

/**
 * @file NetworkClient.h
 * @brief High-performance Wi-Fi STA, HTTP Ingestion & Telemetry Client for ESP32-CAM.
 * Supports persistent NVS Wi-Fi provisioning, power-loss auto-recovery, and Web Serial flasher.
 */

struct NetworkConfig {
    const char* wifi_ssid;
    const char* wifi_password;
    const char* backend_url;    // e.g. "http://192.168.1.5:3000"
    const char* device_id;      // e.g. "ESP32-CAM-01"
    const char* hmac_secret;    // HMAC secret key for request signing
    uint32_t heartbeat_interval_ms; // default 30,000ms
};

struct HardwareTelemetry {
    uint32_t cpu_freq_mhz;
    uint8_t cpu_cores;
    float cpu_usage_percent;
    uint32_t dram_free_bytes;
    uint32_t dram_total_bytes;
    uint32_t dram_min_free_bytes;
    bool psram_found;
    uint32_t psram_free_bytes;
    uint32_t psram_total_bytes;
    uint32_t flash_chip_size_bytes;
    uint32_t flash_chip_speed_hz;
    uint32_t flash_sketch_used_bytes;
    uint32_t flash_sketch_free_bytes;
    int8_t wifi_rssi;
    uint64_t uptime_sec;
};

class NetworkClient {
public:
    NetworkClient();
    ~NetworkClient();

    void init(const NetworkConfig& config);
    void update(); // Call in loop()

    bool isConnected();
    String getIpAddress();
    int8_t getRssi();

    // Ingestion & 100% Accurate Hardware Telemetry
    HardwareTelemetry collectHardwareTelemetry();
    bool sendHardwareTelemetry();
    bool sendHeartbeat(uint32_t freeHeap, uint32_t freePsram, bool flashEnabled);
    bool uploadFrame(const uint8_t* jpegBuf, size_t jpegLen, uint16_t width, uint16_t height,
                     bool personDetected, float confidence, bool isDark);
    
    // NVS Wi-Fi Provisioning & Power-loss Auto Recovery
    void saveCredentialsToNVS(const String& ssid, const String& password, const String& backendUrl);
    bool loadCredentialsFromNVS();
    void checkSerialProvisioning();
    void handleSerialLine(const String& rawLine);
    void handlePowerRecovery();

    // Commands
    void pollCommands();

    // Hardware flash control
    void setFlashLed(bool enable);
    bool isFlashEnabled() const { return m_flashEnabled; }

private:
    NetworkConfig m_config;
    bool m_connected;
    bool m_wasConnected;
    bool m_flashEnabled;
    uint32_t m_lastHeartbeatMs;
    uint32_t m_lastTelemetryMs;
    uint32_t m_lastCommandPollMs;
    uint32_t m_lastReconnectAttemptMs;
    Preferences m_prefs;
    String m_nvsSsid;
    String m_nvsPassword;
    String m_nvsBackendUrl;

    String generateNonce();
    String computeHmacSha256(const String& payload);
};

