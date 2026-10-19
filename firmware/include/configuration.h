#pragma once
#include <cstdint>

// Configuración de adquisición. Los códigos y el orden son los del contrato v1.0.
namespace cfg {

constexpr const char* FORMAT_VERSION = "1.0";
constexpr const char* FIRMWARE_VERSION = "0.2.2-h6";
constexpr uint8_t CHANNEL_COUNT = 6;
constexpr uint16_t RAW_MAX = 4095;          // ADC de 12 bits
constexpr uint16_t READ_ERROR_VALUE = 0xFFFF; // valor binario que representa read_error
constexpr uint32_t SAMPLE_PERIOD_US = 50000;  // 20 reg/s: punto de partida, no tasa validada (H04)
constexpr uint8_t QUEUE_CAPACITY = 32;        // registros; al llenarse se descarta y se cuenta

// Orden fijo del contrato y del registro binario.
constexpr const char* CHANNEL_CODES[CHANNEL_COUNT] = {"L_HEEL", "L_MEDIAL", "L_LATERAL", "R_HEEL", "R_MEDIAL", "R_LATERAL"};

#if defined(ACQ_ANALOG)
constexpr const char* CONFIGURATION_ID = "ESP32-FSR-001";
constexpr const char* DESCRIPTION = "Seis divisores FSR + resistencia fija, ADC 12 bits";
constexpr const char* MODEL = "FSR402"; // denominación comercial, no acredita fabricante (04 §2)
// Pines ADC1 (los de ADC2 no funcionan con Wi-Fi/BLE activos). Verificar contra la placa real en H2.
constexpr int CHANNEL_PINS[CHANNEL_COUNT] = {36, 39, 34, 35, 32, 33};
#else
constexpr const char* CONFIGURATION_ID = "ESP32-SYN-001";
constexpr const char* DESCRIPTION = "Lecturas sintéticas generadas en la placa (sin sensores)";
constexpr const char* MODEL = "synthetic";
#endif

}  // namespace cfg
