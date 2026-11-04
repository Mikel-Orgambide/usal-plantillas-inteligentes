# Etapa 15 — Rutinas y entrenamiento (ADR 0013)

- Fecha: 2026-11-04. Versión de la app: 0.15.0. Commits: ver `git log` (`feat(training): etapa 15 …`).
- Estado: implementada y probada con pruebas automáticas; validación de uso en el teléfono con la build preview 0.15.0 pendiente.
- Decisión del autor (4/11/2026): módulo de cierre funcional de la app. Registrar lo que la app no mide (rutina, series, pesos, tiempos, esfuerzo, indicaciones del profesional) y vincularlo con lo que sí mide (las sesiones de plantillas). La app organiza y registra; no prescribe rutinas ni ajusta cargas.

## Qué se implementó

- **Dominio `packages/training`**: tipos (`Routine`, `RoutineItem` con objetivo por tipo `strength`/`walk_run`/`other`, `Workout`, `WorkoutEntry`, `SessionLink`), validación (`validateRoutine`, `validateItem`, `validateEntry`, `validateWorkout`), resúmenes (`summarizeWorkout`: series, volumen Σ reps×kg declarado, minutos de caminata, RPE medio, molestias contadas sin interpretar; `routineProgress`; `describeEntry`/`describeTarget`) y carga asistida (`isLogIntent` por reglas, `LOG_ENTRY_SCHEMA_DESCRIPTION`, `parseLogEntryProposal` tolerante a cercos de código y JSON parcial, `proposalMissing`, `askForMissing`, `validateProposal`). 7 pruebas.
- **Persistencia `packages/storage`**: migración local **v6** (`routine`, `routine_item`, `workout`, `workout_entry`, `session_link`, índices), `TrainingRepository` (rutinas con ejercicios, entrenamientos con entradas, vínculo por sesión, consultas por día), respaldo y restauración: el paquete de una sesión lleva `training` (entrenamiento, rutina, entradas y vínculo) cuando está vinculada y se restaura con el vínculo. Pruebas en `test/training.test.ts` (+2) y migraciones a v6.
- **App**:
  - `application/trainingStore.ts`: rutinas (listar, guardar, archivar, duplicar), entrenamientos (empezar desde rutina o libre, entradas, finalizar, borrar), vínculo pendiente al iniciar una sesión desde un ejercicio (`setPendingLink` → `applyPendingLink` en `sessionStore.startSession`), `sessionLinkInfo`, `saveProposal` (guarda la tarjeta confirmada en el entrenamiento de hoy, creándolo si no existe) y `trainingContext` para el asistente.
  - Ajustes → **Rutinas** (`ajustes/rutinas.tsx`, `ajustes/rutina.tsx`): lista, crear/editar nombre, objetivo, origen (propia / profesional) y nota del profesional; ejercicios con tipo, objetivo e indicaciones; reordenar con flechas; archivar; duplicar.
  - **Hoy**: tarjeta «Entrenamiento del día» (elegir rutina o libre → `/entrenamiento`; progreso y resumen; para otros días, el de esa fecha).
  - **Entrenamiento** (`entrenamiento.tsx`): ejercicios con objetivo y progreso, agregar serie (reps, peso, RPE, nota, molestia) o tiempo/distancia, «Medir con plantillas» (abre Preparación con el contexto precargado y deja el vínculo pendiente), finalizar con nota.
  - **Historial**: fila del entrenamiento del día junto a las sesiones (rutina, series, volumen declarado, minutos). **Detalle de sesión**: chip «Vinculada a <ejercicio · serie>» con acceso al entrenamiento. **Informe PDF**: sección «7b. Entrenamiento asociado · declarado por el usuario» (`packages/report`, +1 prueba).
  - **Asistente**: el contexto lleva un bloque ENTRENAMIENTO (hoy y último, marcado como declarado); si el mensaje describe una serie (`isLogIntent`), el cliente consulta en modo `log_entry` con el prompt de extracción (`LOG_ENTRY_PROMPT`, compartido con la función gestionada vía `scripts/sync-assistant-prompt.mjs`) y la app muestra una **tarjeta editable** («Sentadilla · serie 2 · 10 reps · 40 kg»): nada se guarda sin «Guardar»; lo que falta se pregunta. Ficha de conocimiento y prompt con las reglas del módulo (lo declarado no es medido; no se proponen rutinas ni cargas). Pruebas en `packages/assistant/test/training-context.test.ts` (+3).
- **Esquema remoto**: `supabase/migrations/0005_training.sql` (tablas, RLS por titular, privilegios para `authenticated`, sin borrados remotos). **La transferencia desde `packages/sync` no se implementó**: queda como evolución futura; el respaldo y la exportación de sesión cubren la conservación.

## Cómo probar (Mikel, build 0.15.0)

1. Ajustes → Rutinas → Nueva: «Pierna (kinesiólogo)», origen profesional, nota del profesional; ejercicios: Sentadilla (fuerza, 3 × 10 × 40 kg), Caminata (20 min), Elongación (otro, instrucciones).
2. Hoy → Entrenamiento del día → Empezar → elegir la rutina. En Sentadilla, agregar serie 1 (10 × 40, RPE 7). Tocar «Medir con plantillas» → Preparación llega con el contexto «Sentadilla · serie 2» → iniciar una sesión corta con la placa → finalizar. En el Detalle de esa sesión debe aparecer el chip «Vinculada a Sentadilla · serie 2».
3. Asistente (desde Hoy): escribir «sentadilla serie 3, 10 repeticiones con 42 kg, rpe 8» → tarjeta de confirmación → Guardar. Verificar en Entrenamiento que apareció la serie 3. Probar «caminé 25 minutos» y «hice press» (debe preguntar repeticiones y peso).
4. Preguntar al asistente «¿cómo fue mi entrenamiento de hoy?» y «¿qué sesión está vinculada a la sentadilla?».
5. Finalizar el entrenamiento con una nota. Historial → la fila del entrenamiento del día. Detalle → Exportar informe (PDF) → sección «Entrenamiento asociado».
6. Ajustes → Respaldo: exportar; restaurar en limpio y comprobar que el vínculo se conserva.

## Evidencia a guardar

Capturas de Rutinas, Entrenamiento, tarjeta de confirmación del asistente, Detalle con el chip y el PDF con la sección 7b en `docs/capturas/0.15.0/`; un `.plantillas.json` de una sesión vinculada en `test-data/entrenamiento/`.

## Limitaciones declaradas

- Todo lo del módulo es **declarado por la persona**; la app no verifica repeticiones, pesos ni tiempos.
- El vínculo sesión↔serie lo establece la persona al iniciar la sesión desde el ejercicio; no se infiere.
- La extracción del asistente depende del modelo: por eso nunca guarda sin confirmación y puede pedir datos que ya estaban.
- Sin sincronización remota de rutinas y entrenamientos (esquema preparado); se conservan en el teléfono y en los respaldos.
