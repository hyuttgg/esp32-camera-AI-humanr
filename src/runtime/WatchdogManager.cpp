#include "WatchdogManager.h"
#include "DiagnosticLogger.h"

#define TAG "WatchdogMgr"

bool WatchdogManager::init(uint32_t timeoutSeconds) {
    esp_err_t err = esp_task_wdt_init(timeoutSeconds, true);
    if (err == ESP_OK || err == ESP_ERR_INVALID_STATE) {
        // ESP_ERR_INVALID_STATE means TWDT was already initialized by system
        DiagnosticLogger::i(TAG, "Task Watchdog initialized (Timeout: %u seconds).", timeoutSeconds);
        return true;
    }
    DiagnosticLogger::e(TAG, "Failed to initialize Task Watchdog (err: 0x%x).", err);
    return false;
}

bool WatchdogManager::registerCurrentTask() {
    esp_err_t err = esp_task_wdt_add(NULL);
    if (err == ESP_OK || err == ESP_ERR_INVALID_STATE) {
        return true;
    }
    DiagnosticLogger::w(TAG, "esp_task_wdt_add failed (err: 0x%x).", err);
    return false;
}

bool WatchdogManager::feed() {
    esp_err_t err = esp_task_wdt_reset();
    return (err == ESP_OK);
}

bool WatchdogManager::unregisterCurrentTask() {
    esp_err_t err = esp_task_wdt_delete(NULL);
    return (err == ESP_OK);
}

