# ListRow

Fila de 64px para Historial, eventos y dispositivos. Título en `body`, subtítulo en `caption` (`text-secondary`), valor opcional a la derecha en `num-md` tabular, chevron fino en `text-secondary`. Separadas por 1px de `line`; sin fondo propio: viven sobre `bg` o dentro de una `Card`.

- Subtítulo con separador «·»: «Running · 32 min · 41 220 registros».
- `chip` recibe un `Chip` de estado (Incompleta, Simulada). Una sesión completa y física no lleva chip.
- `selected` (elegida para comparar): tilde a la izquierda, título en accent, `chevron: false`.
- Toda la fila es el objetivo táctil.
