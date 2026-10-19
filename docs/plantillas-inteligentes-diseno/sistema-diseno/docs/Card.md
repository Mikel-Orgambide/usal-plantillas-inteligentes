# Card

Contenedor base en `surface`, `radius-md`, padding `space-4`. Sin borde ni sombra: se apoya sobre `bg` por el escalón de luminosidad. `elevated` usa `surface-elevated` para hojas inferiores y diálogos (ahí el radio sube a `radius-lg` por CSS del contenedor).

- Título opcional en `heading`; un solo título por tarjeta.
- Dentro, el contenido sigue la retícula: `space-2` entre etiqueta y valor, `space-3` entre bloques.
- Una tarjeta responde a una pregunta («¿Cuál fue la última sesión?»); si necesita dos títulos, son dos tarjetas.
- El consumidor pasa `title` y `children`.
