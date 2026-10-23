#include "BoardDiagnostics.h"
#include "DiagnosticLogger.h"
#include <esp_heap_caps.h>

#define TAG "BoardDiag"

const char* BoardDiagnostics::resetReasonToString(esp_reset_reason_t reason) {
    switch (reason) {
        case ESP_RST_UNKNOWN:   return "Unknown reset reason";
        case ESP_RST_POWERON:   return "Power-on event / cold boot";
        case ESP_RST_EXT:       return "External pin reset (EN button or reset circuit)";
        case ESP_RST_SW:        return "Software reset via esp_restart()";
        case ESP_RST_PANIC:     return "Software panic / unhandled exception";
        case ESP_RST_INT_WDT:   return "Interrupt watchdog reset";
        case ESP_RST_TASK_WDT:  return "Task watchdog reset (TWDT)";
        case ESP_RST_WDT:       return "Other watchdog reset";
        case ESP_RST_DEEPSLEEP: return "Wakeup from deep sleep";
        case ESP_RST_BROWNOUT:  return "BROWNOUT RESET: Supply voltage dropped below brownout threshold!";
        case ESP_RST_SDIO:      return "Reset over SDIO";
        default:                return "Unrecognized reset code";
    }
}

bool BoardDiagnostics::testPsramIntegrity(size_t testSizeBytes) {
    if (!psramFound()) {
        DiagnosticLogger::w(TAG, "Cannot test PSRAM: psramFound() returned false.");
        return false;
    }

    uint8_t* buffer = (uint8_t*)heap_caps_malloc(testSizeBytes, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!buffer) {
        DiagnosticLogger::e(TAG, "Failed to allocate %u bytes in PSRAM for integrity test.", testSizeBytes);
        return false;
    }

    bool passed = true;

    // Pattern 1: Alternating 0xAA (10101010)
    memset(buffer, 0xAA, testSizeBytes);
    for (size_t i = 0; i < testSizeBytes; ++i) {
        if (buffer[i] != 0xAA) {
            DiagnosticLogger::e(TAG, "PSRAM pattern 0xAA failed at index %u (read 0x%02X)", i, buffer[i]);
            passed = false;
            break;
        }
    }

    // Pattern 2: Alternating 0x55 (01010101)
    if (passed) {
        memset(buffer, 0x55, testSizeBytes);
        for (size_t i = 0; i < testSizeBytes; ++i) {
            if (buffer[i] != 0x55) {
                DiagnosticLogger::e(TAG, "PSRAM pattern 0x55 failed at index %u (read 0x%02X)", i, buffer[i]);
                passed = false;
                break;
            }
        }
    }

    // Pattern 3: Walking address hash
    if (passed) {
        for (size_t i = 0; i < testSizeBytes; ++i) {
            buffer[i] = (uint8_t)((i ^ (i >> 8)) & 0xFF);
        }
        for (size_t i = 0; i < testSizeBytes; ++i) {
            uint8_t expected = (uint8_t)((i ^ (i >> 8)) & 0xFF);
            if (buffer[i] != expected) {
                DiagnosticLogger::e(TAG, "PSRAM walking hash failed at index %u (expected 0x%02X, read 0x%02X)",
                                   i, expected, buffer[i]);
                passed = false;
                break;
            }
        }
    }

    free(buffer);
    return passed;
}

