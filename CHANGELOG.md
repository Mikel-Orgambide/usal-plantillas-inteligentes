# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Las versiones siguen la de la app (`apps/mobile/app.json`); cada etapa cerrada lleva además un tag `vX.Y-etapaN` (ver [`docs/incrementos`](docs/incrementos/README.md)). «Implementado» no significa «validado»: la evidencia de cada etapa dice qué se comprobó y con qué datos.

## [Sin publicar]

- Pendiente: validación física de la sesión bilateral con dos ESP32 (6/11/2026); caracterización H3 por sensor; despliegue de la función `assistant` y validación del asistente en ambos modos.

## [0.15.3] — 2026-11-11

- Informe PDF: la tasa efectiva se calcula por captura (un módulo ausente ya no baja la tasa informada) y la lista de sesiones comparables exige el mismo conjunto de configuraciones (antes bastaba la del primer módulo).
- Detalle: con dos módulos, las capturas se rotulan con su pie («Izquierdo 1», «Derecho», «Izquierdo 2») y se aclara que el otro pie figura como n/d en esa vista.
- Evidencia: módulo derecho por USB, primera sesión bilateral con dos placas y prueba de corte de un módulo (`docs/tesis/04_Evidencia_y_pruebas.md` §3 bis).

## [0.15.2] - 2026-11-04 — pulido de la actividad, el historial y la navegación

### Cambiado
- Grabación: el alternador «123» pasa a un selector «Pies | Números grandes».
- Finalizar la sesión de plantillas cierra toda la actividad (también el entrenamiento vinculado), con una confirmación única «Finalizar sesión y entrenamiento». En la pestaña Rutina, «Terminar rutina» cierra sólo el entrenamiento y la medición sigue.
- Un entrenamiento que termina sin ninguna serie ni nota se descarta en vez de guardarse vacío. Los vacíos que ya existían se muestran «sin series» y se pueden borrar desde su detalle.
- Descanso: mientras corre no se puede pasar a otra serie ni a otro ejercicio; el botón principal pasa a «Saltar descanso» y los chips de ejercicio avisan. «Listo» no admite doble toque.
- Historial con dos vistas, «Sesiones | Entrenamientos», cada una con sus contadores y filtros; los entrenamientos se filtran por tipo de rutina. Orden dentro del día por hora de inicio.
- Tipo de rutina opcional (Piernas, Tren superior, Cuerpo completo, Core, Cardio / caminata, Movilidad, Rehabilitación, Otro): se elige al crear o editar la rutina, el entrenamiento lo copia al iniciar y se muestra en las tarjetas (base local v8: `routine.category`, `workout.category`).
- Navegación: cada pestaña vuelve a su raíz al dejarla; el detalle de una sesión se abre con la lista de Historial debajo («atrás» vuelve a la lista y no queda abierto al volver a la pestaña).

### Corregido
- Borrar una serie desde la actividad no actualizaba el cursor ni la lista de hechas.
- Finalizar desde la pantalla de entrenamiento el que estaba en curso dejaba la isla y la actividad abiertas.
- Cargar una serie desde la pantalla de entrenamiento no movía el cursor de la rutina en curso.
- Los errores de «Cargar ejercicio» fuera de la rutina aparecían en la tarjeta de la serie en curso.
- Una serie de fuerza con 0 repeticiones se aceptaba.
- Guardar una rutina admitía doble toque.

## [0.15.1] - 2026-11-04 — actividad unificada (ajuste de la etapa 15)

### Corregido
- La pantalla Entrenamiento cerraba la app al abrirse desde Hoy (hook declarado después de la salida temprana).

### Añadido
- Actividad unificada: rutina opcional al iniciar la sesión; pestañas Medición | Rutina; ejecución ejercicio por ejercicio con serie precargada y editable, descanso entre series (`rest_sec`, 90 s por defecto) con cuenta regresiva y «Saltar», cronómetro de caminata con cuenta regresiva al objetivo, progresión por ejercicio, «Fuera de la rutina», finalizar con nota.
- Isla flotante con la actividad en curso (grabación, descanso, caminata) en todas las pantallas.
- Hoy: tarjeta «Entrenamiento» como puerta (seguir, iniciar rutina sin plantillas, crear, ver rutinas). Historial: entrenamientos como entradas propias del día, también sin sesiones medidas. Detalle de sesión: series declaradas durante la sesión. PDF: series de la sesión marcadas.
- `@plantillas/training/activity`: máquina de estados pura con pruebas; persistencia local v7 (`workout_entry.session_id`).
- Asistente: contexto con el ejercicio y la serie en curso; la carga por conversación avanza la actividad.

