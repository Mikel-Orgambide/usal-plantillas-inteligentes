# 03 · Funcionalidades por pantalla

> Documento base (no redacción final). Verificado contra `apps/mobile/src/app/**` y `apps/mobile/src/presentation/components/**` en la versión de app **0.15.2** (commit `01487bf`). Textos entre comillas = textos reales de la interfaz. «a verificar» = no confirmado en el código.
> Capturas de referencia disponibles: `docs/capturas/0.11.0/01–20` y `docs/capturas/0.12.0-fsr/01–04`. **No hay capturas** de las pantallas agregadas desde 0.13 (Entrenamiento, Rutinas, Asistente, Respaldo, Demostración, isla de actividad): conviene tomarlas con `scripts/capturar-pantallas.ps1` antes de la entrega.

## 0. Navegación general
- Barra inferior con tres pestañas (`(tabs)/_layout.tsx`): **Historial** · **Hoy** (centro, inicio) · **Ajustes**. Al salir de una pestaña su pila vuelve al inicio (`popToTopOnBlur`).
- Pantallas de pila raíz: Preparación (Nueva sesión), Grabación, Entrenamiento, Plantillas, Ajustes › {Asistente, Demostración, Respaldo, Rutinas, Rutina}. Asistente como **modal**.
- Elementos globales:
  - **Isla de actividad** (`ActivityIsland`): pastilla flotante arriba de todas las pantallas mientras hay una sesión grabando o un entrenamiento en curso; tocarla vuelve a Grabación («Volver a la actividad en curso»).
  - **Botón flotante del asistente** (`AssistantFab`): en Hoy, Historial y Detalle de sesión si el asistente está activado; desde el detalle pasa el id de la sesión al contexto.
  - Al abrir la app: migraciones de la base, cierre como incompletas de las sesiones que quedaron abiertas (aviso de sesiones recuperadas, captura `20-recuperada.png`), autenticación y sincronización automática.

---

## 1. Hoy (`(tabs)/index.tsx`)
**Propósito**: punto de partida y resumen de un día. Capturas `01-hoy-conectado`, `02-hoy-vacio`, `03-hoy-desconectado`.

| Bloque | Contenido / comportamiento | Datos y módulos |
|---|---|---|
| Acción principal | «Nueva sesión» (deshabilitado si no hay fuente) → Preparación; si hay sesión grabando: «Volver a la sesión en curso» | `useActiveSource`, `sessionStore` |
| Selector de día | flechas «Día anterior» / «Día siguiente», «Volver a hoy»; sólo días con sesiones | `daySummary.availableDays`, `dayLabel` |
| **Indicadores del día** | segmentado «Izq / der» · «Antepié / talón» · «Calidad», con anillo (`Ring`) y filas (`MeterRow`). Izq/der: reparto por pie y «Diferencia por zona (izq − der)» Talón/Medial/Lateral; con un solo pie: «Requiere ambos pies: la configuración actual instrumenta un solo pie…». Antepié/talón: «Antepié (medial + lateral)» vs «Talón», «Media por posición (cuentas ADC)», «Variabilidad (σ / media)». Calidad: «Registros recibidos», «Esperados», «Huecos de secuencia», «Lecturas fallidas» con la aclaración «No describe al usuario: describe la captura.» | `loadDaySummary` → `combineChannelMetrics`, `computeDistribution` (`dist-1.0`) |
| **Resumen del día** | «Sesiones», «Tiempo grabado», «Carga acumulada» (cuentas·s aproximadas), «Huecos y fallas» | `daySummary`, `approximateLoad` |
| **Entrenamiento** | entrenamiento del día («En curso» → «Seguir», «Hecho» → «Ver»); «Iniciar rutina» (hoja «¿Qué rutina?», o «Entrenamiento libre (sin rutina)»), «Entrenar libre», «Crear rutina», «Ver rutinas». Aviso: «Entrenás sin plantillas; si querés medir, iniciá la sesión desde «Nueva sesión» y elegí la rutina ahí.» | `trainingStore`, `activityStore.startActivity` → Grabación (panel Rutina) |
| **Sesiones del día** | lista con etiquetas «Física» / «Simulada» / «Incompleta»; «Ver las N sesiones en Historial» | `useSessions` |

