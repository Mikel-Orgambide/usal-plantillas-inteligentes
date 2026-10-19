#include "capture_controller.h"
#include <Arduino.h>
#include <Preferences.h>
#include "clock.h"
#include "diagnostics.h"

namespace capture {

static Preferences prefs;
static uint16_t boot_count = 0;
static uint16_t capture_count = 0;
static uint32_t sequence = 0;
static int64_t origin_us = 0;
static bool is_active = false;
static char dev_id[24] = {0};

void begin() {
  uint64_t mac = ESP.getEfuseMac();
  snprintf(dev_id, sizeof(dev_id), "ESP32-%06llX", static_cast<unsigned long long>(mac & 0xFFFFFFULL));
  prefs.begin("plantillas", false);
  boot_count = static_cast<uint16_t>(prefs.getUShort("boot", 0) + 1);
  prefs.putUShort("boot", boot_count);
  prefs.end();
}

bool start() {
  if (is_active) return false;
  capture_count++;
  sequence = 0;
  origin_us = clk::now_us();
  diag::reset_capture_counters();
  is_active = true;
  return true;
}

bool stop() {
  if (!is_active) return false;
  is_active = false;
  return true;
}

bool active() { return is_active; }
uint16_t boot() { return boot_count; }
uint16_t number() { return capture_count; }
int64_t t0_us() { return origin_us; }
uint32_t next_sequence() { return sequence++; }
void capture_id(char* out, size_t len) { snprintf(out, len, "%s-B%u-C%u", dev_id, boot_count, capture_count); }
const char* device_id() { return dev_id; }

}  // namespace capture
