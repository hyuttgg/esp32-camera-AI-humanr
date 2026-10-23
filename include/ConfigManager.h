#pragma once
#include <Arduino.h>
#include <Preferences.h>
#include "Config.h"
#include "ErrorCodes.h"

/**
 * @file ConfigManager.h
 * @brief NVS persistent configuration storage with schema versioning and validation.
 */

class ConfigManager {
public:
    ConfigManager();
    ~ConfigManager();

    ErrorCode init();
    ErrorCode loadConfig(FirmwareConfig &cfg);
    ErrorCode saveConfig(const FirmwareConfig &cfg);
    ErrorCode resetToDefaults(FirmwareConfig &cfg);

private:
    Preferences m_prefs;
    bool m_initialized;
};