Estados: cargando («Cargando…»), error («No se pudo leer el historial» + «Reintentar»), vacío («Sin sesiones todavía. Las plantillas están conectadas / El simulador está listo / …», «Sin sesiones este día.»), sin fuente (botón deshabilitado).

---

## 2. Preparación — «Nueva sesión» (`preparacion.tsx`)
Captura `04-nueva-sesion`.
- **Actividad**: Caminata · Running · Fuerza · Otra (`ACTIVITY_LABEL`).
- **Rutina (opcional)**: lista de rutinas activas o «Sin rutina»; si no hay: «Sin rutinas activas. Se crean desde Hoy → Entrenamiento o Ajustes → Rutinas.» Elegir una rutina inicia también el entrenamiento y lo vincula con la sesión.
- **Contexto (opcional)**: texto libre «Calzado, superficie, notas» (se guarda en la sesión; afecta la comparabilidad como advertencia).
- **Módulos / Dispositivo**: procedencia «Física» / «Simulada» / «Sin fuente» y pies instrumentados («Ambos», izquierdo o derecho) con un `FootMap` de las posiciones Talón/Medial/Lateral.
- Botón «Iniciar» («Iniciando…»); si no hay configuración: «Sin configuración · no se puede iniciar». Al iniciar → Grabación (`router.replace`).
- Módulos: `sessionStore` (crea el `SessionCoordinator` con la fuente de `activeSource`), `trainingStore`.

---

## 3. Grabación (`grabacion.tsx`)
Capturas `05-grabacion-grabando`, `06-grabacion-interrumpida`, `07-grabacion-finalizar`, `0.12.0-fsr/01–04-grabacion-pie-fsr`.
- Sin gesto de volver (`gestureEnabled: false`); «Volver al inicio; la actividad sigue» (la isla permite volver). Pantalla encendida si el ajuste `keepAwake` está activo.
- **Estado de la sesión**: «Preparada», «Grabando», «Interrumpida», «Finalizando», «Completa», «Incompleta». Duración en vivo.
- Si hay entrenamiento en curso: segmentado **«Medición» | «Rutina»** (o «Rutina libre»).
- **Panel Medición**: vista «Pies» (`FootMap` con el valor en vivo de cada posición; no instrumentadas vacías; valores grises = viejos) o «Números grandes» (`BigNumbers`); selector de pie «Izquierdo» / «Derecho» / «Ambos». Banner «Conexión interrumpida — Los valores en gris son anteriores a la desconexión»; con dos módulos: «Módulo izquierdo/derecho {reconectando/desconectado…}» y «La duración sigue; el hueco queda registrado».
- **Panel Rutina** (`RoutinePane`): ejercicio actual con objetivo; fuerza: «Repeticiones», «Peso (kg)», «RPE 1–10», «Molestia o dolor (se anota tal cual, no se interpreta)», botón «Listo · serie X de N»; luego **Descanso** con cuenta regresiva, «Después: …» y «Saltar descanso · mm:ss» («Terminá o saltá el descanso para cambiar de ejercicio.»); caminata: cronómetro «Iniciar/Pausar/Reanudar», «Transcurrido», «Falta» / «Objetivo cumplido», «Terminé la caminata»; «Hechas» (series cargadas, «Quitar serie»); «Fuera de la rutina» / «Cargar ejercicio»; «Rutina completa».
- **Finalizar**: «Finalizar sesión» → confirmación (resumen de duración, «Seguir grabando», «Finalizar»); con entrenamiento: «Finalizar sesión y entrenamiento» / «Finalizar todo», «Notas del entrenamiento (opcional)», «Descartar entrenamiento vacío». Sin sesión: «Terminar rutina» / «Finalizar entrenamiento». Tras cerrar: «Ver la sesión» → Detalle.
- Sin actividad: «No hay una actividad en curso — Iniciá una sesión o un entrenamiento desde Hoy.»
- Módulos: `sessionStore` (instantánea en vivo), `activityStore`, `packages/session`, `packages/training/activity`.