### Cambiado
- Formularios: teclado en modo `resize`, desplazamiento ajustado al teclado, campos numéricos con selección al enfocar.

## [0.15.0] - 2026-11-04 — etapa 15 (implementada; validación en el teléfono pendiente)

### Añadido
- Rutinas y entrenamiento (ADR 0013): paquete `@plantillas/training`; rutinas con ejercicios de fuerza, caminata/carrera u otro y valores objetivo; entrenamientos con series declaradas (reps, peso, duración, distancia, RPE, molestia como nota); vínculo sesión↔serie («Medir con plantillas» desde el ejercicio); tarjeta «Entrenamiento del día» en Hoy, fila en Historial, chip en Detalle, sección «Entrenamiento asociado» en el PDF; Ajustes → Rutinas.
- Asistente: contexto con el entrenamiento declarado y carga asistida de series por conversación con tarjeta de confirmación (modo `log_entry`, prompt compartido con la función gestionada).
- Asistente: sugerencias de seguimiento tras cada respuesta y «Nueva conversación»; la conversación se conserva mientras la app está abierta.
- Persistencia local v6 y respaldo con entrenamiento; esquema remoto preparado (`0005_training.sql`, transferencia pendiente).
- `docs/especificacion/08_Alcance_Final_del_Prototipo.md`: alcance completo al cierre del desarrollo.

### Cambiado
- Detalle de sesión y Comparación: las acciones (comparar, PDF, CSV) pasan al menú de la cabecera; el contenido ocupa toda la pantalla.

## [0.14.3] - 2026-11-04 — ajustes del asistente

### Corregido
- Contexto del asistente: las fechas y horas se muestran en la zona horaria del teléfono (con la zona declarada en el contexto y una forma corta para citar, «3/11 17:44»), en lugar de depender de la hora del motor; orden por instante de inicio.
- Un sensor instrumentado que no recibió carga figura como «0 en toda la sesión (instrumentado, sin carga registrada)», distinto de «no disponible».

### Añadido
- Ficha de conocimiento (`packages/assistant/src/knowledge.ts`): qué mide el sistema, cómo se calcula y se lee cada indicador, qué puede explicar una diferencia entre sesiones y los límites del prototipo.
- Prompt en tres niveles: medición; lectura descriptiva y educativa (permitida: qué significa un indicador o un cambio, causas no clínicas posibles, cómo comparar mejor); lo clínico, no.
- Comparación precalculada en el contexto entre la sesión principal y la anterior comparable (deltas por posición, absolutos y %, cambio de reparto en puntos porcentuales, condiciones), o el motivo por el que no es comparable.
- Chat del asistente a pantalla completa (`/asistente`, modal sobre la barra inferior): cabecera con la sesión y el modo, preguntas sugeridas, indicador de escritura, «Reintentar» y etiqueta «Generado por IA · revisar» discreta.
- `scripts/sync-assistant-prompt.mjs`: genera `supabase/functions/_shared/assistant-prompt.ts` desde el paquete; una prueba falla si quedó desactualizado.

### Cambiado
- Clasificación: las preguntas de lectura («¿qué significa?», «¿qué cambió?», «¿por qué?») y los consejos sobre el registro («¿qué puedo mejorar para comparar?») ya no se rechazan; los consejos que no hablan del registro y las preguntas por valores «normales» siguen siendo clínicos.
- Generación: `temperature` 0,4, `max_tokens` 600, últimos 6 turnos; la función gestionada usa los mismos valores y el mismo prompt (ya no hay copia a mano).

## [0.14.1] - 2026-11-04 — etapa 14, modo nube

### Añadido
- Asistente en modo **Nube (gestionado)**, por defecto: la app llama a la Edge Function `assistant` de Supabase con la cuenta iniciada; la clave del proveedor (OpenRouter, `qwen/qwen3-14b`) vive en los secretos del backend; límite de 30 preguntas por usuario y hora (`assistant_usage`, migración remota 0004). Nadie tiene que configurar nada.
- `createAssistantClient` con dos transportes (`proxy` y `direct`); códigos de error `unauthorized` y `rate_limited`.
- Ajustes → Asistente: selector «Nube · recomendado / Servidor propio»; «Probar conexión» en ambos.

