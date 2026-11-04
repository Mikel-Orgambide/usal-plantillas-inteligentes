# ADR 0011 - Dos módulos autónomos (uno por pie) y sesión bilateral

- Fecha: 2026-11-04
- Estado: aceptada (pendiente de validación física con dos placas)

## Contexto

El cierre del 27/10/2026 (§6.1) eligió como diseño bilateral **un módulo independiente por pie**, cada uno con su ESP32 y su alimentación, para evitar cableado entre los pies. El prototipo validado el 3/11 es un módulo unilateral izquierdo de tres canales (`ESP32-FSR-L-001`, ADR y etapa 9); el autor construirá el segundo módulo (pie derecho) el 6/11. La aplicación ya admite configuraciones de subconjunto (posiciones no declaradas = «no disponible»), pero una sesión sólo podía tener una fuente. El mismo documento exige: recepción independiente por módulo; no construir una secuencia global ficticia; declarar cómo se estima la correspondencia temporal y con qué error; política explícita ante la pérdida de un módulo; métricas bilaterales sólo con ambos pies y correspondencia temporal.

## Decisión

### Topología
- Un ESP32 por pie, con el mismo firmware y un entorno de compilación por pie (`esp32-analog` → `ESP32-FSR-L-001`, `esp32-analog-right` → `ESP32-FSR-R-001`), mismos pines y resistencias. La app es cliente GATT de hasta dos servidores a la vez. El nombre anunciado sigue siendo `Plantillas-<hex>`; el pie se deduce de la configuración que publica la placa (`info`), no del nombre.
- Alternativas descartadas: (a) un módulo intermediario que retransmite al otro, porque agrega un salto de radio y un segundo reloj sin eliminar el problema de correspondencia; (b) una sola placa con seis entradas y cables entre los pies, viable eléctricamente (validada en banco con 6 canales en la etapa 8 sintética) pero inviable como wearable.

### Sesión con módulos
- Una sesión se abre con **uno o dos módulos**. Cada módulo = (`device_id`, `configuration`, sus capturas). Se rechaza abrir una sesión con dos módulos del mismo pie o con procedencias distintas (`simulated` / `physical` nunca se mezclan).
- Cada módulo conserva su propio `capture_id`, su `sequence` y su `time_us`. No existe una secuencia global: los huecos y reinicios se siguen por módulo, y una captura de la base pertenece a un solo dispositivo.
- Estado por módulo en el instante vivo: `identified` (conocido, sin enlace), `connected`, `disconnected`, `reconnecting`, `stale` (sin registros recientes). Las posiciones del módulo ausente se muestran `unavailable`, nunca cero.

### Correspondencia temporal
- Se alinea por **instante de recepción en el teléfono** (`received_at`), que es la única referencia común. Para cada módulo se estima el origen de su reloj como la mediana de `received_at − time_us` sobre sus registros; la diferencia entre los orígenes de ambos módulos es el **desfase estimado** (ms) y se declara en métricas, pantalla e informe. No se llama «sincronización»: incluye la latencia BLE de cada enlace y la deriva de cada reloj, y no se corrige.
- Un intervalo es **completo** cuando ambos módulos tienen registros con huecos de recepción menores a 1 s. La fracción completa de la sesión (`complete_fraction`) se informa junto con cualquier métrica bilateral.

### Pérdida de un módulo
- Si un módulo se desconecta y el otro sigue, **la sesión continúa**: se registra `module_lost` (con `device_id`) y, al volver, `module_recovered`; el tramo entre ambos es incompleto. La sesión pasa a `interrupted` sólo cuando no queda ningún módulo con enlace.
- Las métricas unilaterales del módulo presente se calculan con normalidad. Las bilaterales (reparto izquierda/derecha, asimetría por zona) se calculan **sólo sobre los intervalos completos**; si la fracción completa es 0, quedan «n/d».

### Métricas e informe
- Por canal: sin cambios (`desc-1.0`, por captura). Bilateral: `bilateral-1.0` sobre los registros de ambas capturas restringidos a intervalos completos, con `offset_ms` y `complete_fraction`. Comparación e informe PDF incluyen el bloque bilateral cuando existe y declaran desfase y fracción completa.

## Consecuencias

- `packages/session`: el coordinador acepta `modules[]` (compatibilidad: `source` + `configuration` equivalen a un módulo). `packages/metrics`: `computeBilateral` sobre el paquete de sesión. `packages/report` y pantallas: bloque bilateral con sus salvedades.
- Dos enlaces BLE simultáneos duplican el tráfico de notificaciones (2 × 20 registros/s): se valida con las dos placas el 6/11, con registro de tasa efectiva y descartes por módulo.
- La validación con dos fuentes **simuladas** (relojes con distinto origen y deriva, pérdida y reconexión de un módulo) comprueba la lógica, no el enlace físico: se documenta como tal (etapa 13) y no sustituye la prueba con dos placas.
- Pendiente para la validación física: tasa sostenida con dos enlaces, comportamiento de Android con dos conexiones, desfase real observado, autonomía (fuera de alcance de esta entrega).