---

## 4. Historial (`(tabs)/historial/index.tsx`)
Capturas `11-historial`, `12-historial-dos-elegidas`, `13-historial-vacio`.
- Segmentado **«Sesiones» | «Entrenamientos»**. Subtítulo: «Sesiones de {correo}» o «Sesiones de este teléfono, sin cuenta» (con cuenta sólo se ven las de esa cuenta).
- **Sesiones**: totales («sesiones», «grabadas», «físicas · simuladas»), filtro «Todas» / por actividad («Caminata», «Running», «Fuerza», «Otra») / «Simuladas», lista agrupada por día con etiquetas; muestra los últimos días y «Ver sesiones anteriores (N días más)» / «Mostrar solo los últimos días». **Selección de dos** sesiones → «Comparar las 2 elegidas».
- **Entrenamientos**: totales «entrenamientos», «series», «kg·rep», «declarado»; filtro por tipo de rutina («Todos» + categorías); lista con «Entrenamiento libre» / «En curso».
- Estados: cargando, error + «Reintentar», vacíos («Todavía no hay sesiones — Grabá la primera desde Inicio.», «Nada con este filtro — Probá con otro filtro.», «Todavía no hay entrenamientos — Iniciá una rutina desde Hoy, con o sin plantillas.»).
- Módulos: `useSessions`, `daySummary.groupByDay`, `trainingStore`, `authStore`.

---

## 5. Detalle de sesión (`(tabs)/historial/sesion/[id].tsx`)
Capturas `08-detalle-arriba`, `09-detalle-medio`, `10-detalle-abajo`.
- **Encabezado**: fecha, actividad, procedencia «Física»/«Simulada», estado de sincronización («Sincronizada», «Sólo en este teléfono», «Sincronizar» / «Sincronizando…» / «Reintentar sincronización», «De otra cuenta» con aviso de que no se sincroniza), vínculo «Vinculada a {entrenamiento}» con «Quitar».
- **Sesión incompleta**: «Lo que llegó quedó guardado; la duración puede ser estimada».
- **Calidad**: «Registros», «Huecos», «Lecturas fallidas», «Capturas»; con dos módulos «Calidad por módulo» (Pie izquierdo/derecho) y «Correspondencia entre módulos» (desfase declarado, tramo completo y fracción; `computeBilateral`).
- **Carga por posición**: por captura («Captura N») media, máximo y σ por posición (`desc-1.0`); reparto antepié/talón; «Izquierda / derecha» con «Izquierdo/Derecho» y «Asimetría {zona}» («más carga a la izquierda/derecha»), sólo con dos pies; «Sesión completa» si hay tramo bilateral. Sin capturas: «Sin capturas: no hay lecturas sobre las que calcular.»; abierta: «Disponibles al finalizar la sesión.»
- **Gráfico** temporal por posición (`LineChart`), o «Sin datos para graficar.»
- **Eventos**: lista desplegable con etiquetas en español («Sesión iniciada/finalizada», «Captura iniciada/detenida», «Reinicio de captura», «Conectado/Desconectado/Reconectado», «Hueco de secuencia», «Registro fuera de orden», «Recuperada como incompleta», «Error de la fuente», «Módulo perdido/recuperado»).
- **«Comparar o exportar»** (hoja): «Comparar con…» («Elegí otra sesión compatible en Historial»), «Exportar informe (PDF)» («Para revisión profesional»), «Exportar sesión (CSV)» («Una fila por muestra»), «Exportar paquete (.plantillas.json)» («Respaldo completo de la sesión»).
- Estados: cargando, error, «No existe una sesión con ese identificador.»
- Módulos: `useSessions`, `sessionMetrics`, `packages/metrics` (desc, dist, bilateral), `infrastructure/report`, `infrastructure/backup`, `syncStore`.

