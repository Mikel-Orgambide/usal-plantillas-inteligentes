# Plataforma wearable de plantillas inteligentes

Proyecto Final de Ingeniería en Informática (USAL) · Mikel Orgambide Rueda.

Prototipo de una plataforma que adquiere, transmite, procesa, almacena y visualiza señales plantares de seis sensores FSR (tres por pie) mediante un ESP32 y una aplicación Android, con historial de sesiones y comparación entre sesiones compatibles.

> Estado: **etapa 0 (preparación)**. Ninguna función se considera implementada hasta que su etapa esté cerrada en [`docs/incrementos`](docs/incrementos/).

## Estructura

| Carpeta | Contenido |
|---|---|
| `apps/mobile` | Aplicación Android (Expo SDK 57, React Native, TypeScript) |
| `packages/contract` | Contrato de datos compartido: versión, configuración de canales y validación |
| `packages/simulator` | Fuente simulada determinista con escenarios de falla |
| `packages/storage` | Esquema SQLite versionado, repositorio y cola de escritura |
| `packages/session` | Coordinador de sesiones (máquina de estados, recuperación) |
| `packages/metrics` | Métricas descriptivas por canal con versión de algoritmo |
| `firmware` | Firmware del ESP32 (PlatformIO, Arduino Core) |
| `test-data` | Fixtures y datos simulados identificados como tales |
| `scripts` | Utilidades de desarrollo |
| `docs/especificacion` | Bases de desarrollo (contrato, etapas, pruebas) |
| `docs/decisiones` | Registro de decisiones de arquitectura (ADR) |
| `docs/incrementos` | Evidencia de cada etapa cerrada |

## Requisitos

- Node 24 (ver `.nvmrc`) y npm.
- Android SDK + JDK 17/21 (Android Studio) para builds locales.
- Cuenta de Expo (`eas login`) para builds en la nube.

## Uso

```bash
npm install            # instala todo el monorepo
npm run typecheck      # verificación de tipos
npm test               # pruebas
npm run android        # compila e instala el development build en el teléfono conectado
```

## Flujo de trabajo

- `main` siempre compila y pasa CI. El trabajo se hace en ramas `etapa-N/descripcion` o `fix/...`.
- Commits con [Conventional Commits](https://www.conventionalcommits.org/es/v1.0.0/): `feat(contract): ...`, `fix(mobile): ...`, `docs: ...`.
- Cada etapa cerrada genera un tag `vX.Y-etapaN` y una entrada en `docs/incrementos`.
- Las decisiones técnicas nuevas se registran como ADR en `docs/decisiones`.