### Cambiado
- `assistant_exchange` guarda el modo con el que se respondió (migración local 5).
- ADR 0012 actualizado: dos modos, datos que salen del teléfono en cada uno, sin entrenamiento.

## [0.14.0] - 2026-11-04 — etapa 14 (implementada; validación con el modelo pendiente)

### Añadido
- ADR 0012 y `packages/assistant`: contexto armado en el teléfono, filtro clínico previo con respuestas fijas, cliente compatible con OpenAI (LM Studio), descarte de bloques `<think>`; registro local `assistant_exchange` (migración 4).
- App: botón flotante en Hoy, Historial y Detalle; hoja de chat con chip «Generado por IA · revisar»; Ajustes → Asistente.
- Esquema remoto 0003 (`session_configuration`): sesiones bilaterales con las configuraciones de todos los módulos; `packages/sync` las envía y las exige para confirmar.

## [0.13.1] - 2026-11-04

### Añadido
- Grabación: modo de números grandes (alternador «123»), para leer el teléfono desde lejos en un ensayo de banco; preferencia persistida.
- Detalle: «Exportar sesión (CSV)», una fila por muestra con valores originales en `adc_count` (`@plantillas/report`: `buildSessionCsv`).
- Repositorio: README completo, licencia MIT y este registro de cambios.

## [0.13.0] - 2026-11-04 — etapa 13 (implementada; validación física pendiente)

### Añadido
- ADR 0011: dos módulos autónomos, uno por pie; la app es cliente de dos servidores BLE; correspondencia temporal por instante de recepción con desfase declarado; si se pierde un módulo la sesión sigue y el tramo queda incompleto.
- Sesión con uno o dos módulos: estado por módulo (`identified`, `connected`, `stale`, `disconnected`, `reconnecting`), captura, cola y secuencia propias; eventos `module_lost` / `module_recovered`.
- Métricas `bilateral-1.0`: izquierda/derecha y asimetría sólo sobre tramos con ambos módulos; `offset_ms` y fracción completa declarados.
- Firmware 0.3.1: entorno `esp32-analog-right` (`ESP32-FSR-R-001`) para el módulo del pie derecho.
- App: Plantillas con una fila por pie, Grabación con chips de estado por módulo y aviso de módulo perdido, Detalle con calidad por módulo, Comparación e informe PDF bilaterales; simulador con dos módulos y deriva de reloj configurable.
- Respaldo: `configurations[]` en el paquete de sesión (compatible con paquetes anteriores).

### Cambiado
- Numeración de etapas: 13 = bilateral; el asistente explicativo pasa a 14.

## [0.12.0] - 2026-11-03 — etapa 12 (implementada; validada en la build preview 0.12.0 el 3/11)

### Añadido
- Marca «.NSL» (ADR 0009): ícono `.N`, ícono adaptativo, splash, componente `Brand` (Manrope 800) en Ajustes → «Acerca de» y en la hoja de cuenta; fuentes en `docs/diseno/marca/`.
- Informe de sesión para revisión profesional en PDF (ADR 0010): `@plantillas/report` genera HTML autocontenido con SVG; `expo-print` lo convierte y se comparte; ocho secciones (identificación seudonimizada, montaje y canales, origen y transporte, calidad, indicadores, gráficos, comparabilidad, limitaciones). Describe mediciones, no diagnostica. Disponible también para la comparación de dos sesiones.

### Cambiado
- Nombre visible de la app: «NSL».

## [0.11.0 + fuente física] - 2026-11-03 — etapa 9 (en curso: banco validado; falta H3 por sensor)

### Añadido
- Firmware 0.3.0: `esp32-analog` con tres canales (`ESP32-FSR-L-001`, pines 36/39/34, modelo por canal, registro binario de `9 + 6 × n` bytes); entorno `esp32-adc-test` para pruebas de banco.
- Contrato: una configuración declara un subconjunto de las seis posiciones en el orden del contrato; el validador de registros exige exactamente las de la configuración (`channel_not_in_configuration`).
- Sesión y app: posiciones no instrumentadas como «n/d» (estado `unavailable`), nunca cero; métricas izquierda/derecha y asimetría `null` sin ambos pies.
- `scripts/check_serial.py` toma los canales de la línea `info` del log.
- Evidencia: banco de FSR (resistencias 2,2 kΩ talón y 4,7 kΩ antepié elegidas por ensayo), 475 registros por USB sin saltos a 50,00 ms, dos sesiones físicas por BLE desde la app (436 y 609 registros, sin saltos), capturas y exports en `test-data/fisico/` y `docs/capturas/0.12.0-fsr/`.

