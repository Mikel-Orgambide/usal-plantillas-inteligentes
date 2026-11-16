# 08 — Material para la declaración de uso de inteligencia artificial

- Requisito (Clase 5): declarar el uso de IA en la metodología; el autor es responsable; verificar datos; **guardar los prompts** (apéndice o carpeta de Drive); no copiar sin leer; el plagio a partir de un LLM es plagio. Clase 13: la declaración de uso de IA va en los preliminares.
- Coherencia: amplía la declaración de la Entrega 5 (preliminares y 2.14), que preveía «documentar el uso en programación, pruebas y procesamiento cuando ocurra», y la síntesis del uso de Codex del 13/10 para documentación ([`06_Sintesis_Continuidad_y_Uso_IA.md`](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes/blob/entrega-final/docs/especificacion/06_Sintesis_Continuidad_y_Uso_IA.md), en la etiqueta `entrega-final`). Se mantiene la distinción que ya hacía la E5: **IA como asistencia al desarrollo** vs. **IA integrada en la plataforma**.

## 1. Herramientas usadas como asistencia (desarrollo y documentación)

| Herramienta | Período | Para qué se usó | Qué produjo | Qué hizo el autor |
|---|---|---|---|---|
| **ChatGPT** (OpenAI) | Septiembre–octubre 2026 (inicio) | Guía inicial: ideas de componentes, primer listado de compra («Antecedente septiembre 2026» en Drive), organización de la documentación, borradores | Listas y borradores de partida | Seleccionó, descartó (p. ej. 8 FSR, MPU6050, ADS1115) y reescribió |
| **Gemini** (Google) | Documentación inicial | Declarado en la Entrega 5 para organización y revisión de redacción | Borradores de documentación | **Confirmar por Mikel** si corresponde mantenerlo |
| **Codex** (OpenAI) | 13/10/2026 | Consulta de documentación conectada y fuentes primarias, revisión de estructura de la tesis, correspondencia de citas, correcciones de formato, síntesis y guías de implementación (`docs/especificacion/00…07`) | Documentos de especificación y guías | Revisó; las guías orientaron la implementación posterior |
| **Claude** (Anthropic, app y proyecto de claude.ai) | Septiembre–noviembre 2026 | Investigación bibliográfica (base de 50 referencias con estado de lectura TC/R/DT), revisión de capítulos contra consignas, análisis de alcance y riesgos, redacción asistida de borradores, material para la tesis (`docs/tesis/`) | Fichas bibliográficas, borradores, análisis | Verificó referencias (DOI, acceso), decidió alcance, redactó la versión final |
| **Claude Code** (Anthropic) | 18/10–5/11/2026 | Programación asistida de todo el monorepo (firmware, contrato, paquetes, app, migraciones, función), pruebas automáticas, documentación técnica (ADR, incrementos), análisis de logs y sesiones | Código, pruebas (199), ADR 0001–0013, bitácora de etapas | Definió requisitos y decisiones (ADR), armó el hardware, ejecutó todas las pruebas físicas, probó cada build en el teléfono, reportó fallas y validó correcciones |
| **Claude Design** (Anthropic) | Octubre–noviembre 2026 | Exploración de la interfaz y de la marca .NSL | Propuestas visuales (brief en el doc del proyecto `diseno/brief-interfaz.md`) | Eligió la dirección visual; se implementó en la app (ADR 0005, 0009) |

Instrucciones persistentes para los asistentes de código: `CLAUDE.md` (raíz) y `apps/mobile/AGENTS.md` (retiradas de la rama principal el 16/11/2026; visibles en la etiqueta `entrega-final`) fijaron reglas del dominio (cuentas ADC, `read_error` nunca cero, procedencia, ADR 0011), de modo que la asistencia respete el contrato.

## 2. IA integrada en la plataforma (funcionalidad del producto)

