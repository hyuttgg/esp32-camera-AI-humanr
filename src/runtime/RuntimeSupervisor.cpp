#include "RuntimeSupervisor.h"
#include "DiagnosticLogger.h"
#include "img_converters.h"
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

#define TAG "Supervisor"

#pragma pack(push, 1)
struct FramePacketHeader {
    uint8_t magic[4];      // 0xAA, 0x55, 0xCC, 0x33
    uint16_t width;        // Image width
    uint16_t height;       // Image height
    uint32_t payload_len;  // length of JPEG or RAW payload
    uint8_t format;        // 1 = JPEG, 0 = RAW GRAYSCALE
    uint8_t num_detections;// 0 to 2
    uint16_t frame_seq;    // Frame sequence index
    uint16_t crc16;        // CRC16-CCITT checksum of payload (0 = disabled)
};

struct PacketDetection {
    uint8_t class_id;      // 1: Human, 2: Cell Phone, 3: Handheld Item
    uint8_t confidence;    // 0 - 100%
    uint8_t is_handheld;   // 1 = Held, 0 = Scene item
    uint8_t reserved;
    int16_t x;
    int16_t y;
    int16_t w;
    int16_t h;
    uint16_t track_id;
};
#pragma pack(pop)

static inline uint16_t calculateCRC16(const uint8_t *data, size_t length) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < length; ++i) {
        crc = ((crc >> 8) | (crc << 8)) & 0xFFFF;
        crc ^= data[i];
        crc ^= (crc & 0xFF) >> 4;
        crc ^= (crc << 12) & 0xFFFF;
        crc ^= ((crc & 0xFF) << 5) & 0xFFFF;
    }
    return crc;
}

RuntimeSupervisor::RuntimeSupervisor()
    : m_state(STATE_BOOT), m_recoveryAttempts(0), m_lastError(APP_OK), 
      m_lastTelemetryMs(0), m_lastHeartbeatMs(0), m_streamBinaryFrames(false),
      m_flashActive(false), m_frameSeq(0) {
    m_config = getDefaultConfig();
    memset(&m_hwReport, 0, sizeof(HardwareReport));
}

const char* RuntimeSupervisor::getStateName() const {
    switch (m_state) {
        case STATE_BOOT:           return "STATE_BOOT";
        case STATE_HARDWARE_CHECK: return "STATE_HARDWARE_CHECK";
        case STATE_CAMERA_INIT:    return "STATE_CAMERA_INIT";
        case STATE_CAMERA_TEST:    return "STATE_CAMERA_TEST";
        case STATE_AI_INIT:        return "STATE_AI_INIT";
        case STATE_RUNNING:        return "STATE_RUNNING";
        case STATE_ERROR:          return "STATE_ERROR";
        case STATE_DIAGNOSTICS:    return "STATE_DIAGNOSTICS";
        case STATE_LIMITED_MODE:   return "STATE_LIMITED_MODE";
        case STATE_RECOVERY:       return "STATE_RECOVERY";
        default:                   return "STATE_UNKNOWN";
    }
}

void RuntimeSupervisor::transitionTo(SystemState newState) {
    DiagnosticLogger::i(TAG, "State Transition: [%s] -> [%s]", getStateName(), 
                        (newState == STATE_BOOT ? "BOOT" :
                         newState == STATE_HARDWARE_CHECK ? "HARDWARE_CHECK" :
                         newState == STATE_CAMERA_INIT ? "CAMERA_INIT" :
                         newState == STATE_CAMERA_TEST ? "CAMERA_TEST" :
                         newState == STATE_AI_INIT ? "AI_INIT" :
                         newState == STATE_RUNNING ? "RUNNING" :
                         newState == STATE_ERROR ? "ERROR" :
                         newState == STATE_DIAGNOSTICS ? "DIAGNOSTICS" :
                         newState == STATE_LIMITED_MODE ? "LIMITED_MODE" :
                         newState == STATE_RECOVERY ? "RECOVERY" : "UNKNOWN"));
    m_state = newState;
}