---

## 6. Comparación (`(tabs)/historial/comparar.tsx`)
Capturas `14-comparacion`, `15-comparacion-incompatible`.
- Cabecera A vs B. Resultado de `assessComparability`: «Compatibles · misma configuración · cuentas ADC · misma procedencia · misma métrica» o «Estas dos sesiones no se pueden comparar por posición» con la lista **«Requisitos para comparar»** (✓/✗ «Misma configuración», «Misma unidad», «Misma procedencia», «Misma versión de métrica») y advertencias («Actividad distinta», «Contexto distinto», «Sesión con reinicios»). Incompatibles: «Sí se pueden comparar duración, cantidad de registros y calidad de recepción.»
- Varias capturas: «A x · B y capturas · se compara la primera de cada una».
- **Diferencia por posición**: «A m · B m · máx ±… · σ ±…» y Δ (B − A) con signo; «Las posiciones no instrumentadas en esta configuración no se comparan.»
- **Izquierda / derecha**: «Izquierdo · A → B», «Asimetría talón · A → B» (si hay dos pies).
- **Calidad de recepción**: «Datos recibidos · A / B».
- Gráficos superpuestos «Pie izquierdo/derecho · alineadas por tiempo de sesión» (o «no instrumentado»).
- Acciones: «Exportar informe (PDF)» (informe comparativo), «Cambiar sesiones».
- Módulos: `packages/metrics/compare`, `packages/report.buildComparisonReportHtml`.

---

## 7. Plantillas — conexión BLE (`plantillas.tsx`)
Capturas `16-plantillas`, `17-plantillas-buscando`.
- Estado: «Sin plantillas conectadas», «Buscando…», «Conectando…», «Conectadas», «Reconectando».
- «Buscar plantillas» (escaneo de 6 s filtrado por el servicio GATT) → lista «Encontradas» → elegir; tarjeta por módulo con pie, «Dispositivo», «MTU» y «Configuración publicada» (canales leídos de la placa). «Buscar el módulo del pie {otro}» para el segundo módulo. «Desconectar» / «Desconectar ambos» (bloqueado: «Hay una sesión grabando»). «Última conectada · {id}».
- Avisos: «Bluetooth apagado — Activalo para buscar las plantillas.», «Conexión interrumpida — Si hay una sesión grabando, intenta reconectar sola; lo que no llegue queda como hueco.», «No se pudo completar».
- Ayuda «Para conectar»: encender la placa, buscar, la app reconoce qué pie instrumenta (tres posiciones), conectar la otra para ambos pies, con plantillas conectadas no se usa el simulador.
- Módulos: `infrastructure/ble/deviceStore.ts`, `packages/ble`.

---

## 8. Entrenamiento (`entrenamiento.tsx`)
- Detalle de un entrenamiento (en curso o terminado). Resumen: «Series», «Volumen» (kg·rep), «Caminata», «RPE medio».
- En curso: «Este entrenamiento está en curso: se sigue ejercicio por ejercicio desde la actividad» + «Seguir»; aviso «Hay una sesión de plantillas grabando».
- Entradas por ejercicio («Ejercicios» / «Fuera de la rutina»), «Cargar serie», «Cargar ejercicio» (hoja con tipo Fuerza / Caminata-carrera / Otro, «Serie», «Repeticiones», «Peso (kg)», «Tiempo (min)», «Distancia (km)», «RPE 1–10», molestia, notas → «Guardar serie»), «Quitar serie».
- «Grabar con plantillas» (inicia sesión vinculada); «Finalizar entrenamiento» (notas; vacío se descarta), «Borrar entrenamiento».
- Leyenda: «Lo que cargás acá lo declarás vos; la app no lo mide…».
- Módulos: `trainingStore`, `activityStore`, `packages/training` (summary, validate).

