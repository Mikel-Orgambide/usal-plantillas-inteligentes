#pragma once
#include "record.h"

// Cola acotada entre adquisición (temporizador) y transmisión (loop).
namespace rb {
void begin();
// Lee los canales configurados, asigna sequence y encola. Si la cola está llena, el
// registro se descarta DESPUÉS de consumir su sequence (hueco observable).
void acquire_one();
bool pop(Record& out);
uint8_t pending();
}
