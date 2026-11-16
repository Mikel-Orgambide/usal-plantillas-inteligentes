# Marca .NSL

Reglas de uso y archivos de la marca (2026-11-03). Decisión: [ADR 0009](../../decisiones/0009-marca-nsl.md).

**.NSL**: consonantes de *iNSoLe*; en texto corrido «NSL» («NSL · Plantillas inteligentes» la primera vez). Marca de letras en Manrope 800 con tracking cerrado; el único gráfico es el **punto** en `accent` apoyado en la línea base delante de la N (el apoyo que miden los sensores; mismo círculo que `FootMap`). Letras en `text-primary`, fondo `bg`; versión clara (#16181c / #5b3fb8) sólo para documentos. Reducción **.N** a tamaño de ícono; las tres letras desde ~24 px. Prohibido rotar, estirar, cambiar el peso, poner el punto después, colorear las letras, agregar contorno o fondo de otro color, degradados o sombras.

| Archivo | Qué es | Dónde está |
|---|---|---|
| `icon.png` | Ícono de la app, `.N` sobre `bg` | `apps/mobile/assets/icon.png` |
| `adaptive-icon.png` | Capa *foreground* del ícono adaptativo (zona segura 66 %) | `apps/mobile/assets/android-icon-foreground.png` (+ fondo plano `bg` y monocromo generados) |
| `splash-icon.png` | Imagen del splash (`contain`, fondo `bg`) | `apps/mobile/assets/splash-icon.png` |
| `logo-nsl-dark.svg/.png` | Marca completa sobre `bg` | `apps/mobile/assets/brand/` y `docs/diseno/marca/` |
| `logo-nsl-light.svg/.png` | Marca completa, versión clara | `docs/diseno/marca/` (tesis, informe PDF, PPT) |
| `*.svg` | Fuentes vectoriales | `docs/diseno/marca/` |

Dónde aparece en la app: Ajustes → «Acerca de» (`Brand` 40, «NSL · Plantillas inteligentes», versión, «Proyecto Final · Ingeniería en Informática · USAL») y en la hoja de cuenta (`Brand` 32). En ningún otro lugar.
