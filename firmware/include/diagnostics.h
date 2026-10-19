#pragma once
#include <cstdint>

// Contadores acotados: reinicios, descartes y errores. Se informan por status.
namespace diag {
struct Counters {
  uint32_t generated = 0;   // registros con sequence asignada
  uint32_t transmitted = 0; // registros efectivamente enviados por algún transporte
  uint32_t dropped = 0;     // descartados por cola llena (hueco observable)
  uint32_t read_errors = 0; // muestras con read_error
};
Counters& counters();
void reset_capture_counters();
}
