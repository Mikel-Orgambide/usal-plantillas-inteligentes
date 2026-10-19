#pragma once
#include <cstdint>
#include "configuration.h"

// Registro tal como lo produce la placa: un valor por canal con su tiempo.
struct Sample {
  uint32_t time_us;  // desde el inicio de la captura, tomado al comenzar la lectura
  uint16_t value;    // 0..RAW_MAX, o READ_ERROR_VALUE
};

struct Record {
  uint16_t boot;
  uint16_t capture;
  uint32_t sequence;
  Sample samples[cfg::CHANNEL_COUNT];
};
