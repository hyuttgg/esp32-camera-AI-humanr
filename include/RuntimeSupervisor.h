#pragma once
#include <Arduino.h>
#include "Config.h"
#include "ErrorCodes.h"
#include "BoardDiagnostics.h"
#include "CameraManager.h"
#include "ImageQualityMonitor.h"
#include "MemoryMonitor.h"
#include "WatchdogManager.h"
#include "ConfigManager.h"
#include "InferenceScheduler.h"
#include "NetworkClient.h"

/**
 * @file RuntimeSupervisor.h
 * @brief Master system coordinator managing state transitions, recovery loops, and execution.
 */

class RuntimeSupervisor {
public:
    RuntimeSupervisor();

    void setup();
    void step();

    SystemState getState() const { return m_state; }
    const char* getStateName() const;

private:
    SystemState m_state;
    FirmwareConfig m_config;
    HardwareReport m_hwReport;
    uint8_t m_recoveryAttempts;
    ErrorCode m_lastError;

    CameraManager m_cameraMgr;
    ImageQualityMonitor m_qualityMon;
    ConfigManager m_configMgr;
    InferenceScheduler m_scheduler;
    NetworkClient m_netClient;

    uint32_t m_lastTelemetryMs;
    uint32_t m_lastHeartbeatMs;
    bool m_streamBinaryFrames;
    bool m_flashActive;
    uint16_t m_frameSeq;

    void processSerialCommands();
    void sendFramePacket(camera_fb_t *fb, const DetectionResult &humanResult, 
                         const DetectionResult &objectResult, bool hasHuman, bool hasObject);

    void transitionTo(SystemState newState);
    void handleHardwareCheck();
    void handleCameraInit();
    void handleCameraTest();
    void handleAiInit();
    void handleRunning();
    void handleError();
    void handleRecovery();
    void handleLimitedMode();

    void printErrorDiagnosis(ErrorCode err);
};

