# Revisión general del proyecto y estado de desarrollo

Fecha de revisión: 13 de octubre de 2026.
Objeto: documento integrado de capítulos 1 a 4, bibliografía, referencias de contexto y consignas pertinentes.

## 1. Qué se revisó

Se consultaron la versión nativa de Entrega 4, su índice y estructura de tablas, figuras y estilos; la base bibliográfica; el README maestro; el documento histórico de arquitectura; el registro de compra; las clases 8 y 13; y el repositorio de Norman, incluyendo README, main.tex, usal-proyecto-final.cls y capitulos/04-marco-tecnologico.tex.

La revisión de referencias comprueba correspondencia entre citas y entradas bibliográficas, significado de las letras y soporte técnico de las incorporaciones del capítulo 4. No equivale a una nueva lectura completa de todos los artículos ya utilizados en capítulos anteriores.

La inspección del documento no acredita código operativo. No se inspeccionó un repositorio del producto ni se ejecutaron pruebas sobre sensores. Los programas auxiliares utilizados para revisar el documento no son la implementación del prototipo.

## 2. Coherencia general

El objetivo general y los objetivos específicos del capítulo 1 incluyen adquisición, comunicación, procesamiento, almacenamiento, visualización, sesiones y análisis temporal.

El capítulo 2 delimita el sensado local con tres sensores por pie y una evaluación estática inicial. La marcha controlada depende del montaje. La comparación entre sensores exige condiciones adicionales, y las conclusiones se restringen a la evidencia obtenida.

El capítulo 3 fundamenta cobertura, calibración, tiempos, métricas e historial. Distingue funcionamiento informático, validación física y uso específico. WHOOP constituye una referencia funcional para organización temporal.

El capítulo 4 conserva estas condiciones y propone un contrato, modelo relacional, ejecución local y complemento remoto. Se revisó la coherencia entre SQLite seleccionada en 4.3.5 y su presentación en 4.1.1. La síntesis no afirma que se haya demostrado aún la factibilidad técnica.

El texto de los capítulos 1 a 3 se mantuvo; se uniformó un signo en una nota de elaboración propia. Los cambios de estilo de tablas, índice y listas pueden modificar su paginación.

## 3. Correcciones aplicadas al documento

- Se incorporó 4.7 Síntesis del marco tecnológico.
- Se añadieron al final de 4.6.3 la previsión de integración continua y el seguimiento operativo.
- Se completó la bibliografía con Chacon y Straub (2014) y WHOOP (2025).
- Se amplió la base bibliográfica de apoyo con veinte fichas técnicas y funcionales del capítulo 4, indicando alcance de consulta y uso. Sus estados históricos quedan identificados como tales.
- En 4.3.3 se corrigió Database a Supabase s. f.-b y Edge functions a s. f.-d.
- Se reemplazó la atribución imprecisa del mecanismo de secretos por una referencia interna a los criterios de 4.6.1.
- Se retiraron los rótulos en negrita introducidos en párrafos de 4.5 y 4.6.1, conservando el contenido.
- Se uniformaron fuente y color del capítulo 4 y se normalizó el formato de la bibliografía.
- Se uniformó la presentación de las trece tablas, conservando su estructura nativa, y se fijó su primera fila como encabezado.
- Se uniformó el fondo de sus encabezados, se igualó el título de 4.7 con los apartados pares y se retiró una viñeta vacía al final de la bibliografía.
- Se escribieron las entradas de tablas 9 a 13 y figura 9 en sus listas, sin inventar marcadores o enlaces.

La comprobación posterior confirmó las modificaciones de contenido, las trece tablas nativas con encabezado repetido, las seis entradas nuevas y la ausencia de enlaces y rótulos en negrita dentro de los párrafos del capítulo 4. La exportación de trabajo revisada contenía 149 páginas; se inspeccionaron veinte páginas pertinentes de listas, arquitectura, tablas, cierre y bibliografía. Esta muestra visual no equivale a revisar manualmente cada página de los capítulos anteriores. El índice desactualizado de aquella revisión ya fue actualizado posteriormente por el usuario.

La bibliografía académica contiene 56 entradas no vacías. Se conservaron las trece tablas y los objetos visuales; la lectura posterior comprobó el fondo común y el retiro de la viñeta vacía. La inspección final confirmó el título completo de la lista de figuras y la síntesis con el formato de sus apartados pares.

## 4. Índice y marcadores

El índice automático leído inicialmente terminaba en 4.6.2 aunque 4.6.3 ya estaba en el cuerpo. El usuario informó después su actualización; la lectura de cierre confirmó 4.6.3 y 4.7 en el índice y enlaces en las seis entradas nuevas.

