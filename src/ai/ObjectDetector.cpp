#include "ObjectDetector.h"
#include "DiagnosticLogger.h"
#include "../models/ModelWeights.h"
#include "img_converters.h"
#include <esp_heap_caps.h>
#include <math.h>

#define TAG "ObjectDetect"

ObjectDetector::ObjectDetector()
    : m_threshold(0.55f), m_initialized(false), m_tensorArena(nullptr), m_arenaSize(0), m_jpegScratch(nullptr) {}

ObjectDetector::~ObjectDetector() {
    deinit();
}

ErrorCode ObjectDetector::init(float confidenceThreshold) {
    m_threshold = confidenceThreshold;
    m_arenaSize = AI_INPUT_WIDTH * AI_INPUT_HEIGHT;

    size_t scratchSize = 160 * 120 * 2;
    if (psramFound()) {
        m_tensorArena = (int8_t*)heap_caps_malloc(m_arenaSize, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        m_jpegScratch = (uint8_t*)heap_caps_malloc(scratchSize, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    } else {
        m_tensorArena = (int8_t*)heap_caps_malloc(m_arenaSize, MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
        m_jpegScratch = (uint8_t*)heap_caps_malloc(80 * 60 * 2, MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    }

    if (!m_tensorArena) {
        DiagnosticLogger::logError(TAG, ERR_AI_ARENA_ALLOC_FAILED, "ObjectDetector arena allocation failed");
        return ERR_AI_ARENA_ALLOC_FAILED;
    }

    m_initialized = true;
    return APP_OK;
}

void ObjectDetector::deinit() {
    if (m_tensorArena) {
        free(m_tensorArena);
        m_tensorArena = nullptr;
    }
    if (m_jpegScratch) {
        free(m_jpegScratch);
        m_jpegScratch = nullptr;
    }
    m_initialized = false;
}

static inline float sigmoidFast(float x) {
    return 1.0f / (1.0f + expf(-x));
}

float ObjectDetector::runPhoneInferenceINT8(const int8_t *inputTensor, BoundingBox &outBox, DetectedClass &outClass) {
    int strideX = AI_INPUT_WIDTH / MODEL_GRID_W;
    int strideY = AI_INPUT_HEIGHT / MODEL_GRID_H;

    float maxScore = 0.0f;
    int bestGridX = 0;
    int bestGridY = 0;
    DetectedClass bestClass = CLASS_BACKGROUND;

    for (int gy = 0; gy < MODEL_GRID_H; ++gy) {
        int centerY = gy * strideY + (strideY / 2);

        for (int gx = 0; gx < MODEL_GRID_W; ++gx) {
            int centerX = gx * strideX + (strideX / 2);

            int32_t channelResponses[8] = {0};

            for (int c = 0; c < 8; ++c) {
                int32_t convSum = s_conv1_biases[c];
                for (int ky = -1; ky <= 1; ++ky) {
                    int py = centerY + ky * 2;
                    if (py < 0 || py >= AI_INPUT_HEIGHT) continue;

                    for (int kx = -1; kx <= 1; ++kx) {
                        int px = centerX + kx * 2;
                        if (px < 0 || px >= AI_INPUT_WIDTH) continue;

                        int8_t inVal = inputTensor[py * AI_INPUT_WIDTH + px];
                        int8_t wVal = (int8_t)pgm_read_byte(&s_conv1_weights[c][ky + 1][kx + 1]);
                        convSum += (int32_t)inVal * (int32_t)wVal;
                    }
                }
                channelResponses[c] = (convSum > 0) ? (convSum >> 6) : 0;
            }

            // Head 1: Cell Phone
            int32_t phoneLogit = s_pointwise_biases[1];
            for (int c = 0; c < 8; ++c) {
                int8_t pw = (int8_t)pgm_read_byte(&s_pointwise_weights[1][c]);
                phoneLogit += channelResponses[c] * pw;
            }
            float phoneProb = sigmoidFast((float)phoneLogit * 0.0004f);

            // Head 2: Generic Handheld Object
            int32_t handLogit = s_pointwise_biases[2];
            for (int c = 0; c < 8; ++c) {
                int8_t pw = (int8_t)pgm_read_byte(&s_pointwise_weights[2][c]);
                handLogit += channelResponses[c] * pw;
            }
            float handProb = sigmoidFast((float)handLogit * 0.0004f);

            if (phoneProb > maxScore && phoneProb > handProb) {
                maxScore = phoneProb;
                bestGridX = centerX;
                bestGridY = centerY;
                bestClass = CLASS_PHONE;
            } else if (handProb > maxScore) {
                maxScore = handProb;
                bestGridX = centerX;
                bestGridY = centerY;
                bestClass = CLASS_HANDHELD;
            }
        }
    }

    outClass = bestClass;
    if (maxScore > 0.35f) {
        // Typical aspect ratio of cell phone / handheld gadget is roughly 2:1 vertical or 1:1 square
        int boxW = 16;
        int boxH = (bestClass == CLASS_PHONE) ? 26 : 20;
        outBox.x = constrain(bestGridX - (boxW / 2), 0, AI_INPUT_WIDTH - boxW);
        outBox.y = constrain(bestGridY - (boxH / 2), 0, AI_INPUT_HEIGHT - boxH);
        outBox.w = boxW;
        outBox.h = boxH;
    } else {
        outBox = {0, 0, 0, 0};
    }

    return maxScore;
}

bool ObjectDetector::verifyHandheldGrasp(const camera_fb_t *fb, 
                                        const BoundingBox &phoneBox, 
                                        const BoundingBox *humanBox) {
    if (!humanBox || humanBox->w == 0 || humanBox->h == 0) {
        // No human detected in scene -> cannot be verified as handheld
        return false;
    }

    // 1. Proximity check: Is phone within or adjacent to the human's torso/hand zone?
    // Hands are typically between 30% and 90% of human height
    int humanHandZoneTop = humanBox->y + (humanBox->h * 30) / 100;
    int humanHandZoneBottom = humanBox->y + (humanBox->h * 95) / 100;
    int phoneCenterY = phoneBox.y + (phoneBox.h / 2);

    if (phoneCenterY < humanHandZoneTop || phoneCenterY > humanHandZoneBottom) {
        // Phone is above head or on ground -> not held
        return false;
    }

    // Horizontal overlap or proximity
    int phoneCenterX = phoneBox.x + (phoneBox.w / 2);
    if (phoneCenterX < (humanBox->x - 15) || phoneCenterX > (humanBox->x + humanBox->w + 15)) {
        // Too far horizontally from human
        return false;
    }

    // 2. Optical boundary gradient check (edge crossings along phone boundary indicating fingers/hand)
    if (!fb || !fb->buf) return false;

    int edgeTransitions = 0;
    int checkY = constrain(phoneCenterY, 0, (int)fb->height - 1);
    int checkLeft = constrain(phoneBox.x, 2, (int)fb->width - 3);
    int checkRight = constrain(phoneBox.x + phoneBox.w, 2, (int)fb->width - 3);

    if (fb->format == PIXFORMAT_GRAYSCALE) {
        // Sample left edge gradient
        uint8_t leftOuter = fb->buf[checkY * fb->width + (checkLeft - 2)];
        uint8_t leftInner = fb->buf[checkY * fb->width + checkLeft];
        if (abs((int)leftOuter - (int)leftInner) > 25) edgeTransitions++;

        // Sample right edge gradient
        uint8_t rightInner = fb->buf[checkY * fb->width + checkRight];
        uint8_t rightOuter = fb->buf[checkY * fb->width + (checkRight + 2)];
        if (abs((int)rightOuter - (int)rightInner) > 25) edgeTransitions++;
    } else if (fb->format == PIXFORMAT_RGB565) {
        const uint16_t *pixels = (const uint16_t*)fb->buf;
        auto getLum = [&](int x, int y) -> uint8_t {
            uint16_t p = pixels[y * fb->width + x];
            return (uint8_t)((((p >> 11) & 0x1F) * 77 + ((p >> 5) & 0x3F) * 75 + (p & 0x1F) * 29) >> 6);
        };
        if (abs((int)getLum(checkLeft - 2, checkY) - (int)getLum(checkLeft, checkY)) > 25) edgeTransitions++;
        if (abs((int)getLum(checkRight + 2, checkY) - (int)getLum(checkRight, checkY)) > 25) edgeTransitions++;
    }

    // If edge gradients confirm hand fingers or grip bordering the device
    return (edgeTransitions >= 1);
}

bool ObjectDetector::detectObjects(const camera_fb_t *fb, 
                                  const DetectionResult *humanResult, 
                                  DetectionResult &objectResult) {
    if (!m_initialized || !fb) return false;

    uint32_t startMs = millis();

    // Resize camera frame into INT8 tensor
    int srcW = fb->width;
    int srcH = fb->height;
    if (fb->format == PIXFORMAT_GRAYSCALE) {
        for (int y = 0; y < AI_INPUT_HEIGHT; ++y) {
            int srcY = (y * srcH) / AI_INPUT_HEIGHT;
            const uint8_t *srcRow = &fb->buf[srcY * srcW];
            int8_t *dstRow = &m_tensorArena[y * AI_INPUT_WIDTH];
            for (int x = 0; x < AI_INPUT_WIDTH; ++x) {
                int srcX = (x * srcW) / AI_INPUT_WIDTH;
                dstRow[x] = (int8_t)((int16_t)srcRow[srcX] - 128);
            }
        }
    } else if (fb->format == PIXFORMAT_RGB565) {
        const uint16_t *srcPixels = (const uint16_t*)fb->buf;
        for (int y = 0; y < AI_INPUT_HEIGHT; ++y) {
            int srcY = (y * srcH) / AI_INPUT_HEIGHT;
            int8_t *dstRow = &m_tensorArena[y * AI_INPUT_WIDTH];
            for (int x = 0; x < AI_INPUT_WIDTH; ++x) {
                int srcX = (x * srcW) / AI_INPUT_WIDTH;
                uint16_t p = srcPixels[srcY * srcW + srcX];
                uint8_t r = ((p >> 11) & 0x1F) << 3;
                uint8_t g = ((p >> 5) & 0x3F) << 2;
                uint8_t b = (p & 0x1F) << 3;
                uint8_t lum = (uint8_t)((r * 77 + g * 150 + b * 29) >> 8);
                dstRow[x] = (int8_t)((int16_t)lum - 128);
            }
        }
    } else if (fb->format == PIXFORMAT_JPEG) {
        if (!m_jpegScratch) return false;
        // Dynamic fast hardware JPEG decode:
        // For 640x480 (VGA), scale 1/8 gives 80x60 in ~1.8ms
        // For 320x240 (QVGA), scale 1/4 gives 80x60 in ~1.5ms
        jpg_scale_t scale = (fb->width >= 640) ? JPG_SCALE_8X : JPG_SCALE_4X;
        if (!jpg2rgb565(fb->buf, fb->len, m_jpegScratch, scale)) {
            return false;
        }
        int decW = (fb->width >= 640) ? (fb->width / 8) : (fb->width / 4);
        int decH = (fb->height >= 480) ? (fb->height / 8) : (fb->height / 4);
        const uint16_t *srcPixels = (const uint16_t*)m_jpegScratch;
        for (int y = 0; y < AI_INPUT_HEIGHT; ++y) {
            int srcY = (y * decH) / AI_INPUT_HEIGHT;
            int8_t *dstRow = &m_tensorArena[y * AI_INPUT_WIDTH];
            for (int x = 0; x < AI_INPUT_WIDTH; ++x) {
                int srcX = (x * decW) / AI_INPUT_WIDTH;
                uint16_t p = srcPixels[srcY * decW + srcX];
                uint8_t r = ((p >> 11) & 0x1F) << 3;
                uint8_t g = ((p >> 5) & 0x3F) << 2;
                uint8_t b = (p & 0x1F) << 3;
                uint8_t lum = (uint8_t)((r * 77 + g * 150 + b * 29) >> 8);
                dstRow[x] = (int8_t)((int16_t)lum - 128);
            }
        }
    }

    BoundingBox rawBox;
    DetectedClass cls;
    float conf = runPhoneInferenceINT8(m_tensorArena, rawBox, cls);
    uint32_t elapsedMs = millis() - startMs;

    // Strict validation to eliminate ear / hair / facial feature false alarms:
    if (conf >= 0.65f && cls != CLASS_BACKGROUND) {
        // Visual hand-grasp verification
        const BoundingBox *humanBox = (humanResult && humanResult->confidence >= 0.40f) ? &humanResult->box : nullptr;
        bool isHeld = verifyHandheldGrasp(fb, rawBox, humanBox);

        // Anatomical head-zone suppression:
        // When a human is present, check if candidate box is in the upper head zone (ears, hair, temple)
        if (humanBox) {
            int headBottom = humanBox->y + (humanBox->h * 28) / 100;
            int objCenterY = rawBox.y + (rawBox.h / 2);
            // If the object is located in the head zone and not confirmed held by a hand -> REJECT
            if (objCenterY <= headBottom && !isHeld) {
                objectResult.detectedClass = CLASS_BACKGROUND;
                objectResult.className = "None";
                objectResult.confidence = conf;
                objectResult.box = {0, 0, 0, 0};
                objectResult.isHandheld = false;
                objectResult.inferenceTimeMs = elapsedMs;
                return false;
            }

            // When human is in frame, cell phone MUST have visual hand contact (held in hand)
            if (!isHeld) {
                objectResult.detectedClass = CLASS_BACKGROUND;
                objectResult.className = "None";
                objectResult.confidence = conf;
                objectResult.box = {0, 0, 0, 0};
                objectResult.isHandheld = false;
                objectResult.inferenceTimeMs = elapsedMs;
                return false;
            }
        } else {
            // Standalone scene object (tabletop phone): require higher confidence (>= 0.75f)
            if (conf < 0.75f) {
                objectResult.detectedClass = CLASS_BACKGROUND;
                objectResult.className = "None";
                objectResult.confidence = conf;
                objectResult.box = {0, 0, 0, 0};
                objectResult.isHandheld = false;
                objectResult.inferenceTimeMs = elapsedMs;
                return false;
            }
        }

        objectResult.detectedClass = cls;
        objectResult.className = (cls == CLASS_PHONE) ? "Cell Phone" : "Handheld Item";
        objectResult.confidence = conf;
        objectResult.box = rawBox;
        objectResult.isHandheld = isHeld;
        objectResult.inferenceTimeMs = elapsedMs;
        return true;
    }

    objectResult.detectedClass = CLASS_BACKGROUND;
    objectResult.className = "None";
    objectResult.confidence = conf;
    objectResult.box = {0, 0, 0, 0};
    objectResult.isHandheld = false;
    objectResult.inferenceTimeMs = elapsedMs;
    return false;
}

