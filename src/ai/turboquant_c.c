/**
 * @file turboquant_c.c
 * @brief High-Performance Pure C99 Implementation of TurboQuant.
 */

#include "turboquant_c.h"
#include <math.h>
#include <string.h>

#if defined(_MSC_VER)
  #include <intrin.h>
  #define TQ_POPCOUNT32(x) __popcnt(x)
#else
  #define TQ_POPCOUNT32(x) __builtin_popcount(x)
#endif

#define M_SQRT_PI_2 1.2533141373155002512f // sqrt(pi / 2)

// 4-bit Lloyd-Max optimal centroids for standard Gaussian N(0, 1)
static const float LLOYD_MAX_4BIT_CENTROIDS[16] = {
    -2.7326f, -2.0690f, -1.6180f, -1.2562f,
    -0.9424f, -0.6568f, -0.3881f, -0.1284f,
     0.1284f,  0.3881f,  0.6568f,  0.9424f,
     1.2562f,  1.6180f,  2.0690f,  2.7326f
};

// 15 Decision boundaries between centroids
static const float LLOYD_MAX_4BIT_BOUNDARIES[15] = {
    -2.40080f, -1.84350f, -1.43710f, -1.09930f,
    -0.79960f, -0.52245f, -0.25825f,  0.00000f,
     0.25825f,  0.52245f,  0.79960f,  1.09930f,
     1.43710f,  1.84350f,  2.40080f
};

// Deterministic Rademacher sign pattern (+1 / -1) for up to 128 dimensions
static const int8_t RADEMACHER_SIGNS[128] = {
     1, -1, -1,  1, -1,  1,  1, -1,  1,  1, -1, -1,  1, -1,  1,  1,
    -1,  1, -1,  1,  1, -1, -1,  1,  1, -1,  1, -1, -1,  1,  1, -1,
     1,  1, -1, -1,  1, -1,  1,  1, -1,  1, -1,  1,  1, -1, -1,  1,
    -1, -1,  1,  1, -1,  1, -1, -1,  1, -1,  1, -1, -1,  1,  1, -1,
     1, -1,  1,  1, -1, -1,  1, -1,  1,  1, -1,  1, -1, -1,  1,  1,
    -1,  1,  1, -1,  1, -1, -1,  1, -1, -1,  1,  1, -1,  1, -1,  1,
     1, -1, -1,  1,  1, -1,  1, -1, -1,  1,  1, -1, -1,  1, -1,  1,
    -1,  1,  1, -1, -1,  1, -1,  1,  1, -1, -1,  1,  1, -1,  1, -1
};

// Deterministic 32-bit seeds for QJL projection pseudo-random generation
static const uint32_t QJL_SEEDS[4] = {
    0x9E3779B9, 0x85EBCA6B, 0xC2B2AE35, 0x27D4EB2F
};

void turboquant_init(void) {
    // Lookup tables are statically compiled for zero runtime startup overhead.
}

void turboquant_fwht(float *data, int n) {
    if (!data || n <= 0) return;
    int h = 1;
    while (h < n) {
        for (int i = 0; i < n; i += (h * 2)) {
            for (int j = i; j < i + h; ++j) {
                float u = data[j];
                float v = data[j + h];
                data[j] = u + v;
                data[j + h] = u - v;
            }
        }
        h *= 2;
    }
    float scale = 1.0f / sqrtf((float)n);
    for (int i = 0; i < n; ++i) {
        data[i] *= scale;
    }
}

static inline uint8_t quantize_scalar_4bit(float u_norm) {
    // Fast binary search across 15 boundaries
    if (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[7]) { // < 0.0
        if (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[3]) {
            if (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[1]) {
                return (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[0]) ? 0 : 1;
            } else {
                return (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[2]) ? 2 : 3;
            }
        } else {
            if (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[5]) {
                return (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[4]) ? 4 : 5;
            } else {
                return (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[6]) ? 6 : 7;
            }
        }
    } else { // >= 0.0
        if (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[11]) {
            if (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[9]) {
                return (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[8]) ? 8 : 9;
            } else {
                return (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[10]) ? 10 : 11;
            }
        } else {
            if (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[13]) {
                return (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[12]) ? 12 : 13;
            } else {
                return (u_norm < LLOYD_MAX_4BIT_BOUNDARIES[14]) ? 14 : 15;
            }
        }
    }
}

