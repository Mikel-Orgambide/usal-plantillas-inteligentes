# Chip

Etiqueta compacta de 32px en `label`, `radius-sm`. Cuatro usos y nada más:

- `neutral`: filtro no activo en Historial («Caminata», «Running», «Fuerza»).
- `selected`: filtro activo o actividad elegida en Preparación; accent sobre `accent-soft`, con tilde.
- `alert`: estado que requiere atención, siempre con palabra: «Incompleta», «Falta L_LATERAL».
- `sim`: procedencia simulada («Simulada»), en `text-secondary` con icono; «Física» no lleva chip salvo junto a una simulada.

No es un botón de acción ni muestra números. Separación entre chips `space-2`. El consumidor pasa `variant`, `children` y `onClick` cuando filtra.
