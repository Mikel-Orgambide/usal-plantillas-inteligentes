# 07 · Glosario y siglas

> Documento base. Definiciones tal como se usan **en este proyecto** (verificadas contra el código y los ADR). Entre paréntesis, el identificador en el código cuando existe.

## 1. Glosario

### Medición y señal
- **Plantilla instrumentada**: plantilla de calzado con sensores de fuerza resistivos en posiciones fijas; es el dispositivo de captura de la plataforma.
- **Módulo**: conjunto de una placa ESP32 y los sensores de **un pie** (ADR 0011). Una sesión usa uno o dos módulos.
- **Posición / canal** (`channel_id`): uno de los seis lugares de medición: talón, antepié medial y antepié lateral de cada pie (`L_HEEL`, `L_MEDIAL`, `L_LATERAL`, `R_HEEL`, `R_MEDIAL`, `R_LATERAL`).
- **Zona**: agrupación anatómica de una posición: talón (`heel`), antepié medial (`forefoot_medial`), antepié lateral (`forefoot_lateral`). Antepié = medial + lateral; retropié = talón.
- **Posición instrumentada / no instrumentada**: con sensor declarado en la configuración / sin él. Una no instrumentada se muestra «no disponible», nunca 0.
- **FSR** (*force sensing resistor*): sensor cuya resistencia baja al aumentar la fuerza aplicada; se usa FSR 406 (talón) y FSR 402 (antepié). Respuesta no lineal, con histéresis y deriva.
- **Divisor de tensión**: circuito FSR + resistencia fija que convierte la variación de resistencia en tensión medible por el ADC.
- **Cuenta ADC** (`adc_count`): valor entero de 0 a 4095 (12 bits) entregado por el conversor; única unidad del sistema. **No es fuerza ni presión** (sin calibración).
- **Calibración**: relación entre cuentas y una magnitud física (N, kPa). No implementada; queda como trabajo futuro.
- **Saturación / límite del ADC** (`adc_boundary`): lectura exactamente en 0 o 4095; advierte que el valor está en el borde del rango, no prueba que el sensor esté saturado.
- **Lectura válida / fallida** (`ok` / `read_error`): una lectura fallida tiene valor nulo; nunca se reemplaza por 0.
- **Muestra** (`sample`): una lectura de un canal con su `time_us`, valor, unidad y estado.
- **Registro** (`record`): conjunto de muestras de todos los canales de una configuración tomadas en un ciclo de adquisición, con número de secuencia.
- **Período de registro**: intervalo entre registros: 50 ms (20 reg/s) en el firmware; 20 ms (50 reg/s) en el simulador.
- **`time_us`**: instante de adquisición en microsegundos desde el arranque de la placa (reloj propio de cada módulo; u32 en BLE).
- **`received_at`**: instante de recepción en el teléfono (ISO 8601); no reemplaza a `time_us`.

### Datos y contrato
- **Contrato de datos v1.0** (`packages/contract`): especificación común de registros, configuraciones, validación y secuencia para simulador, placa y app.
- **Configuración de adquisición** (`AcquisitionConfiguration`): descripción inmutable de qué sensores, modelos, rango y placa producen los datos; cambiar el montaje implica una configuración nueva.
- **Procedencia / origen de la señal** (`source`): `physical` (sensores reales) o `simulated`. Independiente del transporte.
- **Transporte**: medio por el que llegan los datos: USB (JSON por serie, banco de prueba) o BLE (app).
- **Fuente de datos** (`DataSource`): interfaz común que implementan el simulador y la placa BLE.
- **Captura** (`capture`): tramo continuo de adquisición de un módulo con un identificador `<device_id>-B<arranque>-C<n>`; un reinicio de la placa o de la captura abre otra.
- **Sesión** (`session`): unidad de registro iniciada y finalizada por la persona; agrupa una o más capturas de uno o dos módulos, con actividad y contexto.
- **Secuencia** (`sequence`): número correlativo de registro dentro de una captura. Permite detectar **huecos** (registros perdidos o descartados), **duplicados** y registros **fuera de orden**.
- **Duplicado / conflicto**: misma secuencia con igual contenido (se ignora) / con contenido distinto (se conserva el primero y se registra un diagnóstico).
- **Diagnóstico** (`diagnostic`): registro de un payload rechazado o en conflicto, con su motivo.
- **Evento** (`event`): hecho de la sesión con marca de tiempo (inicio, desconexión, hueco, módulo perdido, etc.).
- **Normalización**: agregado de procedencia, `session_id` y `received_at` a un registro validado.
- **Idempotencia**: propiedad de una operación que, repetida, no cambia el resultado (inserción de registros, restauración, sincronización).