void turboquant_quantize_4bit(const float *x, int dim, turboquant_payload_t *out) {
    if (!x || !out || dim <= 0 || dim > TURBOQUANT_MAX_DIM) return;

    memset(out, 0, sizeof(turboquant_payload_t));
    out->dim = (uint16_t)dim;

    // 1. Calculate L2 norm of x
    float sum_sq = 0.0f;
    for (int i = 0; i < dim; ++i) {
        sum_sq += x[i] * x[i];
    }
    float norm_x = sqrtf(sum_sq);
    out->norm_x = norm_x;

    if (norm_x < 1e-12f) {
        out->norm_res = 0.0f;
        return;
    }

    // 2. PolarQuant: Apply Rademacher signs & Fast Walsh-Hadamard Transform
    float y[TURBOQUANT_MAX_DIM];
    for (int i = 0; i < dim; ++i) {
        y[i] = x[i] * (float)RADEMACHER_SIGNS[i];
    }
    turboquant_fwht(y, dim);

    // 3. 4-bit Lloyd-Max Quantization
    float inv_norm_x = 1.0f / norm_x;
    float sqrt_d = sqrtf((float)dim);
    float inv_sqrt_d = 1.0f / sqrt_d;

    float y_hat[TURBOQUANT_MAX_DIM];
    uint8_t indices[TURBOQUANT_MAX_DIM];

    for (int i = 0; i < dim; ++i) {
        // Coordinate normalized to standard normal distribution N(0, 1)
        float u_coord = (y[i] * inv_norm_x) * sqrt_d;
        uint8_t code = quantize_scalar_4bit(u_coord);
        indices[i] = code;
        y_hat[i] = (LLOYD_MAX_4BIT_CENTROIDS[code] * inv_sqrt_d) * norm_x;
    }

    // Pack 4-bit indices (2 per byte)
    int packed_len = dim / 2;
    for (int i = 0; i < packed_len; ++i) {
        out->packed_codes[i] = (indices[2 * i] & 0x0F) | ((indices[2 * i + 1] & 0x0F) << 4);
    }

    // 4. QJL 1-bit Residual Projection
    float res_sum_sq = 0.0f;
    float residual[TURBOQUANT_MAX_DIM];
    for (int i = 0; i < dim; ++i) {
        float r = y[i] - y_hat[i];
        residual[i] = r;
        res_sum_sq += r * r;
    }
    float norm_res = sqrtf(res_sum_sq);
    out->norm_res = norm_res;

    if (norm_res < 1e-12f) return;

    // Fast deterministic pseudo-random projection using LCG bit-flips
    int qjl_words = (dim + 31) / 32;
    for (int w = 0; w < qjl_words; ++w) {
        uint32_t mask = 0;
        int bits_in_word = (dim - w * 32 > 32) ? 32 : (dim - w * 32);

        for (int b = 0; b < bits_in_word; ++b) {
            int row_idx = w * 32 + b;
            uint32_t state = QJL_SEEDS[w % 4] ^ ((uint32_t)row_idx * 0x45D9F3B);
            
            float dot_proj = 0.0f;
            for (int k = 0; k < dim; ++k) {
                state = state * 1103515245U + 12345U;
                int8_t sign = (state & 0x80000000U) ? 1 : -1;
                dot_proj += (float)sign * residual[k];
            }
            if (dot_proj >= 0.0f) {
                mask |= (1U << b);
            }
        }
        out->qjl_mask[w] = mask;
    }
}

