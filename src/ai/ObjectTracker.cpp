#include "ObjectTracker.h"
#include <algorithm>

ObjectTracker::ObjectTracker() : m_nextTrackId(1) {
    reset();
}

void ObjectTracker::reset() {
    for (int i = 0; i < MAX_ACTIVE_TRACKS; ++i) {
        m_tracks[i].active = false;
        m_tracks[i].trackId = 0;
        m_tracks[i].vx = 0;
        m_tracks[i].vy = 0;
        m_tracks[i].confidence = 0.0f;
        m_tracks[i].isHandheld = false;
        m_tracks[i].hitCount = 0;
        m_tracks[i].missCount = 0;
    }
}

float ObjectTracker::calculateIoU(const BoundingBox &a, const BoundingBox &b) {
    int x1 = max(a.x, b.x);
    int y1 = max(a.y, b.y);
    int x2 = min(a.x + a.w, b.x + b.w);
    int y2 = min(a.y + a.h, b.y + b.h);

    int interW = max(0, x2 - x1);
    int interH = max(0, y2 - y1);
    int interArea = interW * interH;

    int areaA = a.w * a.h;
    int areaB = b.w * b.h;
    int unionArea = areaA + areaB - interArea;

    if (unionArea <= 0) return 0.0f;
    return (float)interArea / (float)unionArea;
}

int ObjectTracker::findBestMatch(const BoundingBox &box, DetectedClass cls) {
    int bestIdx = -1;
    float maxIoU = 0.25f; // Match threshold

    for (int i = 0; i < MAX_ACTIVE_TRACKS; ++i) {
        if (!m_tracks[i].active || m_tracks[i].detectedClass != cls) continue;

        float iou = calculateIoU(box, m_tracks[i].box);
        if (iou > maxIoU) {
            maxIoU = iou;
            bestIdx = i;
        }
    }

    return bestIdx;
}

void ObjectTracker::update(DetectionResult &detection) {
    if (detection.detectedClass == CLASS_BACKGROUND || detection.box.w == 0) {
        // Increment misses on all active tracks
        for (int i = 0; i < MAX_ACTIVE_TRACKS; ++i) {
            if (m_tracks[i].active) {
                m_tracks[i].missCount++;
                if (m_tracks[i].missCount >= MAX_TRACK_MISSES) {
                    m_tracks[i].active = false;
                }
            }
        }
        detection.trackId = 0;
        return;
    }

    int matchIdx = findBestMatch(detection.box, detection.detectedClass);

    if (matchIdx >= 0) {
        // Matched existing track: update velocity vector and smooth box
        TrackedObject &tr = m_tracks[matchIdx];
        int16_t dx = detection.box.x - tr.box.x;
        int16_t dy = detection.box.y - tr.box.y;
        tr.vx = (int16_t)(0.6f * dx + 0.4f * tr.vx);
        tr.vy = (int16_t)(0.6f * dy + 0.4f * tr.vy);

        tr.box.x = (int16_t)(0.7f * detection.box.x + 0.3f * tr.box.x);
        tr.box.y = (int16_t)(0.7f * detection.box.y + 0.3f * tr.box.y);
        tr.box.w = (int16_t)(0.7f * detection.box.w + 0.3f * tr.box.w);
        tr.box.h = (int16_t)(0.7f * detection.box.h + 0.3f * tr.box.h);
        tr.confidence = detection.confidence;
        tr.isHandheld = detection.isHandheld;
        tr.hitCount++;
        tr.missCount = 0;

        detection.box = tr.box;
        detection.trackId = tr.trackId;
    } else {
        // Find free slot for new track
        int freeSlot = -1;
        for (int i = 0; i < MAX_ACTIVE_TRACKS; ++i) {
            if (!m_tracks[i].active) {
                freeSlot = i;
                break;
            }
        }

        if (freeSlot >= 0) {
            TrackedObject &tr = m_tracks[freeSlot];
            tr.active = true;
            tr.trackId = m_nextTrackId++;
            tr.detectedClass = detection.detectedClass;
            tr.box = detection.box;
            tr.vx = 0;
            tr.vy = 0;
            tr.confidence = detection.confidence;
            tr.isHandheld = detection.isHandheld;
            tr.hitCount = 1;
            tr.missCount = 0;

            detection.trackId = tr.trackId;
        } else {
            detection.trackId = 0;
        }
    }
}

bool ObjectTracker::predictStep(DetectionResult &humanResult, DetectionResult &objectResult, bool &hasHuman, bool &hasObject) {
    hasHuman = false;
    hasObject = false;

    for (int i = 0; i < MAX_ACTIVE_TRACKS; ++i) {
        if (!m_tracks[i].active) continue;

        TrackedObject &tr = m_tracks[i];
        // Apply velocity prediction (FastBoxTracker algorithm)
        tr.box.x = constrain(tr.box.x + tr.vx, 0, (int16_t)(AI_INPUT_WIDTH - tr.box.w));
        tr.box.y = constrain(tr.box.y + tr.vy, 0, (int16_t)(AI_INPUT_HEIGHT - tr.box.h));

        if (tr.detectedClass == CLASS_HUMAN && !hasHuman) {
            humanResult.detectedClass = CLASS_HUMAN;
            humanResult.className = "Person";
            humanResult.confidence = tr.confidence;
            humanResult.box = tr.box;
            humanResult.trackId = tr.trackId;
            humanResult.isHandheld = false;
            humanResult.inferenceTimeMs = 0; // Velocity-predicted
            hasHuman = true;
        } else if (tr.detectedClass == CLASS_PHONE && !hasObject) {
            objectResult.detectedClass = CLASS_PHONE;
            objectResult.className = "Cell Phone";
            objectResult.confidence = tr.confidence;
            objectResult.box = tr.box;
            objectResult.trackId = tr.trackId;
            objectResult.isHandheld = tr.isHandheld;
            objectResult.inferenceTimeMs = 0; // Velocity-predicted
            hasObject = true;
        }
    }

    return (hasHuman || hasObject);
}

uint8_t ObjectTracker::getActiveTrackCount() const {
    uint8_t count = 0;
    for (int i = 0; i < MAX_ACTIVE_TRACKS; ++i) {
        if (m_tracks[i].active) count++;
    }
    return count;
}

