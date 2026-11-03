#pragma once
#include <cstdint>

// Configuración de adquisición. Los códigos y el orden son los del contrato v1.0.
namespace cfg {

constexpr const char* FORMAT_VERSION = "1.0";
constexpr const char* FIRMWARE_VERSION = "0.3.0";
constexpr uint16_t RAW_MAX = 4095;          // ADC de 12 bits
constexpr uint16_t READ_ERROR_VALUE = 0xFFFF; // valor binario que representa read_error
constexpr uint32_t SAMPLE_PERIOD_US = 50000;  // 20 reg/s: punto de partida, no tasa validada (H04)
constexpr uint8_t QUEUE_CAPACITY = 32;        // registros; al llenarse se descarta y se cuenta

#if defined(ACQ_ANALOG)
// Módulo unilateral izquierdo (decisión del 3/11/2026): un ESP32 con tres divisores FSR.
// Los códigos se declaran en el orden del contrato; el pie derecho no se instrumenta y
// queda «no disponible» (nunca ceros). Pines ADC1 (los de ADC2 no funcionan con BLE activo).
constexpr uint8_t CHANNEL_COUNT = 3;
constexpr const char* CHANNEL_CODES[CHANNEL_COUNT] = {"L_HEEL", "L_MEDIAL", "L_LATERAL"};
constexpr int CHANNEL_PINS[CHANNEL_COUNT] = {36, 39, 34};
// Denominación comercial por canal; no acredita fabricante (04 §2).
constexpr const char* CHANNEL_MODELS[CHANNEL_COUNT] = {"FSR406", "FSR402", "FSR402"};
// Resistencia fija del divisor por canal, elegida en banco el 3/11/2026 (H2): 2,2 kΩ en el
// talón (FSR406) y 4,7 kΩ en el antepié (FSR402). Informativa: va en la evidencia, no en el contrato.
constexpr int CHANNEL_FIXED_RESISTOR_OHM[CHANNEL_COUNT] = {2200, 4700, 4700};
constexpr const char* CONFIGURATION_ID = "ESP32-FSR-L-001";
constexpr const char* DESCRIPTION = "Modulo unilateral izquierdo: 3 divisores FSR (2,2 kOhm talon, 4,7 kOhm antepie), ADC 12 bits";
#else
// Señal sintética: los seis canales del contrato, para ejercitar transporte y app sin sensores.
constexpr uint8_t CHANNEL_COUNT = 6;
constexpr const char* CHANNEL_CODES[CHANNEL_COUNT] = {"L_HEEL", "L_MEDIAL", "L_LATERAL", "R_HEEL", "R_MEDIAL", "R_LATERAL"};
constexpr const char* CHANNEL_MODELS[CHANNEL_COUNT] = {"synthetic", "synthetic", "synthetic", "synthetic", "synthetic", "synthetic"};
constexpr const char* CONFIGURATION_ID = "ESP32-SYN-001";
constexpr const char* DESCRIPTION = "Lecturas sinteticas generadas en la placa (sin sensores)";
#endif

}  // namespace cfg
