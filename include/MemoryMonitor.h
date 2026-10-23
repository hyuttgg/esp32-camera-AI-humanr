#pragma once
#include <Arduino.h>
#include "Config.h"

/**
 * @file MemoryMonitor.h
 * @brief Dynamic heap and PSRAM tracking, watermark alerts, and leak detection.
 */

struct MemorySnapshot {
    uint32_t internalFree;
    uint32_t internalMinEver;
    uint32_t internalMaxBlock;
    uint32_t psramFree;
    uint32_t psramMinEver;
};

class MemoryMonitor {
public:
    static void init();
    static MemorySnapshot captureSnapshot();
    static void printTelemetry(const char* context = nullptr);
    static void checkThresholds();

    static int32_t compareSnapshotsInternal(const MemorySnapshot &before, const MemorySnapshot &after) {
        return (int32_t)after.internalFree - (int32_t)before.internalFree;
    }
    static int32_t compareSnapshotsPsram(const MemorySnapshot &before, const MemorySnapshot &after) {
        return (int32_t)after.psramFree - (int32_t)before.psramFree;
    }

private:
    static MemorySnapshot s_bootBaseline;
    static uint32_t s_lastCheckMs;
};