void RuntimeSupervisor::setup() {
    // Disable hardware brownout reset to ensure uninterrupted continuous operation on USB cables and wall adapters
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);
    setCpuFrequencyMhz(160); // 160MHz: 50% less thermal dissipation, maintains 3.3V rail stability indefinitely

    // Cold-boot power rail settling delay for standalone operation (wall adapter / battery)
    pinMode(PIN_STATUS_LED, OUTPUT);
    digitalWrite(PIN_STATUS_LED, LOW); // Red LED ON during initial power rise
    delay(250);
    digitalWrite(PIN_STATUS_LED, HIGH); // Red LED OFF
    delay(150);

    DiagnosticLogger::init(LOG_LEVEL_INFO, 115200);

    DiagnosticLogger::i(TAG, "==========================================================");
    DiagnosticLogger::i(TAG, "   %s v%s (%s)", FIRMWARE_NAME, FIRMWARE_VERSION, FIRMWARE_BUILD_DATE);
    DiagnosticLogger::i(TAG, "   Embedded AI * Camera Diagnostics * Auto-Recovery       ");
    DiagnosticLogger::i(TAG, "==========================================================");

    WatchdogManager::init(WATCHDOG_TIMEOUT_SECONDS);
    WatchdogManager::registerCurrentTask();

    // Initialize Network Client with NVS persistence and Power-Recovery loop
    NetworkConfig netCfg;
    netCfg.wifi_ssid = "khanh2007";
    netCfg.wifi_password = "ocean_secure_pass";
    netCfg.backend_url = "https://esp32-camera-ai-humanr.onrender.com";
    netCfg.device_id = "ESP32-CAM-01";
    netCfg.hmac_secret = "dev_secret_key_change_in_production";
    netCfg.heartbeat_interval_ms = 30000;
    m_netClient.init(netCfg);

    m_lastHeartbeatMs = millis();
    transitionTo(STATE_HARDWARE_CHECK);
}

void RuntimeSupervisor::handleHardwareCheck() {
    BoardDiagnostics::runFullDiagnostics(m_hwReport);
    BoardDiagnostics::printReport(m_hwReport);

    // Initialize Memory Baseline
    MemoryMonitor::init();

    // Load or initialize persistent configuration from NVS
    m_configMgr.init();
    m_configMgr.loadConfig(m_config);

    if (m_hwReport.brownoutDetected) {
        DiagnosticLogger::e(TAG, "Power anomaly recorded: Sensor brownout is imminent without adequate 5V power.");
    }

    transitionTo(STATE_CAMERA_INIT);
}

void RuntimeSupervisor::handleCameraInit() {
    ErrorCode err = m_cameraMgr.init(m_config, m_hwReport.psramFound);
    if (err != APP_OK) {
        m_lastError = err;
        transitionTo(STATE_ERROR);
        return;
    }

    transitionTo(STATE_CAMERA_TEST);
}

