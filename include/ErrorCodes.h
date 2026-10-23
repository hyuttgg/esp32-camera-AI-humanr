#pragma once
#include <Arduino.h>

/**
 * @file ErrorCodes.h
 * @brief Comprehensive error and status codes for ESP32-CAM AI Vision Firmware.
 */

enum ErrorCode : int16_t {
    APP_OK                          = 0,

    // Hardware & Memory Diagnostics (100 - 199)
    ERR_HW_CHIP_INCOMPATIBLE        = -101,
    ERR_HW_FLASH_TOO_SMALL          = -102,
    ERR_HW_CPU_FREQ_LOW             = -103,
    ERR_PSRAM_NOT_FOUND             = -110,
    ERR_PSRAM_INIT_FAILED           = -111,
    ERR_PSRAM_INTEGRITY_FAIL        = -112,
    ERR_PSRAM_MALLOC_FAILED         = -113,
    ERR_HEAP_LOW                    = -120,
    ERR_BROWNOUT_DETECTED           = -130,
    ERR_WATCHDOG_RESET_PREVIOUS     = -131,

    // Camera Sensor & Subsystem (200 - 299)
    ERR_CAM_PIN_INVALID             = -201,
    ERR_CAM_INIT_FAILED             = -202,
    ERR_CAM_PROBE_FAILED            = -203,
    ERR_CAM_SCCB_I2C_FAIL           = -204,
    ERR_CAM_FB_NULL                 = -205,
    ERR_CAM_FB_EMPTY                = -206,
    ERR_CAM_DMA_TIMEOUT             = -207,
    ERR_CAM_WARMUP_FAILED           = -208,
    ERR_CAM_UNSUPPORTED_FORMAT      = -209,
    ERR_CAM_ALLOCATION_FAIL         = -210,

    // Image Quality & Sensor Output (300 - 399)
    ERR_IMG_TOO_DARK_BLACK          = -301,
    ERR_IMG_BLOWN_OUT_WHITE         = -302,
    ERR_IMG_FROZEN_OR_FLAT          = -303,
    ERR_IMG_CORRUPTED_DMA           = -304,
    ERR_IMG_SIZE_MISMATCH           = -305,

    // AI & TinyML Inference (400 - 499)
    ERR_AI_MODEL_INIT_FAILED        = -401,
    ERR_AI_ARENA_ALLOC_FAILED       = -402,
    ERR_AI_INPUT_SHAPE_MISMATCH     = -403,
    ERR_AI_INFERENCE_TIMEOUT        = -404,
    ERR_AI_OUTPUT_PARSING_FAILED    = -405,

    // Storage & NVS (500 - 599)
    ERR_NVS_OPEN_FAILED             = -501,
    ERR_NVS_READ_FAILED             = -502,
    ERR_NVS_WRITE_FAILED            = -503,
    ERR_NVS_VERSION_MISMATCH        = -504,
    ERR_NVS_CORRUPTED_MAGIC         = -505,

    // Runtime & Task Management (600 - 699)
    ERR_TASK_CREATE_FAILED          = -601,
    ERR_TASK_WATCHDOG_TRIGGERED     = -602,
    ERR_QUEUE_FULL                  = -603,
    ERR_RECOVERY_MAX_EXCEEDED       = -604
};

/**
 * @brief Returns human-readable error description.
 */
inline const char* errorToString(ErrorCode err) {
    switch (err) {
        case APP_OK: return "OK / Success";
        case ERR_HW_CHIP_INCOMPATIBLE: return "Chip model incompatible or unsupported";
        case ERR_HW_FLASH_TOO_SMALL: return "Flash memory smaller than required 4MB";
        case ERR_HW_CPU_FREQ_LOW: return "CPU frequency below optimal 240MHz";
        case ERR_PSRAM_NOT_FOUND: return "External PSRAM not found by ESP-IDF";
        case ERR_PSRAM_INIT_FAILED: return "PSRAM initialization routine failed";
        case ERR_PSRAM_INTEGRITY_FAIL: return "PSRAM write/read bit integrity check failed";
        case ERR_PSRAM_MALLOC_FAILED: return "Allocation in PSRAM returned NULL";
        case ERR_HEAP_LOW: return "Internal DRAM heap dangerously low (<30KB)";
        case ERR_BROWNOUT_DETECTED: return "Brownout reset occurred (voltage dipped < 2.8V)";
        case ERR_WATCHDOG_RESET_PREVIOUS: return "Previous reset caused by Task Watchdog Timeout";
        case ERR_CAM_PIN_INVALID: return "Camera GPIO pin configuration error";
        case ERR_CAM_INIT_FAILED: return "esp_camera_init() failed";
        case ERR_CAM_PROBE_FAILED: return "Camera sensor probe failed (OV2640 not responding on SCCB/I2C)";
        case ERR_CAM_SCCB_I2C_FAIL: return "Camera SCCB bus transmission error";
        case ERR_CAM_FB_NULL: return "esp_camera_fb_get() returned NULL";
        case ERR_CAM_FB_EMPTY: return "Frame buffer has zero byte length";
        case ERR_CAM_DMA_TIMEOUT: return "DMA transfer timed out waiting for VSYNC/HREF";
        case ERR_CAM_WARMUP_FAILED: return "Camera warmup frames timed out";
        case ERR_CAM_UNSUPPORTED_FORMAT: return "Requested pixel format unsupported";
        case ERR_CAM_ALLOCATION_FAIL: return "Failed to allocate DMA or frame buffers for camera";
        case ERR_IMG_TOO_DARK_BLACK: return "Frame luminance too low (Black Screen)";
        case ERR_IMG_BLOWN_OUT_WHITE: return "Frame luminance saturated (Blown Out White)";
        case ERR_IMG_FROZEN_OR_FLAT: return "Frame has zero variance (Corrupted or Frozen sensor)";
        case ERR_IMG_CORRUPTED_DMA: return "Frame buffer byte length does not match resolution";
        case ERR_IMG_SIZE_MISMATCH: return "Image dimensions do not match model input requirements";
        case ERR_AI_MODEL_INIT_FAILED: return "TinyML model initialization failed";
        case ERR_AI_ARENA_ALLOC_FAILED: return "Could not allocate tensor arena memory";
        case ERR_AI_INPUT_SHAPE_MISMATCH: return "Input tensor shape does not match camera frame";
        case ERR_AI_INFERENCE_TIMEOUT: return "AI inference exceeded maximum execution time window";
        case ERR_AI_OUTPUT_PARSING_FAILED: return "Output tensor parsing / decoding failed";
        case ERR_NVS_OPEN_FAILED: return "NVS namespace open failed";
        case ERR_NVS_READ_FAILED: return "NVS configuration key read error";
        case ERR_NVS_WRITE_FAILED: return "NVS configuration key write error";
        case ERR_NVS_VERSION_MISMATCH: return "NVS config schema version mismatch";
        case ERR_NVS_CORRUPTED_MAGIC: return "NVS magic header corrupted; restoring safe defaults";
        case ERR_TASK_CREATE_FAILED: return "FreeRTOS xTaskCreate failed";
        case ERR_TASK_WATCHDOG_TRIGGERED: return "Task watchdog triggered during processing";
        case ERR_QUEUE_FULL: return "FreeRTOS communication queue is full";
        case ERR_RECOVERY_MAX_EXCEEDED: return "Exceeded maximum consecutive recovery attempts (2)";
        default: return "Unknown Error";
    }
}

