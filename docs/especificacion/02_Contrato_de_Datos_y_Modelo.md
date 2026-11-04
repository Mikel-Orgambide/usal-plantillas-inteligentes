# Contrato lógico de datos y modelo de persistencia

Fecha: 13 de octubre de 2026.
Base: 4.3.4, 4.3.5 y límites de los capítulos 2 y 3.
Estado: especificación para implementar. El formato binario, los UUID GATT y la fragmentación BLE siguen pendientes de la integración.

## 1. Niveles que no se deben mezclar

- Sesión: actividad gestionada por la aplicación y vinculada con un perfil.
- Captura: ejecución del dispositivo o simulador con referencia temporal y secuencia propias.
- Registro: conjunto de lecturas generado en una captura.
- Muestra: lectura individual de un canal.

Una sesión puede incluir varias capturas. Un reinicio no debe conservar silenciosamente el identificador de una captura anterior. La secuencia se incrementa al generar un registro, aunque luego no se transmita.

## 2. Posiciones del contrato y subconjunto configurado

El contrato define seis posiciones lógicas. Una configuración concreta declara un **subconjunto** de ellas (de 1 a 6, en el orden de la tabla, sin repetir). Actualización del 3/11/2026: el prototipo físico es un **módulo unilateral izquierdo** (un ESP32, tres divisores FSR, configuración `ESP32-FSR-L-001`), por lo que declara `L_HEEL`, `L_MEDIAL` y `L_LATERAL`. Las posiciones no declaradas quedan «no disponibles» en todo el sistema: nunca se rellenan con ceros ni con valores copiados, las métricas que las requieren (reparto izquierda/derecha, asimetría por zona) se informan como no disponibles, y la interfaz las muestra como «n/d». La configuración simulada sigue declarando las seis.

| Código de posición | Pie | Zona | Modelo anunciado |
|---|---|---|---|
| L_HEEL | Izquierdo | Talón | FSR406 |
| L_MEDIAL | Izquierdo | Antepié medial | FSR402 |
| L_LATERAL | Izquierdo | Antepié lateral | FSR402 |
| R_HEEL | Derecho | Talón | FSR406 |
| R_MEDIAL | Derecho | Antepié medial | FSR402 |
| R_LATERAL | Derecho | Antepié lateral | FSR402 |

El código de posición no identifica por sí solo la unidad física. Conservar un identificador de instalación de sensor dentro de cada configuración. Los GPIO se definirán después de identificar la placa; no forman parte del significado de los códigos.

## 3. Decisiones operativas propuestas para el primer contrato

Se propone nombrar la primera versión lógica 1.0. Esa denominación será efectiva cuando el contrato se implemente y compruebe; la tesis no afirma que ya exista.

Los identificadores serán cadenas no vacías. La aplicación utilizará identificadores persistentes para perfiles y sesiones. El dispositivo debe producir un capture_id que no colisione entre reinicios y ejecuciones. Definir y comprobar el mecanismo real antes de integrar BLE.

sequence y time_us serán enteros no negativos representables sin pérdida en los módulos TypeScript. Si la codificación embebida utiliza enteros mayores, definir una representación compatible en el protocolo; no convertirlos silenciosamente a valores de precisión insuficiente.

Para la primera implementación proponemos status = ok o read_error. Una lectura ok admite un cero digital legítimo. Una lectura read_error se representa con raw_value = null. Añadir otros estados exige documentar su significado y compatibilidad.

Los valores crudos estarán dentro del rango eléctrico documentado en la configuración. La resolución ADC y su rango no se deducen del nombre comercial de la placa.

## 4. Registro normalizado

Campos generados por la fuente:

| Campo | Tipo lógico | Regla |
|---|---|---|
| format_version | Cadena | Versión admitida |
| device_id | Cadena | Fuente identificada |
| capture_id | Cadena | Captura única para esa fuente |
| configuration_id | Cadena | Configuración previamente conocida |
| sequence | Entero | Contador por captura |
| samples | Lista | Lecturas individuales con identificadores explícitos |
| samples.channel_id | Cadena | Canal declarado por la configuración |
| samples.time_us | Entero | Tiempo relativo asignado al inicio de la lectura |
| samples.raw_value | Entero o null | Valor ADC original o error explícito |
| samples.unit | Cadena | adc_count en la primera versión |
| samples.status | Cadena | ok o read_error, según propuesta inicial |

Campos añadidos por el adaptador y la aplicación:

- source: physical o simulated, determinado por el adaptador elegido; no confiar en una etiqueta externa para reclasificar la procedencia.
- session_id: sesión a la que se incorpora.
- received_at: recepción del registro completo en el teléfono, expresada como fecha/hora con zona. No reemplaza el tiempo de adquisición.

La muestra mantiene su propio tiempo aunque el registro contenga los seis canales. La precisión representacional de microsegundos no demuestra precisión física de microsegundos.

## 5. Ejemplo exclusivamente simulado

Las cifras son ilustrativas. No expresan frecuencia ni desfase medidos en el hardware.