void turboquant_dequantize_4bit(const turboquant_payload_t *payload, float *out) {
    if (!payload || !out || payload->dim == 0) return;

    int dim = payload->dim;
    float norm_x = payload->norm_x;
    if (norm_x < 1e-12f) {
        memset(out, 0, dim * sizeof(float));
        return;
    }

    float inv_sqrt_d = 1.0f / sqrtf((float)dim);
    float y_hat[TURBOQUANT_MAX_DIM];

    // Unpack 4-bit codes
    int packed_len = dim / 2;
    for (int i = 0; i < packed_len; ++i) {
        uint8_t byte_val = payload->packed_codes[i];
        uint8_t code_0 = byte_val & 0x0F;
        uint8_t code_1 = (byte_val >> 4) & 0x0F;
        y_hat[2 * i] = (LLOYD_MAX_4BIT_CENTROIDS[code_0] * inv_sqrt_d) * norm_x;
        y_hat[2 * i + 1] = (LLOYD_MAX_4BIT_CENTROIDS[code_1] * inv_sqrt_d) * norm_x;
    }

    // Inverse rotation: FWHT + Rademacher unflip
    turboquant_fwht(y_hat, dim);
    for (int i = 0; i < dim; ++i) {
        out[i] = y_hat[i] * (float)RADEMACHER_SIGNS[i];
    }
}

float turboquant_fast_dot_product(const turboquant_payload_t *a, const turboquant_payload_t *b) {
    if (!a || !b || a->dim != b->dim) return 0.0f;

    float norm_a = a->norm_x;
    float norm_b = b->norm_x;
    if (norm_a < 1e-12f || norm_b < 1e-12f) return 0.0f;

    int dim = a->dim;
    float inv_d = 1.0f / (float)dim;

    // 1. Base Lloyd-Max dot product in rotated coordinate space
    float base_dot = 0.0f;
    int packed_len = dim / 2;
    for (int i = 0; i < packed_len; ++i) {
        uint8_t b_a = a->packed_codes[i];
        uint8_t b_b = b->packed_codes[i];

        uint8_t a0 = b_a & 0x0F;
        uint8_t a1 = (b_a >> 4) & 0x0F;
        uint8_t b0 = b_b & 0x0F;
        uint8_t b1 = (b_b >> 4) & 0x0F;

        base_dot += (LLOYD_MAX_4BIT_CENTROIDS[a0] * LLOYD_MAX_4BIT_CENTROIDS[b0]) +
                    (LLOYD_MAX_4BIT_CENTROIDS[a1] * LLOYD_MAX_4BIT_CENTROIDS[b1]);
    }
    base_dot = (base_dot * inv_d) * (norm_a * norm_b);

    // 2. QJL 1-bit Residual Correction using Bitwise XOR & POPCOUNT
    float res_a = a->norm_res;
    float res_b = b->norm_res;

    if (res_a > 1e-12f && res_b > 1e-12f) {
        int qjl_words = (dim + 31) / 32;
        int total_hamming = 0;
        for (int w = 0; w < qjl_words; ++w) {
            uint32_t xor_diff = a->qjl_mask[w] ^ b->qjl_mask[w];
            total_hamming += TQ_POPCOUNT32(xor_diff);
        }
        float sign_dot = (float)(dim - 2 * total_hamming);
        float qjl_correction = (M_SQRT_PI_2 * (res_a * res_b / (float)dim)) * sign_dot;
        return base_dot + qjl_correction;
    }

    return base_dot;
}

float turboquant_fast_cosine_sim(const turboquant_payload_t *a, const turboquant_payload_t *b) {
    if (!a || !b) return 0.0f;
    float denom = a->norm_x * b->norm_x;
    if (denom < 1e-12f) return 0.0f;
    float dot = turboquant_fast_dot_product(a, b);
    float sim = dot / denom;
    if (sim > 1.0f) sim = 1.0f;
    if (sim < -1.0f) sim = -1.0f;
    return sim;
}

