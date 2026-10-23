#include "CameraManager.h"
#include "DiagnosticLogger.h"

#define TAG "CameraMgr"

CameraManager::CameraManager() 
    : m_psramAvailable(false), m_flashLedPwmInitialized(false) {
    memset(&m_info, 0, sizeof(CameraInfo));
}

CameraManager::~CameraManager() {
    deinit();
}

void CameraManager::setupLeds() {
    // Red Status LED (Active LOW on GPIO 33)
    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_STATUS_LED, HIGH); // Turn OFF initially

    // Flash LED (GPIO 4) PWM setup
    if (!m_flashLedPwmInitialized) {
        ledcSetup(7, 5000, 8); // Channel 7, 5kHz, 8-bit resolution (0-255)
        ledcAttachPin(PIN_FLASH_LED, 7);
        ledcWrite(7, 0); // OFF initially
        m_flashLedPwmInitialized = true;
    }
}

void CameraManager::setFlashLed(uint8_t brightness) {
    if (!m_flashLedPwmInitialized) {
        setupLeds();
    }
    ledcWrite(7, brightness);
}

void CameraManager::setStatusLed(bool on) {
    // Active LOW: LOW = ON, HIGH = OFF
    digitalWrite(PIN_STATUS_LED, on ? LOW : HIGH);
}

ErrorCode CameraManager::init(const FirmwareConfig &cfg, bool psramAvailable) {
    m_activeConfig = cfg;
    m_psramAvailable = psramAvailable;

    setupLeds();

    // Check if camera was already initialized
    if (m_info.initialized) {
        deinit();
        vTaskDelay(pdMS_TO_TICKS(100));
    }

    camera_config_t cam_cfg = buildAiThinkerCameraConfig(m_activeConfig, m_psramAvailable);
    DiagnosticLogger::i(TAG, "Initializing camera: Res=%d, PixFmt=%d, XCLK=%u MHz, PSRAM=%s",
                        cam_cfg.frame_size, cam_cfg.pixel_format,
                        cam_cfg.xclk_freq_hz / 1000000,
                        psramAvailable ? "YES" : "NO");

    esp_err_t err = esp_camera_init(&cam_cfg);
    if (err != ESP_OK) {
        DiagnosticLogger::e(TAG, "esp_camera_init() failed with esp_err: 0x%x (%s)", err, esp_err_to_name(err));
        
        // Attempt Stage 2 Fallback: Lower XCLK to 10MHz for signal line integrity
        if (cam_cfg.xclk_freq_hz > 10000000) {
            DiagnosticLogger::w(TAG, "Attempting Fallback 2: Reducing XCLK to 10MHz...");
            m_activeConfig.xclk_freq_hz = 10000000;
            cam_cfg.xclk_freq_hz = 10000000;
            vTaskDelay(pdMS_TO_TICKS(150));
            err = esp_camera_init(&cam_cfg);
        }

        if (err != ESP_OK) {
            DiagnosticLogger::logError(TAG, ERR_CAM_INIT_FAILED, "Primary and fallback init both failed");
            return ERR_CAM_INIT_FAILED;
        }
    }

    sensor_t *s = esp_camera_sensor_get();
    if (!s) {
        DiagnosticLogger::logError(TAG, ERR_CAM_PROBE_FAILED, "esp_camera_sensor_get() returned NULL");
        esp_camera_deinit();
        return ERR_CAM_PROBE_FAILED;
    }

    m_info.initialized = true;
    m_info.pid = s->id.PID;
    m_info.ver = s->id.VER;
    m_info.frameSize = cfg.frame_size;
    m_info.pixelFormat = cfg.pixel_format;
    m_info.xclkHz = m_activeConfig.xclk_freq_hz;
    m_info.usingPsram = psramAvailable;

    if (s->id.PID == OV2640_PID) {
        snprintf(m_info.sensorName, sizeof(m_info.sensorName), "OmniVision OV2640 (0x%04X)", s->id.PID);
    } else if (s->id.PID == OV3660_PID) {
        snprintf(m_info.sensorName, sizeof(m_info.sensorName), "OmniVision OV3660 (0x%04X)", s->id.PID);
    } else {
        snprintf(m_info.sensorName, sizeof(m_info.sensorName), "Sensor PID: 0x%04X, VER: 0x%02X", s->id.PID, s->id.VER);
    }

    DiagnosticLogger::i(TAG, "Sensor Probed: %s", m_info.sensorName);

    // Apply baseline register calibration
    applySensorTuning(cfg.brightness, cfg.contrast, cfg.auto_exposure_enabled, cfg.auto_white_balance_enabled);

    // Warm up sensor to allow AGC/AEC convergence (critical to prevent initial black frames)
    DiagnosticLogger::i(TAG, "Executing sensor warmup sequence to stabilize AEC/AGC...");
    if (!warmupSensor(12)) {
        DiagnosticLogger::w(TAG, "Sensor warmup captured fewer frames than expected, proceeding with caution.");
    } else {
        DiagnosticLogger::i(TAG, "Sensor warmup complete. AEC/AGC exposure loop stabilized.");
    }

    return APP_OK;
}