void RuntimeSupervisor::handleCameraTest() {
    uint16_t testFrames = (m_config.op_mode == MODE_CAMERA_DIAGNOSTIC_ONLY) ? 100 : 20;
    DiagnosticLogger::i(TAG, "Starting camera stability test (%u frames)...", testFrames);

    m_qualityMon.resetStats();
    FrameBufferManager::resetStats();

    MemorySnapshot memBefore = MemoryMonitor::captureSnapshot();
    uint32_t validDmaFrames = 0;
    uint32_t darkFrames = 0;
    uint32_t failFrames = 0;

    for (uint16_t i = 1; i <= testFrames; ++i) {
        WatchdogManager::feed();

        // If first 15 frames are completely dark (<5 lum), pulse flash LED gently (PWM 25/255)
        if (i == 16 && darkFrames >= 14) {
            DiagnosticLogger::i(TAG, "Low ambient light detected; activating Flash LED (Level 25) for optical test...");
            m_cameraMgr.setFlashLed(25);
        }

        camera_fb_t *fb = m_cameraMgr.captureFrame();
        if (!fb) {
            failFrames++;
            continue;
        }

        FrameBufferGuard guard(fb);
        ImageMetrics metrics = m_qualityMon.analyzeFrame(fb);

        if (!metrics.isCorrupted) {
            validDmaFrames++;
        }
        if (metrics.isBlackScreen) {
            darkFrames++;
        }

        if (i % 20 == 0 || i == testFrames) {
            DiagnosticLogger::i(TAG, "Test Progress: %u/%u frames (DMA Valid: %u, Dark: %u, Fail: %u, Mean Lum: %.1f)",
                                i, testFrames, validDmaFrames, darkFrames, failFrames, metrics.meanLuminance);
        }

        vTaskDelay(pdMS_TO_TICKS(15));
    }

    // Turn off Flash LED after test
    m_cameraMgr.setFlashLed(0);

    MemorySnapshot memAfter = MemoryMonitor::captureSnapshot();
    int32_t heapDelta = MemoryMonitor::compareSnapshotsInternal(memBefore, memAfter);

    DiagnosticLogger::i(TAG, "Stability Test Results:");
    DiagnosticLogger::i(TAG, "  DMA Valid Frames : %u / %u", validDmaFrames, testFrames);
    DiagnosticLogger::i(TAG, "  Dark / Low Lum   : %u", darkFrames);
    DiagnosticLogger::i(TAG, "  Failed Grabs     : %u", failFrames);
    DiagnosticLogger::i(TAG, "  Heap Delta       : %+d bytes (Leak Check)", heapDelta);

    if (validDmaFrames >= (testFrames * 80) / 100) {
        DiagnosticLogger::i(TAG, ">>> CAMERA_READY: Camera sensor passed stability verification! <<<");
        if (darkFrames > (testFrames * 60) / 100) {
            DiagnosticLogger::w(TAG, "NOTE: Frames have low luminance (Mean < 12.0). Ensure lens cap is removed and camera faces light.");
        }

        // Standalone optical confirmation: gentle pulse on Flash LED + double blink on Red LED
        m_cameraMgr.setFlashLed(20);
        digitalWrite(PIN_STATUS_LED, LOW);
        vTaskDelay(pdMS_TO_TICKS(100));
        m_cameraMgr.setFlashLed(0);
        digitalWrite(PIN_STATUS_LED, HIGH);
        vTaskDelay(pdMS_TO_TICKS(100));
        digitalWrite(PIN_STATUS_LED, LOW);
        vTaskDelay(pdMS_TO_TICKS(100));
        digitalWrite(PIN_STATUS_LED, HIGH);
        
        if (m_config.op_mode == MODE_CAMERA_DIAGNOSTIC_ONLY) {
            transitionTo(STATE_DIAGNOSTICS);
        } else {
            transitionTo(STATE_AI_INIT);
        }
    } else {
        DiagnosticLogger::e(TAG, "Camera stability test failed! DMA transfer failure.");
        m_lastError = ERR_CAM_FB_NULL;
        transitionTo(STATE_ERROR);
    }
}

void RuntimeSupervisor::handleAiInit() {
    ErrorCode err = m_scheduler.init(m_config.op_mode, m_config.confidence_threshold);
    if (err != APP_OK) {
        DiagnosticLogger::w(TAG, "AI initialization failed (%s). Falling back to LIMITED_MODE.", errorToString(err));
        m_lastError = err;
        transitionTo(STATE_LIMITED_MODE);
        return;
    }

    DiagnosticLogger::i(TAG, "AI Subsystems initialized successfully. Entering RUNNING state.");
    transitionTo(STATE_RUNNING);
}

void RuntimeSupervisor::processSerialCommands() {
    while (Serial.available() > 0) {
        int pk = Serial.peek();
        if (pk == 13 || pk == 10 || pk == 32) {
            Serial.read();
            continue;
        }
        if (pk == 'S' || pk == 'P' || pk == 'F') {
            String line = Serial.readStringUntil((char)10);
            line.trim();
            if (line.startsWith("SET_WIFI:") || line.startsWith("PROV:") ||
                line.startsWith("SET_EI_CONFIG:") || line.startsWith("FLASH_VERIFY")) {
                m_netClient.handleSerialLine(line);
                continue;
            }
            if (line.length() == 0) continue;
            char c0 = line.charAt(0);
            if (c0 == 'S') {
                m_streamBinaryFrames = true;
            } else if (c0 == 'F') {
                static bool flashState = false;
                flashState = !flashState;
                m_cameraMgr.setFlashLed(flashState ? 45 : 0);
            }
            continue;
        }
        char c = (char)Serial.read();
        if (c == 'V' || c == 'v' || c == 's') { // Stream Video
            m_streamBinaryFrames = true;
        } else if (c == 'X' || c == 'x' || c == 'Q' || c == 'q') { // Stop Video
            m_streamBinaryFrames = false;
        } else if (c == 'f') { // Toggle Flash LED
            static bool flashState = false;
            flashState = !flashState;
            m_cameraMgr.setFlashLed(flashState ? 45 : 0);
        } else if (c == 'O' || c == 'o') { // Force Flash ON
            m_cameraMgr.setFlashLed(45);
        } else if (c == 'K' || c == 'k') { // Force Flash OFF
            m_cameraMgr.setFlashLed(0);
        } else if (c == '1') { // 320x240 QVGA (Native 30 FPS)
            sensor_t *s = esp_camera_sensor_get();
            if (s) {
                s->set_framesize(s, FRAMESIZE_QVGA);
                s->set_quality(s, 24);
            }
        } else if (c == '2') { // 480x320 HVGA (16 FPS)
            sensor_t *s = esp_camera_sensor_get();
            if (s) {
                s->set_framesize(s, FRAMESIZE_HVGA);
                s->set_quality(s, 22);
            }
        } else if (c == '3') { // 640x480 VGA (10 FPS)
            sensor_t *s = esp_camera_sensor_get();
            if (s) {
                s->set_framesize(s, FRAMESIZE_VGA);
                s->set_quality(s, 25);
            }
        }
    }
}