### Sesión y calidad
- **Estados de sesión**: preparada, grabando, interrumpida, finalizando, completa, incompleta.
- **Sesión incompleta**: cerrada sin confirmación completa (sin captura, lotes fallidos o cierre inesperado); lo recibido se conserva.
- **Sesión recuperada**: sesión que quedó abierta por un cierre inesperado de la app y se cerró como incompleta al reabrir.
- **Ventana de datos tardíos**: espera breve al finalizar para aceptar registros en tránsito.
- **Cola de escritura**: búfer que agrupa registros en lotes (25 o 250 ms) antes de escribirlos en una transacción.
- **Calidad del registro**: cuánto de lo emitido llegó y se guardó (recibidos, esperados, huecos, lecturas fallidas); describe la captura, no a la persona.
- **Valor viejo (*stale*)**: último valor de un canal que dejó de actualizarse (se muestra en gris).

### Métricas
- **Versión de métrica** (`metric_version`): identificador del algoritmo (`desc-1.0`, `dist-1.0`, `bilateral-1.0`); sólo se comparan resultados de la misma versión.
- **Descriptores por canal** (`desc-1.0`): media muestral, máximo y desvío estándar poblacional de las lecturas válidas de un canal en una captura.
- **Media muestral**: promedio de lecturas sin ponderar por tiempo.
- **Desvío estándar poblacional (σ)**: dispersión de las lecturas alrededor de la media (divisor *n*).
- **Distribución de la carga** (`dist-1.0`): proporciones entre las medias de las posiciones: antepié/talón, izquierda/derecha.
- **Reparto antepié / talón** (`forefoot_share`, `rearfoot_share`): fracción de la suma de medias que corresponde a cada zona.
- **Reparto izquierda / derecha** (`left_share`, `right_share`): fracción por pie; requiere ambos pies instrumentados.
- **Asimetría por zona**: (izq − der) / (izq + der), de −1 a 1; positivo = más lectura a la izquierda.
- **Variabilidad**: promedio de los coeficientes de variación (σ / media) de las posiciones instrumentadas.
- **Carga acumulada aproximada**: Σ media × lecturas válidas × período, en cuentas·segundo; comparable sólo con la misma configuración.
- **Ley de varianza total**: fórmula para combinar desvíos de varios grupos (capturas o sesiones) en uno.
- **Comparabilidad**: condición para comparar dos sesiones por posición: misma configuración, unidad, procedencia y versión de métrica; con advertencias si cambian actividad o contexto.
- **Delta / diferencia B − A**: diferencia entre la sesión posterior y la anterior; también relativa (delta / media A).
- **Sesión bilateral**: sesión con un módulo por pie.
- **Desfase declarado** (`offset_ms`): diferencia estimada entre los orígenes de reloj de los dos módulos (mediana de `received_at − time_us`); se informa, no se corrige.
- **Tramo completo**: intervalo en que ambos módulos estuvieron presentes (huecos < 1 s); las métricas bilaterales se calculan sólo ahí.
- **Fracción completa** (`complete_fraction`): tiempo con ambos módulos / tiempo con al menos uno.

### Entrenamiento
- **Rutina**: lista de ejercicios con objetivos declarados por la persona o indicados por un profesional; la app no la propone ni la ajusta.
- **Tipo de rutina** (`category`): Piernas, Tren superior, Cuerpo completo, Core, Cardio / caminata, Movilidad, Rehabilitación, Otro.
- **Ejercicio / ítem** (`routine_item`): elemento de una rutina de tipo fuerza, caminata/carrera u otro, con objetivo y descanso.
- **Entrenamiento** (`workout`): ejecución de una rutina (o libre) en una fecha; planificado, en curso o completado.
- **Serie / entrada** (`workout_entry`): una serie o bloque declarado (repeticiones, peso, duración, distancia, RPE, molestia).
- **Volumen**: Σ repeticiones × peso (kg·rep).
- **RPE**: esfuerzo percibido en escala 1–10, declarado.
- **Descanso**: cuenta regresiva entre series (90 s por defecto); bloquea el cambio de ejercicio hasta terminar o saltarlo.
- **Vínculo sesión–entrenamiento** (`session_link`, `workout_entry.session_id`): asociación entre lo medido por las plantillas y lo declarado.
- **Entrenamiento libre**: entrenamiento sin rutina.
- **Declarado vs medido**: lo declarado lo ingresa la persona; lo medido proviene de los sensores. El sistema nunca presenta lo declarado como medición.
- **Carga asistida**: registro de una serie a partir de una frase en lenguaje natural, extraída por el modelo y confirmada por la persona.

### Asistente
- **Asistente explicativo**: chat que explica sesiones e indicadores ya calculados; no diagnostica ni prescribe.
- **LLM** (modelo de lenguaje grande): modelo que genera texto; aquí Qwen3 14B vía OpenRouter o un modelo local en LM Studio.
- **Prompt de sistema**: instrucciones fijas (reglas en tres niveles + ficha de conocimiento) enviadas con cada consulta.
- **Contexto**: resumen textual de las sesiones armado en el teléfono e incluido en la consulta (≤ 10 000 caracteres).
- **Clasificación de alcance**: filtro determinista previo al modelo que responde con texto fijo lo clínico y lo ajeno.
- **Modo Nube / Servidor propio**: consulta vía la Edge Function de Supabase (clave en el servidor) / vía un servidor compatible con OpenAI en la red local.
- **Seudónimo**: identificador no personal («usuario local» o «usuario» + 8 caracteres del id) usado en el contexto y el PDF.
- **Sugerencias de seguimiento**: preguntas propuestas tras una respuesta según el tema.

