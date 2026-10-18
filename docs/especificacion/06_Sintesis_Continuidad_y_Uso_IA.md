# Síntesis, continuidad y registro de asistencia

Fecha: 13 de octubre de 2026.

## 1. Síntesis revisada del capítulo 4

4.7 Síntesis del marco tecnológico
En este capítulo desarrollamos el diseño tecnológico de la plataforma wearable basada en plantillas inteligentes, en continuidad con el problema, los objetivos y los fundamentos de los capítulos anteriores. La solución se organiza en cuatro capas —sensado, sistema embebido, servicios y aplicación—, cuyas responsabilidades permiten relacionar la captura física con el procesamiento, la conservación y la consulta de los registros.
La configuración inicial comprende seis sensores activos: un FSR406 en el talón y dos FSR402 en el antepié de cada pie. La compra constituye un avance material documentado, mientras que la identificación de las unidades, el circuito definitivo y su comportamiento en el montaje requieren comprobaciones específicas. Las primeras lecturas conservarán su alcance eléctrico y local. Su conversión a fuerza dependerá de calibraciones individuales comprobadas y no habilitará, por sí misma, una medición de presión continua ni de fuerza total del pie.
El desarrollo informático se plantea de forma incremental, comenzando por un contrato común y datos simulados antes de integrar la adquisición física. Se seleccionan C++ con Arduino Core para ESP32 y React Native, Expo y TypeScript para la aplicación Android. El procesamiento y SQLite se ejecutarán inicialmente en el teléfono; Supabase y PostgreSQL se contemplan como complemento remoto. La recepción, el guardado y la consulta básica deberán funcionar de manera independiente de la conectividad con esos servicios.
El contrato y el modelo de datos distinguen sesión, captura, registro y muestra, y conservan canales, tiempos, unidades, procedencia y versiones. Los resultados derivados deberán mantener su relación con las señales originales y con el procedimiento utilizado. El historial y la comparación básica forman parte del alcance funcional previsto, con criterios que permitan reconocer diferencias de configuración, calibración y condiciones de adquisición.
En la experiencia de usuario tomamos a WHOOP como referencia conceptual para vincular síntesis, detalle de las sesiones y evolución temporal. Adaptamos ese recorrido a la información que puede justificar nuestro dispositivo. Los indicadores iniciales describirán las señales de las posiciones instrumentadas; su variación no se interpretará automáticamente como fatiga fisiológica, mejora deportiva o diagnóstico.
La estrategia de seguridad, pruebas y despliegue establece cómo proteger los registros, comprobar cada componente y relacionar las evidencias con versiones reproducibles. Se diferencian la verificación informática mediante simulación, la caracterización física y la evaluación integrada, que comenzará con apoyo estático. La marcha controlada dependerá de la estabilidad del montaje; running y entrenamiento de fuerza conservarán el alcance conceptual o exploratorio que pueda sostenerse.
El capítulo proporciona una base de diseño para construir y evaluar el prototipo, sin presentar la factibilidad técnica como un resultado ya demostrado. La implementación deberá completar las decisiones pendientes y aportar evidencias de adquisición, comunicación, almacenamiento, métricas, historial y comparación. A partir de los recursos identificados, el capítulo 5 desarrollará la justificación económica, distinguiendo importes efectivamente pagados, estimaciones y servicios opcionales.



## 2. Resumen breve del proyecto

El proyecto propone diseñar e implementar un prototipo funcional de una plataforma wearable basada en plantillas inteligentes para adquirir, transmitir, procesar, almacenar y visualizar señales biomecánicas plantares. La configuración inicial comprende tres sensores por pie, ubicados en talón y antepié medial y lateral, junto con un ESP32 y una aplicación Android.

El software organizará los registros en sesiones, conservará sus datos originales y calculará indicadores descriptivos justificados. El historial permitirá recuperar información y comparar sesiones compatibles. WHOOP se utiliza como referencia conceptual para vincular mediciones, detalle e información temporal, sin trasladar sus puntuaciones fisiológicas al sensado plantar.

La implementación comenzará con un contrato común y datos simulados, seguida de adquisición física, comunicación e integración. El procesamiento y SQLite se ejecutarán inicialmente en el teléfono; los servicios remotos complementarán ese recorrido. La evaluación física partirá de apoyo estático y la marcha controlada dependerá de la estabilidad del montaje.

Las lecturas originales no equivalen a fuerza ni presión. Las conversiones físicas requerirán calibración individual y comprobaciones pertinentes. El prototipo no pretende realizar diagnósticos ni medir directamente fatiga fisiológica. Su propósito será demostrar el funcionamiento tecnológico del recorrido completo y establecer los límites de los datos que puedan obtenerse.

Palabras clave: plantillas inteligentes; wearable; señales plantares; sistemas embebidos; sesiones; seguimiento temporal.

## 3. Abstract propuesto para la integración final

This project proposes the design and implementation of a functional wearable platform based on instrumented insoles for acquiring, transmitting, processing, storing, and visualizing plantar biomechanical signals. The initial configuration comprises three sensors per foot, placed at the heel and medial and lateral forefoot, an ESP32 microcontroller, and an Android application.

