#pragma once
#include <Arduino.h>
#include "Config.h"
#include "HumanDetector.h"

/**
 * @file ObjectTracker.h
 * @brief Zero-allocation IoU and centroid object tracker for ESP32.
 */

#define MAX_ACTIVE_TRACKS 4
#define MAX_TRACK_MISSES  3

struct TrackedObject {
    uint32_t trackId;
    DetectedClass detectedClass;
    BoundingBox box;
    int16_t vx;
    int16_t vy;
    float confidence;
    bool isHandheld;
    uint8_t hitCount;
    uint8_t missCount;
    bool active;
};

class ObjectTracker {
public:
    ObjectTracker();

    void update(DetectionResult &detection);
    bool predictStep(DetectionResult &humanResult, DetectionResult &objectResult, bool &hasHuman, bool &hasObject);
    void reset();

    uint8_t getActiveTrackCount() const;

private:
    TrackedObject m_tracks[MAX_ACTIVE_TRACKS];
    uint32_t m_nextTrackId;

    float calculateIoU(const BoundingBox &a, const BoundingBox &b);
    int findBestMatch(const BoundingBox &box, DetectedClass cls);
};

