#include "MemoryMonitor.h"
#include "DiagnosticLogger.h"

#define TAG "MemoryMon"

MemorySnapshot MemoryMonitor::s_bootBaseline = {0, 0, 0, 0, 0};
uint32_t MemoryMonitor::s_lastCheckMs = 0;

void MemoryMonitor::init() {
    s_bootBaseline = captureSnapshot();
    s_lastCheckMs = millis();
    DiagnosticLogger::i(TAG, "Baseline Memory: Internal Free=%u KB, PSRAM Free=%u KB",
                        s_bootBaseline.internalFree / 1024,
                        s_bootBaseline.psramFree / 1024);
}

MemorySnapshot MemoryMonitor::captureSnapshot() {
    MemorySnapshot snap;
    snap.internalFree = ESP.getFreeHeap();
    snap.internalMinEver = ESP.getMinFreeHeap();
    snap.internalMaxBlock = ESP.getMaxAllocHeap();
    snap.psramFree = psramFound() ? ESP.getFreePsram() : 0;
    snap.psramMinEver = psramFound() ? ESP.getMinFreePsram() : 0;
    return snap;
}

void MemoryMonitor::printTelemetry(const char* context) {
    MemorySnapshot s = captureSnapshot();
    if (context) {
        DiagnosticLogger::i(TAG, "[%s] Heap Free: %u KB (Min: %u KB, MaxBlk: %u KB) | PSRAM Free: %u KB",
                            context,
                            s.internalFree / 1024,
                            s.internalMinEver / 1024,
                            s.internalMaxBlock / 1024,
                            s.psramFree / 1024);
    } else {
        DiagnosticLogger::i(TAG, "Heap Free: %u KB (Min: %u KB, MaxBlk: %u KB) | PSRAM Free: %u KB",
                            s.internalFree / 1024,
                            s.internalMinEver / 1024,
                            s.internalMaxBlock / 1024,
                            s.psramFree / 1024);
    }
}

void MemoryMonitor::checkThresholds() {
    uint32_t now = millis();
    if (now - s_lastCheckMs < 2000) return; // Rate limit to every 2 seconds
    s_lastCheckMs = now;

    uint32_t freeHeap = ESP.getFreeHeap();
    if (freeHeap < MIN_SAFE_INTERNAL_HEAP_BYTES) {
        DiagnosticLogger::w(TAG, "DANGER: Internal Heap critically low (%u bytes)! Risk of allocation crash.", freeHeap);
    }

    if (psramFound()) {
        uint32_t freePsram = ESP.getFreePsram();
        if (freePsram < MIN_SAFE_PSRAM_BYTES) {
            DiagnosticLogger::w(TAG, "WARNING: PSRAM critically low (%u bytes)!", freePsram);
        }
    }
}

