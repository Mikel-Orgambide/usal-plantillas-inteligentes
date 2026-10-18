# Bases para desarrollar la plataforma de plantillas inteligentes

Proyecto Final de Ingeniería en Informática - Mikel Orgambide Rueda.
Fecha: 13 de octubre de 2026.
Estado: documentación de diseño y preparación. Este paquete no acredita implementación ni pruebas físicas.

Actualización de cierre: índice y navegación de Entrega 4 ya actualizados por el usuario y confirmados en lectura posterior. La paginación definitiva se revisará al integrar el documento en LaTeX. Para continuar la redacción, leer Capitulo_4_Resumen_Continuidad_y_Uso_IA.md, Capitulo_5_Guia_Inicio_Nuevo_Chat.md y Metodo_Desarrollo_Capitulos_y_Formato_Respuestas.md, disponibles en la carpeta de contexto y en el paquete de cierre. Las guías de este directorio se mantienen para el desarrollo del código.

## Referencia formal principal

Por instrucción del usuario, todas las consultas sobre estructura, formato y entregables deben contrastarse con el [template completo de Norman](https://github.com/Noorman999/usal-proyecto-final-template).

Consultar los archivos relevantes del repositorio, no únicamente su README. Para el capítulo 4: capitulos/04-marco-tecnologico.tex. Para formato e integración: main.tex, usal-proyecto-final.cls y los preliminares correspondientes. El template es una referencia académica, no una fuente de validación biomecánica ni una selección obligatoria del stack del producto.

Las instrucciones actuales del usuario y del proyecto prevalecen sobre documentos históricos. No migrar automáticamente la tesis desde Google Docs a LaTeX ni atribuir requisitos a archivos no consultados. La versión de Google Docs revisada conserva su estilo de trabajo; el ajuste al formato final del repositorio queda identificado en la auditoría.

## Orden de lectura

1. 01_Revision_General_y_Estado.md: objetivo, alcance, auditoría y pendientes reales.
2. 02_Contrato_de_Datos_y_Modelo.md: reglas compartidas entre simulador, dispositivo, aplicación y almacenamiento.
3. 03_Implementacion_Aplicacion_Paso_a_Paso.md: módulos, pantallas, estados y etapas con condiciones de cierre.
4. 04_Hardware_y_Firmware_Paso_a_Paso.md: compra confirmada, identificación, adquisición, USB, BLE y montaje.
5. 05_Pruebas_y_Criterios_de_Cierre.md: casos, resultados esperados y evidencia que debe conservarse.
6. 06_Sintesis_Continuidad_y_Uso_IA.md: síntesis del capítulo, resumen del proyecto y contexto para otro chat.
7. 07_Referencias_Marcadores_y_Decisiones.md: citas, títulos de tablas y figuras, decisiones pendientes y fuentes.

## Documentos de origen

- [Tesis integrada hasta el capítulo 4](https://docs.google.com/document/d/1am2vT2imrb3VeaoWKgtkc-IAxRV0WGrezEWYVixNuvU).
- [Base bibliográfica](https://docs.google.com/document/d/1m5sqbWb2DttDbbTtYkx_17WiwhMqY5z0f1r0ivJ9MXA).
- [Carpeta de contexto](https://drive.google.com/drive/folders/1h02ZrPCyBT_9qkEM-szycjmIMuE13QPG).
- [Registro de compra](https://drive.google.com/file/d/1Wnt4bxFXdVNmiyYx_RX5EXKYzvIM9RH9/view).
- [Clase 8](https://drive.google.com/file/d/1Z_pckDw9QSIUamptizz1Cu6aDLA_mklN/view).
- [Clase 13](https://drive.google.com/file/d/1PC94-EkJxd01LZufBeMWQZuVkfO3snFq/view).

## Qué hacer al comenzar a programar

Primero inspeccionar el repositorio de implementación que realmente exista y registrar su estado, versiones y cambios del usuario. Estas guías proponen nombres de módulos y una estructura; no indican que ya existan.

Implementar una etapa, comprobar su condición de cierre y documentar el resultado antes de avanzar. El primer incremento debe producir una sesión simulada que pueda guardarse, recuperarse y visualizarse. La compra o identificación pendiente del hardware no bloquea ese trabajo.

Cuando una decisión técnica nueva complete estas bases, registrarla con fecha, motivo, alternativa y evidencia. Actualizar la versión del contrato o de configuración cuando cambie su significado. No presentar una decisión propuesta en esta guía como una decisión ya implementada.

## Núcleo comprometido

Seis canales -> adquisición -> comunicación -> aplicación -> procesamiento -> persistencia -> sesiones -> métricas justificadas -> historial -> comparación básica compatible.

El servidor remoto y el asistente de IA son ampliaciones de la ejecución local. El historial y la comparación básica forman parte del núcleo previsto. No convertirlos silenciosamente en trabajo futuro.

## Límites que debe respetar todo el código

- Dos FSR406 en talones y cuatro FSR402 en antepié: seis sensores activos.
- Datos originales con unidades explícitas; inicialmente adc_count.
- Ausencia o error no equivalen a cero.
- Simulación siempre identificada y separada de medición física.
- Tres posiciones por pie no constituyen una imagen continua de presión ni fuerza total.
- Fuerza local sólo mediante calibración individual comprobada; presión requiere además área de contacto justificada.
- Sin diagnóstico, detección directa de fatiga ni clasificación automática de mejora deportiva.
- Cuatro capas globales; BLE es comunicación entre componentes.
- Los tiempos de adquisición y recepción son referencias distintas.
- No inventar versiones instaladas, frecuencias efectivas, autonomía, resultados ni cantidades de repuestos.

## Primer encargo sugerido para un chat de programación

> Revisá este paquete y el repositorio existente. Contrastá las consultas académicas con el template completo de Norman. Comenzá por la etapa 0 y el contrato lógico: estructura modular, configuración de seis canales y validación en ejecución. Después implementá el simulador determinista y una sesión local guardable y recuperable. Conservá el origen simulado y las unidades originales. Informá qué se implementó y qué se comprobó; mantené pendientes el pinout, la frecuencia física y BLE hasta identificar el hardware y verificar la integración. No agregues IA ni servicios remotos antes de cerrar el recorrido local.

