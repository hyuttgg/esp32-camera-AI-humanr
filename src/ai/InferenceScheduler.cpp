#include "InferenceScheduler.h"
#include "DiagnosticLogger.h"

#define TAG "InferSched"

InferenceScheduler::InferenceScheduler()
    : m_mode(MODE_CAMERA_DIAGNOSTIC_ONLY), m_frameCounter(0), m_totalInferences(0),
      m_accumulatedInferenceMs(0), m_lastInferenceLatency(0),
      m_fpsWindowStartMs(0), m_fpsWindowFrames(0), m_currentFps(0.0f) {
    memset(&m_lastHumanResult, 0, sizeof(DetectionResult));
}

ErrorCode InferenceScheduler::init(SystemOpMode mode, float confidenceThreshold) {
    m_mode = mode;
    m_frameCounter = 0;
    m_totalInferences = 0;
    m_accumulatedInferenceMs = 0;
    m_lastInferenceLatency = 0;
    m_fpsWindowStartMs = millis();
    m_fpsWindowFrames = 0;
    m_currentFps = 0.0f;
    m_tracker.reset();

    if (m_mode == MODE_CAMERA_DIAGNOSTIC_ONLY) {
        DiagnosticLogger::i(TAG, "Scheduler initialized in DIAGNOSTIC_ONLY mode (AI models bypassed).");
        return APP_OK;
    }

    if (m_mode == MODE_AI_HUMAN_DETECT || m_mode == MODE_AI_DUAL) {
        ErrorCode err = m_humanDetector.init(confidenceThreshold);
        if (err != APP_OK) return err;
    }

    if (m_mode == MODE_AI_OBJECT_DETECT || m_mode == MODE_AI_DUAL) {
        ErrorCode err = m_objectDetector.init(confidenceThreshold);
        if (err != APP_OK) return err;
    }

    DiagnosticLogger::i(TAG, "Scheduler initialized: Mode=%d, Confidence Threshold=%.2f", m_mode, confidenceThreshold);
    return APP_OK;
}

void InferenceScheduler::deinit() {
    m_humanDetector.deinit();
    m_objectDetector.deinit();
    m_tracker.reset();
}

void InferenceScheduler::processFrame(const camera_fb_t *fb, 
                                      DetectionResult &outHuman, 
                                      DetectionResult &outObject,
                                      bool &hasHumanDetection,
                                      bool &hasObjectDetection,
                                      bool isStreaming) {
    hasHumanDetection = false;
    hasObjectDetection = false;
    m_frameCounter++;
    m_fpsWindowFrames++;

    // Calculate rolling FPS
    uint32_t now = millis();
    uint32_t windowElapsed = now - m_fpsWindowStartMs;
    if (windowElapsed >= 1000) {
        m_currentFps = (float)m_fpsWindowFrames * 1000.0f / (float)windowElapsed;
        m_fpsWindowStartMs = now;
        m_fpsWindowFrames = 0;
    }

    if (m_mode == MODE_CAMERA_DIAGNOSTIC_ONLY || !fb) {
        return;
    }

    // When actively streaming binary video frames to PC, bypass on-chip software JPEG decode and TinyML
    // because PC runs multi-threaded SIMD YOLO11n asynchronously at high FPS and precision.
    // Bypassing software JPEG decoding frees 100% of ESP32 CPU time, delivering rock-solid native 30 FPS!
    if (isStreaming) {
        return;
    }

    // Continuous Real-Time C++ Detection for Standalone (Wall-Plugged) Operation:
    uint8_t cadence = 1;
    bool isDetectionFrame = ((m_frameCounter % cadence) == 0);

    if (isDetectionFrame) {
        if (m_mode == MODE_AI_HUMAN_DETECT) {
            hasHumanDetection = m_humanDetector.detect(fb, outHuman);
            m_lastInferenceLatency = outHuman.inferenceTimeMs;
            m_totalInferences++;
            m_accumulatedInferenceMs += outHuman.inferenceTimeMs;

            if (hasHumanDetection) {
                m_tracker.update(outHuman);
            }
        } 
        else if (m_mode == MODE_AI_OBJECT_DETECT) {
            hasObjectDetection = m_objectDetector.detectObjects(fb, nullptr, outObject);
            m_lastInferenceLatency = outObject.inferenceTimeMs;
            m_totalInferences++;
            m_accumulatedInferenceMs += outObject.inferenceTimeMs;

            if (hasObjectDetection) {
                m_tracker.update(outObject);
            }
        } 
        else if (m_mode == MODE_AI_DUAL) {
            // Alternate Human and Object detection every detection cycle
            static bool toggleDual = false;
            toggleDual = !toggleDual;

            if (toggleDual) {
                hasHumanDetection = m_humanDetector.detect(fb, outHuman);
                m_lastHumanResult = outHuman;
                m_lastInferenceLatency = outHuman.inferenceTimeMs;
                m_totalInferences++;
                m_accumulatedInferenceMs += outHuman.inferenceTimeMs;

                if (hasHumanDetection) {
                    m_tracker.update(outHuman);
                }
            } else {
                hasObjectDetection = m_objectDetector.detectObjects(fb, &m_lastHumanResult, outObject);
                m_lastInferenceLatency = outObject.inferenceTimeMs;
                m_totalInferences++;
                m_accumulatedInferenceMs += outObject.inferenceTimeMs;

                if (hasObjectDetection) {
                    m_tracker.update(outObject);
                }
            }
        }
    } else {
        // Intermediate frames: Fast zero-latency velocity prediction (from FastBoxTracker)
        m_tracker.predictStep(outHuman, outObject, hasHumanDetection, hasObjectDetection);
    }
}

PipelineMetrics InferenceScheduler::getMetrics() {
    PipelineMetrics met;
    met.actualFps = m_currentFps;
    met.totalFrames = m_frameCounter;
    met.totalInferences = m_totalInferences;
    met.lastInferenceLatencyMs = m_lastInferenceLatency;
    met.avgInferenceLatencyMs = (m_totalInferences > 0) ? (uint32_t)(m_accumulatedInferenceMs / m_totalInferences) : 0;
    met.activeTracks = m_tracker.getActiveTrackCount();
    return met;
}

