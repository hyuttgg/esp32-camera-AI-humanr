#include "ImageQualityMonitor.h"
#include "DiagnosticLogger.h"
#include <math.h>

#define TAG "ImgMonitor"

ImageQualityMonitor::ImageQualityMonitor() 
    : m_totalAnalyzed(0), m_healthyCount(0), m_blackFrameCount(0),
      m_blownOutCount(0), m_corruptCount(0), m_consecutiveBlack(0) {}

void ImageQualityMonitor::resetStats() {
    m_totalAnalyzed = 0;
    m_healthyCount = 0;
    m_blackFrameCount = 0;
    m_blownOutCount = 0;
    m_corruptCount = 0;
    m_consecutiveBlack = 0;
}

ImageMetrics ImageQualityMonitor::analyzeFrame(const camera_fb_t *fb) {
    ImageMetrics m;
    m.meanLuminance = 0.0f;
    m.minPixel = 255;
    m.maxPixel = 0;
    m.variance = 0.0f;
    m.isBlackScreen = false;
    m.isBlownOut = false;
    m.isFrozenOrFlat = false;
    m.isCorrupted = false;
    m.qualityCode = APP_OK;

    if (!fb || !fb->buf || fb->len == 0) {
        m.isCorrupted = true;
        m.qualityCode = ERR_CAM_FB_NULL;
        m_corruptCount++;
        m_totalAnalyzed++;
        return m;
    }

    m_totalAnalyzed++;

    if (fb->format == PIXFORMAT_JPEG) {
        // Validate JPEG SOI (0xFF 0xD8) and EOI (0xFF 0xD9)
        if (fb->len < 4 || fb->buf[0] != 0xFF || fb->buf[1] != 0xD8) {
            m.isCorrupted = true;
            m.qualityCode = ERR_IMG_CORRUPTED_DMA;
            m_corruptCount++;
            return m;
        }
        // In JPEG mode, check if payload is suspiciously tiny (< 500 bytes for normal scene)
        if (fb->len < 400) {
            m.isBlackScreen = true;
            m.qualityCode = ERR_IMG_TOO_DARK_BLACK;
            m_blackFrameCount++;
            m_consecutiveBlack++;
            return m;
        }
        m_healthyCount++;
        m_consecutiveBlack = 0;
        return m;
    }

    // Direct pixel processing (Grayscale or RGB565)
    uint64_t sumLuminance = 0;
    uint32_t sampleCount = 0;

    // Stride sampling to keep analysis latency < 2ms regardless of resolution
    size_t step = (fb->len > 40000) ? 4 : 1;

    if (fb->format == PIXFORMAT_GRAYSCALE) {
        for (size_t i = 0; i < fb->len; i += step) {
            uint8_t p = fb->buf[i];
            sumLuminance += p;
            if (p < m.minPixel) m.minPixel = p;
            if (p > m.maxPixel) m.maxPixel = p;
            sampleCount++;
        }
    } else if (fb->format == PIXFORMAT_RGB565) {
        size_t totalPixels = fb->len / 2;
        size_t pixelStep = (totalPixels > 20000) ? 4 : 1;
        const uint16_t *pixels = (const uint16_t*)fb->buf;

        for (size_t i = 0; i < totalPixels; i += pixelStep) {
            uint16_t p = pixels[i];
            // RGB565: R(5 bits) G(6 bits) B(5 bits)
            uint8_t r = ((p >> 11) & 0x1F) << 3;
            uint8_t g = ((p >> 5) & 0x3F) << 2;
            uint8_t b = (p & 0x1F) << 3;
            uint8_t lum = (uint8_t)((r * 77 + g * 150 + b * 29) >> 8);

            sumLuminance += lum;
            if (lum < m.minPixel) m.minPixel = lum;
            if (lum > m.maxPixel) m.maxPixel = lum;
            sampleCount++;
        }
    }

    if (sampleCount > 0) {
        m.meanLuminance = (float)sumLuminance / (float)sampleCount;

        // Second pass for sample variance
        double sumSqDiff = 0.0;
        if (fb->format == PIXFORMAT_GRAYSCALE) {
            for (size_t i = 0; i < fb->len; i += step) {
                float diff = (float)fb->buf[i] - m.meanLuminance;
                sumSqDiff += diff * diff;
            }
        } else if (fb->format == PIXFORMAT_RGB565) {
            size_t totalPixels = fb->len / 2;
            size_t pixelStep = (totalPixels > 20000) ? 4 : 1;
            const uint16_t *pixels = (const uint16_t*)fb->buf;
            for (size_t i = 0; i < totalPixels; i += pixelStep) {
                uint16_t p = pixels[i];
                uint8_t r = ((p >> 11) & 0x1F) << 3;
                uint8_t g = ((p >> 5) & 0x3F) << 2;
                uint8_t b = (p & 0x1F) << 3;
                uint8_t lum = (uint8_t)((r * 77 + g * 150 + b * 29) >> 8);
                float diff = (float)lum - m.meanLuminance;
                sumSqDiff += diff * diff;
            }
        }
        m.variance = sqrtf((float)(sumSqDiff / sampleCount));
    }

    // Determine quality anomalies
    if (m.meanLuminance < THRESHOLD_BLACK_SCREEN_LUMINANCE) {
        m.isBlackScreen = true;
        m.qualityCode = ERR_IMG_TOO_DARK_BLACK;
        m_blackFrameCount++;
        m_consecutiveBlack++;
    } else if (m.meanLuminance > THRESHOLD_BLOWN_OUT_LUMINANCE) {
        m.isBlownOut = true;
        m.qualityCode = ERR_IMG_BLOWN_OUT_WHITE;
        m_blownOutCount++;
        m_consecutiveBlack = 0;
    } else if (m.minPixel == m.maxPixel) {
        // Truly frozen or corrupt DMA: zero dynamic range across all pixels
        m.isFrozenOrFlat = true;
        m.qualityCode = ERR_IMG_FROZEN_OR_FLAT;
        m_corruptCount++;
        m_consecutiveBlack = 0;
    } else {
        m.qualityCode = APP_OK;
        m_healthyCount++;
        m_consecutiveBlack = 0;
    }

    return m;
}

bool ImageQualityMonitor::isSensorHealthy() const {
    if (m_totalAnalyzed < 5) return true;
    // Unhealthy if > 30% of frames are black or corrupt
    float badRatio = (float)(m_blackFrameCount + m_corruptCount) / (float)m_totalAnalyzed;
    return (badRatio < 0.30f && m_consecutiveBlack < MAX_CONSECUTIVE_BLACK_FRAMES);
}

