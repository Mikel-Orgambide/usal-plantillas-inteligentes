# Etapa 12 - Informe para revisión profesional (PDF) y marca .NSL

- Fecha: 2026-11-03 · estado: implementada, pendiente de validar en la build preview 0.12.0.
- Versión de la app: 0.12.0. ADR 0009 (marca) y 0010 (informe).

## Marca

- Nombre visible «NSL» (`expo.name`), ícono `.N`, ícono adaptativo (foreground + fondo plano `bg` + monocromo), splash `contain` sobre `bg`, favicon. Fuentes en `docs/diseno/marca/`; marca completa en `apps/mobile/assets/brand/`.
- Componente `Brand` (`presentation/components/Brand.tsx`): Manrope 800 (`Manrope_800ExtraBold` agregado a `useFonts`), punto en `accent` apoyado en la línea base. Aparece en Ajustes → «Acerca de» y en la hoja de cuenta; en ningún otro lugar.
- Pendiente: frame «Marca» en Figma (no bloquea).

## Informe

- `packages/report`: `buildSessionReportHtml(bundle, opciones)` y `buildComparisonReportHtml(a, b, opciones)`; 4 pruebas (paquete físico `ESP32-FSR-L-001` de tres canales recortado de `test-data/fisico/sesion-2026-11-03-ca49daed`, y paquete simulado de seis canales con una lectura fallida). Comprobado: pie no instrumentado como «no disponible» (3 filas), bilaterales «n/d · requiere ambos pies», declaración de origen `physical`/`simulated`, sin correos, un SVG por canal más barras, nombre de archivo `informe-<fecha>-<id8>.pdf`.
- App: `infrastructure/report/report.ts` (`expo-print` ~57.0.2 + `expo-sharing`), botón «Exportar informe (PDF)» en Detalle (sesión cerrada con capturas) y en Comparación (sólo compatibles).

## Pruebas

- `npm run typecheck`: 8 paquetes y `apps/mobile` en verde. `npm test`: 137 pruebas en verde (contract 25, ble 19, session 11, metrics 29, report 4, storage 26, simulator 15, sync 8).

## Pendiente para cerrar

- Build preview 0.12.0 (EAS) e instalación por cable; comprobar ícono, splash, «Acerca de» y generar un PDF real de la sesión física `ca49daed` (paginación de los gráficos).
- Guardar el PDF generado en `test-data/fisico/` como evidencia y una captura de «Acerca de» en `docs/capturas/0.12.0/`.
- Mostrar el informe al profesional entrevistado y registrar sus observaciones.
