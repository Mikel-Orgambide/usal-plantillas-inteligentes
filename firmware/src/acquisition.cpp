#include "acquisition.h"
#include <Arduino.h>
#include <cmath>
#include "clock.h"

namespace acq {

#if defined(ACQ_ANALOG)
void begin() {
  analogReadResolution(12);
  for (int pin : cfg::CHANNEL_PINS) pinMode(pin, INPUT);
}
void read_all(int64_t t0_us, Sample out[cfg::CHANNEL_COUNT]) {
  for (uint8_t i = 0; i < cfg::CHANNEL_COUNT; i++) {
    out[i].time_us = static_cast<uint32_t>(clk::now_us() - t0_us);
    int v = analogRead(cfg::CHANNEL_PINS[i]);
    out[i].value = (v < 0 || v > cfg::RAW_MAX) ? cfg::READ_ERROR_VALUE : static_cast<uint16_t>(v);
  }
}
#else
// Señal sintética: alternancia de apoyo izquierdo/derecho con un período de
// 1,2 s, misma forma que el simulador de la app, más una lectura fallida cada
// 97 registros en R_LATERAL para ejercitar read_error en el camino real.
static uint32_t counter = 0;
void begin() { counter = 0; }
void read_all(int64_t t0_us, Sample out[cfg::CHANNEL_COUNT]) {
  counter++;
  for (uint8_t i = 0; i < cfg::CHANNEL_COUNT; i++) {
    int64_t now = clk::now_us();
    out[i].time_us = static_cast<uint32_t>(now - t0_us);
    const bool left = i < 3;
    const float phase = std::fmod(static_cast<float>(now - t0_us) / 1.2e6f + (left ? 0.0f : 0.5f), 1.0f);
    const float lobe = phase < 0.5f ? std::sin(phase * 2.0f * static_cast<float>(M_PI)) : 0.0f;
    const float zone = (i % 3 == 0) ? 1.0f : (i % 3 == 1) ? 0.85f : 0.7f;
    const float noise = static_cast<float>((counter * 7919u + i * 104729u) % 61) - 30.0f;
    float v = lobe * 3000.0f * zone + 60.0f + noise;
    if (v < 0) v = 0;
    if (v > cfg::RAW_MAX) v = cfg::RAW_MAX;
    out[i].value = static_cast<uint16_t>(v);
    if (i == 5 && counter % 97 == 0) out[i].value = cfg::READ_ERROR_VALUE;
  }
}
#endif

}  // namespace acq
