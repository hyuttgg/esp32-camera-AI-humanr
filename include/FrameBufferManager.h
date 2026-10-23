#pragma once
#include <Arduino.h>
#include "esp_camera.h"

/**
 * @file FrameBufferManager.h
 * @brief RAII wrapper for camera_fb_t and frame capture telemetry.
 */

class FrameBufferGuard {
public:
    explicit FrameBufferGuard(camera_fb_t* fb = nullptr) : m_fb(fb) {}
    ~FrameBufferGuard() {
        release();
    }

    // Disable copy semantics
    FrameBufferGuard(const FrameBufferGuard&) = delete;
    FrameBufferGuard& operator=(const FrameBufferGuard&) = delete;

    // Enable move semantics
    FrameBufferGuard(FrameBufferGuard&& other) noexcept : m_fb(other.m_fb) {
        other.m_fb = nullptr;
    }
    FrameBufferGuard& operator=(FrameBufferGuard&& other) noexcept {
        if (this != &other) {
            release();
            m_fb = other.m_fb;
            other.m_fb = nullptr;
        }
        return *this;
    }

    void reset(camera_fb_t* fb = nullptr) {
        release();
        m_fb = fb;
    }

    camera_fb_t* releaseOwnership() {
        camera_fb_t* temp = m_fb;
        m_fb = nullptr;
        return temp;
    }

    void release() {
        if (m_fb) {
            esp_camera_fb_return(m_fb);
            m_fb = nullptr;
        }
    }

    camera_fb_t* get() const { return m_fb; }
    camera_fb_t* operator->() const { return m_fb; }
    explicit operator bool() const { return m_fb != nullptr; }

private:
    camera_fb_t* m_fb;
};

struct FrameStats {
    uint32_t totalCaptured;
    uint32_t totalFailed;
    uint32_t totalDropped;
    uint32_t avgCaptureLatencyMs;
    uint32_t lastCaptureLatencyMs;
};

class FrameBufferManager {
public:
    static void init();
    static void recordSuccess(uint32_t latencyMs);
    static void recordFailure();
    static void recordDrop();
    static FrameStats getStats();
    static void resetStats();

private:
    static FrameStats s_stats;
    static uint64_t s_accumulatedLatency;
};

