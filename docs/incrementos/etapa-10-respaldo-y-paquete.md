# Etapa 10 - Respaldo, actualización y paquete

- Fecha de implementación: 2026-10-20
- Fecha de cierre: 2026-10-20
- Tag: v0.10-etapa10
- Especificación: `docs/especificacion/03` §13, `02` §12, `05` (P05, §7 Despliegue). Decisión: ADR 0007.

## Qué se implementó

- **Respaldo por sesión**: exportar desde el Detalle (`.plantillas.json`) e importar desde Ajustes → Respaldo. Idempotente.
- **Copia completa de la base**: compartir `.db`; restaurar con comprobación previa en una base separada y copia de seguridad automática de la actual.
- **Migraciones con datos existentes**: prueba 1 → 2 sobre una base con registros (desde la etapa 6); al restaurar una copia de esquema anterior se migra al reabrir.
- **Versión identificada**: `0.10.0` en `app.json`, visible en Ajustes.
- **Rendimiento**: `FootMap`, `LineChart` y `ValueCard` memorizados por contenido (solo se redibujan si cambian valores).
- **Identidad**: ícono, adaptive icon (fondo, primer plano, monocromo) y splash generados desde la silueta de la app; fondo `#0c0d10`; plugin `expo-splash-screen`.
- **README** reescrito con puesta en marcha desde copia limpia, app, paquete de demostración y firmware.

## Pruebas

`npm test`: 103 (5 nuevas en `storage/test/backup.test.ts`): P05 exportar → restaurar en base separada con mismas cantidades (1 sesión, 1 captura, 40 registros, 240 muestras, 2 eventos, 1 resultado) y mismas muestras; doble restauración sin duplicar; restaurar sobre la misma base no modifica; archivo no reconocido o incompleto rechazado con motivo; sesión sin capturas no exportable.

**Copia limpia (05 §7)**: clon del repositorio → `npm ci` → `npm run typecheck` (0 errores) → `npm test` (103) → `npx expo export --platform android` sin errores. 2026-10-20.

## Verificación en dispositivo (2026-10-20)

Pixel 10 Pro XL. Build de desarrollo nueva (módulos de archivos) y build **preview** 0.10.0.

- Ícono propio en el launcher (incluido el ícono monocromo de Android en una carpeta temática) y splash con la silueta sobre fondo oscuro. ✔
- Exportar sesión desde el Detalle → archivo `.plantillas.json` compartido (`test-data/backup/sesion-2026-10-20-977b2add.plantillas.json`). ✔
- Reimportar el mismo archivo: «La sesión ya estaba en este teléfono; no se modificó nada». ✔
- Copia completa `.db` (4,4 MB) verificada fuera del teléfono con SQLite: `integrity_check` ok, 0 violaciones de claves foráneas, `user_version` 2; 24 sesiones (8 físicas, 16 simuladas), 25 capturas, 6506 registros, 39 036 muestras, 123 eventos, 108 resultados. ✔
- Paquete vs. copia para la misma sesión (97 registros, 582 muestras, 1 read_error, 5 eventos, 6 resultados): cantidades iguales y **muestras idénticas valor a valor**; secuencia 0…96 sin saltos. ✔
- **Preview sin servidor de desarrollo**: la app abre sola, conecta las plantillas y graba una sesión física (20,1 reg/s, 0 huecos; métricas 380/380 válidas por posición). El autor reporta funcionamiento correcto y fluido. ✔

Cierre (03 §13): versión identificada (0.10.0), instalada sin servidor de desarrollo y capaz de recuperar sesiones; respaldo y restauración comprobados (P05). La copia `.db` no se versiona en el repositorio (contiene todo el historial del autor).

## Limitaciones

- Restaurar una copia completa no se ejecutó en esta verificación sobre datos distintos de los actuales; está cubierto por la comprobación previa y la copia de seguridad automática, y por la prueba automática P05 a nivel de paquete.
- La copia de seguridad previa a una restauración queda en la caché de la app (Android puede borrarla si necesita espacio).