---

## 9. Asistente (`asistente.tsx`, modal)
- Encabezado «Asistente» con modo («Nube» / «Servidor propio»), alcance («Sesión seleccionada» / «Todas tus sesiones»), «Nueva conversación», «Cerrar».
- Sugerencias iniciales: con sesión — «¿Cómo se repartió la carga?», «¿Hubo problemas en el registro?», «¿Qué cambió respecto de la anterior?», «¿Qué significa el desvío?»; general — «¿Cómo vienen mis últimas sesiones?», «¿Qué cambió entre las dos últimas?», «¿Cómo fue el entrenamiento de hoy?», «¿Cómo puedo comparar mejor mis sesiones?».
- Respuestas marcadas «Generado por IA · revisar»; «Preguntas de seguimiento»; error con «Reintentar»; indicador «El asistente está escribiendo».
- **Modo registro**: botón «Registrar ejercicio» (ej. «sentadilla serie 2, 10 × 40 kg»); tarjeta «Serie a registrar» editable (Ejercicio, Serie, Repeticiones, Peso, Duración, Distancia, RPE) → «Guardar» / «Descartar»; «Salir del modo registro».
- Módulos: `assistantStore`, `packages/assistant`, `packages/training/assisted`, Edge Function `assistant` o LM Studio.

---

## 10. Ajustes (`(tabs)/mas.tsx`) y subpantallas
Capturas `18-ajustes`, `19-cuenta`.

| Sección | Elementos |
|---|---|
| **Cuenta** | «Sin cuenta» → hoja con «Correo», «Contraseña (mínimo 6 caracteres)», «Iniciar sesión» / «Crear cuenta»; «Conectada» con «Sincronizar ahora» (progreso «Enviando X de Y registros…», «Nada pendiente»), «Cerrar sesión». Sin servicio: «Este paquete no tiene configurado el servicio remoto». Textos explicativos: «La copia local es la fuente primaria…», con cuenta el Historial muestra sólo sus sesiones |
| **Dispositivo** | «Plantillas» (estado: Conectadas / Ambos pies) → Plantillas |
| **Datos** | «Rutinas» («…se registran, no se miden»), «Respaldo», «Unidad: cuentas ADC (0–4095) · sin calibración» (informativo) |
| **Aplicación** | «Demostración» («Simulador, escenarios de falla y pantalla encendida»), «Asistente» (estado) |
| **Acerca de** | «NSL · Plantillas inteligentes», «Proyecto Final · Ingeniería en Informática · USAL», versión |

- **Ajustes › Asistente** (`ajustes/asistente.tsx`): «Botón flotante» (on/off), **Modo** «Nube · recomendado» (requiere cuenta) o «Servidor propio» (URL `http://192.168.0.140:1234` por defecto, modelo opcional; LM Studio con «Serve on Local Network»), «Probar conexión», «Qué hace y qué no», aviso de privacidad (qué se envía en cada modo).
- **Ajustes › Demostración** (`ajustes/demostracion.tsx`): «Simulador sin plantillas», «Simular dos módulos» (relojes con distinto origen y deriva, prueba ADR 0011), «Pantalla encendida al grabar», «Escenario del simulador» (normal, lectura fallida, desconexión, hueco, duplicado, conflicto, reinicio, contradicción, canal faltante). La semilla (`seed`, por defecto 1) existe en los ajustes pero **no se edita desde la interfaz**.
- **Ajustes › Respaldo** (`ajustes/respaldo.tsx`): «Por sesión» (exportar desde el detalle; «Importar sesión» `.plantillas.json`, idempotente: «La sesión ya estaba en este teléfono; no se modificó nada.» o «Sesión restaurada: N captura(s)…»); «Base completa» («Copia completa» `.db` de todas las cuentas; «Restaurar una copia completa» que reemplaza todo, con confirmación «Reemplazar todo»; la anterior queda guardada).
- **Ajustes › Rutinas** (`ajustes/rutinas.tsx`): lista («Profesional» / «Propia»), «Nueva rutina», «Editar», «Duplicar», «Archivar»/«Restaurar», «Ver/Ocultar archivadas».
- **Ajustes › Rutina** (`ajustes/rutina.tsx`): «Nombre», «Objetivo (opcional)», «Tipo (opcional)» (categorías), «Origen» «Propia» / «Indicada por un profesional», «Indicaciones del profesional (opcional)» («Tal cual te las dieron; la app no las interpreta»), «Ejercicios» (tipo, objetivo: series/reps/peso, tiempo/distancia/ritmo, o texto; «Descanso (s)» 90 por defecto; «Subir/Bajar/Quitar»; «Agregar ejercicio»), «Guardar rutina». Leyenda: «La app no propone rutinas ni ajusta cargas.»

