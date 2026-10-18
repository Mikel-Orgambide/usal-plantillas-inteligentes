# Implementación de la aplicación, paso a paso

Fecha: 13 de octubre de 2026.
Estado: hoja de trabajo previa al desarrollo. Nombres de módulos propuestos, no archivos existentes.

## 1. Enfoque y estructura

React Native, Expo y TypeScript; Android como entorno inicial. Seleccionar versiones compatibles al inspeccionar el repositorio, fijarlas y conservar el archivo de bloqueo. No instalar automáticamente las versiones más recientes sin comprobar el conjunto.

Estructura sugerida:

~~~text
mobile/
  presentation/       pantallas, navegación, gráficos y mensajes
  application/        coordinación de sesión y casos de uso
  domain/             tipos, reglas, métricas y compatibilidad
  infrastructure/     simulador, BLE, SQLite y sincronización
shared/
  contract/           versión, validación y configuración de canales
firmware/
docs/
test-data/
scripts/
~~~

Es una organización modular del código, no una quinta capa de la plataforma. Adaptar los nombres al repositorio real sin reconstruirlo innecesariamente.

## 2. Interfaces propuestas

- DataSource: conectar/desconectar, consultar configuración, iniciar/detener captura y emitir registros y eventos.
- ContractValidator: validar mensajes y devolver errores explicables.
- SessionCoordinator: controlar el ciclo de sesión y asociar capturas.
- SessionRepository: transacciones, guardado, recuperación y consultas.
- MetricCalculator: cálculo determinista por canal y ventana.
- CompatibilityChecker: decidir qué comparación se puede realizar y explicar restricciones.
- BackupService: copia consistente y recuperación comprobable.
- SyncService: ampliación posterior, con titularidad e identificadores conservados.

Los cálculos de dominio no importan componentes visuales ni llaman directamente a BLE o Supabase. Una pantalla no escribe muestras en la base por su cuenta.

## 3. Etapa 0 - Inspeccionar y preparar

Leer el paquete, las instrucciones y el repo de Norman para requisitos académicos. Inspeccionar después el código del producto, si existe. Registrar versiones, scripts y cambios locales del usuario.

Preparar estructura, configuración, tipos y documentación. Conservar secretos fuera del repositorio; incluir únicamente nombres y ejemplos no privados.

Cierre: proyecto ejecutable en el teléfono o entorno Android disponible, con configuración de seis posiciones identificadas. Registrar el entorno utilizado, sin atribuir pruebas físicas.

## 4. Etapa 1 - Contrato y validación

Implementar 02_Contrato_de_Datos_y_Modelo.md. Separar el payload transportado del registro normalizado en la aplicación.

Preparar pruebas de campos ausentes, versiones desconocidas, null, cero, canales duplicados y valores fuera de rango. El validador debe devolver motivo y contexto; no corregir silenciosamente la entrada.

Cierre: aceptar fixtures válidos y rechazar o identificar los inválidos conforme a las reglas establecidas.

## 5. Etapa 2 - Simulador determinista

Implementar una fuente reemplazable con semilla o secuencia fija. Debe generar los seis canales, referencias temporales por lectura, capturas y secuencias.

Producir modos de prueba: registro normal, lectura fallida, desconexión, salto de secuencia, duplicado, contenido contradictorio y reinicio de captura.

La tasa simulada será configurable y quedará registrada como parámetro del generador. No la presentar como frecuencia alcanzada por el ESP32.

Cierre: la misma configuración genera resultados reproducibles y toda sesión queda identificada como simulada.

## 6. Etapa 3 - Persistencia básica

Implementar una primera migración SQLite, habilitar claves foráneas y documentar restricciones. Preparar el repositorio de sesiones y una cola de escritura.

Guardar un registro y sus muestras en una misma transacción. La recepción de datos no espera a cada actualización visual. Definir lotes pequeños y medir su comportamiento antes de aumentar volumen.

Cierre: guardar una sesión simulada, cerrar la aplicación, abrirla y recuperar iguales registros, muestras, contexto y eventos.

## 7. Etapa 4 - Coordinación de sesiones

Definir una máquina de estados. Propuesta inicial:

- prepared: sesión preparada con perfil y contexto.
- recording: captura activa y recepción habilitada.
- interrupted: adquisición interrumpida, con eventos conservados.
- finalizing: cierre solicitado y escritura pendiente.
- completed: cierre y persistencia confirmados.
- incomplete: registro recuperable cuyo cierre o adquisición quedó incompleto.

Los errores de almacenamiento, conexión y sincronización se conservan por separado. No expresar todo mediante un único booleano connected.

Flujo de inicio: elegir fuente/configuración -> crear sesión -> solicitar captura -> comprobar estado -> asociar captura -> aceptar registros.

Flujo de cierre: solicitar detención -> comprobar respuesta o documentar falta de respuesta -> definir límite de aceptación de datos tardíos -> vaciar escritura pendiente -> confirmar estado -> mostrar resumen.

Repetir el botón de finalizar no debe duplicar resultados ni crear otra sesión. Al reiniciar la aplicación, reconocer sesiones abiertas y conservarlas como incompletas hasta resolver su estado; no borrarlas.

La duración mostrada debe distinguirse del tiempo de cada captura. Si se usa un reloj monotónico del teléfono durante el registro, conservar la duración resultante; no reconstruirla suponiendo que dos relojes diferentes estén alineados.

Cierre: completar el recorrido normal y recuperar un registro interrumpido de manera explicable.

## 8. Etapa 5 - Pantallas mínimas

