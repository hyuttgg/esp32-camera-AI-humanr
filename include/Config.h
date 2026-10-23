#pragma once
#include <Arduino.h>
#include "esp_camera.h"

/**
 * @file Config.h
 * @brief Global system configuration, thresholds, and operational modes.
 */

// Firmware Version Information
#define FIRMWARE_NAME          "ESP32-CAM AI Vision"
#define FIRMWARE_VERSION       "1.3.1"
#define FIRMWARE_BUILD_DATE    __DATE__ " " __TIME__
#define CONFIG_SCHEMA_VERSION  15 // Schema version 15: Low-Latency High-Throughput Stream

// Operating Modes
enum SystemOpMode : uint8_t {
    MODE_CAMERA_DIAGNOSTIC_ONLY = 0, // Diagnostic: 100-frame stability, image quality audit, no AI
    MODE_AI_HUMAN_DETECT        = 1, // Operational: Human presence & bounding box
    MODE_AI_OBJECT_DETECT       = 2, // Operational: Cell phone & handheld object detection
    MODE_AI_DUAL                = 3  // Operational: Cooperative Human + Phone tracking
};

// System State Machine
enum SystemState : uint8_t {
    STATE_BOOT              = 0,
    STATE_HARDWARE_CHECK    = 1,
    STATE_CAMERA_INIT       = 2,
    STATE_CAMERA_TEST       = 3,
    STATE_AI_INIT           = 4,
    STATE_RUNNING           = 5,
    STATE_ERROR             = 6,
    STATE_DIAGNOSTICS       = 7,
    STATE_LIMITED_MODE      = 8,
    STATE_RECOVERY          = 9
};

// Persistent Configuration (stored in NVS)
struct FirmwareConfig {
    uint32_t magic;                   // 0x43414D31 ('CAM1')
    uint16_t version;                 // Schema version (e.g. 1)
    SystemOpMode op_mode;             // Operating mode
    framesize_t frame_size;           // FRAMESIZE_HVGA (480x320) or FRAMESIZE_VGA / QVGA
    pixformat_t pixel_format;         // PIXFORMAT_JPEG (Full Hardware Color/Sharpness)
    uint32_t xclk_freq_hz;            // 20000000 (20MHz) or fallback 10000000 (10MHz)
    uint8_t fb_count;                 // 1 (DRAM) or 2 (PSRAM double buffering)
    float confidence_threshold;       // Default 0.50f
    uint32_t inference_interval_ms;   // 0 ms for full 30 FPS DMA
    uint8_t flash_led_level;          // 0 to 255 (PWM brightness)
    bool auto_exposure_enabled;       // Enable camera AEC
    bool auto_white_balance_enabled;  // Enable camera AWB
    int8_t brightness;                // -2 to +2
    int8_t contrast;                  // -2 to +2
    uint16_t diagnostic_frame_count;  // Default 100 frames
};

// Image Quality Analysis Thresholds
#define THRESHOLD_BLACK_SCREEN_LUMINANCE  12.0f  // Mean luminance < 12.0 -> Black Screen
#define THRESHOLD_BLOWN_OUT_LUMINANCE     242.0f // Mean luminance > 242.0 -> Saturated
#define THRESHOLD_MIN_VARIANCE            2.5f   // Pixel variance < 2.5 -> Flat/Frozen DMA
#define MAX_CONSECUTIVE_BLACK_FRAMES      5      // Alert after 5 consecutive black frames

// System Memory Safety Thresholds
#define MIN_SAFE_INTERNAL_HEAP_BYTES      25000  // Trigger warning if DRAM < 25KB
#define MIN_SAFE_PSRAM_BYTES              65536  // Trigger warning if PSRAM < 64KB

// Watchdog & Task Timeouts
#define WATCHDOG_TIMEOUT_SECONDS          10     // TWDT timeout for camera/AI tasks
#define CAMERA_CAPTURE_TIMEOUT_MS         2500   // DMA frame timeout
#define MAX_RECOVERY_ATTEMPTS             2      // Max consecutive recovery loops

// AI Input Dimension Defaults
#define AI_INPUT_WIDTH                    96
#define AI_INPUT_HEIGHT                   96
#define AI_INPUT_CHANNELS                 1      // 1: Grayscale (optimal for 240MHz LX6), 3: RGB

// Default configuration factory initializer
inline FirmwareConfig getDefaultConfig() {
    FirmwareConfig cfg;
    cfg.magic = 0x43414D31;
    cfg.version = 16; // Force NVS migration to version 16
    cfg.op_mode = MODE_AI_HUMAN_DETECT; // Operational Mode: 100% Dedicated Human Detection
    cfg.frame_size = FRAMESIZE_QVGA;     // 320x240: True 30.0 FPS DMA hardware streaming over 2M baud!
    cfg.pixel_format = PIXFORMAT_JPEG;   // Real Hardware JPEG ISP from OmniVision sensor
    cfg.xclk_freq_hz = 16000000;         // 16MHz: Reduced sensor thermal footprint and rock-solid PCLK PLL lock
    cfg.fb_count = 2; // Double buffering in PSRAM
    cfg.confidence_threshold = 0.50f;
    cfg.inference_interval_ms = 0; // 0ms delay: full 30 FPS hardware DMA pipeline
    cfg.flash_led_level = 0;
    cfg.auto_exposure_enabled = true;
    cfg.auto_white_balance_enabled = true;
    cfg.brightness = 1; // Subtle exposure boost for indoor room lighting
    cfg.contrast = 1;   // Crisp contrast
    cfg.diagnostic_frame_count = 100;
    return cfg;
}
