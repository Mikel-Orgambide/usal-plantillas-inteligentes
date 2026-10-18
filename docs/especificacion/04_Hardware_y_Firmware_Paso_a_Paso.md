# Hardware y firmware: preparación e integración

Fecha: 13 de octubre de 2026.
Estado: compra confirmada; recepción, identificación y pruebas por documentar.

## 1. Configuración vigente

Dos FSR406 para los talones, confirmados expresamente por el usuario. Cuatro FSR402 activos para antepié medial y lateral. Seis canales.

Placa adquirida: comercializada como NodeMCU ESP32, 38 pines y USB-C. Identificar módulo y placa reales antes de asignar GPIO, resolución y configuración de adquisición.

Materiales de preparación: protoboard, Dupont, resistencias, multímetro, soldador y cintas de fijación/aislamiento. Las pilas AAA se compraron para el multímetro. No constituyen la alimentación seleccionada del ESP32.

No se confirmó ADS1115, MPU6050, otra placa, batería LiPo, cargador/regulador ni power bank. No escribir firmware que dependa obligatoriamente de ellos.

## 2. Etapa H0 - Inventario físico

Fotografiar e identificar cada unidad, terminales y accesorios. Completar cantidades recibidas y distinguir repuestos de sensores activos.

Registrar el modelo real, las fuentes técnicas aplicables y el resultado de comprobación. No asumir que las denominaciones FSR402/406 acreditan fabricante Interlink.

Cierre: seis unidades activas identificadas y placa documentada. Si falta algo, registrarlo; el software simulado puede continuar.

## 3. Etapa H1 - Placa sin sensores

Conectar por USB utilizando un cable con datos. Comprobar programación y salida de diagnóstico. Registrar entorno, placa seleccionada y versión de Arduino Core.

Preparar un programa mínimo que informe identificación de firmware y estado. Su ejecución no acredita adquisición plantar.

Cierre: programa cargado y comunicación USB observada.

## 4. Etapa H2 - Un circuito de lectura

Preparar un esquema para la placa efectivamente identificada. Seleccionar entrada analógica y límites eléctricos a partir de su documentación.

Plantear FSR y resistencia fija como divisor de tensión. Comprobar alimentación, continuidad y tensión con el multímetro antes de interpretar lecturas. La alimentación USB de la placa no determina qué tensión admite una entrada analógica.

Probar valores de resistencia disponibles y documentar el resultado. No fijar el valor definitivo sólo por un ejemplo de Internet.

Cierre: cambios de lectura reproducibles ante aplicaciones controladas de carga, con circuito y condiciones registrados. Esto no constituye calibración de fuerza.

## 5. Etapa H3 - Caracterización individual

Repetir ensayos por unidad. Registrar lectura sin carga aplicada, respuesta, comportamiento al retirar carga, dispersión, rangos eléctricos observados y efectos del soporte.

Si se ajusta una conversión física, definir referencia, rango, procedimiento y datos de comprobación separados del ajuste. Un multímetro o una curva del vendedor no constituyen por sí solos una referencia de fuerza independiente.

Cierre: informe por sensor que distinga respuesta eléctrica, repetibilidad observada y conversión física, si se comprobó.

## 6. Etapa H4 - Seis entradas

Extender el circuito y asociar cada entrada con código de posición, unidad y configuración. Comprobar un sensor a la vez y verificar su identificación.

Leer los canales con tiempos individuales. Medir el intervalo efectivo por canal y el desfase entre lecturas. Conservar los resultados aunque difieran del intervalo programado.

Cierre: seis canales identificados sin mezclas, con registros observables por USB.

## 7. Responsabilidades del firmware

Módulos propuestos:

~~~text
configuration      placa, canales, adquisición y montaje
acquisition        lectura eléctrica y estado de error
clock              referencia monotónica de captura
capture_controller inicio, cierre y nuevo identificador
record_builder     secuencia y muestras con tiempos individuales
usb_transport      salida de prueba y diagnóstico
ble_transport      servicio, características y notificaciones
diagnostics        reinicios, errores y contadores acotados
~~~

No incorporar gráficos, historial del usuario, recomendaciones ni IA en el firmware.

Separar el ritmo de adquisición de transmisión. Una cola acotada deberá hacer observables los descartes cuando no pueda sostener el envío. No detener silenciosamente el muestreo para que los números de secuencia parezcan completos.

No aplicar filtros o promedios que sustituyan el dato original sin documentarlos. Si se añaden valores procesados, mantener su condición separada.

## 8. Captura y secuencia

Definir inicio, origen temporal, identificador y contador. Un inicio o reinicio crea una captura distinguible. Los registros conservan configuration_id.

El tiempo por muestra se toma al inicio de la operación de lectura. No afirmar simultaneidad ni exactitud temporal a partir del tipo de variable.

sequence aumenta al generar el registro, no sólo al transmitir. Si hay descarte, los huecos deben poder observarse.

Documentar el comportamiento de contadores y relojes al reiniciar o desbordar. Evitar reutilizar accidentalmente capturas.

## 9. Etapa H5 - Protocolo USB

Utilizar una salida interpretable por el host. Para la prueba inicial puede adoptarse JSON por línea con tipos distintos para estado y medición.

Medir longitud de mensajes y capacidad de envío antes de escoger una tasa. Una codificación textual de seis canales puede requerir más caudal que una binaria; no copiar una tasa simulada como tasa física.

Cierre: registros físicos normalizados conservan campos, canales, secuencias y unidades.

## 10. Etapa H6 - BLE

ESP32 como servidor GATT; aplicación como cliente. Características propuestas: configuración/estado, mediciones y control.

Fijar UUID, codificación y límites sólo después de comprobar biblioteca, entorno y capacidad de transporte. Incluir comprobación de ejecución de órdenes; una solicitud enviada no demuestra captura iniciada.

Definir la seguridad del enlace de acuerdo con las herramientas efectivamente utilizadas y registrar el alcance de la prueba. El nombre anunciado del dispositivo no demuestra su autenticidad.

Cierre: recepción sostenida con seis canales, desconexión reconocida y reconexión con dispositivo/configuración/captura comprobados.

## 11. Etapa H7 - Montaje en plantillas

Mantener electrónica y protoboard fuera de las zonas de apoyo. Preparar cableado, fijación y protección adecuados al ensayo.

Documentar calzado, plantilla, soporte, ubicación y transmisión de carga. Una modificación relevante crea otra configuración y exige revisar calibraciones.

Comenzar con apoyo estático. La marcha controlada requiere estabilidad y continuidad demostradas; BLE no resuelve por sí solo alimentación ni autonomía.

Cierre: registro integrado estático con condiciones documentadas y datos recuperables en la aplicación.

## 12. Parámetros que no se deben inventar

- GPIO y límites analógicos.
- Resolución y rango de conversión usados.
- Resistencia fija por canal.
- Tasa objetivo física y tasa efectiva.
- UUID, tamaño de mensaje y buffers.
- Autonomía, consumo y rango de fuerza.
- Fabricante real y cantidades de repuestos.

Cada uno debe tener valor, fuente o ensayo y fecha cuando se resuelva.

