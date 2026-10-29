# Diseño en Figma — cómo usarlo desde otro chat

Archivo: **Plantillas Inteligentes — Sistema de diseño**
https://www.figma.com/design/0Hb0wBxywX9LlM0NOzJbNo (equipo de `mikel.orgambide`, conector de Figma activo en claude.ai).

## Páginas
- **Fundamentos**: variables (Color con modos Oscuro/Claro, incluye `accent-deep`; Espaciado; Radio; Medidas), estilos de texto Manrope, hoja de muestras.
- **Componentes**: 21 iconos (`Icon/<nombre>`), Button, Chip, Card, ListRow, Header, StatusBanner, ValueCard, FootMap, LineChart, DeviceStatus, **Ring**, **TabBar**. Cada componente tiene en su descripción la regla de uso.
- **Pantallas**: las 19 del diseño original (19/10) en 7 secciones; sección **«Editables (app 0.11.0)»** con las pantallas rehechas en auto-layout: ahí viven las propuestas. Nombres: `Hoy · propuesta B (dirección elegida)`, `Historial · propuesta B (dirección elegida)`; las descartadas quedan al 50 % de opacidad.
- **App 0.11.0 (capturas)**: 20 capturas reales del teléfono (`docs/capturas/0.11.0/`), referencia fija.

## Regla de oro
La captura es lo que existe; la pantalla «propuesta B» es lo que se quiere; el código es lo que se cambia. Figma no genera código: el chat lee la pantalla y la traduce a los componentes de `apps/mobile/src/presentation/components` con los tokens de `theme/tokens.ts`. Si un cambio necesita un token nuevo, primero se agrega a `tokens.json` y a `tokens.ts`, después a Figma.

## Cómo pedirlo en un chat
Pegar esto (ajustando la pantalla):

> Trabajá con el archivo de Figma https://www.figma.com/design/0Hb0wBxywX9LlM0NOzJbNo (conector de Figma). Leé en la página «Pantallas», sección «Editables (app 0.11.0)», el frame «Historial · propuesta B (dirección elegida)» con `get_design_context` y compará con la captura `docs/capturas/0.11.0/11-historial.png` y con `apps/mobile/src/app/(tabs)/historial/index.tsx`. Proponé el cambio en React Native usando los componentes existentes y los tokens de `theme/tokens.ts`, sin agregar dependencias. Antes de editar, mostrame el plan.

Para obtener el enlace exacto de un frame: en Figma, clic derecho sobre el frame → *Copy link*; ese enlace lleva el `node-id` y el chat puede leer sólo ese nodo.

## Decisiones vigentes (27/10)
- Dirección visual: «B» (ver enmienda en `docs/diseno/brief-interfaz.md`): halo de `accent` 12 % detrás de la cabecera; tarjetas `surface-elevated → surface` con borde `line` 60 %. Nada más lleva degradado.
- Historial agrupado por día en tarjetas, con resumen arriba (sesiones · horas · físicas/simuladas); filtros y selección para comparar se mantienen.
- Pestaña «Más» → «Ajustes». Tocar «Hoy» estando en Hoy vuelve al día de hoy. Hoy sin texto explicativo largo (va a la hoja de desglose).
- Las capturas se regeneran con `scripts/capturar-pantallas.ps1` en cada versión (`docs/capturas/<versión>/`).
