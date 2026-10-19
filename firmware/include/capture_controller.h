#pragma once
#include <cstdint>
#include "record.h"

// Inicio y cierre de capturas; identificadores que no colisionan entre
// reinicios (contador de arranques en NVS) ni dentro de un arranque.
namespace capture {
void begin();                      // carga e incrementa el contador de arranques
bool start();                      // nueva captura: origen temporal y sequence = 0
bool stop();
bool active();
uint16_t boot();
uint16_t number();                 // número de captura dentro de este arranque
int64_t t0_us();
uint32_t next_sequence();          // consume un número de secuencia (aunque luego se descarte)
void capture_id(char* out, size_t len);        // "<device_id>-B<boot>-C<n>"
const char* device_id();                       // "ESP32-<6 hex de la MAC>"
}
