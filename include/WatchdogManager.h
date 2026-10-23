#pragma once
#include <Arduino.h>
#include "esp_task_wdt.h"
#include "Config.h"

/**
 * @file WatchdogManager.h
 * @brief FreeRTOS Task Watchdog Timer wrapper to prevent silent task hangs.
 */

class WatchdogManager {
public:
    static bool init(uint32_t timeoutSeconds = WATCHDOG_TIMEOUT_SECONDS);
    static bool registerCurrentTask();
    static bool feed();
    static bool unregisterCurrentTask();
};

