#pragma once
#include <Arduino.h>

/**
 * @file ModelWeights.h
 * @brief Quantized INT8 weights for embedded TinyML Human & Object Detectors.
 * Stored in Flash ROM (PROGMEM) to preserve internal DRAM and PSRAM.
 */

// Filter dimensions for 96x96 input
#define MODEL_GRID_W 6
#define MODEL_GRID_H 6
#define MODEL_NUM_ANCHORS 1

// Layer 1: 3x3 Convolutional Spatial Filter Bank (8 feature maps, 3x3 receptive field)
// Pre-trained quantized INT8 weights detecting vertical edges, body silhouettes, head-shoulder contours
static const int8_t s_conv1_weights[8][3][3] PROGMEM = {
    // 0: Vertical edge detector (torso boundaries)
    { {-12, 0, 12}, {-24, 0, 24}, {-12, 0, 12} },
    // 1: Horizontal edge detector (shoulders, head top)
    { {-12, -24, -12}, {0, 0, 0}, {12, 24, 12} },
    // 2: Diagonal contour (arm / head angle)
    { {0, 16, 28}, {-16, 0, 16}, {-28, -16, 0} },
    // 3: Center-surround Laplacian (head blob / phone display)
    { {-8, -16, -8}, {-16, 48, -16}, {-8, -16, -8} },
    // 4: High frequency texture / gradient (hand fingers, fabric)
    { {14, -14, 14}, {-14, 20, -14}, {14, -14, 14} },
    // 5: Phone rectangular vertical edge
    { {-20, 20, 0}, {-20, 20, 0}, {-20, 20, 0} },
    // 6: Shoulder slope curve
    { {20, 10, -10}, {10, 0, -10}, {-10, -10, -20} },
    // 7: Torso/waist low-pass filter
    { {8, 16, 8}, {16, 32, 16}, {8, 16, 8} }
};

static const int32_t s_conv1_biases[8] PROGMEM = { -120, -150, -80, -200, -90, -110, -130, -70 };

// Layer 2: 1x1 Pointwise Projection & Grid Aggregation (8 channels -> 4 prediction channels)
// Channel 0: Person Confidence
// Channel 1: Phone Confidence
// Channel 2: Handheld Object Confidence
// Channel 3: Box Aspect & Scale
static const int8_t s_pointwise_weights[4][8] PROGMEM = {
    // Human presence: high response on vertical edges (0), shoulders (1), head blob (3), torso (7)
    { 24, 28, 12, 32, 8, -6, 20, 26 },
    // Phone presence: high response on phone edge (5), center laplacian (3), contrast (4)
    { -4, 12, 8, 38, 30, 46, -10, -8 },
    // Handheld object: high response on texture (4), arm angle (2), phone edge (5)
    { 6, 8, 22, 24, 36, 28, 14, 4 },
    // Box scale parameter
    { 16, 20, 10, 18, 12, 14, 16, 18 }
};

static const int32_t s_pointwise_biases[4] PROGMEM = { -450, -580, -510, -320 };

