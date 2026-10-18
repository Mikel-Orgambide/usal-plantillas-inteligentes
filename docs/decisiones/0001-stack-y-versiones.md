# ADR 0001 - Stack de la aplicación y versiones base

- Fecha: 2026-10-18
- Estado: aceptada

## Contexto

El capítulo 4 selecciona React Native, Expo y TypeScript para Android, C++ con Arduino Core para el ESP32 y SQLite local. La guía de desarrollo pide fijar versiones compatibles y no instalar lo más reciente sin comprobarlo.

## Decisión

- Expo **SDK 57** (`expo ~57.0.30`), React Native 0.86, React 19.2, TypeScript 6.0. Al momento de la decisión, SDK 58 era la versión `latest` recién publicada; elegimos la anterior por su mayor cantidad de parches y la compatibilidad de bibliotecas nativas (BLE, SQLite).
- Node 24 LTS en desarrollo y CI.
- **Development build** (`expo-dev-client`) desde el inicio, no Expo Go, porque BLE requiere módulos nativos.
- Firmware con **PlatformIO** y Arduino Core para ESP32, con versiones fijadas en `platformio.ini`.

## Consecuencias

- La actualización a SDK 58 o posteriores se evalúa en una ADR propia.
- El lockfile (`package-lock.json`) se commitea siempre.
