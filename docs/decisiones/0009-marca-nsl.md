# ADR 0009 - Marca «.NSL»

- Fecha: 2026-11-03
- Estado: aceptada

## Contexto

La aplicación tenía ícono, splash y nombre visible provisorios («Plantillas Inteligentes»). Para la demostración y la defensa hacía falta una identidad mínima, coherente con el sistema de diseño (tokens, Manrope, tema oscuro) y con el carácter del prototipo. El autor evaluó las opciones SNSL, SOLEA, Pisada y .NSL.

## Decisión

**Nombre:** `NSL`, escrito con el punto delante: **.NSL** (consonantes de *iNSoLe*, plantilla inteligente). En texto corrido se escribe «NSL» y, la primera vez, «NSL · Plantillas inteligentes».

**Isotipo:** marca de letras, sin plantilla dibujada. El único elemento gráfico es el **punto**: un círculo en `accent` apoyado en la línea base delante de la N, que representa el punto de apoyo que miden los sensores (el mismo círculo que `FootMap`). Nunca se cambia por un «.» tipográfico ni se omite.

**Tipografía y color:** Manrope 800 (ExtraBold), tracking ≈ −0,04 em; letras en `text-primary`, punto en `accent`, fondo `bg`. Versión clara (texto #16181c, punto #5b3fb8) sólo para documentos (PDF de la tesis, informe para revisión profesional, PPT). Sin degradados, sombras, contornos ni segunda tinta. A tamaño de ícono se usa la reducción **.N**.

**Activos:** `apps/mobile/assets/` (ícono, ícono adaptativo y monocromo, splash, favicon), `apps/mobile/assets/brand/` (marca completa) y fuentes SVG/PNG en `docs/diseno/marca/`. Componente `Brand` (`presentation/components/Brand.tsx`, props `size` y `variant: full | mark`) para la interfaz; nunca PNG dentro de la app. Aparece sólo en Ajustes → «Acerca de» y en la hoja de cuenta; no en Hoy, Historial ni Grabación.

## Consecuencias

- `expo.name` pasa a «NSL»; `slug`, `android.package`, `scheme` y el proyecto EAS no cambian. El nombre interno `plantillas-inteligentes` (repositorio, paquetes npm, tablas, rutas) se mantiene.
- El punto se reserva como símbolo de la marca y no se usa como adorno en otros lugares.
- Ícono y splash se hornean en el binario: requiere nueva build (preview 0.12.0).
- La marca es parte del prototipo y de la tesis; no constituye un registro comercial.
- Pendiente: frame «Marca» en la página Fundamentos de Figma (oscuro, claro y `.N` a 48 px, enlazado a `accent` / `text-primary` / `bg`); no bloquea.