~~~json
{
  "format_version": "1.0",
  "device_id": "SIM-001",
  "capture_id": "SIM-CAPTURE-001",
  "configuration_id": "SIM-CONFIG-001",
  "sequence": 0,
  "source": "simulated",
  "session_id": "SIM-SESSION-001",
  "received_at": "2026-10-13T12:00:00-03:00",
  "samples": [
    {"channel_id":"L_HEEL","time_us":0,"raw_value":100,"unit":"adc_count","status":"ok"},
    {"channel_id":"L_MEDIAL","time_us":400,"raw_value":200,"unit":"adc_count","status":"ok"},
    {"channel_id":"L_LATERAL","time_us":800,"raw_value":300,"unit":"adc_count","status":"ok"},
    {"channel_id":"R_HEEL","time_us":1200,"raw_value":400,"unit":"adc_count","status":"ok"},
    {"channel_id":"R_MEDIAL","time_us":1600,"raw_value":500,"unit":"adc_count","status":"ok"},
    {"channel_id":"R_LATERAL","time_us":2000,"raw_value":null,"unit":"adc_count","status":"read_error"}
  ]
}
~~~

## 6. Validación al ingresar datos

Implementar una función de validación en ejecución independiente de los tipos TypeScript. Debe devolver resultado válido o una lista de errores concretos. No sustituir este control por una conversión de tipos.

Comprobar versión, tipos, identificadores, configuración, canales, unidades, estados, números finitos y límites representacionales.

Cada registro debe traer **exactamente las posiciones declaradas por su configuración**, una vez cada una (seis con la configuración simulada, tres con el módulo unilateral). Si falta una posición declarada, rechazar el registro del conjunto válido, conservar evidencia en diagnóstico y generar un evento; no rellenarla con cero. Una posición que la configuración no declara se rechaza con `channel_not_in_configuration`. No existe aceptación parcial dentro de una configuración. Un registro completo con una muestra read_error conserva las demás lecturas válidas.

En la primera implementación, una sesión utiliza una única procedencia: physical o simulated. No mezclar ambas dentro de la misma sesión. Vincular las capturas con el dispositivo y la configuración autorizados al iniciar o reanudar la sesión; rechazar cambios inesperados. Un cambio físico deliberado de configuración exige cerrar la sesión e iniciar otra. Un reinicio con la misma configuración puede crear otra captura dentro de la sesión, dejando constancia de la discontinuidad.

Una lectura fallida identificada no implica necesariamente que las otras cinco sean inválidas. Un mensaje cuya estructura impide interpretar la captura no se incorpora como un registro válido.

Los valores numéricos fuera del rango declarado son errores de contrato. Una lectura en un límite del ADC puede registrarse como dato original y advertencia técnica; no demuestra por sí sola que el FSR haya alcanzado un límite de fuerza.

## 7. Duplicados, orden y discontinuidades

Clave externa: device_id + capture_id + sequence.

- Una retransmisión idéntica no crea otro registro.
- El mismo identificador con contenido diferente es un conflicto: conservar evidencia y no sobrescribir el original.
- Un salto de secuencia genera una discontinuidad observada. Diferenciar registros ausentes de muestras planificadas ausentes.
- Si se admiten registros fuera de orden, documentar la ventana y actualizar la evaluación de huecos cuando llegue información tardía. No confundir orden de llegada con orden de adquisición.
- Reinicio de captura: nueva referencia temporal y secuencia; se conserva la sesión cuando corresponda.
- La reconexión no recupera automáticamente datos no recibidos.

Conservar el payload problemático en un registro de diagnóstico acotado y separado de muestras válidas. Definir límite de almacenamiento y excluir secretos o datos personales innecesarios.

## 8. Transporte separado del significado

El simulador produce el contrato normalizado directamente. El adaptador físico reconstruye el registro transportado y añade procedencia y recepción.

USB puede comenzar con una representación JSON por línea para diagnóstico, separando mensajes de estado y mediciones. Es una propuesta de codificación de prueba, no el formato obligatorio de BLE.

Antes de fijar BLE: seleccionar biblioteca, servicio, características, tamaño útil, agrupación y estrategia de reconstrucción. No asumir que el mismo JSON de seis muestras cabe en una notificación.

Si se fragmenta: identificar registro y fragmento, longitud y cantidad; definir plazo de reconstrucción y límites de memoria; rechazar conjuntos incompletos, contradictorios o de otra captura. Sólo después normalizar y almacenar el registro completo.

## 9. Entidades y relaciones

| Entidad | Contenido mínimo |
|---|---|
| Usuario | ID local y vinculación remota opcional |
| Dispositivo | ID, modelo documentado, firmware identificado |
| Configuración | ID, dispositivo, versión de adquisición y montaje |
| Canal | ID de instalación, configuración, código, pie, posición, modelo y unidad física |
| Sesión | ID, usuario, actividad, inicio, cierre, estado, contexto y duración documentada |
| Captura | ID interno, dispositivo, ID externo, sesión, configuración, origen |
| Registro | Captura, secuencia, versión, recepción |
| Muestra | Registro, canal, tiempo relativo, valor, unidad, estado |
| Calibración | Canal y configuración, parámetros, unidades, rango y evidencia |
| Resultado | Métrica, intervalo/captura, canales, unidad, valor, cantidades y versión |
| Evento | Sesión/captura, tipo, referencia temporal y descripción acotada |

