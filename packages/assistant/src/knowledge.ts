/**
 * Ficha de conocimiento del asistente (ADR 0012, ajuste del 4/11/2026).
 *
 * Texto fijo que acompaña al prompt de sistema: qué mide el sistema, cómo se
 * calcula y se lee cada indicador de la app, qué puede explicar una diferencia
 * entre sesiones y cuáles son los límites. Su contenido sale de la
 * documentación del repositorio (especificación 02, métricas `desc-1.0`,
 * `dist-1.0` y `bilateral-1.0`, evidencia de la etapa 9); no incluye rangos
 * «normales» ni cifras clínicas, porque el prototipo no está calibrado ni
 * validado con personas. Se comparte con la función gestionada mediante
 * `scripts/sync-assistant-prompt.mjs`.
 */
export const KNOWLEDGE = `FICHA DE CONOCIMIENTO (cómo funciona NSL y cómo se leen sus números)

Qué se mide
- Cada posición tiene un sensor resistivo de fuerza (FSR) bajo el pie: talón (FSR406), antepié medial y antepié lateral (FSR402). El ESP32 lee la tensión de un divisor con una resistencia fija y la convierte en cuentas ADC de 0 a 4095 (12 bits), unas 20 veces por segundo.
- Más apoyo sobre el sensor → más cuentas. La relación no es lineal ni está calibrada: 2000 cuentas no son «el doble» de 1000 en fuerza, y no hay conversión a newtons, kilos ni presión. 0 significa que el sensor no recibió carga en ese momento; 4095 es el tope (saturación): por encima no se distingue más carga.
- Sensores de modelo o resistencia distintos no son directamente comparables entre sí (en el banco: 2,2 kΩ en el talón y 4,7 kΩ en el antepié).
- Tres puntos por pie no son un mapa de presión: muestran lo que pasa en esos tres lugares.

Indicadores por posición (algoritmo desc-1.0)
- Media: promedio de todas las lecturas válidas de la sesión. Mezcla momentos con y sin apoyo: una media baja puede ser poco apoyo o pocos momentos de apoyo.
- Máximo: lectura más alta. Cerca de 4095 indica que el sensor llegó al tope.
- Desvío (σ): cuánto cambian las lecturas alrededor de la media. Alto = señal que sube y baja (pasos, cambios de postura); bajo = carga constante o sin carga.
- n: cantidad de lecturas válidas usadas.
- «no disponible» o n/d: esa posición no estaba instrumentada en la configuración (no es cero).

Reparto y simetría (dist-1.0)
- Reparto antepié/talón: qué parte de la suma de medias corresponde a la parte delantera (medial + lateral) y qué parte al talón. Ej.: antepié 76 % / talón 24 % = la lectura se concentró en la parte delantera del pie.
- Izquierda/derecha: qué parte de la suma corresponde a cada pie. Sólo existe si ambos pies estaban instrumentados.
- Asimetría por zona: (izq − der)/(izq + der), de −1 a 1; 0 = parecido en ambos pies, positivo = más lectura a la izquierda.
- Variabilidad: σ/media promedio de las posiciones; mayor = lecturas más cambiantes durante la sesión.
- Todo esto describe cómo se repartió la lectura de los sensores, no la fuerza real ni un puntaje.

Calidad del registro
- Registros: mensajes recibidos (cada uno con las lecturas de todas las posiciones del módulo). Esperados: los que la placa numeró.
- Hueco de secuencia: registros que no llegaron (por ejemplo, una interferencia BLE). Desconexión/reconexión: el enlace se cortó y volvió. Reinicio de captura: la placa empezó una captura nueva.
- Tasa: registros por segundo (objetivo 20). Un hueco no significa que no hubo apoyo: significa que no hay datos de ese intervalo.
- Con dos módulos (uno por pie): «tramo con ambos módulos» = porcentaje del tiempo en que llegaron datos de los dos; «desfase» = diferencia estimada entre los relojes de las placas. Los indicadores izquierda/derecha se calculan sólo en ese tramo.

Qué puede explicar una diferencia entre sesiones (siempre como posibilidades, no conclusiones)
- La tarea: caminar, estar parado, cargar el peso en un pie, apretar con la mano; la duración y cuántos momentos hubo sin apoyo.
- La postura o la forma de apoyar: más peso adelante o atrás, de un lado o del otro.
- El calzado, la superficie o lo que se apoya sobre el sensor (una moneda, una plantilla).
- La colocación del sensor: unos milímetros de diferencia cambian bastante la lectura.
- La deriva propia del FSR: bajo carga constante la lectura sube lentamente con el tiempo (en el banco, de 2150 a 2600 en 5 s).
- La saturación: si un sensor llega a 4095, más carga ya no se ve.
- Cambios de configuración (otra placa, otra resistencia, otro sensor): las sesiones dejan de ser comparables.

Cómo comparar mejor
- Mismo protocolo (misma tarea, mismo orden, duración parecida), misma configuración y mismos sensores en el mismo lugar, mismo calzado. Repetir la sesión en las mismas condiciones para ver si la diferencia se mantiene.

Entrenamiento (rutinas y registro de lo declarado)
- La app permite cargar una rutina (propia o indicada por un profesional) con ejercicios de fuerza (series × repeticiones × peso), caminata/carrera (tiempo o distancia) u otros, y registrar en cada entrenamiento lo que la persona hizo por serie: repeticiones, peso, duración, esfuerzo percibido (RPE 1–10) y notas. Esos datos los declara la persona; la app no los mide.
- Volumen = suma de repeticiones × kilos de las series con peso; es un total declarado, no una medida de los sensores. RPE es la sensación de esfuerzo de la persona, de 1 (muy liviano) a 10 (máximo).
- Una sesión de plantillas puede estar vinculada a un ejercicio o a una serie: ahí lo medido (la lectura de los sensores) y lo declarado (reps, peso) se leen juntos, pero siguen siendo cosas distintas.
- Si la persona anota una molestia o dolor, se guarda como nota suya: no se interpreta, no se mide y no se saca ninguna conclusión; eso es del profesional.
- La app no arma rutinas ni ajusta cargas: eso lo decide la persona o su profesional.

Límites del prototipo
- Es un módulo en banco (protoboard) con tres sensores por pie, sin calibración de fuerza y sin validación con usuarios.
- No mide fatiga, dolor, lesiones ni rendimiento, y no reemplaza a un profesional: describe cómo se comportaron los sensores.`;
