# Referencias, marcadores y decisiones pendientes

Fecha: 13 de octubre de 2026.

## 1. Referencia formal principal

Consultar siempre el [repositorio completo de Norman](https://github.com/Noorman999/usal-proyecto-final-template) para resolver dudas de estructura, formato y entregables. Las decisiones científicas y técnicas también necesitan sus fuentes pertinentes; el template no valida las mediciones del prototipo.

Archivos consultados en esta revisión:

- [README](https://github.com/Noorman999/usal-proyecto-final-template/blob/main/README.md): uso del template.
- [main.tex](https://github.com/Noorman999/usal-proyecto-final-template/blob/main/main.tex): integración de capítulos y preliminares.
- [usal-proyecto-final.cls](https://github.com/Noorman999/usal-proyecto-final-template/blob/main/usal-proyecto-final.cls): formato efectivo.
- [Capítulo 4](https://github.com/Noorman999/usal-proyecto-final-template/blob/main/capitulos/04-marco-tecnologico.tex): arquitectura, prototipo, stack, infraestructura, UX y calidad.

La rama main puede cambiar. Al realizar la integración final registrar el commit utilizado; no inventar ahora una versión congelada que no se haya identificado.

## 2. Entradas escritas y navegación completada

Estas entradas se agregaron como texto a las listas del documento. El usuario completó después la navegación; la lectura de cierre confirmó enlaces en las seis entradas. Se conservan aquí para identificar los recursos, no como tareas pendientes.

Tabla 9. Requisitos de la arquitectura y comprobaciones previstas.

Tabla 10. Alcance previsto y estado documentado del prototipo.

Tabla 11. Contrato lógico propuesto para los registros de medición.

Tabla 12. Entidades principales del modelo de datos propuesto.

Tabla 13. Distribución local de los componentes de la plataforma.

Figura 9. Arquitectura lógica de la plataforma y recorrido de los datos.

El índice automático actualizado incluye 4.6.3 y 4.7. La paginación definitiva se revisará al integrar el trabajo en LaTeX, según la decisión del usuario. No trasladar páginas de Google Docs ni pedir que repita la actualización ya realizada.

## 3. Correspondencia de citas técnicas

Se incorporaron a la bibliografía académica Chacon y Straub (2014), para control de versiones y etiquetas, y WHOOP (2025), para la referencia funcional de tendencias. Ambas se citaban en el cuerpo sin entrada.

Conservar las siguientes letras al citar Supabase:

| Cita | Página correspondiente |
|---|---|
| Supabase, s. f.-a | Available regions |
| Supabase, s. f.-b | Database |
| Supabase, s. f.-c | Database backups |
| Supabase, s. f.-d | Edge functions |
| Supabase, s. f.-e | Pricing & fees |
| Supabase, s. f.-f | Row level security |

En 4.3.3 se corrigieron las referencias a Database y Edge functions. El tratamiento de secretos se vinculó con los criterios propios de 4.6.1; no se atribuye su demostración a la página general de base de datos.

Espressif s. f.-a corresponde a ADC; s. f.-b, a la documentación del núcleo Arduino ESP32. SQLite s. f.-a corresponde a PRAGMA; s. f.-b, a claves foráneas.

Las páginas de productos y soporte son fuentes técnicas o funcionales. No reemplazan literatura científica sobre biomecánica ni demuestran eficacia deportiva, exactitud del montaje o validación clínica.

## 4. Decisiones que deben registrarse al implementar

| Decisión | Evidencia mínima para cerrarla | Etapa afectada |
|---|---|---|
| Placa real y módulo ESP32 | Identificación visible y documentación de la variante | H0–H1 |
| Sensor físico y terminales | Unidad identificada, dimensiones y conexión comprobada | H0–H2 |
| GPIO, ADC y circuito | Esquema, parámetros, resistencia medida y lectura por canal | H2–H3 |
| Alimentación y montaje | Fuente elegida, sujeción, conexiones y condiciones de ensayo | H2 y H7 |
| Frecuencia y tiempo por canal | Medición de intervalos, desfases, pérdidas y duración | H4 |
| Identificador de captura | Procedimiento sin colisiones comprobado ante reinicio | H4 |
| Contrato y esquema físico | Versiones, restricciones y casos de aceptación ejecutados | Software 0–3 |
| Biblioteca BLE y UUID | Compatibilidad con placa, Android y compilación elegida | H6 e integración |
| Fragmentación y caudal | MTU útil, tamaño, límite de memoria y prueba sostenida | H6 |
| Versiones de herramientas | Archivo de dependencias, bloqueo y compilación reproducible | Software 0 y despliegue |
| Teléfono y permisos | Modelo, versión Android, permisos y pruebas documentadas | Integración y UX |
| Calibración por instalación | Procedimiento, parámetros, rango y comprobación independiente | Métricas físicas |
| Ventanas y comparación | Reglas de segmentación, compatibilidad y datos independientes | Métricas e historial |
| Objetivos cuantitativos | Valores justificados fijados antes del ensayo correspondiente | Plan experimental |
| Respaldo y restauración | Copia consistente, destino y restauración efectivamente probada | Persistencia |
| Complemento remoto | Región, plan vigente, titularidad y controles de acceso probados | Etapa opcional posterior |

Una decisión pendiente limita su etapa dependiente. La identificación del circuito no impide avanzar con simulación, persistencia y navegación. No resolver incertidumbres rellenando campos con especificaciones de otro modelo.

Registrar para cada decisión: fecha, responsable, alternativas consideradas, fundamento, estado, evidencia y cambios respecto de esta guía. Mantener estados separados: propuesto, seleccionado, implementado y comprobado.

## 5. Referencias técnicas utilizadas en el capítulo 4

Las entradas siguientes se conservan en la bibliografía académica y se incorporan al registro de apoyo. Las páginas web se consultaron el 13 de octubre de 2026; las versiones de herramientas a instalar deberán fijarse después de comprobar compatibilidad. No se declara lectura integral de libros por haber consultado un capítulo.

Chacon, S., y Straub, B. (2014). Pro Git (2.ª ed.). Apress. https://git-scm.com/book/en/v2/Git-Basics-Tagging

Espressif Systems. (s. f.-a). ADC. Arduino ESP32 documentation. Recuperado el 13 de octubre de 2026, de https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html

Espressif Systems. (s. f.-b). Welcome to ESP32 Arduino Core’s documentation. Arduino ESP32 documentation. Recuperado el 13 de octubre de 2026, de https://docs.espressif.com/projects/arduino-esp32/en/latest/

Expo. (2026). Using Expo SDK, React Native, and third-party libraries. Recuperado el 13 de octubre de 2026, de https://docs.expo.dev/workflow/using-libraries/

Expo. (s. f.). Expo SQLite. Recuperado el 13 de octubre de 2026, de https://docs.expo.dev/versions/latest/sdk/sqlite/

Google. (s. f.). Touch target size. Android Accessibility Help. Recuperado el 13 de octubre de 2026, de https://support.google.com/accessibility/android/answer/7101858

Google. (2026, 16 de abril). Test your app’s accessibility. Android Developers. Recuperado el 13 de octubre de 2026, de https://developer.android.com/guide/topics/ui/accessibility/testing

Meta Platforms. (2026). Core components and native components. React Native documentation. Recuperado el 13 de octubre de 2026, de https://reactnative.dev/docs/intro-react-native-components

Microsoft. (2026). The basics. TypeScript documentation. Recuperado el 13 de octubre de 2026, de https://www.typescriptlang.org/docs/handbook/2/basic-types.html

SQLite. (s. f.-a). Pragma statements supported by SQLite. Recuperado el 13 de octubre de 2026, de https://www.sqlite.org/pragma.html

SQLite. (s. f.-b). SQLite foreign key support. Recuperado el 13 de octubre de 2026, de https://www.sqlite.org/foreignkeys.html

Supabase. (s. f.-a). Available regions. Supabase Docs. Recuperado el 13 de octubre de 2026, de https://supabase.com/docs/guides/platform/regions

Supabase. (s. f.-b). Database. Supabase Docs. Recuperado el 13 de octubre de 2026, de https://supabase.com/docs/guides/database/overview

Supabase. (s. f.-c). Database backups. Supabase Docs. Recuperado el 13 de octubre de 2026, de https://supabase.com/docs/guides/platform/backups

Supabase. (s. f.-d). Edge functions. Supabase Docs. Recuperado el 13 de octubre de 2026, de https://supabase.com/docs/guides/functions

Supabase. (s. f.-e). Pricing & fees. Recuperado el 13 de octubre de 2026, de https://supabase.com/pricing

Supabase. (s. f.-f). Row level security. Recuperado el 13 de octubre de 2026, de https://supabase.com/docs/guides/database/postgres/row-level-security

WHOOP. (2025, 22 de mayo). Viewing trends. Recuperado el 13 de octubre de 2026, de https://support.whoop.com/s/article/Viewing-Trends

Woolley, M. (2024). The Bluetooth Low Energy primer (versión 1.3.0). Bluetooth SIG. https://www.bluetooth.com/bluetooth-le-primer/

World Wide Web Consortium. (2024, 12 de diciembre). Web Content Accessibility Guidelines (WCAG) 2.2. https://www.w3.org/TR/2024/REC-WCAG22-20241212/

Para Pro Git se consultó la sección Git Basics — Tagging; su utilización no acredita lectura del libro completo. Los resultados experimentales del proyecto siguen pendientes y no se atribuyen a estas fuentes.

