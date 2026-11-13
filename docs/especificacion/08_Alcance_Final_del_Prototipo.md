# Alcance final del prototipo (cierre del desarrollo, 4 de noviembre de 2026)

Proyecto Final de Ingeniería en Informática — Mikel Orgambide Rueda. Versión de la app: 0.15.3; firmware 0.3.1 (placa derecha; la izquierda conserva 0.3.0). Actualizado el 11/11/2026 con la validación con dos placas.
Propósito: describir **qué hace realmente** la plataforma al cierre del desarrollo (etapas 0–15), separando en cada punto lo **validado con hardware real**, lo **implementado y probado con datos simulados** y lo **diseñado o documentado sin implementar**. Es la base para reescribir los capítulos de la tesis: ningún capítulo debe afirmar más de lo que dice este documento, y cada afirmación remite a su evidencia en `docs/incrementos/`.

Leyenda de estado: **[H]** validado con hardware real (FSR + ESP32 + app) · **[S]** implementado y probado con pruebas automáticas y datos simulados · **[D]** diseñado o preparado, no implementado o no validado.

## 1. Qué es

Una plataforma wearable que convierte la lectura de sensores plantares en registros organizados, indicadores descriptivos e información temporal consultable: sensores FSR bajo el pie → ESP32 (adquisición) → BLE → aplicación móvil (recepción, validación, persistencia, métricas, historial, comparación, informe) → servicio remoto (cuenta y copia de sesiones). Se complementa con un asistente explicativo (modelo de lenguaje) y un registro de entrenamiento declarado por la persona. No diagnostica, no prescribe, no mide fatiga ni fuerza.

## 2. Qué mide (señal adquirida)

| Elemento | Estado | Detalle y evidencia |
|---|---|---|
| Sensores | **[H]** | FSR406 en el talón y FSR402 en antepié medial y lateral, divisor resistivo (2,2 kΩ talón, 4,7 kΩ antepié), ADC 12 bits del ESP32 (cuentas 0–4095, unidad `adc_count`). Elección por ensayo (etapa 9). |
| Módulo unilateral izquierdo `ESP32-FSR-L-001` | **[H]** | 3 canales, 20 registros/s, USB y BLE; 475 registros sin saltos por USB; sesiones físicas con apoyo del pie (etapa 9, 3/11). |
| Módulo derecho `ESP32-FSR-R-001` | **[H]** | Placa `ESP32-68D1D8`, `esp32-analog-right` 0.3.1, banco propio en una segunda protoboard. USB 11/11: 397 registros, 0 saltos, 50,00 ms, 0 errores. Pendiente: corrida de 60 s y confirmar medial/lateral. |
| Sesión bilateral (dos módulos) | **[H]** recorrido básico / **[S]** resto | Dos fuentes BLE independientes, estado por módulo, tramos incompletos, correspondencia por recepción con desfase declarado (ADR 0011, etapa 13). Con dos placas (11/11): `9befa503`, 714 registros por módulo a 20,03 reg/s, 0 huecos; `2523ea01`, corte de un módulo con recuperación automática (pérdida detectada a ≈ 4,5 s, no ≤ 3 s), `complete_fraction` 75,5 %, desfase 125 ms. Sólo con simulación: comparación entre sesiones bilaterales, sincronización bilateral, deriva de reloj. Pendiente: sesión de ≥ 120 s con el pie. 13/11: sesión de 90 s `d3367518` (1802 + 1803 registros, 0 huecos, 99,9 % con ambos), comparación con `f66ec0f5` y PDF de comparación, y ambas sincronizadas en Supabase: también **[H]**. Sigue **[S]**: deriva de reloj y exactitud del desfase. |
| Montaje | **[H]** banco | Protoboard, sensores sobre el piso con moneda, apoyo estático del pie. Plantilla en calzado, cableado al cuerpo y autonomía: **[D]**, evolución futura (decisión del 3/11). |
| Calibración a fuerza/presión | **[D]** | No implementada; los valores son cuentas ADC. Caracterización H3 por sensor pendiente. |

## 3. Qué registra (datos y metadatos)

| Elemento | Estado |
|---|---|
| Contrato v1.0: configuración (dispositivo, canales, modelo anunciado, unidad), captura, registro con secuencia, muestra con `time_us`, valor y estado (`ok`/`read_error`, nunca cero por ausencia) | **[H]** |
| Procedencia `physical`/`simulated` separada del transporte (BLE/USB) | **[H]** |
| Sesión: actividad, contexto, inicio/fin, estado, eventos (conexión, captura, desconexión, reconexión, módulo perdido/recuperado) | **[H]** (unilateral y bilateral, incluido módulo perdido/recuperado el 11/11) |
| Persistencia local SQLite (v6), respaldo y restauración, exportación de sesión (`.plantillas.json`) y CSV | **[H]** |
| Cuenta y copia remota (Supabase: sesiones, capturas, registros, resultados, configuraciones de todos los módulos) | **[H]** unilateral sincronizada; bilateral **[H]** (13/11: dos sesiones de dos placas confirmadas con cantidades coincidentes) |
| Entrenamiento declarado: rutinas (propias o del profesional), ejercicios objetivo, entrenamientos, series (reps, peso, duración, distancia, RPE, molestia como nota), vínculo sesión↔serie, actividad unificada con descansos, tipo de rutina opcional e historial de entrenamientos separado (ADR 0013, etapa 15) | **[S]** (local; remoto preparado **[D]**) |
| Actividad unificada (ajuste 4/11): rutina ejercicio por ejercicio dentro de la sesión de plantillas, serie precargada y corregible, descanso entre series con cuenta regresiva, cronómetro de caminata, isla flotante con la actividad en curso, entrenamientos en Historial también sin sesión medida | **[S]** |

