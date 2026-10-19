#pragma once
#include <cstdint>
#include "record.h"

// Lectura eléctrica (o sintética) de los seis canales. Nunca inventa un cero:
// si una lectura falla, el valor es READ_ERROR_VALUE.
namespace acq {
void begin();
// Lee los seis canales en orden; `t0_us` es el origen temporal de la captura.
void read_all(int64_t t0_us, Sample out[cfg::CHANNEL_COUNT]);
}
