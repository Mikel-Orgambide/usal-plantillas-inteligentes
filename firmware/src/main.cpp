// Firmware de la plantilla instrumentada. Etapas H1 (USB), H5 (protocolo USB) y H6 (BLE).
// Adquisición por temporizador a período fijo; transmisión desde loop() por USB y BLE.
#include <Arduino.h>
#include <esp_timer.h>
#include "ble_transport.h"
#include "capture_controller.h"
#include "diagnostics.h"
#include "acquisition.h"
#include "record_builder.h"
#include "usb_transport.h"

static esp_timer_handle_t sampler = nullptr;

static void on_sample(void*) { rb::acquire_one(); }

static void start_capture() {
  if (!capture::start()) { usb::send_status("ignored", "captura ya activa"); return; }
  rb::begin();
  esp_timer_start_periodic(sampler, cfg::SAMPLE_PERIOD_US);
  usb::send_status("capture_started");
  ble::notify_status("capture_started");
}

static void stop_capture() {
  if (!capture::active()) { usb::send_status("ignored", "sin captura activa"); return; }
  esp_timer_stop(sampler);
  capture::stop();
  usb::send_status("capture_stopped");
  ble::notify_status("capture_stopped");
}

void setup() {
  usb::begin();
  capture::begin();
  acq::begin();
  rb::begin();
  const esp_timer_create_args_t args = {.callback = &on_sample, .arg = nullptr, .dispatch_method = ESP_TIMER_TASK, .name = "sampler", .skip_unhandled_events = true};
  esp_timer_create(&args, &sampler);
  ble::begin();
  usb::send_info();
  usb::send_status("boot");
}

void loop() {
  char cmd[32];
  if (usb::poll_command(cmd, sizeof(cmd))) {
    if (!strcmp(cmd, "start")) start_capture();
    else if (!strcmp(cmd, "stop")) stop_capture();
    else if (!strcmp(cmd, "info")) usb::send_info();
    else usb::send_status("unknown_command", cmd);
  }
  switch (ble::take_command()) {
    case 0x01: start_capture(); break;
    case 0x02: stop_capture(); break;
    default: break;
  }

  static uint32_t last_dropped = 0;
  Record r;
  uint8_t sent = 0;
  while (sent < 8 && rb::pop(r)) {  // acotado por vuelta de loop para no monopolizar
    // Con un cliente BLE conectado los registros van solo por BLE; el USB conserva status/info.
    if (!ble::connected()) usb::send_record(r);
    else ble::notify_record(r);
    diag::counters().transmitted++;
    sent++;
  }
  if (diag::counters().dropped != last_dropped) {
    last_dropped = diag::counters().dropped;
    usb::send_status("dropped");
    ble::notify_status("dropped");
  }
  delay(1);
}
