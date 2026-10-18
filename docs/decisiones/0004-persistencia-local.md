# ADR 0004 - Persistencia local: paquete independiente y driver mínimo

- Fecha: 2026-10-18
- Estado: aceptada

## Contexto

La guía exige SQLite con claves foráneas, migraciones versionadas por `user_version`, escritura transaccional de registro + muestras y una cola de escritura acotada. También pide pruebas de guardado/recuperación, fallo dentro de transacción, relaciones incompatibles y cambio de esquema. Ejecutar esas pruebas únicamente en el teléfono sería lento y poco reproducible.

## Decisión

- El esquema, las migraciones, el repositorio y la cola viven en `packages/storage`, sin dependencias de React Native, escritos contra una interfaz `SqlDriver` de cinco operaciones (`exec`, `run`, `all`, `get`, `transaction`).
- Dos adaptadores: `ExpoSqliteDriver` (app, `expo-sqlite`) y `NodeSqliteDriver` (pruebas, módulo `node:sqlite` incorporado en Node ≥ 22, sin binarios nativos).
- Los lotes usan una transacción por lote y un *savepoint* por registro: un registro defectuoso se revierte solo y queda en `diagnostic`; los demás se confirman.
- Un duplicado idéntico no crea filas; un duplicado con contenido distinto conserva el original y guarda el payload en `diagnostic` (límite de 200 entradas por sesión).
- La base vigila por sí misma la coherencia estado/valor (`CHECK`), la pertenencia del canal a la configuración de la captura (trigger) y las unicidades del contrato.
- Calibración y resultados de métricas no están en la migración 1; se agregarán en su etapa con una migración nueva.

## Consecuencias

Las pruebas P01–P04, C08, C09, C11 y S02 se ejecutan en CI contra SQLite real. El comportamiento en el teléfono depende solo del adaptador, que es una capa fina.
