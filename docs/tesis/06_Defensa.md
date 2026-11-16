# 06 — Recorrido reproducible de la demostración

- Versión: app 0.15.3 (build `preview` instalada con `adb install -r`, ver el README), firmware 0.3.0 en la placa izquierda y 0.3.1 en la derecha, etiqueta `entrega-final`.
- Requisitos de la cátedra que cubre (Clases 13 y 14): sistema desplegado, datos de prueba cargados, guion de demostración de tres o cuatro acciones en menos de cuatro minutos, ambiente de respaldo e instrucciones reproducibles.
- El guion oral y la preparación de las preguntas de la defensa no forman parte del repositorio.

## 1. Recorrido (≤ 4 min, 4 acciones)

| # | Acción (qué se toca) | Tiempo | Respaldo si falla |
|---|---|---|---|
| 1 | **Plantillas** → conectar módulo izquierdo y módulo derecho (dos filas «Conectado») → **Nueva sesión** → grabar ~45 s apretando/apoyando sobre los sensores de cada banco; a los ~15 s **desenchufar el USB de una placa**, esperar ~10 s (la pérdida se registra a los ≈ 4,5 s) y volver a enchufar | 1:25 | Sin corte: sólo grabar con las dos placas. Sin placas: Ajustes → Demostración → «Simular dos módulos» (o «Simulador sin plantillas») y repetir; o abrir la sesión `2523ea01` ya guardada |
| 2 | Terminar → **Detalle de sesión**: calidad por módulo (esperados/recibidos, huecos), eventos «Módulo perdido» / «Módulo recuperado» con el tramo incompleto, izquierda/derecha calculado sólo en tramos completos, capturas rotuladas por pie («Izquierdo 1», «Derecho», «Izquierdo 2») | 0:45 | Abrir la sesión bilateral del 11/11 (`2523ea01`) o una física importada (`ca49daed`) |
| 3 | Menú → **Comparar** con la sesión anterior del mismo protocolo → **Exportar informe (PDF)** | 1:00 | Mostrar el PDF ya exportado (guardado en el teléfono y en la PC) |
| 4 | **Asistente** desde el Detalle: «¿Qué cambió respecto de la anterior?» y luego «¿Tengo una lesión en el talón?» | 0:45 | Cambiar a modo servidor propio (LM Studio) o mostrar el tramo del video |

Recorridos opcionales: Hoy → Entrenamiento (rutina con series y descanso, isla flotante), modo avión + sincronización, informe PDF de la sesión con corte (`test-data/fisico/informe-2026-11-11-2523ea01-bilateral-corte.pdf`).

## 2. Datos a cargar

| Dato | Archivo | Cómo cargarlo |
|---|---|---|
| Sesión física sin carga del pie (3 canales, 436 registros) | `test-data/fisico/sesion-2026-11-03-18763da6.plantillas.json` | Copiar al teléfono → **Ajustes → Respaldo → Por sesión → Importar sesión** (no modifica las existentes) |
| Sesión física con apoyo del pie (609 registros) | `test-data/fisico/sesion-2026-11-03-ca49daed.plantillas.json` | Ídem |
| Sesiones bilaterales del 11/11 | Quedan en el historial del teléfono de demo (`9befa503`, `2523ea01`). En el repo: `test-data/fisico/sesion-2026-11-11-9befa503-bilateral.csv` (CSV, evidencia; no se importa) e `informe-2026-11-11-2523ea01-bilateral-corte.pdf`. El paquete `.plantillas.json` de cada una se exporta desde el Detalle | Si se cambia de teléfono: importar el paquete como las anteriores |
| Dos sesiones bilaterales comparables (`d3367518` y `f66ec0f5`, 13/11, ≈ 90 s) | **Grabadas**; en el teléfono y en Supabase | Ídem |
| Sesión de respaldo antigua | `test-data/backup/sesion-2026-10-20-977b2add.plantillas.json` | Ídem |
| Base completa (alternativa) | Copia `.db` exportada desde el teléfono de demo | **Ajustes → Respaldo → Base completa → Restaurar una copia completa** (⚠ reemplaza todo) |
| Rutina de ejemplo | — | Crear antes: Ajustes → Rutinas → «Pierna» (Sentadilla 3 × 10 · 40 kg · descanso 60 s; Caminata 2 min; Elongación) |

Antes de empezar: tener en el historial al menos dos sesiones comparables del mismo protocolo (las dos unilaterales del 3/11 sirven; también las dos bilaterales del 13/11) y una con entrenamiento vinculado. Comparar sólo ofrece sesiones con el mismo conjunto de módulos (0.15.3): una bilateral no se compara con una unilateral.

## 3. Plan de respaldo (por capa)

| Falla | Respaldo 1 | Respaldo 2 |
|---|---|---|
| Placa/sensores/BLE no conectan | Modo simulado (Ajustes → Demostración; procedencia `simulated` visible) | Sesiones físicas importadas |
| Sin internet / Supabase pausado | La app es local-first: grabar, ver, comparar y exportar funcionan sin red | Mostrar capturas `test-data/remote/` |
| OpenRouter sin crédito o caído | Ajustes → Asistente → servidor propio (LM Studio en la PC, misma red) | Video |
| Red del lugar no permite la PC | Hotspot del teléfono con la PC conectada (LM Studio en `http://<ip-local>:1234`) | Video |
| Teléfono falla | Segundo dispositivo con la build instalada (si hay) | Video completo |
| Todo falla | **Video de la demo** (grabado antes) | Capturas en la presentación |
