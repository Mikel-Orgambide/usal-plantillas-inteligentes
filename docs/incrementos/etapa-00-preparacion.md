# Etapa 0 - Preparación del entorno

- Fecha de cierre: 2026-10-18
- Commits: 71a2da2, 0cc903e, 7cb8db4
- Tag: v0.0-etapa0

## Versiones comprobadas

| Componente | Versión |
|---|---|
| Expo SDK / runtime | 57 (`exposdk:57.0.0`) |
| React Native / React | 0.86.3 / 19.2.3 |
| TypeScript | 6.0.x |
| Node / npm (Windows) | 24.20.0 / 11.19.1 |
| JDK | OpenJDK 21.0.10 (Android Studio JBR) |
| Android platform-tools | 37.0.0 |
| eas-cli | 25.x |
| Git / GitHub CLI | 2.55 / 2.102 |

## Entorno y cuentas

- Repositorio privado `Mikel-Orgambide/proyecto-final-plantillas-inteligentes`, CI de GitHub Actions configurado.
- Proyecto EAS `@mikel-orgambide/plantillas-inteligentes` (ID 3b47649d-172b-4c2b-8ac4-1d9a13ea119c), keystore Android generada y almacenada en EAS.
- Variables `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` cargadas en los entornos development, preview y production de EAS.
- Proyecto Supabase `plantillas-inteligentes` (región São Paulo, plan Free): Data API activa, exposición automática de tablas desactivada, RLS automática activada. Sin esquema todavía.

## Prueba ejecutada

- Build EAS `development` para Android (ID 23573132-0fc2-47a8-918a-92089721bf86), APK de distribución interna.
- Dispositivo: Google Pixel 10 Pro XL (Android 16, serie 57311FDCQ0068A). La instalación desde el navegador fue bloqueada por la Protección avanzada de Google; la instalación mediante `adb install` desde la PC fue exitosa.
- `npx expo start` en la PC: la app detectó el servidor de desarrollo en la red local, compiló el bundle (708 módulos, ~3,6 s) y mostró la pantalla inicial de la plantilla.

## Resultado

Condición de cierre cumplida: proyecto ejecutable en el teléfono, con cadena de herramientas, repositorio, CI, build en la nube y cuentas operativas. No se ejecutaron pruebas físicas ni existe aún código de dominio.

## Limitaciones y notas

- Los `development builds` se instalan por cable con `adb install`; el enlace de instalación de EAS no sirve en este dispositivo mientras la Protección avanzada esté activa.
- `expo-doctor` pasó 21/21 comprobaciones desde Windows.
- Las 22 vulnerabilidades reportadas por `npm audit` corresponden a dependencias de herramientas de desarrollo de Expo; no se aplica `npm audit fix --force` para no romper la compatibilidad con el SDK.

## Próxima tarea

Etapa 1: contrato de datos v1.0 en `packages/contract` (tipos, configuración de seis canales, validador en ejecución) con pruebas sobre los casos C01-C12.
