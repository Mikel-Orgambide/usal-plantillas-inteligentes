<img src="docs/diseno/marca/logo-nsl-dark.png" alt=".NSL" width="160">

# NSL · Plantillas inteligentes

**NSL** · Plantillas inteligentes — plataforma wearable que adquiere, transmite, procesa, almacena y visualiza señales plantares. Proyecto Final de Ingeniería en Informática (Universidad del Salvador) · Mikel Orgambide Rueda · 2026.

| Punto de entrada | Qué muestra |
|---|---|
| [Inicio y documentación](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes) | Rama principal: este README, las guías y la documentación técnica ordenada para evaluar el prototipo |
| [Versión evaluada en la tesis](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes/tree/entrega-final) | Etiqueta `entrega-final` (commit `1169f82`): el estado exacto del código, los datos y los documentos que cita el PDF |

La rama principal difiere de la etiqueta sólo en documentación: la aplicación, el firmware, los paquetes, los contratos y los datos de prueba son los mismos. Versiones ensayadas: **app 0.15.3** y **firmware 0.3.0 en el módulo izquierdo y 0.3.1 en el derecho** (0.3.1 sólo agrega el entorno del pie derecho; el izquierdo no se recargó).

Un ESP32 por pie lee sensores de fuerza resistivos (FSR) y envía los registros por Bluetooth a una aplicación Android, que los organiza en sesiones, calcula indicadores descriptivos, guarda el historial, compara sesiones compatibles, genera un informe para revisión profesional, registra el entrenamiento declarado y ofrece un asistente explicativo. El sistema **describe mediciones y su calidad; no diagnostica ni estima fatiga**.

## Requisitos

- Node 24 (`.nvmrc`) y npm 11.
- Para la app en el teléfono: cuenta de Expo (`npm i -g eas-cli`, `eas login`) y Android SDK con `adb`.
- Para el firmware: VS Code + PlatformIO IDE y el driver USB del conversor de la placa (CP210x).
- Para la función del asistente: CLI de Supabase.

## Tres recorridos

Son independientes; el primero no necesita teléfono ni placa y alcanza para comprobar el software.

**A. Pruebas de software (≈10 min, sólo una PC)**

```bash
git clone https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes.git
cd usal-plantillas-inteligentes
npm install            # Node 24 (.nvmrc) y npm 11
npm run typecheck      # tipos de todos los paquetes y la app
npm test               # 201 pruebas (vitest), deterministas, sin teléfono ni placa
```

**B. Android con el simulador (teléfono Android)**

1. Generar el APK de la build de demostración (perfil `preview`, app 0.15.3) con una cuenta de Expo y su CLI (`npm i -g eas-cli`, `eas login`). La compilación corre en la nube de Expo; no hace falta Android Studio:

   ```bash
   cd apps/mobile
   eas build --profile preview --platform android   # al terminar imprime el enlace de descarga del APK (también queda en expo.dev → Builds)
   ```

   Descargar el archivo de ese enlace y guardarlo, por ejemplo, como `nsl-0.15.3-preview.apk`. El proyecto de Expo declarado en `apps/mobile/app.json` (`owner`, `extra.eas.projectId`) es el del autor: desde otra cuenta de Expo hace falta asociar la app a un proyecto propio (quitar esos dos campos en la copia local y ejecutar `eas init`).
2. Instalarlo con el teléfono conectado por cable y la depuración USB activa: `adb install -r nsl-0.15.3-preview.apk`.
3. Abrir la app → **Ajustes → Demostración → «Simulador sin plantillas»** (o «Simular dos módulos») → **Nueva sesión** → grabar 30 s → **Detalle**.
4. Cargar sesiones reales: copiar al teléfono `test-data/fisico/sesion-2026-11-03-ca49daed.plantillas.json` y `…-18763da6.plantillas.json` → **Ajustes → Respaldo → Importar sesión** → **Historial → Comparar** → **Exportar informe (PDF)**.

Sin `.env` la app funciona sólo en local (sin cuenta, sincronización ni asistente en modo nube); todo lo demás está disponible.

