# LineChart

Gráfico de línea con **huecos visibles**. Una línea por serie (`accent`; la segunda en `text-secondary`), ejes de 1px en `line`, tope del eje Y en 4095 con sus dos marcas en `caption`. Un `null` corta la línea y deja un tramo punteado en `chart-gap` sobre el eje: los huecos se ven como huecos, nunca se unen.

- Grabación: ventana de los últimos segundos (`startLabel: '−10 s'`, `endLabel: 'ahora'`), una serie por pie o por posición elegida con `Chip`.
- Detalle: sesión completa, `ticks` cada 5 o 10 minutos.
- Comparación: dos series alineadas por tiempo de sesión; `stale` en la serie no activa.
- Sin área rellena, sin suavizado, sin puntos sobre la línea. Altura 120px por defecto; el ancho sigue al contenedor.
