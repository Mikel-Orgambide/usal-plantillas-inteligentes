#pragma once
#include "record.h"

// Servidor GATT (ADR 0006): info (read), control (write), status (notify),
// measurement (notify, registro binario de 9 + 6 × CHANNEL_COUNT bytes: 45 con seis canales, 27 con tres).
namespace ble {
void begin();
bool connected();
void notify_status(const char* event, const char* detail = nullptr);
// Devuelve false si la pila BLE no pudo encolar la notificación (se cuenta como descarte).
bool notify_record(const Record& r);
// Orden recibida por la característica de control (0x01 start, 0x02 stop); 0 si no hay.
uint8_t take_command();
}