---

## 11. Flujos de punta a punta

1. **Sesión física (un pie)**: Ajustes › Plantillas → Buscar → elegir placa (MTU, `info`, configuración de 3 canales) → Hoy › Nueva sesión → Actividad/Contexto → Iniciar (`0x01`, espera `capture_started`) → Grabación (valores en vivo, 20 reg/s) → Finalizar (`0x02`, vaciado de la cola, métricas `desc-1.0`) → Detalle (calidad, carga por posición, antepié/talón; izq/der «requiere ambos pies») → PDF/CSV/paquete → sincronización automática si hay cuenta.
2. **Sesión bilateral**: conectar módulo izquierdo y luego el derecho (o «Simular dos módulos») → sesión con dos capturas → Detalle con «Calidad por módulo», «Correspondencia entre módulos» y métricas `bilateral-1.0` en tramos completos.
3. **Desconexión durante la grabación**: banner «Conexión interrumpida», valores grises → `BleDataSource` reintenta 5 × 2 s → mismo `capture_id` ⇒ hueco de secuencia; otro ⇒ «Reinicio de captura» → evento en Detalle; con dos módulos `module_lost` / `module_recovered`.
4. **Cierre inesperado de la app**: al reabrir, `recoverOpenSessions` marca «Incompleta» («Recuperada como incompleta») sin borrar datos.
5. **Comparación**: Historial → elegir dos → «Comparar las 2 elegidas» → requisitos/advertencias → diferencias B − A → PDF comparativo.
6. **Entrenamiento con medición**: Nueva sesión → elegir rutina → Grabación con «Medición | Rutina» → series con descanso → «Finalizar sesión y entrenamiento» → sesión vinculada, cada serie con su `session_id`; en Historial › Entrenamientos y en el Detalle («Vinculada a…»); sección 7b del PDF.
7. **Entrenamiento sin plantillas**: Hoy › Iniciar rutina / Entrenar libre → panel Rutina → Finalizar → Historial › Entrenamientos.
8. **Asistente**: botón flotante (desde Detalle con la sesión) → pregunta → clasificación (clínica/otra ⇒ texto fijo) → contexto → Nube (Edge Function) o LAN → respuesta «Generado por IA · revisar» → registro local.
9. **Carga por asistente**: «Registrar ejercicio» o frase tipo «sentadilla serie 2, 10 × 40 kg» → JSON → tarjeta editable → «Guardar» (sólo tras confirmar) → entrada del entrenamiento en curso.
10. **Cuenta y sincronización**: Ajustes › Cuenta → crear/iniciar → vínculo usuario local/remoto → «Sincronizar ahora» o automática → «Sincronizada» sólo con cantidades confirmadas.
11. **Respaldo**: exportar `.plantillas.json` desde el Detalle → importar en otro teléfono (Ajustes › Respaldo) — o copia `.db` completa.
12. **Demostración sin hardware**: Ajustes › Demostración → simulador + escenario de falla → sesión «Simulada» con la falla registrada en Eventos/Calidad.
