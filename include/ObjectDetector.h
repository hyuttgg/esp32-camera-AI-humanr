#pragma once
#include <Arduino.h>
#include "esp_camera.h"
#include "Config.h"
#include "ErrorCodes.h"
#include "HumanDetector.h"

/**
 * @file ObjectDetector.h
 * @brief TinyML Object Detector for Cell Phones and handheld objects with visual hand-grasp verification.
 */

class ObjectDetector {
public:
    ObjectDetector();
    ~ObjectDetector();

    ErrorCode init(float confidenceThreshold = 0.55f);
    void deinit();

    bool detectObjects(const camera_fb_t *fb, 
                       const DetectionResult *humanResult, 
                       DetectionResult &objectResult);

    void setThreshold(float threshold) { m_threshold = threshold; }
    float getThreshold() const { return m_threshold; }

private:
    float m_threshold;
    bool m_initialized;
    int8_t* m_tensorArena;
    size_t m_arenaSize;
    uint8_t* m_jpegScratch;

    bool verifyHandheldGrasp(const camera_fb_t *fb, 
                             const BoundingBox &phoneBox, 
                             const BoundingBox *humanBox);

    float runPhoneInferenceINT8(const int8_t *inputTensor, BoundingBox &outBox, DetectedClass &outClass);
};

