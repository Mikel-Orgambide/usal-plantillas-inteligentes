# Button

La única acción principal de la pantalla va en `primary` (accent, `on-accent`), una sola vez y, en pantallas de flujo, fija al pie con `block`. Todo lo demás es `secondary` (borde `line`, texto `text-primary`). `danger` (alert) existe solo para confirmar «Finalizar» dentro de un diálogo.

- Etiqueta en `body-medium`: infinitivo o sustantivo («Iniciar», «Finalizar», «Historial», «Comparar con…»). Nunca «OK», «Aceptar» ni jerga.
- 48px de alto (`control-height`), `radius-md`, padding horizontal `space-6`.
- Icono opcional de 20px antes del texto (`icon`), solo si aclara («play» en Iniciar, «stop» en Finalizar).
- Deshabilitado: opacidad .4, sin cambio de color; el motivo se explica en un texto cercano («Faltan 2 posiciones»).
- El consumidor pasa `children` (la etiqueta), `variant`, `onClick`.
