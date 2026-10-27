# Plataforma wearable de plantillas inteligentes

Proyecto Final de Ingeniería en Informática (USAL) · Mikel Orgambide Rueda.

Prototipo de una plataforma que adquiere, transmite, procesa, almacena y visualiza señales plantares de seis sensores FSR (tres por pie) mediante un ESP32 y una aplicación Android, con historial de sesiones y comparación entre sesiones compatibles.

> Estado: **etapas 0–8 y 10 cerradas** (contrato, simulador, persistencia, sesiones, pantallas, métricas, comparación, fuente física por BLE con lecturas sintéticas del ESP32, respaldo y paquete de demostración); **etapa 11 cerrada** (cuenta con correo y contraseña y sincronización confirmada con Supabase). Ninguna función se considera implementada hasta que su etapa esté cerrada en [`docs/incrementos`](docs/incrementos/). Los sensores FSR y la calibración (H2–H4, etapa 9) quedan pendientes.

## Estructura

| Carpeta | Contenido |
|---|---|
| `apps/mobile` | Aplicación Android (Expo SDK 57, React Native, TypeScript) |
| `packages/contract` | Contrato de datos compartido: versión, configuración de canales y validación |
| `packages/simulator` | Fuente simulada determinista con escenarios de falla |
| `packages/storage` | Esquema SQLite versionado, repositorio y cola de escritura |
| `packages/session` | Coordinador de sesiones (máquina de estados, recuperación) |
| `packages/metrics` | Métricas descriptivas por canal con versión de algoritmo |
| `packages/ble` | Protocolo BLE de la plantilla y fuente de datos física |
| `packages/sync` | Sincronización de sesiones con el servicio remoto: identificadores estables, confirmación por cantidades, reintentos |
| `supabase` | Esquema remoto (tablas con titular, RLS, funciones de sincronización) y su prueba en PostgreSQL local |
| `firmware` | Firmware del ESP32 (PlatformIO, Arduino Core) |
| `test-data` | Fixtures y datos simulados identificados como tales |
| `scripts` | Utilidades de desarrollo |
| `docs/especificacion` | Bases de desarrollo (contrato, etapas, pruebas) |
| `docs/decisiones` | Registro de decisiones de arquitectura (ADR) |
| `docs/incrementos` | Evidencia de cada etapa cerrada |

## Requisitos

- Node 24 (ver `.nvmrc`) y npm 11.
- Para la app en el teléfono: cuenta de Expo (`npm i -g eas-cli`, `eas login`) y Android SDK con `adb` para instalar el APK por cable.
- Para el firmware: VS Code + PlatformIO IDE y el driver USB del conversor de la placa (CP210x).

## Puesta en marcha desde una copia limpia

```bash
git clone https://github.com/Mikel-Orgambide/proyecto-final-plantillas-inteligentes.git
cd proyecto-final-plantillas-inteligentes
npm ci                 # instala todo el monorepo con las versiones del lockfile
npm run typecheck      # verificación de tipos de todos los paquetes y la app
npm test               # pruebas (vitest), sin teléfono ni placa
```

Comprobado el 2026-10-20 desde una copia limpia: `npm ci` + `npm run typecheck` + `npm test` (103 pruebas) + `npx expo export --platform android` sin errores.

### App en el teléfono

La app usa módulos nativos (SQLite, Bluetooth, archivos), así que no corre en Expo Go: se instala una build propia una vez y después se desarrolla con el servidor de Metro.

```bash
cd apps/mobile
cp .env.example .env                                   # URL y publishable key de Supabase (opcional: sin ellas la app funciona sólo en local)
npx expo-doctor
eas build --profile development --platform android     # build de desarrollo (una vez, y cada vez que cambian módulos nativos)
adb install -r <apk descargado>
npx expo start                                         # servidor de desarrollo; la app se conecta por Wi-Fi
```

Paquete autónomo para demostración (sin servidor de desarrollo):

```bash
eas build --profile preview --platform android
```

### Firmware del ESP32

Abrir la carpeta `firmware/` en VS Code con PlatformIO, conectar la placa por USB y ejecutar **Upload** (mantener `IO0` durante `Connecting…`). Detalles en [`firmware/README.md`](firmware/README.md) y en [`docs/guia-arranque-y-pruebas.md`](docs/guia-arranque-y-pruebas.md).

## Guía operativa

[`docs/guia-arranque-y-pruebas.md`](docs/guia-arranque-y-pruebas.md): arranque diario, carga del firmware, pruebas automáticas y manuales, builds, problemas frecuentes.

## Flujo de trabajo

- `main` siempre compila y pasa CI. El trabajo se hace en ramas `etapa-N/descripcion` o `fix/...`.
- Commits con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/): `feat(contract): ...`, `fix(mobile): ...`, `docs: ...`.
- Cada etapa cerrada genera un tag `vX.Y-etapaN` y una entrada en `docs/incrementos`.
- Las decisiones técnicas nuevas se registran como ADR en `docs/decisiones`.