Relaciones: usuario 1:N sesiones; sesión 1:N capturas; captura 1:N registros; registro 1:N muestras; configuración 1:N canales. Resultados que utilicen varias calibraciones necesitan una relación auxiliar para conservarlas.

**Sesión con módulos (ADR 0011).** Una sesión puede tener uno o dos módulos, cada uno un dispositivo con su configuración y sus capturas; en la base no hay una entidad «módulo»: las capturas de una sesión se agrupan por `device_id`. Reglas: los dos módulos instrumentan pies distintos (el pie se deduce de los códigos de su configuración), comparten procedencia (`simulated`/`physical`) y nunca comparten `device_id`. Cada módulo conserva su `capture_id`, su `sequence` y su `time_us`; no se construye una secuencia global. La correspondencia temporal entre módulos se estima por `received_at` (origen de reloj = mediana de `received_at − time_us`; el desfase entre orígenes se declara, no se corrige) y los tramos sin ambos módulos se marcan con los eventos `module_lost` / `module_recovered` (con `device_id` y `foot`). Las métricas bilaterales (`bilateral-1.0`) se calculan sólo en los tramos completos y se acompañan de `offset_ms` y `complete_fraction`. El paquete de respaldo lleva `configurations[]` (una por módulo) además de `configuration` (la primera, por compatibilidad). El esquema remoto conserva hoy la configuración del primer módulo (`session.configuration`); la segunda queda registrada en las capturas locales y en el paquete; ampliar el remoto es una evolución futura.

**Entrenamiento declarado (ADR 0013).** Junto a lo medido, la base guarda lo que la persona declara: `routine` (nombre, objetivo, origen `own`/`professional`, nota del profesional, archivado), `routine_item` (orden, tipo `strength`/`walk_run`/`other`, nombre, objetivo en JSON, indicaciones, descanso), `workout` (rutina opcional, fecha local, estado `planned`/`in_progress`/`completed`, notas) y `workout_entry` (ejercicio copiado por nombre, tipo, serie, repeticiones, peso, duración, distancia, RPE 1–10, nota de molestia textual, notas, hora). El único nexo con lo medido es `session_link` (sesión → entrenamiento y, opcionalmente, serie). Estas tablas nunca alimentan los resultados de las métricas: son datos declarados y se presentan así en pantallas, informe y asistente. Migración local v6; esquema remoto preparado en `supabase/migrations/0005_training.sql` (transferencia pendiente); el paquete de respaldo de una sesión incluye `training` cuando está vinculada.

No almacenar únicamente un arreglo de seis valores sin contexto. No modificar una configuración ya asociada con registros: generar otra versión cuando cambien sensor, ubicación, circuito, montaje o adquisición.

## 10. Restricciones del esquema a implementar

- Claves primarias persistentes.
- Claves foráneas habilitadas y comprobadas por conexión SQLite.
- Unicidad de dispositivo + capture_id externo.
- Unicidad de captura interna + sequence.
- Unicidad de configuration_id + código de posición.
- Una muestra sólo referencia un canal de la configuración de su captura.
- No duplicar una muestra de un canal dentro del mismo registro.
- Estado y null coherentes; unidades y tiempos obligatorios.
- Los resultados conservan versión de algoritmo y referencias de calibración.

El esquema físico, las relaciones auxiliares y los índices se documentarán al implementarse. Esta guía no sustituye una migración SQL probada.

## 11. Escritura y recuperación

Usar consultas parametrizadas y una cola de escritura con operaciones acotadas. Registro y muestras deben guardarse en una misma transacción. Elegir la interfaz transaccional de expo-sqlite y comprobar su comportamiento frente a escrituras concurrentes.

Una confirmación en la interfaz significa commit comprobado. Diferenciar memoria temporal de datos persistidos. Si la escritura falla, comunicar el estado, conservar lo recuperable y registrar el incidente; no mostrar éxito.

Recuperar por sesión, captura, canal y segmento. La reducción de puntos para dibujar un gráfico no cambia las muestras almacenadas.

## 12. Migración, respaldo y sincronización

Versionar migraciones y utilizar user_version como valor administrado por la aplicación. No asumir que SQLite ejecuta migraciones automáticamente.

Preparar una copia consistente antes de cambios relevantes. Restaurarla en una ubicación de prueba y comprobar relaciones y cantidades. Una copia en el mismo espacio que se pierde junto al original no es protección suficiente.

La sincronización utiliza los mismos identificadores, confirmación de registros aceptados y reintentos idempotentes. Conservar la titularidad local original: un cambio de cuenta no debe reasignar sesiones pendientes.

Sincronización y respaldo son mecanismos distintos. No implementar borrados remotos ni resolución automática de conflictos sin definir antes su semántica.