### Software y plataforma
- **Local primero (*local-first*)**: la copia local es la fuente primaria; la nube es un complemento opcional.
- **Monorepo / espacios de trabajo**: un repositorio con varios paquetes (`packages/*`, `apps/mobile`) gestionados por npm *workspaces*.
- **Migración de esquema**: cambio versionado de la estructura de la base (SQLite v1–v8; Supabase 0001–0005).
- **Sincronización confirmada**: sesión cuyo conteo de entidades en el servidor coincide con el local.
- **RLS** (*row level security*): política de Postgres que limita cada fila a su dueño (`owner_id = auth.uid()`).
- **RPC**: función de base de datos invocada por la app (`sync_session_begin`, etc.).
- **Edge Function**: función sin servidor (Deno) desplegada en Supabase; aquí, el proxy del asistente.
- **Paquete de sesión** (`.plantillas.json`, formato `plantillas-session-bundle-1`): respaldo portable de una sesión.
- **Copia completa de la base**: archivo `.db` con todas las sesiones del teléfono.
- **Dev build**: compilación de la app con módulos nativos propios (necesaria por BLE), distinta de Expo Go.
- **ADR** (registro de decisión de arquitectura): documento corto con contexto, decisión y consecuencias (`docs/adr/0001–0013`).
- **Store** (de aplicación): módulo con estado compartido y suscripción (`useSyncExternalStore`).
- **Isla de actividad**: pastilla flotante que indica una sesión o entrenamiento en curso.
- **Escenario de falla**: modo del simulador que introduce una falla conocida (hueco, duplicado, etc.) para verificar el manejo.
- **Semilla**: valor inicial del generador pseudoaleatorio que hace reproducible la señal simulada.
- **Marca .NSL**: identidad visual: letras Manrope 800 con un punto violeta delante, símbolo del apoyo.

## 2. Siglas

| Sigla | Significado | Uso en el proyecto |
|---|---|---|
| ADC | Analog-to-Digital Converter | conversor de 12 bits del ESP32 |
| ADR | Architecture Decision Record | `docs/adr/` |
| API | Application Programming Interface | OpenAI-compatible, Supabase |
| ATT | Attribute Protocol | capa de BLE bajo GATT; MTU |
| BLE | Bluetooth Low Energy | transporte placa ↔ teléfono |
| BOM | Byte Order Mark | inicio del CSV UTF-8 |
| CI | Continuous Integration | GitHub Actions |
| CRLF | Carriage Return + Line Feed | fin de línea del CSV |
| CSV | Comma-Separated Values | exportación por muestra |
| CV | Coeficiente de variación | σ / media (variabilidad) |
| ESP32 | microcontrolador de Espressif | placa de cada módulo |
| FreeRTOS | Free Real-Time Operating System | tarea de adquisición del firmware |
| FSR | Force Sensing Resistor | sensores 402 y 406 |
| GATT | Generic Attribute Profile | servicio y características BLE |
| GPIO | General Purpose Input/Output | pines de la placa |
| HTML | HyperText Markup Language | base del informe PDF |
| HTTP(S) | Hypertext Transfer Protocol (Secure) | asistente, Supabase |
| IA | Inteligencia artificial | asistente |
| ISO 8601 | norma de fechas y horas | `received_at` |
| JSON | JavaScript Object Notation | contrato USB, respaldo, `log_entry` |
| JWT | JSON Web Token | autenticación ante la Edge Function |
| kv | key-value | almacén de ajustes |
| LAN | Local Area Network | modo Servidor propio |
| LLM | Large Language Model | Qwen3 14B |
| MTU | Maximum Transmission Unit | 185 pedido, 48 mínimo |
| NVS | Non-Volatile Storage | contador de arranques del ESP32 |
| PDF | Portable Document Format | informe de sesión |
| PR | Pull Request | GitHub |
| RLS | Row Level Security | Supabase |
| RNG | Random Number Generator | mulberry32 del simulador |
| RPC | Remote Procedure Call | funciones de sincronización |
| RPE | Rating of Perceived Exertion | escala 1–10 declarada |
| SDK | Software Development Kit | Expo SDK 57 |
| SQL | Structured Query Language | SQLite, Postgres |
| SVG | Scalable Vector Graphics | gráficos y FootMap |
| UI | User Interface | aplicación |
| USB | Universal Serial Bus | transporte de banco de prueba |
| UTF-8 | codificación Unicode | CSV, textos |
| UUID | Universally Unique Identifier | ids de entidades y servicio BLE |
| WAL | Write-Ahead Logging | modo de diario de SQLite |
