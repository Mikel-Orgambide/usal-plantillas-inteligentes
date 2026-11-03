# Integración de la marca «.NSL» en la app — prompt para el chat de desarrollo

Contexto: la app móvil del proyecto (Expo SDK 57 / React Native, `apps/mobile`) tiene ícono y splash provisorios. Se definió la marca del producto y hay que incorporarla en la app y dejarla registrada en los documentos del repo. Es un cambio **solo de activos, configuración y docs**: no toca lógica ni módulos nativos nuevos. Hacelo completo en una sola pasada y cerralo con un commit.

Adjunto a este mensaje la carpeta `brand/` con los archivos listos (SVG fuente + PNG renderizados con Manrope 800). No los regeneres ni los redibujes: copialos.

## 1. La marca (para que la entiendas antes de tocar nada)

- **Nombre:** `NSL`, escrito con el punto delante: **.NSL**. Son las consonantes de *iNSoLe* (smart insole). En texto corrido se escribe «NSL» (sin el punto) y la primera vez va acompañado de «plantillas inteligentes».
- **Isotipo:** marca de letras, sin dibujo de plantilla. El único elemento gráfico es el **punto**: un círculo en `accent` apoyado en la línea base, delante de la N. Representa el punto de apoyo que miden los sensores (el mismo círculo que usa `FootMap`). No es decorativo: nunca se cambia por un «.» tipográfico ni se saca.
- **Tipografía:** Manrope 800 (ExtraBold), tracking cerrado (≈ −0,04 em). La app ya carga Manrope; si no está el peso 800 en `@expo-google-fonts/manrope`, agregarlo al `useFonts` (está en el paquete: `Manrope_800ExtraBold`).
- **Colores:** solo tokens existentes de `apps/mobile/src/presentation/theme/tokens.ts`: texto en `text-primary`, punto en `accent` (#b48cff), fondo en `bg`. Versión clara (solo para documentos, no para la app): texto #16181c, punto `accent` claro #5b3fb8. Sin degradados, sin sombras, sin brillos, sin segunda tinta.
- **Reducción:** a tamaño de ícono se usa solo **.N** (punto + N). Las tres letras se usan desde ~24 px de alto hacia arriba.
- **Prohibido:** rotar, estirar, cambiar el peso, poner el punto después (`NSL.`), colorear las letras, agregar un contorno o un fondo de otro color.

## 2. Archivos adjuntos (`brand/`)

| Archivo | Qué es | Dónde va |
|---|---|---|
| `icon.png` (1024×1024, fondo `bg`) | Ícono de la app, `.N` | `apps/mobile/assets/icon.png` |
| `adaptive-icon.png` (1024×1024, fondo transparente, contenido dentro de la zona segura del 66 %) | Capa *foreground* del ícono adaptativo Android | `apps/mobile/assets/adaptive-icon.png` |
| `splash-icon.png` (1024×1024, transparente) | Imagen del splash (`expo-splash-screen`, modo `contain`) | `apps/mobile/assets/splash-icon.png` |
| `logo-nsl-dark.svg` / `.png` | Marca completa `.NSL` sobre `bg` | `apps/mobile/assets/brand/` y `docs/diseno/marca/` |
| `logo-nsl-light.svg` / `.png` | Marca completa, versión clara, fondo transparente | `docs/diseno/marca/` (para el PDF de la tesis y la PPT de la defensa) |
| `icon.svg`, `adaptive-icon.svg`, `splash-icon.svg`, `splash.svg` | Fuentes vectoriales de lo anterior | `docs/diseno/marca/` |

Si el proyecto ya usa otros nombres para estos activos en `app.json` / `app.config.*`, respetá los nombres existentes y reemplazá el contenido; no dejes el ícono viejo huérfano.

## 3. Qué hacer en la app

1. **Activos.** Copiar los PNG a `apps/mobile/assets/` según la tabla. Borrar los provisorios que reemplazan.
2. **`app.json` / `app.config`.**
   - `expo.name`: `"NSL"` (es el nombre que se ve bajo el ícono). **No cambiar** `expo.slug`, `android.package`, el `projectId` de EAS ni el `scheme`: romperían la build y el proyecto EAS.
   - `expo.icon`: `./assets/icon.png`.
   - `expo.android.adaptiveIcon`: `{ "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "<valor de bg en tokens.ts>" }`. Si el proyecto ya usa `monochromeImage`, generar una desde `adaptive-icon.png` en blanco.
   - Plugin `expo-splash-screen`: `{ "image": "./assets/splash-icon.png", "resizeMode": "contain", "backgroundColor": "<bg>", "imageWidth": 200 }`. El fondo del splash debe ser exactamente `bg` para que no haya salto al cargar la app (tema oscuro fijo).
3. **Componente `Brand`** en `apps/mobile/src/presentation/components/Brand.tsx` (o donde vivan los componentes de presentación): dibuja `.NSL` con `react-native-svg` (un `Circle` + `Text` en Manrope 800) o con `View` + `Text`, usando solo tokens. Props: `size` (alto de las letras en px; default 28) y `variant: 'full' | 'mark'` (`mark` = `.N`). Nada de PNG dentro de la app para el logo: tiene que escalar.
4. **Dónde aparece en la interfaz** (y en ningún otro lado):
   - **Ajustes → sección «Acerca de»** (crearla si no existe, al final): `Brand` tamaño 40, debajo «NSL · Plantillas inteligentes», versión de la app (`expo-constants`) y «Proyecto Final · Ingeniería en Informática · USAL». Sin créditos largos.
   - **Pantalla de inicio de sesión / cuenta** (la que se ve sin sesión iniciada): `Brand` tamaño 32 en la cabecera, reemplazando el título de texto si lo hay.
   - **No** va en la cabecera de Hoy, Historial ni Grabación: esas pantallas tienen su propio título y una sola acción principal; la marca compite con los números.
5. **Nombre visible en textos.** Donde la app se nombre a sí misma en un string de interfaz («Plantillas inteligentes» en pantallas de bienvenida, correos de Supabase, `README`), pasar a «NSL · Plantillas inteligentes» la primera vez y «NSL» después. No tocar identificadores, nombres de paquetes npm, tablas ni rutas.
6. **Build.** El ícono y el splash se hornean en el binario: hace falta **nueva build** (preview 0.12.0 por EAS; la development build vigente sirve para ver el componente `Brand` pero no el ícono). Subir la versión de la app en `app.json` (`version`) y en `package.json` del workspace según la convención del repo.

## 4. Qué registrar en los documentos

1. **`docs/diseno/brief-interfaz.md`** (y la copia en el Proyecto de Claude, `diseno/brief-interfaz.md`): agregar **§8 Marca (2026-11-03)** con el contenido de la sección 1 de este prompt, resumido, más la tabla de archivos y la lista de dónde aparece.
2. **`docs/decisiones/0009-marca-nsl.md`** (ADR, mismo formato que los 0001–0008): contexto (la app no tenía identidad; se evaluaron SNSL, SOLEA, Pisada y .NSL), decisión (.NSL, marca de letras, punto en `accent` como símbolo del apoyo), consecuencias (sin plantilla dibujada; el punto se reserva como símbolo y no se usa como adorno en otros lugares; nombre interno `plantillas-inteligentes` se mantiene), estado: aceptada. Dejar explícito que la marca es parte del prototipo y de la tesis, no un registro comercial.
3. **`desarrollo/estado-y-convenciones.md`** (doc del Proyecto): en «Stack decidido» agregar una línea «Marca: .NSL (ADR 0009); activos en `apps/mobile/assets/` y fuentes en `docs/diseno/marca/`», actualizar la versión de la app y la nota de build pendiente.
4. **`README.md`** del repo: `logo-nsl-dark.png` arriba del título, y la primera línea «**NSL** · Plantillas inteligentes — plataforma wearable…».
5. **Figma** (archivo «Plantillas Inteligentes — Sistema de diseño», página Fundamentos): si está conectado el conector, agregar un frame «Marca» con el `.NSL` en oscuro y claro y el `.N` a 48 px, enlazado a las variables `accent` / `text-primary` / `bg`. Si no está conectado, dejarlo anotado como pendiente en el ADR; no bloquea.
6. **`docs/defensa/`** (si ya existe el guion de la demo): anotar que la portada de la PPT usa `logo-nsl-light.png` o `logo-nsl-dark.png` según el fondo.

## 5. Cierre

- `npm run typecheck` y `npm test` en verde.
- Un solo commit (Conventional Commits): `feat(mobile): incorporar marca .NSL (ícono, splash, componente Brand) y registrar ADR 0009`.
- Reportá: archivos tocados, si hizo falta agregar el peso 800 de Manrope, y recordar que la preview 0.12.0 la corre el autor desde Windows (EAS) e instala con `adb install -r`.