ErrorCode CameraManager::applySensorTuning(int8_t brightness, int8_t contrast, bool aec, bool awb) {
    sensor_t *s = esp_camera_sensor_get();
    if (!s) return ERR_CAM_PROBE_FAILED;

    if (s->id.PID == OV3660_PID) {
        // OmniVision OV3660 calibration: well-exposed indoor room, crisp edges, natural skin
        s->set_brightness(s, 1);                                 // Healthy indoor brightness (prevents dark crushing)
        s->set_contrast(s, 1);                                   // Balanced contrast (+1)
        s->set_saturation(s, 0);                                // Neutral saturation (prevents green/purple chroma bleed)
        s->set_sharpness(s, 2);                                 // Hardware ISP edge sharpness (+2 max)
        s->set_denoise(s, 1);                                   // Crisp edge preservation & sensor noise suppression
        s->set_quality(s, 24);                                  // Quality 24: High throughput 30 FPS DMA rate without UART bottleneck
        s->set_special_effect(s, 0);                            // No tint effect
        s->set_whitebal(s, awb ? 1 : 0);                        // Auto White Balance
        s->set_awb_gain(s, 1);
        s->set_wb_mode(s, 0);
        s->set_exposure_ctrl(s, aec ? 1 : 0);                   // Auto Exposure Control
        s->set_gain_ctrl(s, 1);                                 // Auto Gain Control
        s->set_gainceiling(s, GAINCEILING_16X);                 // 16X gain ceiling for bright indoor view
        s->set_aec2(s, 1);                                      // Advanced DSP Auto Exposure 2
        s->set_ae_level(s, 1);                                  // +1 Exposure compensation
        s->set_bpc(s, 1);                                       // Black pixel correction
        s->set_wpc(s, 1);                                       // White pixel correction
        s->set_raw_gma(s, 1);                                   // Gamma correction
        s->set_lenc(s, 1);                                      // Lens shading correction
        s->set_vflip(s, 1);
        s->set_hmirror(s, 0);
    } else {
        // OmniVision OV2640 tuning
        s->set_brightness(s, 1);
        s->set_contrast(s, 1);
        s->set_saturation(s, 0);
        s->set_sharpness(s, 2);                                 // Hardware ISP sharpness boost
        s->set_denoise(s, 1);
        s->set_quality(s, 20);                                  // Quality 20: 30 FPS DMA rate without UART bottleneck
        s->set_special_effect(s, 0);
        s->set_whitebal(s, awb ? 1 : 0);
        s->set_awb_gain(s, 1);
        s->set_wb_mode(s, 0);
        s->set_exposure_ctrl(s, aec ? 1 : 0);
        s->set_gain_ctrl(s, 1);
        s->set_gainceiling(s, GAINCEILING_16X);
        s->set_aec2(s, 1);
        s->set_ae_level(s, 1);
        s->set_bpc(s, 0);
        s->set_wpc(s, 1);
        s->set_raw_gma(s, 1);
        s->set_lenc(s, 1);
        s->set_vflip(s, 1);
        s->set_hmirror(s, 0);
        s->set_dcw(s, 1);
    }

    return APP_OK;
}

bool CameraManager::warmupSensor(uint8_t frameCount) {
    uint8_t successfulWarmups = 0;
    for (uint8_t i = 0; i < frameCount; ++i) {
        camera_fb_t *fb = esp_camera_fb_get();
        if (fb) {
            successfulWarmups++;
            esp_camera_fb_return(fb);
        }
        vTaskDelay(pdMS_TO_TICKS(30)); // 30ms yield between warmup frames
    }
    return (successfulWarmups >= (frameCount / 2));
}

camera_fb_t* CameraManager::captureFrame(uint32_t timeoutMs) {
    if (!m_info.initialized) {
        DiagnosticLogger::e(TAG, "Cannot capture frame: Camera not initialized.");
        FrameBufferManager::recordFailure();
        return nullptr;
    }

    uint32_t startMs = millis();
    setStatusLed(true);

    camera_fb_t *fb = esp_camera_fb_get();

    setStatusLed(false);
    uint32_t elapsedMs = millis() - startMs;

    if (!fb) {
        DiagnosticLogger::logError(TAG, ERR_CAM_FB_NULL, "esp_camera_fb_get() returned NULL");
        FrameBufferManager::recordFailure();
        return nullptr;
    }

    if (fb->len == 0) {
        DiagnosticLogger::logError(TAG, ERR_CAM_FB_EMPTY, "Captured frame has zero bytes");
        esp_camera_fb_return(fb);
        FrameBufferManager::recordFailure();
        return nullptr;
    }

    FrameBufferManager::recordSuccess(elapsedMs);
    return fb;
}

ErrorCode CameraManager::deinit() {
    if (m_info.initialized) {
        esp_camera_deinit();
        m_info.initialized = false;
        DiagnosticLogger::i(TAG, "Camera deinitialized.");
    }
    setFlashLed(0);
    setStatusLed(false);
    return APP_OK;
}

ErrorCode CameraManager::reinitSafeFallback() {
    DiagnosticLogger::w(TAG, "Initiating Safe Fallback re-initialization...");
    deinit();
    vTaskDelay(pdMS_TO_TICKS(300));

    m_activeConfig.xclk_freq_hz = 10000000;
    m_activeConfig.frame_size = FRAMESIZE_96X96;
    m_activeConfig.pixel_format = PIXFORMAT_GRAYSCALE;
    m_activeConfig.fb_count = 1;

    return init(m_activeConfig, false);
}

sensor_t* CameraManager::getSensor() {
    return esp_camera_sensor_get();
}

void CameraManager::hardPowerCycleSensor() {
    DiagnosticLogger::w(TAG, "Hardware power cycling camera sensor via GPIO %d (PWDN)...", CAM_PIN_PWDN);
    pinMode(CAM_PIN_PWDN, OUTPUT);
    digitalWrite(CAM_PIN_PWDN, HIGH); // Assert Power Down (Sensor OFF)
    vTaskDelay(pdMS_TO_TICKS(60));
    digitalWrite(CAM_PIN_PWDN, LOW);  // De-assert Power Down (Sensor ON)
    vTaskDelay(pdMS_TO_TICKS(120));   // Wait for sensor internal oscillator to stabilize
}

