#pragma once
#include <Arduino.h>
#include "esp_camera.h"
#include "Config.h"
#include "HumanDetector.h"
#include "ObjectDetector.h"
#include "ObjectTracker.h"

/**
 * @file InferenceScheduler.h
 * @brief Coordinates AI inference scheduling, dual-pipeline interleaving, and FPS tracking.
 */

struct PipelineMetrics {
    float actualFps;
    uint32_t totalFrames;
    uint32_t totalInferences;
    uint32_t avgInferenceLatencyMs;
    uint32_t lastInferenceLatencyMs;
    uint32_t activeTracks;
};

class InferenceScheduler {
public:
    InferenceScheduler();

    ErrorCode init(SystemOpMode mode, float confidenceThreshold);
    void deinit();

    void processFrame(const camera_fb_t *fb, 
                      DetectionResult &outHuman, 
                      DetectionResult &outObject,
                      bool &hasHumanDetection,
                      bool &hasObjectDetection,
                      bool isStreaming = false);

    void setMode(SystemOpMode mode) { m_mode = mode; }
    SystemOpMode getMode() const { return m_mode; }

    PipelineMetrics getMetrics();

private:
    SystemOpMode m_mode;
    HumanDetector m_humanDetector;
    ObjectDetector m_objectDetector;
    ObjectTracker m_tracker;

    DetectionResult m_lastHumanResult;
    uint32_t m_frameCounter;
    uint32_t m_totalInferences;
    uint64_t m_accumulatedInferenceMs;
    uint32_t m_lastInferenceLatency;

    uint32_t m_fpsWindowStartMs;
    uint32_t m_fpsWindowFrames;
    float m_currentFps;
};

