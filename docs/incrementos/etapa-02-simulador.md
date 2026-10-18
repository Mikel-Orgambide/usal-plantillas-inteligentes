# Etapa 2 - Simulador determinista

- Fecha de cierre: 2026-10-18
- Tag: v0.2-etapa2
- Paquete: `packages/simulator` (`@plantillas/simulator` 0.1.0); interfaz `DataSource` añadida a `packages/contract`

## Qué se implementó

- Interfaz `DataSource` (conectar, desconectar, iniciar/detener captura, suscripción a payloads y eventos) en el contrato, común para simulador y futuro adaptador físico. Las fuentes entregan payloads sin validar; la aplicación valida.
- Generador puro y determinista (PRNG mulberry32 con semilla): misma semilla → misma salida. Produce capturas identificadas (`SIM-CAPTURE-<semilla>-<n>`), secuencia por captura y tiempo por muestra con desfase configurable entre canales.
- Patrón sintético de señal con alternancia de pies y perfil por zona; los valores quedan dentro del rango de la configuración.
- Nueve modos de prueba: normal, lectura fallida, desconexión (con eventos y hueco de secuencia), salto de secuencia, duplicado, conflicto, reinicio de captura, contradicción estado/valor y canal ausente.
- `SimulatedDataSource` con temporizador para la aplicación.
- Pantalla provisional de verificación en la app (`SimulatorScreen`): seis valores en vivo por pie, contadores de recibidos/aceptados/rechazados/duplicados/huecos, último evento, selector de modo. Los valores previos a una desconexión se marcan como desactualizados.

## Pruebas ejecutadas

`npm test`: contrato 23 + simulador 13 = 36 pruebas satisfactorias. `npm run typecheck` sin errores. `npx expo export --platform android` genera el bundle con el simulador incluido.

- Reproducibilidad: dos generadores con la misma semilla producen 40 salidas idénticas; fixture dorado `test-data/simulator/semilla-0001-normal-20.json` comparado en cada ejecución.
- Cada modo de prueba verificado con el validador del contrato y `classifySequence` (la desconexión produce `gap` 4–6; el reinicio produce nuevo `capture_id`, secuencia y tiempo en cero; contradicción y canal ausente son rechazados por el validador).
- `SimulatedDataSource` con temporizadores simulados: un payload por tick, eventos en orden, detención efectiva.

Datos usados: exclusivamente simulados.

## Limitaciones

- Ninguna persistencia: los registros aceptados se muestran y se descartan (etapa 3).
- La pantalla es de verificación técnica; no es la interfaz final (etapa 5 con el diseño del autor).
- El patrón de señal es ilustrativo; no debe usarse para validar métricas biomecánicas.

## Próxima tarea

Etapa 3: persistencia básica con expo-sqlite (migración inicial, claves foráneas, cola de escritura transaccional, repositorio de sesiones) y prueba P01: guardar sesión simulada, cerrar la app, reabrir y recuperar.