1. Inicio: fuente, conexión, última sesión y acceso a registro e historial.
2. Preparación: actividad, contexto, dispositivo y seis posiciones reconocidas.
3. Registro: sesión activa, duración, valores por posición, gráfico y finalización.
4. Detalle: duración, contexto, origen, eventos, datos e indicadores.
5. Historial: lista recuperada desde SQLite y selección de sesión.
6. Comparación: dos registros compatibles, unidad y restricciones.

WHOOP orienta el recorrido síntesis -> detalle -> historial -> evolución. No copiar índices Sleep, Recovery o Strain ni inventar un puntaje equivalente a partir de FSR.

Durante el registro: esquema de dos pies con tres puntos cada uno. No dibujar un mapa continuo interpolado. Si se usa intensidad de color, acompañarla con etiquetas y valores.

Valores anteriores a una desconexión deben marcarse como desactualizados. Los segmentos sin datos generan huecos. No conectar gráficamente puntos separados por una interrupción como si fueran una medición continua.

Cierre: completar las tareas previstas utilizando datos simulados, incluidos estados vacíos y de error. Los bocetos no cuentan como pantallas implementadas.

## 9. Etapa 6 - Métricas descriptivas por canal

Primera versión propuesta:

- sample_mean: suma de valores válidos dividida por n_valid.
- sample_max: máximo de valores válidos.
- sample_sd_population: raíz de la media de los cuadrados de las diferencias respecto de la media.
- n_received, n_valid y n_invalid: cantidades de lecturas recibidas y aceptadas.

Usar la misma unidad que la señal. Son estadísticas descriptivas de muestras disponibles, no fuerza ni presión. La media muestral no es automáticamente un promedio ponderado por tiempo cuando los intervalos son irregulares.

Cada resultado debe conservar canal, captura o segmento, unidad, versión del algoritmo y cantidad de datos. Cero muestras válidas produce un resultado no disponible, no un valor numérico cero.

Para la primera implementación limitar cada ventana a una captura. Si después se combinan capturas, definir antes cómo se representan reinicios y huecos en el tiempo de sesión.

La proporción de lecturas válidas sobre lecturas recibidas no mide por sí sola continuidad frente a muestras que nunca llegaron.

Cierre: resultados iguales a fixtures calculados independientemente, con tratamiento correcto de cero, null y ventanas vacías.

## 10. Etapa 7 - Historial y comparación básica

Recuperar las sesiones realmente almacenadas, incluyendo origen, actividad, fecha, configuración y calidad. No reconstruir el historial desde un arreglo temporal de la pantalla.

Primera política: comparar el mismo canal bajo configuración, unidades, origen y procedimiento compatibles; señalar diferencias de actividad y contexto. Para señales físicas crudas, no mezclar unidades de sensor ni escalas ADC diferentes.

Mostrar diferencias numéricas de las señales y sus condiciones, sin etiquetas automáticas de mejor rendimiento. Las comparaciones bilaterales y proporciones de fuerza esperan calibraciones comparables y alineación temporal.

Dos sesiones simuladas pueden comprobar el funcionamiento de esta vista. La comparación experimental requiere sesiones físicas repetidas y condiciones documentadas.

Cierre: abrir dos sesiones recuperadas y justificar la comparación o explicar por qué se limita.

## 11. Etapa 8 - Fuente física mediante BLE

Seleccionar una biblioteca vigente compatible con las versiones fijadas. Preparar compilación nativa de desarrollo, permisos y teléfono de prueba.

Implementar descubrimiento, selección, configuración, notificaciones, control y reconstrucción si corresponde. Conservar el dominio y la persistencia usados por el simulador.

Cierre: los seis canales reales recorren adquisición, recepción, guardado, cierre y recuperación. Registrar mensajes generados/recibidos y discontinuidades.

## 12. Etapa 9 - Calibración y métricas físicas condicionadas

Incorporar conversiones únicamente después de registrar su evidencia independiente. Una calibración válida identifica sensor, circuito, montaje, rango y unidades.

Fuera de ese rango o sin calibración compatible, el resultado físico no está disponible. Se preserva el dato original. No convertir automáticamente lecturas a kilogramos, newtons o kilopascales por una etiqueta comercial.

Cierre: conversión comprobada para las condiciones evaluadas. Si no se alcanza, documentar el límite y conservar el funcionamiento con señales crudas.

## 13. Etapa 10 - Respaldo y actualización

Comprobar migraciones con registros existentes y restauración en una base separada. Preparar paquete Android para ejecución sin servidor de desarrollo y un README comprobado desde copia limpia.

Cierre: versión identificada, instalada y capaz de recuperar sesiones.

## 14. Etapa 11 - Complemento remoto

Implementar sólo después de cerrar la ejecución local: autenticación, políticas por titularidad, sincronización con confirmación y reintentos.

Conservar el perfil propietario original de cada sesión. No mostrar sincronización exitosa por un HTTP genérico. Comprobar la separación entre dos cuentas.

Cierre: una transferencia repetida no duplica datos y la caída de Internet no elimina acceso local.

## 15. Funciones posteriores

IA explicativa, más actividades, métricas avanzadas, iOS, web e integración con WHOOP se evalúan después. El asistente no calcula métricas desde señales crudas, no modifica resultados verificables y no forma parte del primer cierre funcional.

## 16. Registro al terminar cada incremento

Guardar: revisión de código, versiones, configuración, prueba ejecutada, datos usados, resultado, limitación y próxima tarea. Actualizar el estado de la función como propuesta, diseñada, implementada o validada para condiciones específicas.

