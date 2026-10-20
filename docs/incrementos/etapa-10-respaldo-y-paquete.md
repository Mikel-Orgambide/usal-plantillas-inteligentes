# Etapa 10 - Respaldo, actualización y paquete

- Fecha de implementación: 2026-10-20
- Tag: v0.10-etapa10 (al verificar en el teléfono)
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

## Verificación en dispositivo

Pendiente: build de desarrollo nueva (módulos de archivos) y build *preview* (paquete sin servidor de desarrollo): abrir la app sin Metro, completar una sesión simulada y una física, exportar una sesión y reimportarla (debe decir «ya estaba»), copia completa y restauración, ícono y splash visibles, fluidez durante la grabación.
