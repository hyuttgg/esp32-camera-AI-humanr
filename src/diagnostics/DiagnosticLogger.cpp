#include "DiagnosticLogger.h"
#include <stdarg.h>

LogLevel DiagnosticLogger::s_minLevel = LOG_LEVEL_INFO;
SemaphoreHandle_t DiagnosticLogger::s_mutex = nullptr;
bool DiagnosticLogger::s_initialized = false;

void DiagnosticLogger::init(LogLevel minLevel, uint32_t baudRate) {
    if (!s_initialized) {
        Serial.setTxBufferSize(32768); // 32KB non-blocking TX ring buffer for smooth 30 FPS pipelining
        Serial.begin(baudRate);
        s_mutex = xSemaphoreCreateMutex();
        s_initialized = true;
    }
    s_minLevel = minLevel;
}

void DiagnosticLogger::setMinLevel(LogLevel level) {
    s_minLevel = level;
}

LogLevel DiagnosticLogger::getMinLevel() {
    return s_minLevel;
}

void DiagnosticLogger::lock() {
    if (s_mutex) xSemaphoreTake(s_mutex, portMAX_DELAY);
}

void DiagnosticLogger::unlock() {
    if (s_mutex) xSemaphoreGive(s_mutex);
}

const char* DiagnosticLogger::levelToString(LogLevel level) {
    switch (level) {
        case LOG_LEVEL_VERBOSE: return "VERB";
        case LOG_LEVEL_DEBUG:   return "DBUG";
        case LOG_LEVEL_INFO:    return "INFO";
        case LOG_LEVEL_WARN:    return "WARN";
        case LOG_LEVEL_ERROR:   return "ERR ";
        case LOG_LEVEL_FATAL:   return "FATL";
        default:                return "UNKN";
    }
}

void DiagnosticLogger::log(LogLevel level, const char* tag, const char* format, ...) {
    if (level < s_minLevel || level >= LOG_LEVEL_NONE) return;

    char msgBuffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(msgBuffer, sizeof(msgBuffer), format, args);
    va_end(args);

    unsigned long ms = millis();

    if (s_mutex) xSemaphoreTake(s_mutex, portMAX_DELAY);
    Serial.printf("[%7lu ms] [%s] [%-12s] %s\r\n", ms, levelToString(level), tag, msgBuffer);
    if (s_mutex) xSemaphoreGive(s_mutex);
}

void DiagnosticLogger::logError(const char* tag, ErrorCode err, const char* context) {
    if (LOG_LEVEL_ERROR < s_minLevel) return;

    unsigned long ms = millis();
    if (s_mutex) xSemaphoreTake(s_mutex, portMAX_DELAY);
    if (context && strlen(context) > 0) {
        Serial.printf("[%7lu ms] [ERR ] [%-12s] Error %d (%s) - Context: %s\r\n", 
                      ms, tag, err, errorToString(err), context);
    } else {
        Serial.printf("[%7lu ms] [ERR ] [%-12s] Error %d (%s)\r\n", 
                      ms, tag, err, errorToString(err));
    }
    if (s_mutex) xSemaphoreGive(s_mutex);
}

void DiagnosticLogger::logRateLimited(uint32_t intervalMs, LogLevel level, const char* tag, const char* format, ...) {
    if (level < s_minLevel || level >= LOG_LEVEL_NONE) return;

    static uint32_t lastLogTime = 0;
    uint32_t now = millis();
    if (now - lastLogTime < intervalMs) return;
    lastLogTime = now;

    char msgBuffer[256];
    va_list args;
    va_start(args, format);
    vsnprintf(msgBuffer, sizeof(msgBuffer), format, args);
    va_end(args);

    if (s_mutex) xSemaphoreTake(s_mutex, portMAX_DELAY);
    Serial.printf("[%7lu ms] [%s] [%-12s] %s\r\n", now, levelToString(level), tag, msgBuffer);
    if (s_mutex) xSemaphoreGive(s_mutex);
}

void DiagnosticLogger::v(const char* tag, const char* format, ...) {
    if (LOG_LEVEL_VERBOSE < s_minLevel) return;
    char buf[256]; va_list args; va_start(args, format);
    vsnprintf(buf, sizeof(buf), format, args); va_end(args);
    log(LOG_LEVEL_VERBOSE, tag, "%s", buf);
}

void DiagnosticLogger::d(const char* tag, const char* format, ...) {
    if (LOG_LEVEL_DEBUG < s_minLevel) return;
    char buf[256]; va_list args; va_start(args, format);
    vsnprintf(buf, sizeof(buf), format, args); va_end(args);
    log(LOG_LEVEL_DEBUG, tag, "%s", buf);
}

void DiagnosticLogger::i(const char* tag, const char* format, ...) {
    if (LOG_LEVEL_INFO < s_minLevel) return;
    char buf[256]; va_list args; va_start(args, format);
    vsnprintf(buf, sizeof(buf), format, args); va_end(args);
    log(LOG_LEVEL_INFO, tag, "%s", buf);
}

void DiagnosticLogger::w(const char* tag, const char* format, ...) {
    if (LOG_LEVEL_WARN < s_minLevel) return;
    char buf[256]; va_list args; va_start(args, format);
    vsnprintf(buf, sizeof(buf), format, args); va_end(args);
    log(LOG_LEVEL_WARN, tag, "%s", buf);
}

void DiagnosticLogger::e(const char* tag, const char* format, ...) {
    if (LOG_LEVEL_ERROR < s_minLevel) return;
    char buf[256]; va_list args; va_start(args, format);
    vsnprintf(buf, sizeof(buf), format, args); va_end(args);
    log(LOG_LEVEL_ERROR, tag, "%s", buf);
}

