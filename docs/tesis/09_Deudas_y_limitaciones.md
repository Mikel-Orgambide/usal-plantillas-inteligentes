# 09 · Deudas técnicas y limitaciones conocidas

Relevamiento del 6/11/2026 al recorrer el código para esta documentación. Sirve para el capítulo 6 (riesgos), el 7 (limitaciones de los resultados), el 8 (recomendaciones y trabajo futuro) y para responder «¿qué no funcionó / qué harían distinto?» en la defensa (`06_Defensa.md`).

Estado: **corregida** (ya resuelta en el repo), **declarar** (limitación aceptada que va al documento), **pendiente** (podría corregirse; no bloquea la entrega).

| # | Tema | Detalle | Estado | Dónde |
|---|---|---|---|---|
| 1 | Comentario de baudios | El comentario decía 115200; el firmware usa 230400 | corregida | `firmware/include/usb_transport.h` |
| 2 | Comentario de variabilidad | Decía «seis posiciones»; se calcula sobre las instrumentadas | corregida | `packages/metrics/src/distribution.ts` |
| 3 | Cadencia del simulador | El simulador emite 50 reg/s y el firmware 20 reg/s: sesiones simuladas y reales no tienen la misma cadencia | declarar | `packages/simulator`, `firmware/include/configuration.h` |
| 4 | Filtro clínico del asistente | «Rehabilitación», «kinesio», «cansancio» y «qué ejercicio» rechazaban preguntas sobre rutinas registradas. Ahora pasan cuando hablan de rutina, entrenamiento o series; fatiga y sobrecarga siguen siendo siempre clínicas | corregida (6/11, 2 pruebas nuevas) | `packages/assistant/src/scope.ts` |
| 5 | Entrenamiento en la nube | La migración remota `0005` no tiene `category` (local sí, v8) y la sincronización del entrenamiento no está implementada: rutinas y entrenamientos viven en el teléfono y en el respaldo | declarar (evolución futura) | `supabase/migrations/0005_training.sql`, `packages/sync` |
| 6 | Nombres y versiones | `package.json` raíz con el nombre viejo; `apps/mobile/package.json` en 1.0.0 frente a 0.15.2 de `app.json` | corregida | `package.json`, `apps/mobile/package.json` |
| 7 | IP por defecto del asistente local | `192.168.0.140:1234` queda escrita como valor por defecto y en el texto de ejemplo | pendiente | cliente del asistente, `settings.ts`, `ajustes/asistente.tsx` |
| 8 | Tráfico http | `usesCleartextTraffic: true` habilita http en toda la app, no sólo en la red local (necesario para LM Studio). Supabase y OpenRouter usan https | declarar | `apps/mobile/app.json`, ADR 0012 |
| 9 | Temporizadores | Descanso y cronómetro de caminata se reinician si se cierra la app | declarar | `apps/mobile/src/application/activityStore.ts` |
| 10 | Duplicados | A verificar: `trackSequence` parecería contar duplicados como aceptados en las estadísticas en vivo; la base sí los descarta | pendiente (verificar) | `packages/session`, `packages/contract/src/sequence.ts` |
| 11 | Reloj de 32 bits | `time_us` es u32: vuelve a cero a los ~71,6 min de captura | declarar | contrato, `firmware`, `packages/ble` |
| 12 | Versión de firmware de la evidencia | Las sesiones de evidencia del 3/11 son de firmware 0.3.0; el actual es 0.3.1 (sólo suma el entorno derecho) | declarar | `docs/incrementos/etapa-09-fuente-fisica.md` |
| 13 | MTU | `MIN_MTU` (48) y el tamaño de medición se calculan para 6 canales aunque cada módulo envía 3 | pendiente | `packages/ble/src/protocol.ts` |
| 14 | Cobertura | La app (`apps/mobile`) no tiene pruebas unitarias; la CI no compila firmware ni app nativa ni corre las pruebas SQL de Supabase | declarar | `.github/` |
| 15 | Carga de sincronización | El envío conserva un campo heredado de configuración única, además de `configurations[]` | pendiente | `packages/sync` |
| 16 | Nombre de tabla | Un informe anterior la nombró `session_configurations`; la real es `session_configuration` | corregida en estos docs | `supabase/migrations/0003_*` |
| 17 | Capturas | Las capturas son de 0.11.0 y 0.12.0; faltan Entrenamiento, Rutinas, Asistente, Respaldo, Demostración y la isla | pendiente (Mikel) | `docs/capturas/`, `scripts/capturar-pantallas.ps1` |
| 18 | Semilla del simulador | Existe en ajustes, sin control en la interfaz | declarar | `settings.ts` |
| 19 | Carpeta vacía | `apps/mobile/src/domain/` está vacía | pendiente | `apps/mobile/src/domain/` |
| 20 | Verificaciones manuales | A confirmar: parámetros de `scripts/remote-check.mjs`; respaldo/restauración y asistente probados en teléfono real (Mikel probó el asistente en nube y local el 4/11) | pendiente (verificar) | `scripts/`, `docs/incrementos/etapa-10*`, `etapa-14*` |
