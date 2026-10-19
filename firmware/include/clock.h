#pragma once
#include <cstdint>
#include <esp_timer.h>

// Referencia monotónica (microsegundos desde el arranque). No es hora civil.
namespace clk {
inline int64_t now_us() { return esp_timer_get_time(); }
}