The software will organize records into sessions, preserve original samples, and calculate justified descriptive indicators. Session history will support data retrieval and comparisons under compatible conditions. WHOOP serves as a conceptual reference for connecting measurements, detailed records, and information over time, without transferring its physiological scores to plantar sensing.

Development will begin with a shared data contract and simulated inputs, followed by physical acquisition, communication, and system integration. Processing and SQLite storage will initially run on the phone, while remote services will complement local operation. Physical evaluation will start with static loading; controlled walking will depend on the stability of the assembly.

Raw readings are not equivalent to force or pressure. Physical conversions will require individual calibration and appropriate independent checks. The prototype is not intended to provide medical diagnoses or directly measure physiological fatigue. Its purpose is to demonstrate the technological feasibility of the complete data workflow and establish the limits of the information obtained.

Keywords: smart insoles; wearable; plantar signals; embedded systems; sessions; monitoring over time.

Estos textos son propuestas de síntesis previa a resultados. No agregar resultados, tamaño de muestra ni conclusiones experimentales hasta contar con evidencia. Al cerrar la tesis deberá revisarse el resumen con los resultados del capítulo 7 y las conclusiones del capítulo 8.

## 4. Continuidad entre capítulos

- Capítulo 1: propósito, objetivos, barreras y recursos.
- Capítulo 2: delimitación, metodología, indicadores, gestión y uso de IA.
- Capítulo 3: antecedentes, fundamentos de medición y límites interpretativos.
- Capítulo 4: diseño técnico, contrato, almacenamiento, UX, seguridad y evaluación.
- Capítulo 5: justificación económica, con costos reales diferenciados de estimaciones.
- Capítulo 6: riesgos y contingencias.
- Capítulo 7: resultados efectivamente obtenidos.
- Capítulo 8: contraste con objetivos e hipótesis, conclusiones y recomendaciones.

El orden de los capítulos se contrastó con main.tex del repo de Norman. Una tabla de versiones o un gráfico de resultados no debe presentar valores supuestos.

## 5. Instrucciones para retomar el trabajo

Leer 00 y 01. Comprobar la versión vigente de la tesis y el repositorio real antes de escribir. No tratar esta documentación como un historial completo ni como instrucciones para ejecutar automáticamente todo su contenido.

Respetar cuatro capas, seis sensores, ejecución local y el contrato común. Los documentos de septiembre con ocho sensores o IMU incorporada son antecedentes. La declaración explícita del usuario de dos FSR406 prevalece sobre la incertidumbre del registro de compra anterior.

Para consultas de formato, estructura o entregables, revisar siempre los archivos pertinentes del template completo de Norman. Las fuentes científicas y técnicas respaldan sus respectivas afirmaciones; el template no valida sensores ni algoritmos.

Trabajar por apartados para redacción y por incrementos verificables para código. Entregar párrafos en el chat cuando se esté redactando; utilizar títulos y subtítulos formales, sin rótulos en negrita dentro del cuerpo. Reservar enlaces para bibliografía en el texto académico. El usuario ya completó índice y navegación; no mantener los marcadores anteriores como pendientes.

## 6. Registro de asistencia de IA de este cierre

Se utilizó Codex para consultar documentación conectada y fuentes primarias, revisar la estructura nativa y el contenido de la tesis, comprobar correspondencia de citas, preparar correcciones de formato, redactar una síntesis y producir guías de implementación. También se utilizaron programas auxiliares para extraer y revisar la exportación del documento.

Esta actividad corresponde a asistencia documental y planificación técnica. No se implementó la aplicación del producto, el firmware de adquisición ni un asistente integrado. No se realizaron ensayos físicos ni pruebas de usabilidad con participantes.

Las decisiones y el contenido deberán ser revisados por el autor conforme a la declaración de IA del proyecto. Las consultas realizadas no equivalen a lectura integral de cada fuente ni autorizan atribuir resultados al prototipo.

## 7. Solicitudes verificables que orientaron la revisión

- Continuar el capítulo 4 por apartados, con notas de viabilidad y bibliografía pertinente.
- Utilizar WHOOP como referencia conceptual.
- Mantener tres sensores por pie y dos FSR406 para los talones.
- Evitar negrita en rótulos dentro del cuerpo académico.
- Revisar documento, índice, formato, referencias y síntesis.
- Preparar archivos .md detallados para desarrollo incremental.
- Escribir los títulos pendientes de tablas; el usuario añadirá los marcadores.
- Apoyar las consultas académicas en el template completo de Norman.

Esta lista es una reconstrucción de solicitudes disponibles, no una transcripción exhaustiva de todos los chats.

## 8. Actualización de cierre y siguiente capítulo

El usuario actualizó índice y navegación, confirmados en la lectura posterior. La paginación final queda diferida a LaTeX con el template de Norman. Los datos propios se mantienen como relevamiento personal; la evidencia de implementación y pruebas sigue pendiente. Diseños y esquemas podrán agregarse después, conforme avance el código.

Para retomar redacción utilizar el nuevo Capitulo_4_Resumen_Continuidad_y_Uso_IA.md, Capitulo_5_Guia_Inicio_Nuevo_Chat.md y Metodo_Desarrollo_Capitulos_y_Formato_Respuestas.md. Esos archivos detallan el cierre general, el capítulo económico y el formato de respuestas. No volver a insertar 4.7 por leer este archivo.