## [0.11.0] - 2026-10-27 — etapa 11 (cerrada)

### Añadido
- Complemento remoto (ADR 0008): cuenta con correo y contraseña (Supabase Auth), esquema remoto con titularidad y RLS (migraciones 0001 y 0002), `@plantillas/sync` con identificadores estables, lotes y confirmación por cantidades; sincronización automática al cerrar una sesión, iniciar sesión, abrir la app y volver a primer plano.
- Una cuenta por vez: Inicio e Historial muestran sólo las sesiones de la cuenta activa.
- Hoy con día navegable y tres indicadores del día; Historial por día (propuesta B de Figma); barra Historial · Hoy · Más; Ajustes en la barra.

### Corregido
- Privilegios del rol `authenticated` (`permission denied for table session`); errores de red legibles; almacén de sesión síncrono (NullPointerException del kv-store asíncrono).

## [0.10.0] - 2026-10-20 — etapa 10 (cerrada)

### Añadido
- Respaldo y restauración (ADR 0007): paquete por sesión y copia completa, importación con validación y deduplicación; build preview sin servidor de desarrollo.
- Evidencia reproducible desde una copia limpia (`npm ci`, typecheck, 103 pruebas, `expo export`).

## [0.8.0] - 2026-10-20 — etapa 8 (cerrada: H0, H1, H5, H6 con lecturas sintéticas)

### Añadido
- Firmware ESP32 (ADR 0006): adquisición en tarea propia a 20 reg/s, USB JSON por línea a 230400, servicio GATT con registros binarios, `start` idempotente, reanudación de captura al reconectar; `device_id` por MAC; contador de arranques en NVS.
- `@plantillas/ble` y pestaña Plantillas: búsqueda, conexión, reconexión, sesión física con lecturas sintéticas de la placa (H06 verificada: desconexión de 5 s reconocida y recuperada).

## [0.7.0] - 2026-10-19 — etapa 7 (cerrada)

### Añadido
- Historial y comparación: política de comparabilidad (misma configuración, unidad, procedencia y versión de métrica) y diferencias numéricas por posición.

## [0.6.0] - 2026-10-19 — etapa 6 (cerrada)

### Añadido
- `@plantillas/metrics`: media, máximo, desvío poblacional y cantidades por canal con versión de algoritmo (`desc-1.0`); tabla `result`.

## [0.5.0] - 2026-10-19 — etapa 5 (cerrada)

### Añadido
- Pantallas mínimas sobre el sistema de diseño (ADR 0005): Hoy, Grabación, Detalle, Historial, Ajustes; barra inferior; siluetas y gráfico de ventana reciente.

## [0.4.0] - 2026-10-18 — etapa 4 (cerrada)

### Añadido
- `@plantillas/session`: coordinador con máquina de estados, cierre idempotente y recuperación de sesiones abiertas.

## [0.3.0] - 2026-10-18 — etapa 3 (cerrada)

### Añadido
- `@plantillas/storage` (ADR 0004): SQLite versionado con migraciones, repositorio y cola de escritura serializada.

## [0.2.0] - 2026-10-18 — etapa 2 (cerrada)

### Añadido
- `@plantillas/simulator`: fuente simulada determinista con escenarios de falla (`read_error`, `disconnect`, `sequence_gap`, `capture_restart`) y pantalla de verificación.

## [0.1.0] - 2026-10-18 — etapa 1 (cerrada)

### Añadido
- `@plantillas/contract`: contrato de datos v1.0 (seis posiciones, `adc_count`, validación en ejecución, normalización y secuencia).

## [0.0.0] - 2026-10-18 — etapa 0 (cerrada)

### Añadido
- Monorepo (ADR 0001–0003): Expo SDK 57 / React Native / TypeScript, workspaces, EAS, CI con typecheck y pruebas, plantilla de variables de entorno.