No escribir números de página supuestos. Los marcadores de tablas 9–13 y figura 9 ya no son pendientes. Sus títulos se conservan en 07_Referencias_Marcadores_y_Decisiones.md como registro.

## 5. Diferencia entre formato de trabajo y template final

La versión de Google Docs utiliza A4, Times New Roman 12, márgenes de 2,54 cm y cuerpo con interlineado 1,5. Las tablas y el índice tienen ajustes propios.

La plantilla maestra antigua menciona Carta y Times New Roman 12. El repo de Norman define actualmente A4, cuerpo base de 11 puntos con Palatino y márgenes diferenciados para doble faz. Esas pautas no son equivalentes. Por instrucción actual del usuario, el repo completo es la referencia formal principal.

Se mantuvo la continuidad de Google Docs durante esta revisión. No se realizó una migración a LaTeX ni se declara que su geometría reproduzca el template final. El usuario decidió reservar la paginación definitiva para esa integración, incluidas tablas, figuras, referencias, preliminares y numeración. No continuar ajustando páginas del documento de trabajo como si fueran las finales.

## 6. Pendientes académicos concretos

| Punto | Situación verificable | Evidencia que falta |
|---|---|---|
| Arquitectura | Diagrama lógico y responsabilidades redactados | Circuito y montaje efectivos, cuando existan |
| Prototipo | Compra confirmada; funciones diseñadas | Código operativo, capturas, demostración integrada |
| Stack | Tecnologías justificadas | Versiones instaladas y biblioteca BLE seleccionada |
| Datos | Entidades, relaciones y contrato definidos | Esquema implementado y pruebas de integridad |
| UX | Recorridos y pantallas descritos | Bocetos gráficos y pruebas con usuarios |
| Seguridad | Medidas y pruebas previstas | Configuración aplicada y resultados |
| Calidad | Plan de pruebas redactado | Ejecuciones, criterios cuantitativos y resultados |
| Despliegue | Procedimiento propuesto | README comprobado, paquete y repositorio accesible |
| Operación | Seguimiento e integración continua previstos | Registros y automatización efectivamente ejecutados |

Estos puntos corresponden al desarrollo y a la evidencia pedida en el template. No se pueden completar con resultados hipotéticos. La redacción conceptual no permite declarar cerrado el requisito de prototipo construido.

## 7. Preliminares y cierre del documento completo

La versión inspeccionada tiene un apartado titulado Abstract cuyo contenido está en español. Para la integración final deberá distinguirse Resumen de Abstract en inglés, con palabras clave en ambos idiomas. En 06 se ofrece una propuesta breve para copiar y revisar.

Quedan por completar o verificar conforme al repo: declaración de originalidad, datos institucionales vigentes de portada, agradecimientos si corresponden, glosario, siglas y símbolos, apéndices, anexo de repositorios y acceso para la cátedra. No redactar declaraciones firmadas ni inventar autoridades o datos personales.

El usuario conserva por ahora los datos propios como relevamiento personal para organizar el avance. Su ajuste institucional y presentación se retoman en la integración final; no bloquean el inicio del capítulo 5.

La declaración de IA presente en preliminares y 2.14 debe mantener coherencia con las herramientas realmente utilizadas. El registro de este paquete explica la asistencia en revisión documental y preparación de guías; no atribuye implementación del producto.

## 8. Documentos históricos con definiciones desactualizadas

El documento Arquitectura de software y recursos tecnológicos, de septiembre, describe cuatro FSR por pie, incluye MPU6050 y enumera comunicación y persistencia como capas adicionales. También presenta Gemini como alternativa inicial.

Estas condiciones no reemplazan las decisiones vigentes: seis sensores activos, cuatro capas globales, ADC adicional e IMU no confirmados en la compra, e IA opcional con proveedor por evaluar. Se conserva ese documento como antecedente. Para programar, utilizar este paquete y la tesis actual.

El registro de compra aún pide confirmar la cantidad de FSR406; el usuario confirmó después dos unidades para los talones. Se adopta esa confirmación. No se deduce la cantidad total de FSR402 de la cantidad de sensores activos.

## 9. Estado real y prioridad inmediata

Comprado: materiales para primeras pruebas de adquisición.
Diseñado: arquitectura, funciones, contrato, modelo lógico, recorridos, seguridad y evaluación.
Pendiente de documentar: recepción, identificación, código operativo, montaje y ensayos.

Prioridad de software: una sesión simulada completa y recuperable, con métricas descriptivas por canal e historial básico.
Prioridad de hardware: identificar placa y terminales; programar ESP32; comprobar un sensor por USB; extender a seis; integrar BLE.

No incorporar primero asistente de IA, servicios complejos, iOS, running o métricas biomecánicas que excedan las comprobaciones disponibles.

