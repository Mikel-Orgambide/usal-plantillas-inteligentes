#include "ble_transport.h"
#include <Arduino.h>
#include <ArduinoJson.h>
#include <NimBLEDevice.h>
#include "capture_controller.h"
#include "diagnostics.h"

namespace ble {

static const char* SERVICE_UUID = "7a0e0001-5d3f-4b1a-9f4c-2e6b8c1d0001";
static const char* INFO_UUID = "7a0e0002-5d3f-4b1a-9f4c-2e6b8c1d0001";
static const char* CONTROL_UUID = "7a0e0003-5d3f-4b1a-9f4c-2e6b8c1d0001";
static const char* STATUS_UUID = "7a0e0004-5d3f-4b1a-9f4c-2e6b8c1d0001";
static const char* MEASUREMENT_UUID = "7a0e0005-5d3f-4b1a-9f4c-2e6b8c1d0001";

static NimBLEServer* server = nullptr;
static NimBLECharacteristic* status_chr = nullptr;
static NimBLECharacteristic* measurement_chr = nullptr;
static volatile uint8_t pending_command = 0;
static volatile bool is_connected = false;

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer*, NimBLEConnInfo&) override { is_connected = true; }
  void onDisconnect(NimBLEServer*, NimBLEConnInfo&, int) override {
    is_connected = false;
    NimBLEDevice::startAdvertising();
  }
};

class ControlCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c, NimBLEConnInfo&) override {
    std::string v = c->getValue();
    if (!v.empty()) pending_command = static_cast<uint8_t>(v[0]);
  }
};

static std::string info_json() {
  JsonDocument doc;
  doc["format_version"] = cfg::FORMAT_VERSION;
  doc["device_id"] = capture::device_id();
  doc["configuration_id"] = cfg::CONFIGURATION_ID;
  doc["firmware"] = cfg::FIRMWARE_VERSION;
  doc["raw_max"] = cfg::RAW_MAX;
  doc["period_us"] = cfg::SAMPLE_PERIOD_US;
  JsonArray ch = doc["channels"].to<JsonArray>();
  for (uint8_t i = 0; i < cfg::CHANNEL_COUNT; i++) {
    JsonObject c = ch.add<JsonObject>();
    c["code"] = cfg::CHANNEL_CODES[i];
    char inst[40];
    snprintf(inst, sizeof(inst), "%s-%s", cfg::CONFIGURATION_ID, cfg::CHANNEL_CODES[i]);
    c["installation_id"] = inst;
    c["model"] = cfg::MODEL;
  }
  std::string out;
  serializeJson(doc, out);
  return out;
}

void begin() {
  char name[32];
  snprintf(name, sizeof(name), "Plantillas-%s", capture::device_id() + 6);
  NimBLEDevice::init(name);
  NimBLEDevice::setMTU(185);
  server = NimBLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());
  NimBLEService* svc = server->createService(SERVICE_UUID);
  NimBLECharacteristic* info = svc->createCharacteristic(INFO_UUID, NIMBLE_PROPERTY::READ);
  info->setValue(info_json());
  NimBLECharacteristic* control = svc->createCharacteristic(CONTROL_UUID, NIMBLE_PROPERTY::WRITE);
  control->setCallbacks(new ControlCallbacks());
  status_chr = svc->createCharacteristic(STATUS_UUID, NIMBLE_PROPERTY::NOTIFY);
  measurement_chr = svc->createCharacteristic(MEASUREMENT_UUID, NIMBLE_PROPERTY::NOTIFY);
  // Un anuncio admite 31 bytes: flags (3) + UUID de 128 bits (18) van en el anuncio;
  // el nombre (19) va en la respuesta de escaneo. Juntos no entran.
  NimBLEAdvertisementData adv_data;
  adv_data.setFlags(BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP);
  adv_data.addServiceUUID(SERVICE_UUID);
  NimBLEAdvertisementData scan_data;
  scan_data.setName(name);
  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->setAdvertisementData(adv_data);
  adv->setScanResponseData(scan_data);
  adv->enableScanResponse(true);
  adv->start();
}

bool connected() { return is_connected; }

void notify_status(const char* event, const char* detail) {
  if (!status_chr || !is_connected) return;
  JsonDocument doc;
  doc["event"] = event;
  if (detail) doc["detail"] = detail;
  char cid[48];
  capture::capture_id(cid, sizeof(cid));
  doc["capture_id"] = cid;
  doc["boot"] = capture::boot();
  doc["n"] = capture::number();
  doc["dropped"] = diag::counters().dropped;
  std::string out;
  serializeJson(doc, out);
  status_chr->setValue(out);
  status_chr->notify();
}

// Registro binario little-endian (ADR 0006): u8 version, u16 boot, u16 n, u32 sequence, 6 × (u32 time_us, u16 value).
bool notify_record(const Record& r) {
  if (!measurement_chr || !is_connected) return false;
  uint8_t buf[45];
  size_t p = 0;
  auto put16 = [&](uint16_t v) { buf[p++] = v & 0xFF; buf[p++] = v >> 8; };
  auto put32 = [&](uint32_t v) { for (int i = 0; i < 4; i++) buf[p++] = (v >> (8 * i)) & 0xFF; };
  buf[p++] = 1;
  put16(r.boot);
  put16(r.capture);
  put32(r.sequence);
  for (uint8_t i = 0; i < cfg::CHANNEL_COUNT; i++) { put32(r.samples[i].time_us); put16(r.samples[i].value); }
  measurement_chr->setValue(buf, sizeof(buf));
  return measurement_chr->notify();
}

uint8_t take_command() {
  uint8_t c = pending_command;
  pending_command = 0;
  return c;
}

}  // namespace ble
