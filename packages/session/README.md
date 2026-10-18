# @plantillas/session

Coordinación de sesiones (etapa 4). `SessionCoordinator` une una `DataSource`, el contrato y el repositorio:

```
prepared → recording ⇄ interrupted → finalizing → completed | incomplete
```

- **Inicio**: crea la sesión (`prepared`), conecta la fuente, inicia la captura y asocia la captura al recibir su identificador. Un identificador nuevo durante la sesión es un reinicio: abre otra captura, sin mezclar secuencias.
- **Recepción**: valida cada payload (rechazos → `diagnostic`), sigue la secuencia (duplicado, hueco, fuera de orden → eventos), normaliza y encola en `WriteQueue`.
- **Desconexión**: `interrupted`, valores marcados desactualizados; `reconnected` vuelve a `recording`.
- **Cierre** (`stop()`, idempotente): `finalizing`, ventana de datos tardíos, vaciado de la cola con commit confirmado, desconexión, estado final con motivo si no es completa (sin captura, lotes fallidos o fuente sin respuesta). Duración por reloj monotónico.
- **Recuperación** (`recoverOpenSessions`): al arrancar, toda sesión abierta pasa a `incomplete` con un evento que lo explica; nada se borra.

`SessionSnapshot` es la vista para la interfaz: estado, valores por canal, contadores, último evento/error y duración.

Pruebas: `npm test` (10: recorrido normal, S01, desconexión y hueco, reinicio de captura, C08/C12, ventana tardía, fuente sin respuesta, sin captura, S02, integración con simulador y SQLite).
