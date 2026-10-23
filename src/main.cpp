#include <Arduino.h>
#include "RuntimeSupervisor.h"

/**
 * @file main.cpp
 * @brief Main firmware entrypoint for ESP32-CAM AI Vision.
 */

static RuntimeSupervisor g_supervisor;

void setup() {
    g_supervisor.setup();
}

void loop() {
    g_supervisor.step();
}