bool BoardDiagnostics::runFullDiagnostics(HardwareReport &report) {
    memset(&report, 0, sizeof(HardwareReport));

    // 1. Chip Info
    esp_chip_info_t chip_info;
    esp_chip_info(&chip_info);
    
    snprintf(report.chipModel, sizeof(report.chipModel), "ESP32 (Model %d)", chip_info.model);
    report.chipRevision = chip_info.revision;
    report.chipCores = chip_info.cores;
    report.cpuFreqMhz = ESP.getCpuFreqMHz();

    // 2. Flash Info
    report.flashSizeBytes = ESP.getFlashChipSize();
    report.flashSpeedHz = ESP.getFlashChipSpeed();
    FlashMode_t mode = ESP.getFlashChipMode();
    switch (mode) {
        case FM_QIO:  strcpy(report.flashMode, "QIO"); break;
        case FM_QOUT: strcpy(report.flashMode, "QOUT"); break;
        case FM_DIO:  strcpy(report.flashMode, "DIO"); break;
        case FM_DOUT: strcpy(report.flashMode, "DOUT"); break;
        default:      strcpy(report.flashMode, "UNKNOWN"); break;
    }

    // 3. Reset Reason & Brownout Check
    report.resetReason = esp_reset_reason();
    report.resetReasonStr = resetReasonToString(report.resetReason);
    report.brownoutDetected = (report.resetReason == ESP_RST_BROWNOUT);

    // 4. PSRAM Verification
    report.psramFound = psramFound();
    if (report.psramFound) {
        report.psramSizeBytes = ESP.getPsramSize();
        report.freePsramBytes = ESP.getFreePsram();
        report.minEverFreePsram = ESP.getMinFreePsram();
        report.psramIntegrityPassed = testPsramIntegrity(65536);
    } else {
        report.psramSizeBytes = 0;
        report.freePsramBytes = 0;
        report.minEverFreePsram = 0;
        report.psramIntegrityPassed = false;
    }

    // 5. Internal DRAM Heap
    report.internalHeapTotal = ESP.getHeapSize();
    report.internalHeapFree = ESP.getFreeHeap();
    report.minEverFreeHeap = ESP.getMinFreeHeap();
    report.maxAllocHeap = ESP.getMaxAllocHeap();

    // 6. Primary Status Determination
    if (report.brownoutDetected) {
        report.primaryStatus = ERR_BROWNOUT_DETECTED;
    } else if (report.flashSizeBytes < 4 * 1024 * 1024) {
        report.primaryStatus = ERR_HW_FLASH_TOO_SMALL;
    } else if (!report.psramFound) {
        report.primaryStatus = ERR_PSRAM_NOT_FOUND;
    } else if (!report.psramIntegrityPassed) {
        report.primaryStatus = ERR_PSRAM_INTEGRITY_FAIL;
    } else if (report.internalHeapFree < 30000) {
        report.primaryStatus = ERR_HEAP_LOW;
    } else {
        report.primaryStatus = APP_OK;
    }

    return (report.primaryStatus == APP_OK);
}

void BoardDiagnostics::printReport(const HardwareReport &report) {
    DiagnosticLogger::i(TAG, "==========================================================");
    DiagnosticLogger::i(TAG, "            ESP32-CAM HARDWARE AUDIT REPORT               ");
    DiagnosticLogger::i(TAG, "==========================================================");
    DiagnosticLogger::i(TAG, "Chip Architecture : %s, Rev %u, %u Cores @ %u MHz", 
                        report.chipModel, report.chipRevision, report.chipCores, report.cpuFreqMhz);
    DiagnosticLogger::i(TAG, "Flash Memory      : %u MB, Speed %u MHz, Mode: %s", 
                        report.flashSizeBytes / (1024 * 1024), report.flashSpeedHz / 1000000, report.flashMode);
    
    if (report.brownoutDetected) {
        DiagnosticLogger::e(TAG, "RESET REASON      : %s", report.resetReasonStr);
        DiagnosticLogger::e(TAG, ">>> CRITICAL WARNING: Brownout reset detected! Your 5V/3.3V rail dipped!");
        DiagnosticLogger::e(TAG, ">>> Check USB cable, power supply (needs >= 1.5A), and decoupling capacitor.");
    } else {
        DiagnosticLogger::i(TAG, "Reset Reason      : %s", report.resetReasonStr);
    }

    if (report.psramFound) {
        DiagnosticLogger::i(TAG, "PSRAM Status      : DETECTED (%u KB Total, %u KB Free)",
                            report.psramSizeBytes / 1024, report.freePsramBytes / 1024);
        DiagnosticLogger::i(TAG, "PSRAM Integrity   : %s", 
                            report.psramIntegrityPassed ? "PASSED (64KB memory test verified)" : "FAILED (Bit corruptions detected!)");
    } else {
        DiagnosticLogger::w(TAG, "PSRAM Status      : NOT DETECTED! Frame buffering limited to internal DRAM.");
        DiagnosticLogger::w(TAG, ">>> If board has PSRAM, check build flags (-DBOARD_HAS_PSRAM) and strapping pins.");
    }

    DiagnosticLogger::i(TAG, "Internal Heap     : %u KB Total, %u KB Free, Min Free: %u KB, Max Block: %u KB",
                        report.internalHeapTotal / 1024, report.internalHeapFree / 1024,
                        report.minEverFreeHeap / 1024, report.maxAllocHeap / 1024);
    DiagnosticLogger::i(TAG, "Status Summary    : %s", errorToString(report.primaryStatus));
    DiagnosticLogger::i(TAG, "==========================================================");
}

