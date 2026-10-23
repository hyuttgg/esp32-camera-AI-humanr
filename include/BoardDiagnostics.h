#pragma once
#include <Arduino.h>
#include "esp_system.h"
#include "esp_chip_info.h"
#include "esp_spi_flash.h"
#include "ErrorCodes.h"

/**
 * @file BoardDiagnostics.h
 * @brief Deep hardware and memory diagnostics for ESP32 and external PSRAM.
 */

struct HardwareReport {
    char chipModel[32];
    uint32_t chipRevision;
    uint32_t cpuFreqMhz;
    uint8_t chipCores;
    
    uint32_t flashSizeBytes;
    uint32_t flashSpeedHz;
    char flashMode[8];

    esp_reset_reason_t resetReason;
    const char* resetReasonStr;
    bool brownoutDetected;

    bool psramFound;
    uint32_t psramSizeBytes;
    uint32_t freePsramBytes;
    uint32_t minEverFreePsram;
    bool psramIntegrityPassed;

    uint32_t internalHeapTotal;
    uint32_t internalHeapFree;
    uint32_t minEverFreeHeap;
    uint32_t maxAllocHeap;

    ErrorCode primaryStatus;
};

class BoardDiagnostics {
public:
    static bool runFullDiagnostics(HardwareReport &report);
    static bool testPsramIntegrity(size_t testSizeBytes = 65536);
    static void printReport(const HardwareReport &report);
    static const char* resetReasonToString(esp_reset_reason_t reason);
};

