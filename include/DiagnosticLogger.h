#pragma once
#include <Arduino.h>
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "ErrorCodes.h"

/**
 * @file DiagnosticLogger.h
 * @brief Thread-safe, leveled logger using FreeRTOS mutexes (no interrupt blocking).
 */

enum LogLevel : uint8_t {
    LOG_LEVEL_VERBOSE = 0,
    LOG_LEVEL_DEBUG   = 1,
    LOG_LEVEL_INFO    = 2,
    LOG_LEVEL_WARN    = 3,
    LOG_LEVEL_ERROR   = 4,
    LOG_LEVEL_FATAL   = 5,
    LOG_LEVEL_NONE    = 6
};

class DiagnosticLogger {
public:
    static void init(LogLevel minLevel = LOG_LEVEL_INFO, uint32_t baudRate = 115200);
    static void setMinLevel(LogLevel level);
    static LogLevel getMinLevel();

    static void log(LogLevel level, const char* tag, const char* format, ...) __attribute__((format(printf, 3, 4)));
    static void logError(const char* tag, ErrorCode err, const char* context = nullptr);
    static void logRateLimited(uint32_t intervalMs, LogLevel level, const char* tag, const char* format, ...) __attribute__((format(printf, 4, 5)));

    static void lock();
    static void unlock();

    static void v(const char* tag, const char* format, ...) __attribute__((format(printf, 2, 3)));
    static void d(const char* tag, const char* format, ...) __attribute__((format(printf, 2, 3)));
    static void i(const char* tag, const char* format, ...) __attribute__((format(printf, 2, 3)));
    static void w(const char* tag, const char* format, ...) __attribute__((format(printf, 2, 3)));
    static void e(const char* tag, const char* format, ...) __attribute__((format(printf, 2, 3)));

private:
    static LogLevel s_minLevel;
    static SemaphoreHandle_t s_mutex;
    static bool s_initialized;
    static const char* levelToString(LogLevel level);
};