void RuntimeSupervisor::sendFramePacket(camera_fb_t *fb, const DetectionResult &humanResult, 
                                        const DetectionResult &objectResult, bool hasHuman, bool hasObject) {
    if (!fb || !m_streamBinaryFrames) return;

    uint8_t *payload = nullptr;
    size_t payload_len = 0;
    bool free_payload = false;
    uint8_t format_code = 0;

    // Fast path: If camera already provides hardware JPEG from sensor ISP, stream directly with 0% CPU load!
    if (fb->format == PIXFORMAT_JPEG) {
        payload = fb->buf;
        payload_len = fb->len;
        free_payload = false;
        format_code = 1;
    } else {
        uint8_t *jpg_buf = nullptr;
        size_t jpg_len = 0;
        if (frame2jpg(fb, 35, &jpg_buf, &jpg_len)) {
            payload = jpg_buf;
            payload_len = jpg_len;
            free_payload = true;
            format_code = 1;
        } else {
            payload = fb->buf;
            payload_len = fb->len;
            free_payload = false;
            format_code = 0;
        }
    }

    FramePacketHeader header;
    header.magic[0] = 0xAA;
    header.magic[1] = 0x55;
    header.magic[2] = 0xCC;
    header.magic[3] = 0x33;
    header.width = fb->width;
    header.height = fb->height;
    header.payload_len = (uint32_t)payload_len;
    header.format = format_code;
    header.num_detections = 0;
    header.frame_seq = ++m_frameSeq;
    header.crc16 = calculateCRC16(payload, payload_len);

    PacketDetection detections[2];
    if (hasHuman && humanResult.confidence >= m_config.confidence_threshold) {
        PacketDetection &d = detections[header.num_detections++];
        d.class_id = 1; // Human
        d.confidence = (uint8_t)(humanResult.confidence * 100.0f);
        d.is_handheld = 0;
        d.reserved = 0;
        // Direct full-resolution box coordinates (already mapped to fb->width and fb->height)
        d.x = humanResult.box.x;
        d.y = humanResult.box.y;
        d.w = humanResult.box.w;
        d.h = humanResult.box.h;
        d.track_id = (uint16_t)humanResult.trackId;
    }

    if (hasObject && objectResult.confidence >= m_config.confidence_threshold) {
        PacketDetection &d = detections[header.num_detections++];
        d.class_id = (strcmp(objectResult.className, "Cell Phone") == 0) ? 2 : 3;
        d.confidence = (uint8_t)(objectResult.confidence * 100.0f);
        d.is_handheld = objectResult.isHandheld ? 1 : 0;
        d.reserved = 0;
        d.x = objectResult.box.x;
        d.y = objectResult.box.y;
        d.w = objectResult.box.w;
        d.h = objectResult.box.h;
        d.track_id = (uint16_t)objectResult.trackId;
    }

    // Atomic UART transmission protected by logger mutex
    DiagnosticLogger::lock();
    Serial.write((const uint8_t*)&header, sizeof(header));
    if (header.num_detections > 0) {
        Serial.write((const uint8_t*)detections, sizeof(PacketDetection) * header.num_detections);
    }
    size_t written = 0;
    while (written < payload_len) {
        size_t toWrite = payload_len - written;
        if (toWrite > 512) toWrite = 512;
        size_t n = Serial.write(payload + written, toWrite);
        if (n == 0) {
            vTaskDelay(pdMS_TO_TICKS(1));
        } else {
            written += n;
        }
    }
    const uint8_t footer[2] = { 0x55, 0xAA };
    Serial.write(footer, 2);
    DiagnosticLogger::unlock();

    if (free_payload && payload) {
        free(payload);
    }
}