| Elemento | Detalle |
|---|---|
| Función | Asistente explicativo (ADR 0012): explica indicadores precalculados de sesiones, comparaciones y entrenamiento declarado; carga asistida de series con confirmación |
| Modelo | **Qwen3 14B** (modelo abierto, Alibaba/Qwen Team) |
| Modo nube gestionada | App → función `assistant` de Supabase → **OpenRouter** (`qwen/qwen3-14b`); clave sólo como secreto de la función; límite 30 consultas/h; registro de metadatos en `assistant_usage` |
| Modo servidor propio | App → **LM Studio** 0.4.28 en la PC local (Qwen3 14B Q4_K_M) |
| Barreras | Contexto armado en el teléfono (no hay acceso libre a la base); ficha de conocimiento; filtro clínico por patrones con respuesta fija sin consultar al modelo; `/no_think`, temperatura 0,4, `max_tokens` 600; marca «Generado por IA · revisar»; registro local `assistant_exchange` |
| Qué NO hace | No entrena ni ajusta modelos; no diagnostica; no decide la validez de las mediciones; no consulta la base con herramientas |

## 3. Cómo se verificó lo producido con IA

| Producto | Verificación |
|---|---|
| Código | 201 pruebas automáticas deterministas en verde; `typecheck`; revisión de diffs; pruebas en el teléfono físico por versión (0.11 → 0.15.3) |
| Firmware | Ejecución en la placa real; logs USB/BLE con conteo de secuencia y período (`test-data/firmware/`, `test-data/fisico/logs-serie/`) |
| Seguridad remota | `remote-check.mjs` 10/10 contra Supabase; RLS en PostgreSQL local |
| Afirmaciones técnicas en documentos | Contraste con código y registros; convención [H]/[S]/[D]/[F]; ninguna magnitud física atribuida sin evidencia |
| Bibliografía | Cada ficha con estado de acceso (TC texto completo, R resumen, DT documentación técnica); DOI verificados; discrepancias conservadas (p. ej. Caloggero 91,2/91,8 %); «candidatas» no citadas sin verificar |
| Asistente integrado | Batería de preguntas por nivel en ambos modos (`04` §2.4); revisión de que las preguntas clínicas no llegan al modelo (logs de LM Studio) |
| Errores detectados en código asistido (ejemplos para la declaración) | Temporizador en núcleo 0 (12 reg/s), redibujo saturado, grants faltantes en Supabase, orden de hooks que cerraba la app: todos detectados por el autor en pruebas reales y corregidos |

## 4. Responsabilidad del autor (puntos para la declaración)

- Definió el problema, la visión, el alcance (incluidas las decisiones de recorte del 3/11 y 5/11) y aprobó cada ADR.
- Compró, armó y cableó el hardware; eligió resistencias por ensayo; ejecutó todas las pruebas físicas.
- Probó cada build en el teléfono, reportó fallas y validó las correcciones.
- Revisó y reescribe con voz propia todo texto incorporado a la tesis; las afirmaciones académicas se sostienen en fuentes externas citadas, no en la herramienta.
- Asume la responsabilidad por el contenido, las decisiones y las conclusiones.

## 5. Prompts y registros a conservar (apéndice o carpeta de Drive)

- Conversaciones de claude.ai del proyecto «Proyecto Final Tesis – Plantillas Inteligentes» (exportar o enlazar las principales por capítulo).
- Sesiones de Claude Code: resumen por etapa ya reflejado en `docs/incrementos/etapa-*.md` y en los mensajes de commit (82 commits al 5/11; co-autoría declarada en los commits).
- Prompt de sistema del asistente integrado: `packages/assistant/src/prompt.ts` (copia en `supabase/functions/assistant/index.ts`) → apéndice E.
- Síntesis del uso de Codex del 13/10: `docs/especificacion/06_Sintesis_Continuidad_y_Uso_IA.md` (en la etiqueta `entrega-final`). Ejemplos de instrucciones a herramientas de diseño: `docs/diseno/prompts-claude-design.md` y `docs/diseno/marca/PROMPT-integracion-marca-NSL.md`.
- Indicar que es una **síntesis reconstruida**, no transcripción literal de todos los prompts (como ya anticipaba la E5).

## 6. Borrador de puntos para la declaración (para redactar)

1. Herramientas: ChatGPT, Codex, Claude, Claude Code, Claude Design (y Gemini si se confirma), con período y tarea.
2. Tareas asistidas: búsqueda y organización bibliográfica; borradores y revisión de redacción; programación, pruebas y documentación técnica; exploración de interfaz.
3. Comprobaciones: pruebas automáticas y físicas, contraste con fuentes, revisión del autor.
4. IA integrada: asistente explicativo con Qwen3 14B (dos modos), con barreras y sin diagnóstico.
5. Responsabilidad: el autor.
6. Registro: carpeta/apéndice con la síntesis de prompts.