## 4. Qué calcula (métricas)

| Métrica | Versión | Estado | Condición |
|---|---|---|---|
| Descriptores por posición: media, máximo, desvío poblacional, n válidas/inválidas | `desc-1.0` | **[H]** | Cero válidas ⇒ no disponible |
| Reparto antepié/talón sobre posiciones instrumentadas; variabilidad | `dist-1.0` | **[H]** | |
| Izquierda/derecha y asimetría por zona | `dist-1.0` / `bilateral-1.0` | **[H]** (11/11, sensores apretados a mano) | Sólo con ambos pies y tramos completos; si no, n/d. En `2523ea01`: 60,4 / 39,6 % en tramos completos |
| Calidad: registros esperados/recibidos, huecos de secuencia, lecturas fallidas, desconexiones, tasa efectiva; por módulo | — | **[H]** | Con dos módulos el 11/11; la tasa se calcula por captura desde 0.15.3 |
| Comparación entre sesiones compatibles (misma configuración y procedencia): diferencias por posición y de reparto | — | **[H]** con dos sesiones físicas | |
| Resumen diario (Hoy): indicadores del día y sesiones | — | **[H]** | |
| Entrenamiento: series, volumen Σ reps×kg, minutos, RPE medio | — | **[S]** | Totales **declarados**, no medidos |

No se calculan: fuerza, presión, fatiga, riesgo de lesión, rendimiento futuro, ni ninguna magnitud clínica.

## 5. Qué muestra (aplicación)

Hoy (día navegable, tres indicadores con desglose, entrenamiento del día, sesiones del día) · Plantillas (búsqueda BLE, una fila por pie, estado por módulo) · Preparación y Grabación (siluetas con posiciones no instrumentadas en «n/d», gráfico en vivo, calidad, modo de números grandes) · Historial por día (sesiones y entrenamientos) · Detalle (calidad por módulo, carga por posición, bilateral, vínculo con entrenamiento, acciones en menú: comparar, PDF, CSV) · Comparación · Rutinas y Entrenamiento · Ajustes (cuenta, respaldo, demostración, asistente, rutinas, acerca de). Marca .NSL (ADR 0009). Estado: **[H]** en todo lo unilateral; **[S]** en lo bilateral y el entrenamiento.

## 6. Qué explica (asistente, ADR 0012)

- Dos modos: nube gestionada (función de Supabase con la clave del proveedor en el backend; OpenRouter · Qwen3 14B) y servidor propio (LM Studio en la red local). **[H]** ambos probados el 4/11 con sesiones físicas reales.
- Contexto armado en el teléfono (sesiones, indicadores, calidad, comparaciones precalculadas, entrenamiento declarado); ficha de conocimiento; tres niveles: medición, lectura descriptiva/educativa, y rechazo fijo de lo clínico sin consultar al modelo. Cada respuesta marcada «Generado por IA · revisar» y registrada localmente.
- Carga asistida de series con tarjeta de confirmación **[S]**.
- No entrena ni ajusta ningún modelo; no decide la validez de las mediciones.

## 7. Qué exporta y comparte

Informe PDF de sesión y de comparación para revisión profesional (ADR 0010; identificación seudonimizada, montaje, origen de señal, calidad, indicadores, gráficos, comparabilidad, limitaciones, entrenamiento declarado) **[H]**; CSV por muestra **[S]**; paquete de sesión `.plantillas.json` **[H]**; respaldo completo **[H]**.

## 8. Qué sincroniza

Sesiones cerradas con cuenta iniciada, confirmadas por cantidades (ADR 0008, etapa 11) **[H]**; configuraciones de todos los módulos (migración 0003) **[S]**; uso del asistente (sólo metadatos, migración 0004) **[H]**; rutinas y entrenamientos: esquema preparado (migración 0005), transferencia **[D]**.

## 9. Lo que queda fuera (evolución futura)

Plantilla integrada en el calzado y autonomía; calibración a fuerza; sesión bilateral de ≥ 120 s con el pie y consigna de cargas (no ejecutada: la más larga es de 90 s con carga manual, 13/11); detección de la pérdida de un módulo en menos de ≈ 4,5 s; sincronización de rutinas; herramientas de consulta a la base para el asistente; streaming de respuestas; integración con otros wearables; portal profesional; pruebas de uso con personas y utilidad clínica.

## 10. Evidencia

`docs/incrementos/etapa-09-fuente-fisica.md` (banco, resistencias, logs, sesiones físicas), `etapa-12-informe-profesional-y-marca.md`, `etapa-13-bilateral.md`, `etapa-14-asistente.md`, `etapa-15-rutinas.md`; `test-data/fisico/` (exports y logs serie), `docs/capturas/`; ADR 0001–0013; CHANGELOG. Pruebas automáticas: 190 al cierre (contract, simulator, storage, metrics, session, ble, sync, report, assistant, training).