**C. Banco físico (dos ESP32 con sensores)**

Cargar `esp32-analog` (pie izquierdo) y `esp32-analog-right` (pie derecho) desde `firmware/` con PlatformIO; en la app, **Plantillas** → conectar ambos módulos → **Nueva sesión**. Cableado y pines en [Firmware del ESP32](#firmware-del-esp32) y en [`docs/incrementos/etapa-09-fuente-fisica.md`](docs/incrementos/etapa-09-fuente-fisica.md).

## Datos de prueba

Cada archivo de [`test-data`](test-data/) declara su origen: simulado, sintético generado por la placa o físico.

| Carpeta | Contenido | Uso |
|---|---|---|
| [`test-data/contract`](test-data/contract/) y [`test-data/simulator`](test-data/simulator/) | Registros de ejemplo del contrato v1.0 y salida de referencia del simulador | Pruebas automáticas (recorrido A) |
| [`test-data/firmware`](test-data/firmware/) | Registros por USB de la placa con señal sintética (19/10) | Transporte sin sensores |
| [`test-data/fisico`](test-data/fisico/) | Sesiones con sensores: dos paquetes importables del 3/11 (`….plantillas.json`), los CSV bilaterales del 11/11 y del 13/11, tres informes PDF y los registros del monitor serie | Recorrido B (importar, comparar, exportar) y contraste de resultados |
| [`test-data/remote`](test-data/remote/) | Comprobaciones de Supabase y de las reglas de acceso, con capturas | Evidencia del complemento remoto |
| [`test-data/backup`](test-data/backup/) | Paquete de respaldo de una sesión | Importación |

Para abrir directamente: [CSV de la sesión bilateral del 13/11](test-data/fisico/sesion-2026-11-13-d3367518-bilateral.csv) · [informe de esa sesión](test-data/fisico/informe-2026-11-13-d3367518-bilateral.pdf) · [informe de comparación entre dos sesiones bilaterales](test-data/fisico/informe-comparacion-2026-11-13-f66ec0f5-d3367518-bilateral.pdf).

## Resultados y estado del prototipo

Distinguimos siempre lo **validado con hardware real**, lo **implementado y comprobado con datos simulados** y lo que es **diseño**. Fuente: [`docs/especificacion/08_Alcance_Final_del_Prototipo.md`](docs/especificacion/08_Alcance_Final_del_Prototipo.md) y [`docs/incrementos`](docs/incrementos/README.md).

| Validado con hardware real | Implementado, comprobado con simulación o pruebas automáticas | Diseño / evolución futura |
|---|---|---|
| Dos módulos de tres FSR (2,2 kΩ talón, 4,7 kΩ antepié), uno por pie y cada uno en su protoboard: reposo 0, respuesta monótona; izquierdo sin saturación con el pie (3/11), derecho validado por USB (11/11: 397 registros, 0 saltos) | Deriva de reloj entre módulos y exactitud del desfase estimado (etapa 13: dos fuentes simuladas; sin referencia externa) | Plantilla física integrada en calzado, cableado al cuerpo, alimentación autónoma, marcha |
| USB: 475 registros sin saltos a 50,00 ms, 0 lecturas fallidas | Rutinas y entrenamiento declarado, actividad con descansos, carga asistida de series (etapa 15) | Calibración a newtons o presión |
| BLE → app: dos sesiones físicas (436 y 609 registros, sin saltos), apoyo estático con el pie, pie derecho «n/d» | Asistente sobre una comparación bilateral | Sincronización de rutinas y entrenamientos (esquema 0005 preparado) |
| Informe PDF sobre las sesiones físicas (etapa 12) | Respaldo, restauración y sincronización con Supabase y RLS 10/10 (etapas 10 y 11, verificadas en el teléfono con sesiones simuladas y sintéticas) | Pruebas de uso con personas |
| Asistente explicativo en modo nube y servidor propio con sesiones físicas (etapa 14, 4/11) | | |
| Sesión bilateral con dos placas por BLE (11/11): 714 registros por módulo a 20,03 reg/s, 0 huecos; corte de un módulo con recuperación automática, métricas `bilateral-1.0` sólo en tramos completos e informe PDF. La pérdida se detectó a ≈ 4,5 s (criterio ≤ 3 s, no cumplido). 13/11: sesión de 90 s (1802 + 1803 registros, 0 huecos), comparación entre dos sesiones bilaterales con PDF y sincronización confirmada en Supabase con cantidades coincidentes | | |

Todas las pruebas con hardware se hicieron **en banco, sobre protoboard**, con la electrónica fuera del calzado y alimentación por USB; no hubo pruebas de uso con personas.

## Limitaciones declaradas

- Las cuentas ADC no son newtons ni presión: no hay calibración de fuerza. La misma lectura en dos sensores de distinto modelo o ubicación no implica la misma carga.
- Los FSR presentan deriva bajo carga constante (creep) y una repetibilidad del orden del 10 % entre colocaciones; tres posiciones por pie no son un mapa de presión.
- El tiempo de adquisición (`time_us`, 32 bits, por módulo) y el de recepción son referencias distintas; entre dos módulos sólo se estima un desfase.
- El entrenamiento es declarado por la persona: la app no verifica repeticiones, pesos ni tiempos.
- El asistente explica indicadores ya calculados; no diagnostica. En modo nube el contexto pasa por un proveedor externo.
- Sin emparejamiento BLE; `configuration_id` sin `device_id`; sin recuperación de contraseña en la app; sin descarga inversa desde el servidor; el proyecto Supabase del plan Free se pausa tras 7 días sin actividad.

## Capturas

Detalle de una sesión con dos módulos (13/11/2026, app 0.15.3): carga por posición de cada pie, señal de ambos talones y eventos por dispositivo. Más capturas en [`docs/capturas`](docs/capturas/); informes PDF de ejemplo en [`test-data/fisico`](test-data/fisico/).

<p>
<img src="docs/capturas/0.15.3/01-detalle-bilateral-izquierdo.png" alt="Detalle: pie izquierdo" width="230">
<img src="docs/capturas/0.15.3/02-detalle-bilateral-derecho.png" alt="Detalle: pie derecho" width="230">
<img src="docs/capturas/0.15.3/03-detalle-bilateral-grafico-eventos.png" alt="Detalle: gráfico y eventos" width="230">
</p>

## Arquitectura

Cuatro capas (especificación `docs/especificacion/02` y `04`):

```mermaid
flowchart LR
  subgraph Sensado
    FSR[FSR406 talón · FSR402 antepié<br/>divisor resistivo por canal]
  end
  subgraph Embebido["Sistema embebido (un ESP32 por pie, firmware)"]
    ADC[ADC 12 bits · 20 reg/s] --> REC[registro: captura, secuencia, time_us]
    REC --> USB[USB JSON por línea]
    REC --> BLE[GATT · registros binarios]
  end
  subgraph App["Aplicación Android (Expo / React Native)"]
    SRC[fuente: BLE o simulador] --> SES[sesión: 1 o 2 módulos]
    SES --> DB[(SQLite local)]
    DB --> MET[métricas desc-1.0 · dist-1.0 · bilateral-1.0]
    MET --> UI[Hoy · Grabación · Historial · Comparación · Entrenamiento]
    DB --> REP[informe PDF · CSV · respaldo]
    MET --> ASI[asistente explicativo]
  end
  subgraph Servicios
    SUP[(Supabase: cuenta, sincronización, función assistant)]
    LLM[OpenRouter · Qwen3 14B<br/>o LM Studio local]
  end
  FSR --> ADC
  BLE --> SRC
  DB -. sesiones cerradas .-> SUP
  ASI -. modo nube .-> SUP --> LLM
  ASI -. servidor propio .-> LLM
```

- **Contrato de datos** (`packages/contract`): seis posiciones (`L_HEEL`, `L_MEDIAL`, `L_LATERAL`, `R_HEEL`, `R_MEDIAL`, `R_LATERAL`); una configuración declara un subconjunto en ese orden y las posiciones no declaradas son «no disponible», nunca cero. Valores originales en `adc_count`; una lectura fallida es `raw_value = null` + `status = read_error`.
- **Un módulo por pie** (ADR 0011): cada ESP32 lleva tres canales, su captura, secuencia y reloj. Con dos módulos la app alinea por instante de recepción y declara el desfase; las métricas izquierda/derecha se calculan sólo en tramos con ambos.
- **Offline-first**: SQLite es la fuente primaria; Supabase sincroniza sesiones cerradas (ADR 0008).
- **Asistente** (ADR 0012): contexto armado en el teléfono, rechazo fijo de consultas clínicas; la clave del proveedor vive sólo como secreto de la función.

## Estructura del monorepo

| Carpeta | Contenido |
|---|---|
| `apps/mobile` | Aplicación Android (Expo SDK 57, React Native, TypeScript, Expo Router) |
| `packages/contract` | Contrato de datos: versión, configuración de canales y validación en ejecución |
| `packages/simulator` | Fuente simulada determinista con escenarios de falla y deriva de reloj |
| `packages/storage` | Esquema SQLite versionado, repositorio, cola de escritura, respaldo |
| `packages/session` | Coordinador de sesiones (máquina de estados, uno o dos módulos, recuperación) |
| `packages/metrics` | Métricas descriptivas por canal, distribución y bilaterales, con versión de algoritmo |
| `packages/ble` | Protocolo BLE de la plantilla y fuente de datos física |
| `packages/sync` | Sincronización de sesiones con el servicio remoto |
| `packages/report` | Informe de sesión (HTML → PDF) y exportación CSV, funciones puras |
| `packages/assistant` | Cliente del asistente (directo o por la función), armado de contexto, filtro de alcance, prompt |
| `packages/training` | Rutinas, entrenamientos, series, actividad (cursor, descanso, caminata) y resumen declarado |
| `supabase` | Esquema remoto (migraciones 0001–0005, RLS), función `assistant` y prueba en PostgreSQL local |
| `firmware` | Firmware del ESP32 (PlatformIO, Arduino Core) |
| `scripts` | Utilidades: validador de logs serie, capturas de pantalla por `adb`, comprobación remota |
| `test-data` | Datos de prueba identificados por origen: `simulator/`, `firmware/`, `fisico/`, `remote/`, `backup/` |
| `docs/tesis` | Documentación de evaluación: cierre del prototipo, especificación final, arquitectura, funcionalidades, evidencia y pruebas, recorrido de demostración, glosario, uso de IA y limitaciones |
| `docs/especificacion` | Bases de desarrollo: contrato de datos, etapas de la aplicación, hardware y firmware, criterios de prueba y alcance final |
| `docs/decisiones` | Registro de decisiones de arquitectura (ADR) |
| `docs/incrementos` | Evidencia de cada etapa |
| `docs/diseno` | Marca .NSL (logos e íconos) y ejemplos de instrucciones dadas a las herramientas de diseño |
| `docs/plantillas-inteligentes-diseno` | Paquete de diseño de la interfaz: brief, pantallas y sistema de diseño (tokens, componentes, fuentes) |
| `docs/capturas` | Capturas de la aplicación por versión |

## Configuración

Ningún secreto va al repositorio: `.env` y `.env.*` están en `.gitignore`; sólo se versionan los `.env.example` con los nombres de las variables.

**App** — copiar `apps/mobile/.env.example` como `apps/mobile/.env`:

| Variable | Para qué | Obligatoria |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | No (sin ella: sólo local) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública (publishable) de Supabase. La secret key **nunca** va en la app | No (sin ella: sólo local) |
| `REMOTE_CHECK_EMAIL_A` / `REMOTE_CHECK_PASSWORD_A` | Cuenta de prueba A para `scripts/remote-check.mjs` | Sólo para esa prueba |
| `REMOTE_CHECK_EMAIL_B` / `REMOTE_CHECK_PASSWORD_B` | Cuenta de prueba B (verifica aislamiento por RLS) | Sólo para esa prueba |

**Base remota** — en el SQL Editor de Supabase ejecutar en orden `supabase/migrations/0001…0005` (0005, entrenamiento, es opcional: la transferencia no está implementada).

**Función `assistant` (modo nube del asistente)** — secretos de Supabase; nombres en `supabase/functions/.env.example`:

| Secreto | Para qué | Por defecto |
|---|---|---|
| `ASSISTANT_API_KEY` | Clave del proveedor compatible con OpenAI (OpenRouter) | — (obligatoria) |
| `ASSISTANT_BASE_URL` | URL base de la API | `https://openrouter.ai/api/v1` |
| `ASSISTANT_MODEL` | Modelo | `qwen/qwen3-14b` |
| `ASSISTANT_HOURLY_LIMIT` | Consultas por hora por usuario | `30` |
| `ASSISTANT_REFERER` / `ASSISTANT_TITLE` | Encabezados opcionales de atribución | vacío / `NSL · Plantillas inteligentes` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase. Carga y despliegue:

```bash
supabase link --project-ref <ref-del-proyecto>
supabase secrets set ASSISTANT_API_KEY=<clave> ASSISTANT_MODEL=qwen/qwen3-14b
supabase functions deploy assistant
```

**Modo servidor propio** — sin secretos: LM Studio en una PC de la misma red con el servidor en `0.0.0.0:1234` y un modelo Qwen3 cargado; en la app, **Ajustes → Asistente → Servidor propio** con `http://<ip-de-la-pc>:1234`.

## Cómo correr

Requisitos: ver [Requisitos](#requisitos).

### Monorepo

```bash
git clone https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes.git
cd usal-plantillas-inteligentes
npm install
npm run typecheck      # tipos de todos los paquetes y la app
npm test               # vitest, sin teléfono ni placa
```

### App en el teléfono

La app usa módulos nativos (SQLite, Bluetooth, archivos, impresión), así que no corre en Expo Go: se instala una build propia y después se desarrolla con el servidor de Metro.

```bash
cd apps/mobile
cp .env.example .env                                   # URL y publishable key de Supabase (opcional: sin ellas funciona sólo en local)
eas build --profile development --platform android     # una vez, y cada vez que cambian módulos nativos
adb install -r <apk descargado>                        # instalación por cable
npx expo start                                         # servidor de desarrollo
```

Build autónoma para demostración: `eas build --profile preview --platform android`. Los comandos de `eas` se ejecutan dentro de `apps/mobile`.

### Firmware del ESP32

Abrir `firmware/` en VS Code con PlatformIO, conectar la placa por USB y cargar el entorno que corresponda (mantener **BOOT/IO0** apretado mientras dice `Connecting…`):

| Entorno | Qué hace | Configuración |
|---|---|---|
| `esp32-synthetic` | Lecturas sintéticas generadas en la placa, sin sensores (pruebas de transporte) | `ESP32-SYN-001` (6 canales) |
| `esp32-analog` | Módulo del pie izquierdo: tres divisores FSR en GPIO 36/39/34 | `ESP32-FSR-L-001` |
| `esp32-analog-right` | Módulo del pie derecho, mismos pines | `ESP32-FSR-R-001` |
| `esp32-adc-test` | Imprime las cuentas crudas de los seis pines por USB, sin BLE ni contrato (banco) | — |

```powershell
pio run -e esp32-analog -t upload -t monitor      # carga y abre el monitor a 230400
python scripts\check_serial.py firmware\logs\<log>.log   # valida secuencia, período y errores de una corrida USB
```

Detalles en [`firmware/README.md`](firmware/README.md) y en [`docs/guia-arranque-y-pruebas.md`](docs/guia-arranque-y-pruebas.md).

## Documentación

El índice completo está en [`docs/README.md`](docs/README.md). Para evaluar el prototipo conviene este orden:

1. [`docs/tesis/10_Cierre_del_prototipo.md`](docs/tesis/10_Cierre_del_prototipo.md): qué hace el sistema, qué quedó demostrado con hardware y qué no.
2. [`docs/guia-arranque-y-pruebas.md`](docs/guia-arranque-y-pruebas.md): arranque de la app, carga del firmware, pruebas automáticas y pruebas manuales en el teléfono.
3. [`docs/tesis/04_Evidencia_y_pruebas.md`](docs/tesis/04_Evidencia_y_pruebas.md): pruebas automáticas por paquete, evidencia de hardware con sus números y protocolos con criterios de aceptación.
4. [`docs/tesis/01_Especificacion_final.md`](docs/tesis/01_Especificacion_final.md) y [`docs/especificacion/08_Alcance_Final_del_Prototipo.md`](docs/especificacion/08_Alcance_Final_del_Prototipo.md): requisitos con su estado y alcance del prototipo.
5. [`docs/tesis/02_Arquitectura_y_codigo.md`](docs/tesis/02_Arquitectura_y_codigo.md) y [`docs/decisiones`](docs/decisiones/): arquitectura y decisiones (ADR 0001 stack, 0002 monorepo y flujo, 0003 nube y distribución, 0004 persistencia local, 0005 interfaz, 0006 transporte USB y BLE, 0007 respaldo, 0008 complemento remoto, 0009 marca .NSL, 0010 informe para revisión profesional, 0011 dos módulos, 0012 asistente explicativo, 0013 rutinas y entrenamiento).
6. [`docs/tesis/09_Deudas_y_limitaciones.md`](docs/tesis/09_Deudas_y_limitaciones.md): deudas técnicas y limitaciones conocidas.
7. [`docs/tesis/06_Defensa.md`](docs/tesis/06_Defensa.md): recorrido reproducible de la demostración y plan de respaldo.

La evidencia de cada etapa está en [`docs/incrementos`](docs/incrementos/README.md), por ejemplo [etapa 9, fuente física](docs/incrementos/etapa-09-fuente-fisica.md) y [etapa 13, bilateral](docs/incrementos/etapa-13-bilateral.md). Los cambios por versión, en [`CHANGELOG.md`](CHANGELOG.md).

## Documentos que cita la tesis

El PDF remite a la etiqueta `entrega-final`. Estos son los archivos que nombra, en la versión evaluada:

| Dónde los cita | Archivo en la etiqueta |
|---|---|
| Capítulo 2, uso de inteligencia artificial | [`docs/tesis/08_Uso_de_IA.md`](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes/blob/entrega-final/docs/tesis/08_Uso_de_IA.md) |
| Capítulo 2, ejemplos de instrucciones a herramientas de diseño | [`docs/diseno/prompts-claude-design.md`](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes/blob/entrega-final/docs/diseno/prompts-claude-design.md) y [`docs/diseno/marca/PROMPT-integracion-marca-NSL.md`](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes/blob/entrega-final/docs/diseno/marca/PROMPT-integracion-marca-NSL.md) |
| Capítulo 7, evidencia y protocolos de prueba | [`docs/tesis/04_Evidencia_y_pruebas.md`](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes/blob/entrega-final/docs/tesis/04_Evidencia_y_pruebas.md) |

En esa etiqueta también quedan los documentos de planificación y las instrucciones internas de trabajo que se retiraron de la rama principal el 16/11/2026 (detalle en [`CHANGELOG.md`](CHANGELOG.md)).

## Flujo de trabajo

- `main` siempre compila y pasa CI (GitHub Actions: typecheck + pruebas).
- Commits con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/). Cada etapa cerrada genera un tag `vX.Y-etapaN` y una entrada en `docs/incrementos`; las decisiones técnicas nuevas, una ADR. La versión entregada lleva el tag `entrega-final`.

## Licencia y autoría

Código y documentación bajo licencia [MIT](LICENSE) © 2026 Mikel Orgambide Rueda. La marca «.NSL» es parte del prototipo y de la tesis, no un registro comercial (ADR 0009). El desarrollo contó con asistencia de herramientas de IA (Claude, Claude Code, Codex, ChatGPT, Claude Design) para investigación, código, pruebas, diseño y redacción técnica, con revisión y decisiones del autor; el registro de ese uso está en [`docs/tesis/08_Uso_de_IA.md`](docs/tesis/08_Uso_de_IA.md) y en las entradas de `docs/incrementos`.
