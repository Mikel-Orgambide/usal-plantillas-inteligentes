# ADR 0007 - Respaldo y restauración: paquete por sesión y copia completa

- Fecha: 2026-10-20
- Estado: aceptada

## Contexto

La guía (02 §12, 03 §13, prueba P05) pide una copia consistente restaurable en una ubicación separada con relaciones y cantidades comprobadas, y distingue respaldo de sincronización. Una copia en el mismo teléfono no protege contra la pérdida del teléfono.

## Decisión

Dos mecanismos con semánticas distintas, ambos en `@plantillas/storage` (sin React Native) y expuestos en la app:

1. **Paquete por sesión** (`plantillas-session-bundle-1`, JSON): configuración y canales, sesión, capturas, registros con muestras, eventos y resultados, con los identificadores originales. Se exporta desde el Detalle y se comparte como archivo `.plantillas.json`. Restaurar es idempotente: una sesión existente no se toca; los registros pasan por `insertRecords` (duplicados ignorados, C08). Sirve para mover sesiones entre teléfonos y para adjuntar evidencia a la tesis.
2. **Copia completa** (imagen binaria de SQLite vía `serializeAsync`): archivo `.db` para guardar fuera del teléfono. Restaurarla reemplaza toda la base; antes se abre la copia aparte (tablas y `user_version` comprobadas) y se guarda la base actual en la caché de la app. Al reabrir, las migraciones pendientes se aplican, por lo que una copia de un esquema anterior se actualiza.

## Consecuencias

- P05 queda cubierta por prueba automática (exportar → restaurar en otra base → mismas cantidades y contenido) y por la restauración manual en el teléfono.
- No hay borrado remoto ni resolución de conflictos: una sesión se restaura entera o no se restaura.
- Módulos nativos nuevos (`expo-file-system`, `expo-sharing`, `expo-document-picker`): build nueva.