void RuntimeSupervisor::handleRunning() {
    processSerialCommands();
    MemoryMonitor::checkThresholds();

    camera_fb_t *fb = m_cameraMgr.captureFrame();
    if (!fb) {
        static uint16_t consecutiveNullFrames = 0;
        consecutiveNullFrames++;
        if (consecutiveNullFrames == 6) {
            DiagnosticLogger::w(TAG, "Camera capture stalled (%u frames)! Power cycling sensor via PWDN...", consecutiveNullFrames);
            m_cameraMgr.deinit();
            m_cameraMgr.hardPowerCycleSensor();
            m_cameraMgr.init(m_config, m_hwReport.psramFound);
        } else if (consecutiveNullFrames >= 25) {
            DiagnosticLogger::e(TAG, "Camera failed %u times consecutively! Triggering clean system reboot...", consecutiveNullFrames);
            ESP.restart();
        }
        vTaskDelay(pdMS_TO_TICKS(40));
        return;
    }
    WatchdogManager::feed(); // ONLY feed watchdog when camera actually captures valid frames!

    FrameBufferGuard guard(fb);
    ImageMetrics metrics = m_qualityMon.analyzeFrame(fb);

    if (!m_streamBinaryFrames && metrics.isBlackScreen && m_qualityMon.getConsecutiveBlackFrames() >= MAX_CONSECUTIVE_BLACK_FRAMES) {
        DiagnosticLogger::w(TAG, "Persistent Black Screen detected (%u frames)! Checking sensor/lighting...", 
                            m_qualityMon.getConsecutiveBlackFrames());
    }

    DetectionResult humanResult;
    DetectionResult objectResult;
    bool hasHuman = false;
    bool hasObject = false;

    m_scheduler.processFrame(fb, humanResult, objectResult, hasHuman, hasObject, m_streamBinaryFrames);

    // Stream binary frame packet if viewer requested it
    if (m_streamBinaryFrames) {
        sendFramePacket(fb, humanResult, objectResult, hasHuman, hasObject);
    }

    uint32_t now = millis();
    static uint32_t lastDetectionLogMs = 0;

    // Output confirmed detections via Serial text only when binary streaming is idle
    if (!m_streamBinaryFrames && now - lastDetectionLogMs >= 350) {
        bool logged = false;
        if (hasHuman && humanResult.confidence >= m_config.confidence_threshold) {
            DiagnosticLogger::i(TAG, "[PHAT HIEN: 1 NGUOI] Conf: %3.0f%% | Box: [%d, %d, %d, %d] | TrackID: #%u | Latency: %u ms",
                                humanResult.confidence * 100.0f,
                                humanResult.box.x, humanResult.box.y, humanResult.box.w, humanResult.box.h,
                                humanResult.trackId,
                                humanResult.inferenceTimeMs);
            logged = true;
        }

        if (hasObject && objectResult.confidence >= m_config.confidence_threshold) {
            DiagnosticLogger::i(TAG, "[DETECTION] Class: %s | Conf: %3.0f%% | Box: [%d, %d, %d, %d] | Held: %s | TrackID: #%u | Latency: %u ms",
                                objectResult.className,
                                objectResult.confidence * 100.0f,
                                objectResult.box.x, objectResult.box.y, objectResult.box.w, objectResult.box.h,
                                objectResult.isHandheld ? "YES (Visual Evidence)" : "NO (Scene Item)",
                                objectResult.trackId,
                                objectResult.inferenceTimeMs);
            logged = true;
        }
        if (logged) {
            lastDetectionLogMs = now;
        }
    }

    // Periodic telemetry every 3 seconds (ONLY when not actively streaming video binary packets)
    if (!m_streamBinaryFrames && now - m_lastTelemetryMs >= 3000) {
        m_lastTelemetryMs = now;
        PipelineMetrics pMet = m_scheduler.getMetrics();
        FrameStats fStats = FrameBufferManager::getStats();
        DiagnosticLogger::i(TAG, "[TELEMETRY] FPS: %.1f | Avg Infer: %u ms | Heap Free: %u KB | Frames: %u (Drops: %u)",
                            pMet.actualFps, pMet.avgInferenceLatencyMs,
                            ESP.getFreeHeap() / 1024,
                            fStats.totalCaptured, fStats.totalDropped);
    }

    // Standalone visual feedback (Red Status LED on GPIO 33):
    if (hasHuman || hasObject) {
        digitalWrite(PIN_STATUS_LED, LOW); // LED ON when human or object detected
    } else {
        // Heartbeat: 40ms pulse every 1.5s to show standalone system is running normally
        if (now - m_lastHeartbeatMs >= 1500) {
            m_lastHeartbeatMs = now;
            digitalWrite(PIN_STATUS_LED, LOW); // ON
        } else if (now - m_lastHeartbeatMs > 40) {
            digitalWrite(PIN_STATUS_LED, HIGH); // OFF
        }
    }

    // Dynamic pacing: taskYIELD() when video streaming to PC for 30+ FPS, inference_interval_ms when standalone
    if (m_streamBinaryFrames) {
        taskYIELD();
    } else {
        // Upload frame to Ocean Vision backend if human detected or every 6s
        static uint32_t lastUploadTime = 0;
        if (lastUploadTime == 0 || (hasHuman && now - lastUploadTime >= 2000) || (now - lastUploadTime >= 6000)) {
            WatchdogManager::feed();
            if (fb->format == PIXFORMAT_JPEG) {
                m_netClient.uploadFrame(fb->buf, fb->len, fb->width, fb->height, hasHuman, humanResult.confidence, metrics.isBlackScreen);
                lastUploadTime = now;
            } else {
                uint8_t *jpg_buf = nullptr;
                size_t jpg_len = 0;
                if (frame2jpg(fb, 30, &jpg_buf, &jpg_len) && jpg_buf) {
                    m_netClient.uploadFrame(jpg_buf, jpg_len, fb->width, fb->height, hasHuman, humanResult.confidence, metrics.isBlackScreen);
                    free(jpg_buf);
                    lastUploadTime = now;
                }
            }
            WatchdogManager::feed();
        }
        vTaskDelay(pdMS_TO_TICKS(m_config.inference_interval_ms > 0 ? m_config.inference_interval_ms : 1));
    }
}

