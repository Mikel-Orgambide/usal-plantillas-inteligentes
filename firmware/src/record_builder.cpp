#include "record_builder.h"
#include <Arduino.h>
#include "acquisition.h"
#include "capture_controller.h"
#include "diagnostics.h"

namespace rb {

static Record queue[cfg::QUEUE_CAPACITY];
static volatile uint8_t head = 0, tail = 0, count = 0;
static portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

void begin() { head = tail = count = 0; }

void acquire_one() {
  if (!capture::active()) return;
  Record r;
  r.boot = capture::boot();
  r.capture = capture::number();
  r.sequence = capture::next_sequence();
  acq::read_all(capture::t0_us(), r.samples);
  diag::counters().generated++;
  for (auto& s : r.samples) if (s.value == cfg::READ_ERROR_VALUE) diag::counters().read_errors++;
  portENTER_CRITICAL(&mux);
  if (count < cfg::QUEUE_CAPACITY) {
    queue[tail] = r;
    tail = (tail + 1) % cfg::QUEUE_CAPACITY;
    count++;
    portEXIT_CRITICAL(&mux);
  } else {
    portEXIT_CRITICAL(&mux);
    diag::counters().dropped++;
  }
}

bool pop(Record& out) {
  portENTER_CRITICAL(&mux);
  if (count == 0) { portEXIT_CRITICAL(&mux); return false; }
  out = queue[head];
  head = (head + 1) % cfg::QUEUE_CAPACITY;
  count--;
  portEXIT_CRITICAL(&mux);
  return true;
}

uint8_t pending() { return count; }

}  // namespace rb
