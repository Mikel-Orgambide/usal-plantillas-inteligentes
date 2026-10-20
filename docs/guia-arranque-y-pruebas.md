# Guía de arranque y pruebas

Cómo levantar la app, cargar el firmware y correr las pruebas, paso a paso. Todo se ejecuta desde PowerShell en la PC (Windows), salvo donde se indica VS Code.

Carpetas:

- Repositorio: `C:\Proyecto Final Tesis\repo`
- App móvil: `C:\Proyecto Final Tesis\repo\apps\mobile`
- Firmware: `C:\Proyecto Final Tesis\repo\firmware` (se abre en VS Code con PlatformIO)

---

## 1. Arranque diario de la app (lo habitual)

La app ya está instalada en el teléfono como *development build*. En el día a día solo hace falta levantar el servidor de desarrollo (Metro) y abrir la app; el teléfono se conecta por Wi-Fi a la PC (misma red).

```powershell
cd "C:\Proyecto Final Tesis\repo"
git pull                 # si hubo cambios en GitHub
npm install              # solo si cambió package.json o aparece "Unable to resolve"
cd apps\mobile
npx expo start
```

Luego abrir la app **Plantillas Inteligentes** en el teléfono. Si no conecta sola, en la pantalla de inicio de la app tocar el servidor que aparece listado o escanear el QR de la terminal.

Teclas útiles en la terminal de `expo start`:

| Tecla | Efecto |
|---|---|
| `r` | recarga la app en el teléfono (después de cambios de código) |
| `j` | abre el depurador |
| `Ctrl+C` | detiene el servidor |

Si la app muestra un error de módulo no encontrado o se comporta raro tras un `git pull`, reiniciar con caché limpia:

```powershell
npx expo start --clear
```

**Cuándo NO alcanza con `expo start`:** cuando se agrega o actualiza un módulo nativo (Bluetooth, SQLite, etc.) hay que generar e instalar una build nueva (sección 4). Se avisa explícitamente en el chat cuando corresponde; en las etapas cerradas hasta ahora pasó en las etapas 0, 3, 5 y 8.

### Fuente de las sesiones

- Con las plantillas (ESP32) conectadas desde la pestaña **Plantillas**, las sesiones nuevas son **físicas**.
- Sin plantillas conectadas, se usa el **simulador** (si está activado en Ajustes) y las sesiones se marcan «Simulada». El escenario del simulador (normal, read_error, disconnect, capture_restart, etc.) se elige en Ajustes.

---

## 2. Firmware del ESP32

### Cargar el firmware en la placa

1. Conectar la placa por USB-C (queda en COM3). LED rojo encendido = alimentada.
2. En VS Code: **File → Open Folder** → `C:\Proyecto Final Tesis\repo\firmware`.
3. Si el **monitor serie** está abierto, cerrarlo con `Ctrl+C` en su terminal (ocupa el puerto).
4. Mantener apretado el botón **IO0** de la placa → clic en **→ (Upload)** en la barra inferior de VS Code → soltar IO0 cuando aparezca `Writing at 0x00001000...` → esperar `SUCCESS` (≈ 50–80 s). No tocar nada durante la escritura.

Equivalente por terminal (desde la carpeta `firmware`):

```powershell
pio run -e esp32-synthetic --target upload
```

Entornos: `esp32-synthetic` (lecturas sintéticas, sin sensores; el actual) y `esp32-analog` (seis FSR en pines ADC1; a partir de la etapa H2).

### Ver lo que manda la placa (monitor serie)

Clic en **🔌 (Serial Monitor)** o:

```powershell
pio device monitor
```

Velocidad 230400. Apretar **EN** en la placa para reiniciarla y ver `info` + `status: boot`. Comandos (escribir y Enter): `start`, `stop`, `info`. Todo lo que muestra el monitor queda guardado en `firmware/logs/`.

- Sin cliente Bluetooth conectado: por USB salen `record` (20 por segundo) y `status`.
- Con la app conectada por Bluetooth: los registros van por BLE; por USB solo salen `status` (incluido `progress` cada 5 s con generados/transmitidos/descartados).

### Validar un registro del monitor

```powershell
cd "C:\Proyecto Final Tesis\repo"
python scripts\check_serial.py firmware\logs\<archivo>.log
```

Informa por captura: registros, saltos de secuencia, período entre registros, desfase entre canales, lecturas fallidas y líneas corruptas.

---

## 3. Pruebas automáticas

