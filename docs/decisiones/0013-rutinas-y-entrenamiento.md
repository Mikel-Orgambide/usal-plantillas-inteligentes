# ADR 0013 - Rutinas y entrenamiento: registrar lo declarado y vincularlo con lo medido

- Fecha: 2026-11-04
- Estado: aceptada (cierre funcional de la app; validación de uso en el teléfono con la build 0.15.0 pendiente)

## Contexto

La app mide una sola cosa: la lectura de los sensores plantares durante una sesión. Todo lo demás que rodea a un entrenamiento (qué ejercicio era, cuántas series y repeticiones, con qué peso, cuánto se caminó, cuánto costó, qué indicó el profesional) no se mide y hasta ahora sólo cabía en el campo «contexto» de la sesión, como texto libre. El autor pidió el 4/11/2026 un módulo de cierre que permita cargar una rutina personalizable (desde una rutina de gimnasio hasta caminatas con objetivo de tiempo, incluidas las indicaciones de un kinesiólogo), registrar lo hecho en cada entrenamiento aunque la app no pueda medirlo, y que el asistente ayude a cargarlo por conversación («estoy en sentadilla, serie 2, 10 repeticiones con 40 kg»).

Las instrucciones del proyecto obligan a distinguir medición, análisis, interpretación y diagnóstico, y el cierre del 27/10/2026 reserva la interpretación al profesional. El módulo tiene que sumar información útil sin que lo declarado se confunda con lo medido ni la app pase a prescribir.

## Decisión

### Qué es

Un registro de **lo que la persona declara**, separado de **lo que los sensores miden**, con un único nexo entre ambos (`session_link`).

- **Rutina** (`routine`): nombre, objetivo, origen (`own` propia o `professional` indicada por un profesional), nota del profesional y estado archivado. Pertenece al usuario activo.
- **Ejercicio de la rutina** (`routine_item`): orden, tipo y valores objetivo. Tres tipos: `strength` (series × repeticiones × peso objetivo), `walk_run` (duración o distancia objetivo, nota de ritmo) y `other` (instrucciones libres: elongación, ejercicios del kinesiólogo, lo que sea). Indicaciones y descanso opcionales.
- **Entrenamiento** (`workout`): una ejecución de una rutina (o libre, sin rutina) en una fecha local; estados `planned`, `in_progress`, `completed`; nota final.
- **Serie registrada** (`workout_entry`): lo realmente hecho, por serie: ejercicio (nombre copiado al momento de registrar), tipo, número de serie, repeticiones, peso, duración, distancia, esfuerzo percibido (RPE 1–10), nota de molestia y notas. Hora de registro.
- **Vínculo** (`session_link`): una sesión de plantillas pertenece, opcionalmente, a un entrenamiento y a una serie. Se crea al iniciar una sesión desde un ejercicio («Medir con plantillas») y se muestra en el detalle de la sesión, en el historial y en el informe PDF.

### Límites (para el código y para la tesis)

- **El módulo organiza y registra; no prescribe.** No arma rutinas, no sugiere ejercicios, no ajusta cargas ni progresiones, no evalúa la ejecución. Las rutinas las escribe la persona o su profesional.
- **Lo declarado no es medido.** Repeticiones, pesos, duraciones y RPE son datos ingresados por la persona; se presentan siempre como «declarado». El volumen (Σ repeticiones × kg) es un total declarado, no una medida.
- **Dolor o molestia es una nota libre.** Se guarda textual, no se cuantifica, no se interpreta y no participa de ningún indicador. Sigue valiendo ADR 0012: ante preguntas clínicas el asistente responde el texto fijo.
- **Nada se guarda sin confirmación cuando lo carga el asistente.** El modelo sólo extrae lo que la persona dijo a un JSON de esquema fijo (`log_entry`); la app lo valida, muestra una tarjeta editable y guarda únicamente al tocar «Guardar». Lo que el modelo no pudo completar queda en `missing` y se pregunta; no se inventan pesos ni repeticiones.
- **Primero local.** Rutinas, entrenamientos, series y vínculos viven en SQLite (migración local v6) y entran en el respaldo y en la exportación de sesión (`SessionBundle.training`). El esquema remoto (`supabase/migrations/0005_training.sql`, con RLS y sin borrados remotos) queda preparado; la transferencia desde `packages/sync` es evolución futura.

