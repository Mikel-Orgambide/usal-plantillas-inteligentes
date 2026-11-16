# Bases de desarrollo de la plataforma

Proyecto Final de Ingeniería en Informática — Mikel Orgambide Rueda.

Estas bases se escribieron el 13/10/2026, antes de programar, y fijaron el contrato, las etapas y los criterios con los que después se construyó y probó el prototipo. Los documentos 02 a 05 describen lo previsto; lo que efectivamente se hizo está en el 08, en [`docs/incrementos`](../incrementos/README.md) y en [`docs/tesis/04_Evidencia_y_pruebas.md`](../tesis/04_Evidencia_y_pruebas.md).

| Documento | Contenido |
|---|---|
| [`02_Contrato_de_Datos_y_Modelo.md`](02_Contrato_de_Datos_y_Modelo.md) | Reglas compartidas entre simulador, dispositivo, aplicación y almacenamiento |
| [`03_Implementacion_Aplicacion_Paso_a_Paso.md`](03_Implementacion_Aplicacion_Paso_a_Paso.md) | Módulos, pantallas, estados y etapas de la aplicación, con sus condiciones de cierre |
| [`04_Hardware_y_Firmware_Paso_a_Paso.md`](04_Hardware_y_Firmware_Paso_a_Paso.md) | Identificación del hardware, adquisición, USB, BLE y montaje |
| [`05_Pruebas_y_Criterios_de_Cierre.md`](05_Pruebas_y_Criterios_de_Cierre.md) | Casos de prueba, resultados esperados y evidencia a conservar |
| [`08_Alcance_Final_del_Prototipo.md`](08_Alcance_Final_del_Prototipo.md) | Qué hace la plataforma al cierre, con estado validado, simulado o diseñado en cada punto |

## Límites que respeta todo el código

- Seis posiciones del contrato: `L_HEEL`, `L_MEDIAL`, `L_LATERAL`, `R_HEEL`, `R_MEDIAL`, `R_LATERAL` (FSR406 en talones, FSR402 en antepié). Cada módulo físico es un ESP32 con los tres canales de un pie; las posiciones no declaradas son «no disponibles», nunca ceros.
- Una sesión tiene uno o dos módulos (ADR 0011), cada uno con su captura, su secuencia y su reloj. La correspondencia temporal se estima por recepción y se declara como desfase; las métricas bilaterales se calculan sólo en tramos con ambos módulos.
- Valores originales en `adc_count`. La ausencia o el error de una lectura nunca se convierten en cero (`raw_value = null` + `status = read_error`).
- Procedencia `simulated` o `physical`, asignada por el adaptador y nunca mezclada en una sesión.
- Sin conversión a fuerza o presión sin calibración comprobada. Sin diagnóstico ni detección de fatiga.
- El tiempo de adquisición (`time_us`) y el de recepción (`received_at`) son referencias distintas.

Los documentos 01, 06 y 07 de este paquete (revisión del documento de tesis, síntesis de continuidad y registro de referencias y marcadores) eran guías de redacción y planificación. Se retiraron de la rama principal el 16/11/2026 y pueden consultarse en la etiqueta `entrega-final`: [01](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes/blob/entrega-final/docs/especificacion/01_Revision_General_y_Estado.md) · [06](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes/blob/entrega-final/docs/especificacion/06_Sintesis_Continuidad_y_Uso_IA.md) · [07](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes/blob/entrega-final/docs/especificacion/07_Referencias_Marcadores_y_Decisiones.md).
