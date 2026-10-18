# Etapa 3 - Persistencia básica

- Estado: implementada; **verificación en dispositivo pendiente** (P01 en el Pixel)
- Paquete: `packages/storage` (`@plantillas/storage` 0.1.0); adaptador `apps/mobile/src/infrastructure/sqlite`

## Qué se implementó

- Migración 1: tablas `user`, `device`, `configuration`, `channel`, `session`, `capture`, `record`, `sample`, `event`, `diagnostic`; claves foráneas habilitadas por conexión; unicidades del contrato; `CHECK` de coherencia estado/valor; trigger que impide muestras de canales ajenos a la configuración de la captura.
- `SessionRepository`: configuración inmutable (una redefinición distinta con el mismo id se rechaza), sesiones con estado, capturas (sin mezclar procedencias ni reutilizar `capture_id` entre sesiones), inserción de registros por lote con savepoint por registro, duplicados y conflictos, eventos, diagnóstico acotado, consultas por sesión/captura/canal.
- `WriteQueue`: lotes de hasta 25 registros o 250 ms; `flush()`/`close()` esperan el commit.
- Adaptador `ExpoSqliteDriver` y apertura única de la base con migración al arrancar.
- La pantalla de verificación crea una sesión por captura, persiste registros, eventos y rechazos, cierra la sesión con duración (reloj monotónico del teléfono) y muestra el historial leído desde SQLite.

## Pruebas ejecutadas (Node, `node:sqlite`)

`npm test -w @plantillas/storage`: 15 pruebas satisfactorias.

| Caso | Resultado |
|---|---|
| P01 guardado y reapertura (archivo en disco) | satisfactoria: sesión, captura, 20 registros, 120 muestras, evento y duración recuperados iguales |
| P02 fallo dentro de transacción | satisfactoria: el registro defectuoso se revierte sin muestras huérfanas; los otros 4 se confirman; queda en diagnóstico |
| P03 relación de canal incompatible | satisfactoria: trigger rechaza la muestra; `CHECK` rechaza ok+NULL |
| P04 cambio de esquema | satisfactoria: migración 2 de prueba conserva los datos |
| C08 retransmisión idéntica | satisfactoria: sin filas nuevas |
| C09 conflicto de contenido | satisfactoria: original conservado, payload en diagnóstico |
| C11 captura nueva tras reinicio | satisfactoria: secuencias separadas; registro de otra captura rechazado |
| S02 sesión abierta al reabrir | satisfactoria: `listOpenSessions` la reconoce |
| Cola de escritura | lotes acotados, vaciado por latencia, lote fallido contado sin detener los siguientes |

## Hallazgos de la primera verificación en dispositivo (2026-10-18)

- Primera sesión simulada guardada y recuperada en el historial (57 registros, 1 captura, 3 eventos, 12,1 s), pero con errores `database is locked`: `withExclusiveTransactionAsync` de expo-sqlite abre una segunda conexión y las escrituras de eventos por la conexión principal colisionaban con los lotes. Corregido: una sola conexión con todas las operaciones serializadas por un candado y transacciones `BEGIN IMMEDIATE`/`COMMIT` explícitas; `busy_timeout` y WAL al preparar la conexión.
- Segunda sesión rechazada por `capture_id` repetido: el simulador generaba el mismo identificador para la misma semilla y la base, correctamente, no lo reutiliza en otra sesión. Corregido: la fuente simulada genera un prefijo de captura único por ejecución (como debe hacerlo el dispositivo); el contenido sigue siendo determinista.
- Errores de inicio/detención no capturados y fecha del historial mal formateada. Corregido; una sesión sin captura o con lotes fallidos se cierra como `incomplete`, y al arrancar la app las sesiones abiertas se marcan `incomplete` (S02).

## Pendiente para cerrar la etapa

Repetir en el Pixel: dos sesiones simuladas consecutivas sin errores, cerrar la app por completo, reabrirla y comprobar que el historial muestra ambas con sus cantidades.
