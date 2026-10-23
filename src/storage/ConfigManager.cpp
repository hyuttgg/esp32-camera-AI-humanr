#include "ConfigManager.h"
#include "DiagnosticLogger.h"

#define TAG "ConfigMgr"
#define NVS_NAMESPACE "cam_ai"
#define CONFIG_KEY    "sys_cfg"

ConfigManager::ConfigManager() : m_initialized(false) {}

ConfigManager::~ConfigManager() {
    if (m_initialized) {
        m_prefs.end();
    }
}

ErrorCode ConfigManager::init() {
    if (!m_prefs.begin(NVS_NAMESPACE, false)) {
        DiagnosticLogger::e(TAG, "Failed to open NVS namespace: %s", NVS_NAMESPACE);
        return ERR_NVS_OPEN_FAILED;
    }
    m_initialized = true;
    return APP_OK;
}

ErrorCode ConfigManager::loadConfig(FirmwareConfig &cfg) {
    if (!m_initialized) {
        ErrorCode err = init();
        if (err != APP_OK) return err;
    }

    size_t len = m_prefs.getBytesLength(CONFIG_KEY);
    if (len != sizeof(FirmwareConfig)) {
        DiagnosticLogger::w(TAG, "NVS key '%s' not found or size mismatch (%u vs %u). Restoring defaults.",
                            CONFIG_KEY, len, sizeof(FirmwareConfig));
        return resetToDefaults(cfg);
    }

    m_prefs.getBytes(CONFIG_KEY, &cfg, sizeof(FirmwareConfig));

    // Validate magic & version
    if (cfg.magic != 0x43414D31) {
        DiagnosticLogger::e(TAG, "Corrupted config magic: 0x%08X (expected 0x43414D31). Restoring defaults.", cfg.magic);
        return resetToDefaults(cfg);
    }

    if (cfg.version != CONFIG_SCHEMA_VERSION) {
        DiagnosticLogger::w(TAG, "Config version mismatch (%u vs %u). Migrating to defaults.", 
                            cfg.version, CONFIG_SCHEMA_VERSION);
        return resetToDefaults(cfg);
    }

    DiagnosticLogger::i(TAG, "Loaded valid config from NVS (Mode: %d, Res: %d, XCLK: %u MHz)",
                        cfg.op_mode, cfg.frame_size, cfg.xclk_freq_hz / 1000000);
    return APP_OK;
}

ErrorCode ConfigManager::saveConfig(const FirmwareConfig &cfg) {
    if (!m_initialized) {
        ErrorCode err = init();
        if (err != APP_OK) return err;
    }

    size_t written = m_prefs.putBytes(CONFIG_KEY, &cfg, sizeof(FirmwareConfig));
    if (written != sizeof(FirmwareConfig)) {
        DiagnosticLogger::e(TAG, "Failed to write complete config to NVS (%u bytes written)", written);
        return ERR_NVS_WRITE_FAILED;
    }

    DiagnosticLogger::i(TAG, "Successfully committed configuration to NVS (%u bytes).", written);
    return APP_OK;
}

ErrorCode ConfigManager::resetToDefaults(FirmwareConfig &cfg) {
    cfg = getDefaultConfig();
    return saveConfig(cfg);
}