### Dónde aparece

Hoy (tarjeta «Entrenamiento del día»: empezar desde una rutina o libre, progreso, abrir), pantalla Entrenamiento (ejercicios con objetivos, series por ejercicio, «Medir con plantillas», finalizar con nota), Ajustes → Rutinas (crear, editar, reordenar, archivar, duplicar), Historial (fila del entrenamiento del día junto a las sesiones), Detalle de sesión (chip «Vinculada a …»), informe PDF (sección «Entrenamiento asociado · declarado por el usuario») y asistente (contexto con el entrenamiento de hoy y el último; carga asistida con tarjeta de confirmación; resumen del día).

## Consecuencias

- La tesis gana un segundo tipo de dato explícitamente **declarado** junto al **medido**; el alcance se describe en `docs/especificacion/08_Alcance_Final_del_Prototipo.md`.
- La comparación entre sesiones puede usar el vínculo (misma serie de la misma rutina) como condición de comparabilidad declarada por la persona; no cambia las métricas.
- Un nuevo paquete de dominio `@plantillas/training` (tipos, validación, resúmenes, parseo de la carga asistida), sin dependencias de UI.
- El prompt compartido con la función gestionada incorpora el modo de extracción; la prueba de «prompt al día» obliga a regenerarlo (`scripts/sync-assistant-prompt.mjs`).

## Alternativas descartadas

- Meter todo en el campo «contexto» de la sesión: no permite rutinas, series ni totales, y mezcla lo declarado con la descripción de la sesión.
- Que el asistente guarde directamente lo que entiende: una extracción equivocada quedaría como dato; la tarjeta de confirmación cuesta un toque y evita eso.
- Que la app proponga progresiones de carga «según la literatura»: es prescripción; queda fuera del alcance de la tesis y de la app.

## Ajuste 4/11 (tarde): actividad unificada

Probado en el teléfono, el flujo «entrenamiento aparte, sesión aparte» separaba demasiado las dos cosas y perdía el enfoque de la app. Decisión de Mikel: la rutina se ejecuta **dentro de la misma actividad** que la medición.

- **Inicio unificado.** Nueva sesión ofrece una rutina opcional (sólo activas) o «Sin rutina»; con rutina, el entrenamiento y la sesión arrancan juntos y quedan vinculados. Desde Hoy también se entrena sin plantillas (misma pantalla, sin fuente de datos).
- **Una pantalla de actividad** (`/grabacion`) con pestañas **Medición | Rutina** cuando hay ambas en curso. La rutina se ejecuta **ejercicio por ejercicio**: la serie en curso llega precargada con el objetivo (y con el peso de la última serie declarada, si la persona lo bajó por cansancio), se corrige y se confirma con «Listo»; eso declara la serie, la vincula a la sesión que graba (`workout_entry.session_id`, migración local v7) y abre el **descanso** del ejercicio (`rest_sec`; 90 s por defecto; 0 = sin descanso), con «Saltar». Caminata/carrera corre con cronómetro y cuenta regresiva al objetivo; al terminar se guarda el tiempo real. La progresión (series hechas con su peso) queda debajo.
- **Isla flotante.** Mientras hay sesión grabando o entrenamiento en curso, una pastilla arriba de todas las pantallas muestra el tiempo de grabación y el descanso o la caminata que corre; tocarla vuelve a la actividad. Los temporizadores viven en el store, no en la pantalla.
- **Puerta en Hoy.** La tarjeta «Entrenamiento» continúa la actividad o permite iniciar una rutina, crear una o ver todas (archivar y restaurar en Ajustes → Rutinas, que se mantiene).
- **Historial.** Los entrenamientos son entradas propias del día (también en días sin sesiones medidas), con nombre de rutina y resumen; su detalle muestra series con peso real y las sesiones vinculadas; desde el detalle de una sesión se listan las series declaradas durante ella.
- **Máquina de estados pura** (`@plantillas/training/activity`: cursor, descanso, cronómetro, `now` inyectable) con pruebas; la app sólo persiste.
- **Lo que no cambia:** la app sigue sin prescribir, sin ajustar cargas y sin interpretar molestias; la serie es declarada aunque esté vinculada a una sesión medida.
