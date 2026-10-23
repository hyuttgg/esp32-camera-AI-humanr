#pragma once
#include <Arduino.h>
#include "esp_camera.h"
#include "Config.h"
#include "ErrorCodes.h"
#include "CameraPinConfig.h"
#include "FrameBufferManager.h"

/**
 * @file CameraManager.h
 * @brief High-reliability OV2640 camera manager with dual-stage initialization and warmup.
 */

struct CameraInfo {
    bool initialized;
    camera_model_t model;
    int pid;
    int ver;
    framesize_t frameSize;
    pixformat_t pixelFormat;
    uint32_t xclkHz;
    bool usingPsram;
    char sensorName[32];
};

class CameraManager {
public:
    CameraManager();
    ~CameraManager();

    ErrorCode init(const FirmwareConfig &cfg, bool psramAvailable);
    ErrorCode deinit();
    ErrorCode reinitSafeFallback();
    void hardPowerCycleSensor();

    camera_fb_t* captureFrame(uint32_t timeoutMs = CAMERA_CAPTURE_TIMEOUT_MS);
    bool warmupSensor(uint8_t frameCount = 8);

    void setFlashLed(uint8_t brightness);
    void setStatusLed(bool on);

    sensor_t* getSensor();
    CameraInfo getInfo() const { return m_info; }
    bool isInitialized() const { return m_info.initialized; }

    ErrorCode applySensorTuning(int8_t brightness, int8_t contrast, bool aec, bool awb);

private:
    CameraInfo m_info;
    FirmwareConfig m_activeConfig;
    bool m_psramAvailable;
    bool m_flashLedPwmInitialized;

    void setupLeds();
};