void RuntimeSupervisor::printErrorDiagnosis(ErrorCode err) {
    DiagnosticLogger::e(TAG, "==========================================================");
    DiagnosticLogger::e(TAG, "              FAULT DIAGNOSIS & ACTION PLAN               ");
    DiagnosticLogger::e(TAG, "==========================================================");
    DiagnosticLogger::e(TAG, "Fault Code: %d (%s)", err, errorToString(err));

    switch (err) {
        case ERR_CAM_INIT_FAILED:
        case ERR_CAM_PROBE_FAILED:
            DiagnosticLogger::e(TAG, "CAUSE: Camera ribbon cable loose, flipped, or pin conflict.");
            DiagnosticLogger::e(TAG, "ACTION: 1. Disconnect USB power.");
            DiagnosticLogger::e(TAG, "        2. Unlatch FPC connector and re-seat OV2640 ribbon firmly.");
            DiagnosticLogger::e(TAG, "        3. Ensure 5V pin receives at least 5.0V @ 1.5A.");
            break;

        case ERR_IMG_TOO_DARK_BLACK:
            DiagnosticLogger::e(TAG, "CAUSE: Sensor lens cap on, AGC/AEC underexposed, or 3.3V rail dipped.");
            DiagnosticLogger::e(TAG, "ACTION: 1. Verify lens protective film/cap is removed.");
            DiagnosticLogger::e(TAG, "        2. Point sensor toward a well-lit environment.");
            DiagnosticLogger::e(TAG, "        3. Add a 470uF electrolytic capacitor across 5V and GND.");
            break;

        case ERR_PSRAM_NOT_FOUND:
        case ERR_PSRAM_INTEGRITY_FAIL:
            DiagnosticLogger::e(TAG, "CAUSE: External PSRAM chip missing or strapping pin issue.");
            DiagnosticLogger::e(TAG, "ACTION: Operating will continue using internal DRAM only with lower resolution.");
            break;

        case ERR_BROWNOUT_DETECTED:
            DiagnosticLogger::e(TAG, "CAUSE: High peak current during camera init caused voltage sag < 2.8V.");
            DiagnosticLogger::e(TAG, "ACTION: Use a powered USB hub or dedicated 5V 2A external power supply.");
            break;

        default:
            DiagnosticLogger::e(TAG, "ACTION: Review log details above and restart in diagnostic mode.");
            break;
    }
    DiagnosticLogger::e(TAG, "==========================================================");
}

