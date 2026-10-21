# Instrucciones para asistentes de IA en este repositorio

Fuente de verdad: `docs/especificacion/` (bases de desarrollo del 13/10/2026) y las ADR de `docs/decisiones/`. Si un documento histórico de la tesis contradice esto, prevalece lo de este repositorio.

## Límites que todo el código respeta

- Seis canales: `L_HEEL`, `L_MEDIAL`, `L_LATERAL`, `R_HEEL`, `R_MEDIAL`, `R_LATERAL` (2 FSR406 en talones, 4 FSR402 en antepié).
- Valores originales en `adc_count`. Ausencia o error nunca se convierten en cero (`raw_value = null` + `status = read_error`).
- Procedencia `simulated` o `physical`, asignada por el adaptador, nunca mezclada en una sesión.
- Sin conversión a fuerza o presión sin calibración comprobada. Sin diagnóstico ni "detección de fatiga".
- Tiempo de adquisición (`time_us`) y tiempo de recepción (`received_at`) son referencias distintas.
- No inventar GPIO, frecuencias, UUID BLE, autonomía ni resultados: se registran cuando se miden.

## Diseño de la interfaz

- Fuente de verdad visual: `docs/plantillas-inteligentes-diseno/` (tokens, componentes, pantallas). Los componentes de `apps/mobile/src/presentation/components` replican esos nombres y props; no inventar estilos fuera de los tokens.
- Diferencias deliberadas respecto del diseño: ADR 0005.

## Arquitectura de código

- `packages/contract`: tipos, configuración y validador en ejecución; sin dependencias de React Native.
- `packages/metrics`: descriptores por canal (media, máximo, σ poblacional, cantidades) con versión de algoritmo; cero válidas ⇒ no disponible, nunca cero.
- `packages/sync`: transferencia de una sesión cerrada al remoto sobre una interfaz `RemoteGateway`; confirmada sólo si el servidor devuelve las mismas cantidades; reintentos ante fallas transitorias, nunca ante rechazos.
- `apps/mobile/src`: `app` (rutas de Expo Router) → `presentation` → `application` → paquetes de dominio (`contract`, `session`, `simulator`, `storage`, `metrics`, `ble`, `sync`) ← `infrastructure` (`sqlite`, `ble`, `backup`, `supabase`). El dominio no importa UI, BLE ni Supabase.
- Offline-first: SQLite local es la fuente primaria; Supabase sincroniza (ADR 0008). El esquema remoto vive en `supabase/migrations` y se prueba en `supabase/tests` con PostgreSQL local.

## Forma de trabajo

- Avanzar por etapas (ver `docs/especificacion/03` y `04`). No empezar una etapa sin cerrar la anterior.
- Antes de declarar algo terminado: `npm run typecheck` y `npm test`.
- Instalar dependencias de la app con `npx expo install` (versiones compatibles con el SDK).
- Al cerrar una etapa: entrada en `docs/incrementos/`, tag y actualización del estado (propuesto / implementado / validado).
- Distinguir siempre lo implementado de lo validado; la evidencia alimenta los capítulos 7 y 8 de la tesis.
