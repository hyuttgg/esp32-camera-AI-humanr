/**
 * @file TurboQuant.cpp
 * @brief Implementation of Embedded C++ TurboQuant Engine.
 */

#include "TurboQuant.h"
#include <math.h>
#include <string.h>

TurboQuantEngine::TurboQuantEngine() : m_initialized(false) {
    memset(&m_prototypeStanding, 0, sizeof(m_prototypeStanding));
    memset(&m_prototypeWalking, 0, sizeof(m_prototypeWalking));
    memset(&m_prototypeSitting, 0, sizeof(m_prototypeSitting));
}

TurboQuantEngine::~TurboQuantEngine() {
}

void TurboQuantEngine::init() {
    if (m_initialized) return;
    turboquant_init();
    initCanonicalPrototypes();
    m_initialized = true;
}

void TurboQuantEngine::initCanonicalPrototypes() {
    // 1. Standing Human Silhouette Feature Vector (64 dimensions)
    // [0..15]: Vertical mass profile (Head: small, Shoulder: wide, Torso: medium, Legs: medium)
    // [16..31]: Horizontal symmetry & torso width profile
    // [32..47]: Spatial edge gradients (head curve, shoulder horiz, torso vert)
    // [48..63]: Temporal motion energy distribution
    float standing[HUMAN_FEATURE_DIM];
    for (int i = 0; i < 16; ++i) {
        float y_pos = (float)i / 15.0f;
        if (y_pos < 0.15f) standing[i] = 0.35f;        // Head
        else if (y_pos < 0.30f) standing[i] = 0.95f;   // Shoulders
        else if (y_pos < 0.65f) standing[i] = 0.80f;   // Torso
        else standing[i] = 0.55f;                      // Legs
    }
    for (int i = 16; i < 32; ++i) {
        // High bilateral symmetry around center
        float dist = fabsf((float)(i - 16) - 7.5f) / 7.5f;
        standing[i] = 1.0f - dist * 0.70f;
    }
    for (int i = 32; i < 48; ++i) {
        // Characteristic edge orientation distribution
        standing[i] = ((i % 4 == 0) ? 0.85f : ((i % 4 == 2) ? 0.75f : 0.40f));
    }
    for (int i = 48; i < 64; ++i) {
        // Motion energy: moderate on upper body, higher on extremities
        standing[i] = 0.50f + 0.30f * sinf((float)(i - 48) * 0.4f);
    }
    turboquant_quantize_4bit(standing, HUMAN_FEATURE_DIM, &m_prototypeStanding);

    // 2. Walking Human Silhouette Feature Vector (64 dimensions)
    float walking[HUMAN_FEATURE_DIM];
    for (int i = 0; i < 16; ++i) {
        float y_pos = (float)i / 15.0f;
        if (y_pos < 0.15f) walking[i] = 0.32f;
        else if (y_pos < 0.30f) walking[i] = 0.90f;
        else if (y_pos < 0.60f) walking[i] = 0.75f;
        else walking[i] = 0.70f; // Stride legs wider
    }
    for (int i = 16; i < 32; ++i) {
        float dist = fabsf((float)(i - 16) - 7.5f) / 7.5f;
        walking[i] = 0.90f - dist * 0.55f;
    }
    for (int i = 32; i < 48; ++i) {
        walking[i] = ((i % 4 == 1) ? 0.80f : ((i % 4 == 3) ? 0.85f : 0.45f));
    }
    for (int i = 48; i < 64; ++i) {
        // High leg swing motion energy
        float y_pos = (float)(i - 48) / 15.0f;
        walking[i] = 0.40f + y_pos * 0.55f;
    }
    turboquant_quantize_4bit(walking, HUMAN_FEATURE_DIM, &m_prototypeWalking);

    // 3. Sitting / Desk Human Silhouette Feature Vector (64 dimensions)
    float sitting[HUMAN_FEATURE_DIM];
    for (int i = 0; i < 16; ++i) {
        float y_pos = (float)i / 15.0f;
        if (y_pos < 0.22f) sitting[i] = 0.45f;
        else if (y_pos < 0.45f) sitting[i] = 0.95f;
        else sitting[i] = 0.85f; // Sitting base is wide
    }
    for (int i = 16; i < 32; ++i) {
        float dist = fabsf((float)(i - 16) - 7.5f) / 7.5f;
        sitting[i] = 0.95f - dist * 0.60f;
    }
    for (int i = 32; i < 48; ++i) {
        sitting[i] = ((i % 2 == 0) ? 0.70f : 0.50f);
    }
    for (int i = 48; i < 64; ++i) {
        // Arm and head movement dominates sitting posture
        float y_pos = (float)(i - 48) / 15.0f;
        sitting[i] = 0.80f - y_pos * 0.45f;
    }
    turboquant_quantize_4bit(sitting, HUMAN_FEATURE_DIM, &m_prototypeSitting);
}

void TurboQuantEngine::quantizeFeatures(const float *features, turboquant_payload_t &outPayload) const {
    turboquant_quantize_4bit(features, HUMAN_FEATURE_DIM, &outPayload);
}

float TurboQuantEngine::computeSimilarity(const turboquant_payload_t &a, const turboquant_payload_t &b) const {
    return turboquant_fast_cosine_sim(&a, &b);
}

float TurboQuantEngine::verifyHumanSilhouette(const float *features) const {
    if (!features) return 0.0f;

    turboquant_payload_t candidatePayload;
    turboquant_quantize_4bit(features, HUMAN_FEATURE_DIM, &candidatePayload);

    // Ultra-fast POPCOUNT similarity against the 3 canonical human models
    float simStanding = turboquant_fast_cosine_sim(&candidatePayload, &m_prototypeStanding);
    float simWalking  = turboquant_fast_cosine_sim(&candidatePayload, &m_prototypeWalking);
    float simSitting  = turboquant_fast_cosine_sim(&candidatePayload, &m_prototypeSitting);

    float maxSim = simStanding;
    if (simWalking > maxSim) maxSim = simWalking;
    if (simSitting > maxSim) maxSim = simSitting;

    if (maxSim < 0.0f) maxSim = 0.0f;
    if (maxSim > 1.0f) maxSim = 1.0f;

    return maxSim;
}

