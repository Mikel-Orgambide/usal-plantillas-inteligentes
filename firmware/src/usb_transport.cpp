#include "usb_transport.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include "capture_controller.h"
#include "diagnostics.h"

namespace usb {

// 230400: un registro JSON ronda 450 bytes (≈ 9 KB/s a 20 reg/s); 115200 no alcanza y a 460800
// se observaron bytes perdidos en la recepción del host (H1, 2026-10-19).
void begin() { Serial.begin(230400); }

// Agrega los campos comunes sin reiniciar el documento (doc.to<>() lo vaciaba y borraba "type").
static void add_identity(JsonDocument& doc) {
  doc["format_version"] = cfg::FORMAT_VERSION;
  doc["device_id"] = capture::device_id();
  doc["configuration_id"] = cfg::CONFIGURATION_ID;
}

void send_info() {
  JsonDocument doc;
  doc["type"] = "info";
  add_identity(doc);
  doc["firmware"] = cfg::FIRMWARE_VERSION;
  doc["description"] = cfg::DESCRIPTION;
  doc["raw_range"]["min"] = 0;
  doc["raw_range"]["max"] = cfg::RAW_MAX;
  doc["raw_range"]["resolution_bits"] = 12;
  doc["sample_period_us"] = cfg::SAMPLE_PERIOD_US;
  JsonArray ch = doc["channels"].to<JsonArray>();
  for (uint8_t i = 0; i < cfg::CHANNEL_COUNT; i++) {
    JsonObject c = ch.add<JsonObject>();
    c["code"] = cfg::CHANNEL_CODES[i];
    char inst[40];
    snprintf(inst, sizeof(inst), "%s-%s", cfg::CONFIGURATION_ID, cfg::CHANNEL_CODES[i]);
    c["installation_id"] = inst;
    c["model"] = cfg::MODEL;
    c["unit"] = "adc_count";
  }
  serializeJson(doc, Serial);
  Serial.println();
}

void send_status(const char* event, const char* detail) {
  JsonDocument doc;
  doc["type"] = "status";
  doc["event"] = event;
  if (detail) doc["detail"] = detail;
  char cid[48];
  capture::capture_id(cid, sizeof(cid));
  doc["capture_id"] = cid;
  doc["capture_active"] = capture::active();
  const auto& c = diag::counters();
  doc["generated"] = c.generated;
  doc["transmitted"] = c.transmitted;
  doc["dropped"] = c.dropped;
  doc["read_errors"] = c.read_errors;
  serializeJson(doc, Serial);
  Serial.println();
}

void send_record(const Record& r) {
  JsonDocument doc;
  doc["type"] = "record";
  add_identity(doc);
  char cid[48];
  snprintf(cid, sizeof(cid), "%s-B%u-C%u", capture::device_id(), r.boot, r.capture);
  doc["capture_id"] = cid;
  doc["sequence"] = r.sequence;
  JsonArray samples = doc["samples"].to<JsonArray>();
  for (uint8_t i = 0; i < cfg::CHANNEL_COUNT; i++) {
    JsonObject s = samples.add<JsonObject>();
    s["channel_id"] = cfg::CHANNEL_CODES[i];
    s["time_us"] = r.samples[i].time_us;
    if (r.samples[i].value == cfg::READ_ERROR_VALUE) {
      s["raw_value"] = nullptr;
      s["status"] = "read_error";
    } else {
      s["raw_value"] = r.samples[i].value;
      s["status"] = "ok";
    }
    s["unit"] = "adc_count";
  }
  serializeJson(doc, Serial);
  Serial.println();
}

bool poll_command(char* out, size_t len) {
  static char buf[32];
  static size_t n = 0;
  while (Serial.available()) {
    char ch = static_cast<char>(Serial.read());
    if (ch == '\n' || ch == '\r') {
      if (n == 0) continue;
      buf[n] = 0;
      strncpy(out, buf, len - 1);
      out[len - 1] = 0;
      n = 0;
      return true;
    }
    if (n < sizeof(buf) - 1) buf[n++] = ch;
  }
  return false;
}

}  // namespace usb
