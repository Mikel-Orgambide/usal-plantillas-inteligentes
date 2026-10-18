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

## Pendiente para cerrar la etapa

Instalar el nuevo development build (expo-sqlite y expo-crypto son módulos nativos), grabar una sesión simulada en el Pixel, cerrar la app por completo, reabrirla y comprobar que el historial muestra la sesión con sus cantidades.