Se corren en la PC, sin teléfono ni placa. Cubren contrato, simulador, persistencia SQLite, coordinación de sesiones, métricas, comparación y protocolo BLE (97 pruebas al cierre de la etapa 8).

```powershell
cd "C:\Proyecto Final Tesis\repo"
npm run typecheck     # tipos de todos los paquetes y la app
npm test              # todas las pruebas (vitest)
```

Un solo paquete:

```powershell
npm test -w @plantillas/contract
npm test -w @plantillas/simulator
npm test -w @plantillas/storage
npm test -w @plantillas/session
npm test -w @plantillas/metrics
npm test -w @plantillas/ble
```

Modo continuo mientras se edita (vuelve a correr al guardar):

```powershell
cd packages\ble
npx vitest
```

Comprobar que el proyecto Expo está sano (versiones, duplicados nativos):

```powershell
cd apps\mobile
npx expo-doctor
```

Las mismas pruebas corren en GitHub Actions en cada push (`.github/workflows/ci.yml`).

---

## 4. Build nueva de la app (solo cuando cambian módulos nativos)

```powershell
cd "C:\Proyecto Final Tesis\repo"
npm install
cd apps\mobile
npx expo-doctor                                   # debe dar 21/21
eas build --profile development --platform android
```

Al terminar, descargar el APK desde el enlace que imprime (o desde expo.dev) y, con el teléfono conectado por cable:

```powershell
adb devices                                       # debe listar el teléfono como "device"
adb install -r "C:\Users\orgam\Downloads\<archivo>.apk"
```

La instalación desde el navegador del teléfono está bloqueada por la Protección avanzada de Google; por cable funciona. Después, `npx expo start` como siempre.

Build para la demo (sin servidor de desarrollo, más fluida):

```powershell
eas build --profile preview --platform android
```

---

## 5. Pruebas manuales en el teléfono (por etapa)

- **Sesión simulada**: Hoy → Nueva sesión → Iniciar → esperar → Finalizar → Ver la sesión. En Ajustes se puede elegir un escenario de falla (read_error, disconnect, sequence_gap, capture_restart…) para ver cómo lo registra la app.
- **Sesión física**: Plantillas → Buscar plantillas → tocar `Plantillas-9E7EE4` → Hoy debe decir «Plantillas · ESP32-9E7EE4» → Nueva sesión. Con el monitor serie abierto se puede comparar `transmitted` (placa) con «Registros» (Detalle): deben coincidir.
- **Comparación**: Historial → marcar dos sesiones con el círculo → Comparar las 2 elegidas.
- **Respaldo**: Detalle → ícono de exportar (arriba a la derecha) comparte un `.plantillas.json`; Ajustes → Respaldo → Importar una sesión lo restaura (si ya existe, lo dice). Copia completa: comparte un `.db`; Restaurar una copia completa lo reemplaza todo (guarda la actual en caché antes).
- **Desconexión (H06)**: con una sesión física grabando, desenchufar la placa 5 s y volver a enchufarla: la app muestra «Conexión interrumpida», reconecta y el Detalle registra Desconectado / Reconectado / Reinicio de captura.

---

## 6. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `Unable to resolve "@plantillas/..."` al bundlear | paquete nuevo del monorepo sin enlazar | `npm install` en la raíz y `npx expo start --clear` |
| Upload se queda en `Connecting....` | la placa no entró en modo de carga | mantener IO0 apretado hasta `Writing at...` |
| Upload falla a mitad (`chip stopped responding`) | se tocó EN o se movió el cable | repetir sin tocar nada; ya está configurado a 115200 |
| Monitor con caracteres raros al inicio | mensajes del cargador del chip a otra velocidad | normales; las líneas JSON vienen después |
| Upload: `could not open port COM3` | el monitor serie está abierto | `Ctrl+C` en el monitor y repetir |
| La app no encuentra la placa | placa sin alimentación o ya conectada a otro cliente | enchufarla, apretar EN, buscar de nuevo |
| Engranaje flotante sobre la app | «Tools button» del cliente de desarrollo de Expo | sacudir el teléfono → apagar *Tools button*; no existe en la build final |
| Botones lentos durante la grabación | development build con Metro | normal en desarrollo; la build *preview* es más fluida |

---

## 7. Git

El asistente commitea en la carpeta compartida; el autor sube:

```powershell
cd "C:\Proyecto Final Tesis\repo"
git status                       # ver qué hay pendiente
git push --follow-tags           # subir commits y tags de etapa
git log --oneline -10            # últimos commits
```

Si un tag de etapa fue movido (se avisa en el chat): `git push --follow-tags --force-with-lease`.