void RuntimeSupervisor::handleError() {
    printErrorDiagnosis(m_lastError);

    if (m_recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
        m_recoveryAttempts++;
        DiagnosticLogger::w(TAG, "Initiating Automatic Recovery Attempt %u of %u...", 
                            m_recoveryAttempts, MAX_RECOVERY_ATTEMPTS);
        transitionTo(STATE_RECOVERY);
    } else {
        DiagnosticLogger::e(TAG, "Maximum recovery attempts exceeded (%u). HALTING auto-reset.", MAX_RECOVERY_ATTEMPTS);
        DiagnosticLogger::e(TAG, "Switching to LIMITED_MODE to preserve Serial Monitor diagnostics.");
        transitionTo(STATE_LIMITED_MODE);
    }
}

void RuntimeSupervisor::handleRecovery() {
    vTaskDelay(pdMS_TO_TICKS(500));
    ErrorCode err = m_cameraMgr.reinitSafeFallback();
    if (err == APP_OK) {
        DiagnosticLogger::i(TAG, "Recovery re-initialization succeeded with safe fallback parameters!");
        transitionTo(STATE_CAMERA_TEST);
    } else {
        m_lastError = err;
        transitionTo(STATE_ERROR);
    }
}

void RuntimeSupervisor::handleLimitedMode() {
    // Keep device alive for diagnostic inspection without resetting
    WatchdogManager::feed();
    // Visual fault indication: toggle status LED every 500ms
    digitalWrite(PIN_STATUS_LED, ((millis() / 500) % 2 == 0) ? LOW : HIGH);
    DiagnosticLogger::logRateLimited(5000, LOG_LEVEL_WARN, TAG, 
        "Device in LIMITED DIAGNOSTIC MODE. System halted for inspection. Send reset command to retry.");
    vTaskDelay(pdMS_TO_TICKS(100));
}

void RuntimeSupervisor::step() {
    WatchdogManager::feed();
    processSerialCommands();
    m_netClient.update();
    switch (m_state) {
        case STATE_HARDWARE_CHECK: handleHardwareCheck(); break;
        case STATE_CAMERA_INIT:    handleCameraInit();    break;
        case STATE_CAMERA_TEST:    handleCameraTest();    break;
        case STATE_AI_INIT:        handleAiInit();        break;
        case STATE_RUNNING:        handleRunning();       break;
        case STATE_ERROR:          handleError();         break;
        case STATE_RECOVERY:       handleRecovery();      break;
        case STATE_LIMITED_MODE:   handleLimitedMode();   break;
        case STATE_DIAGNOSTICS: {
            // Continuous diagnostic capture
            WatchdogManager::feed();
            camera_fb_t *fb = m_cameraMgr.captureFrame();
            if (fb) {
                FrameBufferGuard guard(fb);
                ImageMetrics m = m_qualityMon.analyzeFrame(fb);
                DiagnosticLogger::logRateLimited(2000, LOG_LEVEL_INFO, TAG, 
                    "[DIAG MONITOR] Lum: %.1f (Min:%u, Max:%u, Var:%.1f) | Quality: %s | Consecutive Black: %u",
                    m.meanLuminance, m.minPixel, m.maxPixel, m.variance,
                    errorToString(m.qualityCode), m_qualityMon.getConsecutiveBlackFrames());
            }
            vTaskDelay(pdMS_TO_TICKS(50));
            break;
        }
        default:
            vTaskDelay(pdMS_TO_TICKS(100));
            break;
    }
}
