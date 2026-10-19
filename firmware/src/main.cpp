// Firmware de la plantilla instrumentada. Etapas H1 (USB), H5 (protocolo USB) y H6 (BLE).
// Adquisición en una tarea propia del núcleo 1 a período fijo (vTaskDelayUntil);
// transmisión desde loop() por USB y BLE. El núcleo 0 queda para el controlador BLE:
// con esp_timer en ese núcleo la tasa caía de 20 a 12 reg/s con un cliente conectado.
#include <Arduino.h>
#include "ble_transport.h"
#include "capture_controller.h"
#include "diagnostics.h"
#include "acquisition.h"
#include "record_builder.h"
#include "usb_transport.h"

static TaskHandle_t sampler = nullptr;
static volatile bool sampling = false;

static void sampler_task(void*) {
  TickType_t last = xTaskGetTickCount();
  const TickType_t period = pdMS_TO_TICKS(cfg::SAMPLE_PERIOD_US / 1000);
  for (;;) {
    vTaskDelayUntil(&last, period);
    if (sampling) rb::acquire_one();
  }
}

static void start_capture() {
  if (!capture::start()) {
    // Ya activa: se confirma igual con el capture_id vigente (orden idempotente; la app
    // la reenvía al reconectar y así distingue «sigue la misma captura» de «captura nueva»).
    usb::send_status("capture_started", "ya activa");
    ble::notify_status("capture_started");
    return;
  }
  rb::begin();
  sampling = true;
  usb::send_status("capture_started");
  ble::notify_status("capture_started");
}

static void stop_capture() {
  if (!capture::active()) { usb::send_status("ignored", "sin captura activa"); return; }
  sampling = false;
  capture::stop();
  usb::send_status("capture_stopped");
  ble::notify_status("capture_stopped");
}

void setup() {
  usb::begin();
  capture::begin();
  acq::begin();
  rb::begin();
  ble::begin();
  xTaskCreatePinnedToCore(sampler_task, "sampler", 4096, nullptr, 5, &sampler, 1);
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
    if (!ble::connected()) {
      usb::send_record(r);
      diag::counters().transmitted++;
    } else if (ble::notify_record(r)) {
      diag::counters().transmitted++;
    } else {
      diag::counters().dropped++;  // la pila BLE no pudo enviarlo: hueco observable en la app
    }
    sent++;
  }
  // Progreso por USB cada 5 s durante la captura (diagnóstico H04/H05: generados vs. transmitidos).
  static uint32_t last_progress = 0;
  if (capture::active() && millis() - last_progress >= 5000) {
    last_progress = millis();
    usb::send_status("progress");
  }
  if (diag::counters().dropped != last_dropped) {
    last_dropped = diag::counters().dropped;
    usb::send_status("dropped");
    ble::notify_status("dropped");
  }
  delay(1);
}
