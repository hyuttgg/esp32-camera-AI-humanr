#pragma once
#include <Arduino.h>
#include "esp_camera.h"
#include "Config.h"
#include "ErrorCodes.h"

/**
 * @file ImageQualityMonitor.h
 * @brief Real-time visual metrics, black screen detection, and corrupted frame analysis.
 */

struct ImageMetrics {
    float meanLuminance;              // 0.0 to 255.0
    uint8_t minPixel;
    uint8_t maxPixel;
    float variance;                   // Contrast / spread
    bool isBlackScreen;               // True if mean < THRESHOLD_BLACK_SCREEN_LUMINANCE
    bool isBlownOut;                  // True if mean > THRESHOLD_BLOWN_OUT_LUMINANCE
    bool isFrozenOrFlat;              // True if variance < THRESHOLD_MIN_VARIANCE
    bool isCorrupted;                 // True if size mismatch or corrupt markers
    ErrorCode qualityCode;
};

class ImageQualityMonitor {
public:
    ImageQualityMonitor();

    ImageMetrics analyzeFrame(const camera_fb_t *fb);
    void resetStats();

    uint32_t getTotalAnalyzed() const { return m_totalAnalyzed; }
    uint32_t getHealthyCount() const { return m_healthyCount; }
    uint32_t getBlackFrameCount() const { return m_blackFrameCount; }
    uint32_t getBlownOutCount() const { return m_blownOutCount; }
    uint32_t getCorruptCount() const { return m_corruptCount; }
    uint32_t getConsecutiveBlackFrames() const { return m_consecutiveBlack; }

    bool isSensorHealthy() const;

private:
    uint32_t m_totalAnalyzed;
    uint32_t m_healthyCount;
    uint32_t m_blackFrameCount;
    uint32_t m_blownOutCount;
    uint32_t m_corruptCount;
    uint32_t m_consecutiveBlack;
};

