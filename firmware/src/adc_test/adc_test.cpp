// Programa de prueba del ADC (etapas H2-H4). Entorno `esp32-adc-test`.
// Lee los seis pines del entorno analógico y escribe las cuentas crudas (0..4095)
// cada 100 ms. No usa BLE ni el contrato: sirve solo para comprobar el circuito.
// Misma resolución y atenuación por defecto (11 dB) que acquisition.cpp.
#include <Arduino.h>

static const int PINS[6] = {36, 39, 34, 35, 32, 33};  // igual que cfg::CHANNEL_PINS
static const char* NAMES[6] = {"L_HEEL", "L_MEDIAL", "L_LATERAL", "R_HEEL", "R_MEDIAL", "R_LATERAL"};

void setup() {
  Serial.begin(230400);
  analogReadResolution(12);
  for (int pin : PINS) pinMode(pin, INPUT);
  delay(500);
  Serial.println("adc-test: cuentas crudas 0..4095 por canal, 10 lecturas/s");
  Serial.println("canal   pin   L_HEEL(36) L_MEDIAL(39) L_LATERAL(34) R_HEEL(35) R_MEDIAL(32) R_LATERAL(33)");
}

void loop() {
  Serial.print("raw ");
  for (int i = 0; i < 6; i++) {
    int v = analogRead(PINS[i]);
    Serial.printf("%s=%4d ", NAMES[i], v);
  }
  Serial.println();
  delay(100);
}
