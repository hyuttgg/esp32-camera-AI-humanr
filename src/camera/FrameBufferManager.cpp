#include "FrameBufferManager.h"

FrameStats FrameBufferManager::s_stats = {0, 0, 0, 0, 0};
uint64_t FrameBufferManager::s_accumulatedLatency = 0;

void FrameBufferManager::init() {
    resetStats();
}

void FrameBufferManager::recordSuccess(uint32_t latencyMs) {
    s_stats.totalCaptured++;
    s_stats.lastCaptureLatencyMs = latencyMs;
    s_accumulatedLatency += latencyMs;
    s_stats.avgCaptureLatencyMs = (uint32_t)(s_accumulatedLatency / s_stats.totalCaptured);
}

void FrameBufferManager::recordFailure() {
    s_stats.totalFailed++;
}

void FrameBufferManager::recordDrop() {
    s_stats.totalDropped++;
}

FrameStats FrameBufferManager::getStats() {
    return s_stats;
}

void FrameBufferManager::resetStats() {
    s_stats.totalCaptured = 0;
    s_stats.totalFailed = 0;
    s_stats.totalDropped = 0;
    s_stats.avgCaptureLatencyMs = 0;
    s_stats.lastCaptureLatencyMs = 0;
    s_accumulatedLatency = 0;
}

