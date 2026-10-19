# ValueCard

La tarjeta de valor numérico: etiqueta en `label` (`text-secondary`), número en `num-lg` tabular (`text-primary`), unidad en `caption` a la derecha del número, línea de apoyo opcional en `caption`.

- `value` numérico se formatea con espacio de miles («2 418»); un texto ya formateado («32:08») se muestra tal cual. `null` muestra «Sin datos», nunca un cero.
- `unit` siempre visible: «cuentas» para el ADC (0–4095); dejar lugar para «N»/«kg» cuando haya calibración.
- `stale`: valor anterior a una desconexión, en `stale` con «· desactualizado» junto a la etiqueta. Nunca se congela como actual ni se oculta.
- `size: 'xl'` usa `num-xl` (duración en Grabación). `live` pulsa 160 ms al cambiar.
- Grilla 2×3 para las seis posiciones: dos columnas, gap `space-3`.
