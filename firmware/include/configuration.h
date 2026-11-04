#pragma once
#include <cstdint>

// Configuración de adquisición. Los códigos y el orden son los del contrato v1.0.
namespace cfg {

constexpr const char* FORMAT_VERSION = "1.0";
constexpr const char* FIRMWARE_VERSION = "0.3.1";
constexpr uint16_t RAW_MAX = 4095;          // ADC de 12 bits
constexpr uint16_t READ_ERROR_VALUE = 0xFFFF; // valor binario que representa read_error
constexpr uint32_t SAMPLE_PERIOD_US = 50000;  // 20 reg/s: punto de partida, no tasa validada (H04)
constexpr uint8_t QUEUE_CAPACITY = 32;        // registros; al llenarse se descarta y se cuenta

#if defined(ACQ_ANALOG)
// Módulo unilateral (decisión del 3/11/2026, ADR 0011): un ESP32 con tres divisores FSR por pie.
// El mismo firmware se compila para el pie izquierdo (`esp32-analog`) o el derecho
// (`esp32-analog-right`, -DACQ_FOOT_RIGHT=1): mismos pines, modelos y resistencias; cambian
// los códigos de posición y el configuration_id. El pie no instrumentado por esta placa
// queda «no disponible» en la app (nunca ceros). Pines ADC1 (ADC2 no funciona con BLE activo).
constexpr uint8_t CHANNEL_COUNT = 3;
#if defined(ACQ_FOOT_RIGHT)
constexpr const char* CHANNEL_CODES[CHANNEL_COUNT] = {"R_HEEL", "R_MEDIAL", "R_LATERAL"};
constexpr const char* CONFIGURATION_ID = "ESP32-FSR-R-001";
constexpr const char* DESCRIPTION = "Modulo unilateral derecho: 3 divisores FSR (2,2 kOhm talon, 4,7 kOhm antepie), ADC 12 bits";
#else
constexpr const char* CHANNEL_CODES[CHANNEL_COUNT] = {"L_HEEL", "L_MEDIAL", "L_LATERAL"};
constexpr const char* CONFIGURATION_ID = "ESP32-FSR-L-001";
constexpr const char* DESCRIPTION = "Modulo unilateral izquierdo: 3 divisores FSR (2,2 kOhm talon, 4,7 kOhm antepie), ADC 12 bits";
#endif
constexpr int CHANNEL_PINS[CHANNEL_COUNT] = {36, 39, 34};
// Denominación comercial por canal; no acredita fabricante (04 §2).
constexpr const char* CHANNEL_MODELS[CHANNEL_COUNT] = {"FSR406", "FSR402", "FSR402"};
// Resistencia fija del divisor por canal, elegida en banco el 3/11/2026 (H2): 2,2 kΩ en el
// talón (FSR406) y 4,7 kΩ en el antepié (FSR402). Informativa: va en la evidencia, no en el contrato.
constexpr int CHANNEL_FIXED_RESISTOR_OHM[CHANNEL_COUNT] = {2200, 4700, 4700};
#else
// Señal sintética: los seis canales del contrato, para ejercitar transporte y app sin sensores.
constexpr uint8_t CHANNEL_COUNT = 6;
constexpr const char* CHANNEL_CODES[CHANNEL_COUNT] = {"L_HEEL", "L_MEDIAL", "L_LATERAL", "R_HEEL", "R_MEDIAL", "R_LATERAL"};
constexpr const char* CHANNEL_MODELS[CHANNEL_COUNT] = {"synthetic", "synthetic", "synthetic", "synthetic", "synthetic", "synthetic"};
constexpr const char* CONFIGURATION_ID = "ESP32-SYN-001";
constexpr const char* DESCRIPTION = "Lecturas sinteticas generadas en la placa (sin sensores)";
#endif

}  // namespace cfg
