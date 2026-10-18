# Pruebas y condiciones de cierre

Fecha: 13 de octubre de 2026.
Estado: plan. Las pruebas siguientes no se presentan como ejecutadas.

## 1. Registro de cada caso

Campos mínimos: ID, requisito, versión, configuración, fuente de datos, entrada, resultado esperado, procedimiento, resultado observado, estado, evidencia y limitaciones.

Estados: pendiente, ejecutada satisfactoriamente, fallida o no aplicable con motivo. No marcar satisfactoria una prueba sólo porque su código exista.

## 2. Matriz informática

| ID | Caso | Resultado esperado |
|---|---|---|
| C01 | Registro completo válido | Seis canales asociados correctamente |
| C02 | Cero con estado ok | Se conserva como cero digital válido |
| C03 | null con read_error | Se conserva el error y se excluye del cálculo |
| C04 | Estado/valor contradictorios | Error explícito; no corrección silenciosa |
| C05 | Versión desconocida | Rechazo explicable antes del procesamiento |
| C06 | Canal ausente, duplicado o desconocido | Incompatibilidad identificada sin rellenar con cero |
| C07 | Campo no finito o tiempo fuera del tipo admitido | Error representacional documentado |
| C08 | Repetición idéntica de ID y contenido | No se duplican registros o muestras |
| C09 | Mismo ID con contenido diferente | Conflicto conservado; original no sobrescrito |
| C10 | Salto de secuencia | Evento de discontinuidad |
| C11 | Captura nueva tras reinicio | Tiempos y secuencias no se mezclan |
| C12 | Registro fuera de orden | Política explícita; gráficos ordenados por adquisición |
| P01 | Guardado y reapertura | Muestras, metadatos y eventos recuperados |
| P02 | Fallo dentro de transacción | Sin registro parcialmente confirmado |
| P03 | Relación de canal incompatible | Escritura rechazada o error comprobado |
| P04 | Cambio de esquema | Datos anteriores recuperables después de migración |
| P05 | Respaldo y restauración | Copia restaurada equivalente para entidades comprobadas |
| S01 | Finalizar dos veces | Cierre único y sin resultados duplicados |
| S02 | Reiniciar aplicación con sesión abierta | Sesión conservada como incompleta |
| U01 | Desconexión y valor anterior visible | Valor marcado desactualizado y hueco reconocido |
| U02 | Historial vacío | Mensaje inicial sin resultados ficticios |
| U03 | Dos sesiones incompatibles | Motivo visible y comparación limitada |

La política de C12 debe definirse antes de evaluar el caso. No declarar pérdida definitiva mientras un hueco pueda resolverse por recepción tardía admitida.

## 3. Fixtures de métricas

Canal único, unidad adc_count, una captura, configuración constante.

Fixture A: valores válidos [100, 200, 300].

- n_valid = 3.
- Media = 200.
- Máximo = 300.
- Desviación estándar poblacional = sqrt(20000/3), aproximadamente 81,649658.

Fixture B: esos valores más una lectura read_error con null.

- n_received = 4, n_valid = 3, n_invalid = 1.
- Media y máximo permanecen iguales a A.
- La fracción válida entre lecturas recibidas es 3/4; no representa continuidad frente a mensajes no recibidos.

Fixture C: [0, 100, 200] con estado ok.

- n_valid = 3, media = 100 y máximo = 200.
- El cero no se elimina por considerarlo ausencia de apoyo.

Fixture D: ninguna lectura válida.

- Resultado no disponible, con motivo.
- No producir media, máximo o dispersión numérica cero.

Definir tolerancia numérica para los cálculos de punto flotante antes de ejecutar las comparaciones. Para el fixture entero de la media se puede exigir igualdad exacta; para la raíz, usar una tolerancia documentada.

## 4. Integración física

| ID | Ensayo | Criterio previo |
|---|---|---|
| H01 | Placa programada sin sensores | Versión identificada y diagnóstico USB recibido |
| H02 | Un sensor y circuito | Respuesta observada con identificación correcta |
| H03 | Activación individual de seis sensores | Correspondencia completa en firmware, app y base |
| H04 | Temporización sostenida | Intervalos y desfases medidos para una duración definida |
| H05 | Transporte USB/BLE | Comparación de registros generados y aceptados |
| H06 | Desconexión y reinicio | Eventos, capturas y recuperación consistentes |
| H07 | Montaje estático integrado | Señales, condiciones y sesión recuperable documentadas |
| H08 | Calibración física, si se realiza | Error evaluado con datos independientes del ajuste |

Para H04/H05 deben fijarse duración, tasa objetivo, volumen y límites de aceptación antes del ensayo. La guía no inventa números ni resultados.

Registrar descartes, colas, secuencias, latencias estimables y tiempos de recuperación. La latencia entre dos relojes requiere alineación o un método de medición que la justifique.

No usar el éxito del simulador como aprobación de H01-H08. No extrapolar el montaje estático a running.

## 5. Seguridad y sincronización

- Dos cuentas: cada una accede únicamente a sus sesiones y entidades dependientes.
- Solicitud sin autenticar: no accede a información privada.
- Función privilegiada: verifica solicitante y titularidad.
- Cambio de cuenta: no reasigna la sincronización pendiente.
- Reintento: mismos identificadores y ninguna duplicación.
- Confirmación incierta: conserva estado pendiente hasta resolver aceptación real.
- Error de servidor: no expone credenciales en interfaz o logs.
- Internet ausente: sesiones locales siguen disponibles.

Ejecutar estos casos sólo cuando la integración remota exista. Documentar los mecanismos de cifrado y autenticación realmente configurados; no inferirlos por el nombre de una biblioteca.

## 6. Experiencia de usuario

Tareas: preparar, iniciar, reconocer procedencia, identificar interrupción, finalizar, recuperar y comparar.

Registrar finalización, ayuda, errores y tiempo. Añadir preguntas de comprensión sobre unidad, calidad y origen. Separar revisión del desarrollador de pruebas con participantes.

Comprobar contraste seleccionado, etiquetas además de color, áreas táctiles, texto ampliado y TalkBack. La revisión de algunos criterios no equivale a conformidad integral con WCAG.

## 7. Despliegue

- Copia limpia del proyecto: seguir README y obtener ejecución documentada.
- Paquete Android: abrir y completar flujo local sin computadora ni servidor de desarrollo.
- Actualización: conservar o migrar datos según política.
- Recuperación: no asumir que un binario anterior entiende un esquema nuevo.
- Repositorio: acceso de lectura comprobado para la cátedra y revisión entregada identificada.

## 8. Evidencia mínima del primer cierre funcional

Sesión simulada: configuración -> inicio -> seis canales -> guardado -> cierre -> reapertura -> métricas -> historial -> comparación de dos sesiones compatibles.

Sesión física: captura identificada -> transporte -> recepción -> persistencia -> cierre -> recuperación.

Cada circuito tendrá registros, cantidades y capturas. La evidencia simulada y física se conservará por separado.

Para cerrar el capítulo como entrega con prototipo se necesitan evidencias, versiones y resultados, además de la redacción. Para cerrar la tesis se contrastará también el documento completo y el sistema con el template de Norman.

