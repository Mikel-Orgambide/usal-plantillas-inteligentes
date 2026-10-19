# FootMap

Dos siluetas de pie con **tres puntos** cada una: talón, medial y lateral. Cada punto muestra su valor en `num-md` tabular; el anillo crece y el relleno accent gana opacidad con valor/4095. Nunca hay interpolación entre puntos ni mapa de calor: el color acompaña al número, no lo reemplaza.

- `left` y `right` reciben `{ heel, medial, lateral }` en cuentas (0–4095). `null` dibuja el anillo punteado, «—» y suma al pie de foto «n posiciones sin datos».
- `stale` atenúa todo en `stale` y agrega «desactualizado» al pie de foto; se usa en Grabación tras una desconexión hasta que lleguen lecturas nuevas.
- El pie izquierdo va a la izquierda con la cara medial hacia el centro; el derecho es su espejo.
- Pie de foto automático: «cuentas ADC · 0–4095». Pasar `caption` para reemplazarlo cuando exista calibración.
- En Grabación ocupa el ancho de pantalla bajo la duración; en Detalle muestra la media por posición.
