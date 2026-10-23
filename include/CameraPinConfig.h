#pragma once
#include <Arduino.h>
#include "esp_camera.h"
#include "Config.h"

/**
 * @file CameraPinConfig.h
 * @brief Pinout mapping and camera configuration builder for AI-Thinker ESP32-CAM.
 */

// AI-Thinker ESP32-CAM Pin Definitions
#define CAM_PIN_PWDN     32
#define CAM_PIN_RESET    -1  // Software reset via SCCB
#define CAM_PIN_XCLK      0
#define CAM_PIN_SIOD     26  // I2C / SCCB SDA
#define CAM_PIN_SIOC     27  // I2C / SCCB SCL

#define CAM_PIN_D7       35  // Y9
#define CAM_PIN_D6       34  // Y8
#define CAM_PIN_D5       39  // Y7
#define CAM_PIN_D4       36  // Y6
#define CAM_PIN_D3       21  // Y5
#define CAM_PIN_D2       19  // Y4
#define CAM_PIN_D1       18  // Y3
#define CAM_PIN_D0        5  // Y2

#define CAM_PIN_VSYNC    25
#define CAM_PIN_HREF     23
#define CAM_PIN_PCLK     22

// Board LEDs
#define PIN_FLASH_LED     4  // High-power Flash LED (Active HIGH, also HS2_DATA1)
#define PIN_STATUS_LED   33  // Red indicator LED (Active LOW)

/**
 * @brief Constructs a validated camera_config_t structure for the AI-Thinker board.
 * @param cfg The active FirmwareConfig containing frame size, format, xclk, fb_count.
 * @param psramAvailable Whether external PSRAM was verified during hardware diagnostics.
 * @return camera_config_t ready for esp_camera_init()
 */
inline camera_config_t buildAiThinkerCameraConfig(const FirmwareConfig &cfg, bool psramAvailable) {
    camera_config_t cam_cfg;
    memset(&cam_cfg, 0, sizeof(camera_config_t));
    cam_cfg.pin_pwdn     = CAM_PIN_PWDN;
    cam_cfg.pin_reset    = CAM_PIN_RESET;
    cam_cfg.pin_xclk     = CAM_PIN_XCLK;
    cam_cfg.pin_sccb_sda = CAM_PIN_SIOD;
    cam_cfg.pin_sccb_scl = CAM_PIN_SIOC;

    cam_cfg.pin_d7 = CAM_PIN_D7;
    cam_cfg.pin_d6 = CAM_PIN_D6;
    cam_cfg.pin_d5 = CAM_PIN_D5;
    cam_cfg.pin_d4 = CAM_PIN_D4;
    cam_cfg.pin_d3 = CAM_PIN_D3;
    cam_cfg.pin_d2 = CAM_PIN_D2;
    cam_cfg.pin_d1 = CAM_PIN_D1;
    cam_cfg.pin_d0 = CAM_PIN_D0;

    cam_cfg.pin_vsync = CAM_PIN_VSYNC;
    cam_cfg.pin_href  = CAM_PIN_HREF;
    cam_cfg.pin_pclk  = CAM_PIN_PCLK;

    // Clock frequency: 20MHz standard, 10MHz or 16MHz if fallback
    cam_cfg.xclk_freq_hz = cfg.xclk_freq_hz;
    cam_cfg.ledc_timer   = LEDC_TIMER_0;
    cam_cfg.ledc_channel = LEDC_CHANNEL_0;

    cam_cfg.pixel_format = cfg.pixel_format;
    cam_cfg.frame_size   = cfg.frame_size;
    cam_cfg.jpeg_quality = 24;

    // CAMERA_GRAB_WHEN_EMPTY ensures DMA engine NEVER overwrites a frame buffer while it is being transmitted over UART!
    if (psramAvailable) {
        cam_cfg.fb_count = 2; // Double buffering: Buffer 0 streams over Serial while Buffer 1 captures next frame
        cam_cfg.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
    } else {
        // Without PSRAM, internal SRAM can only hold 1 small frame buffer
        cam_cfg.fb_count = 1;
        cam_cfg.fb_location = CAMERA_FB_IN_DRAM;
        cam_cfg.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
    }

    return cam_cfg;
}

