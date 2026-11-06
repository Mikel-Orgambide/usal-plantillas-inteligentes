#pragma once
#include <cstddef>
#include "record.h"

// JSON por línea a 230400 (H1/H5): status, record e info; órdenes start/stop/info.
namespace usb {
void begin();
void send_info();
void send_status(const char* event, const char* detail = nullptr);
void send_record(const Record& r);
// Lee una orden pendiente ("start", "stop", "info"); devuelve true si hubo.
bool poll_command(char* out, size_t len);
}
