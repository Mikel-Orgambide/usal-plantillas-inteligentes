# Documentación técnica

Índice para quien evalúa el prototipo. Las rutas son relativas a esta carpeta.

## Empezar por acá

| Documento | Qué responde |
|---|---|
| [`tesis/10_Cierre_del_prototipo.md`](tesis/10_Cierre_del_prototipo.md) | Qué hace el sistema, qué quedó demostrado con hardware y qué no |
| [`guia-arranque-y-pruebas.md`](guia-arranque-y-pruebas.md) | Cómo arrancar la app, cargar el firmware y ejecutar las pruebas automáticas y manuales |
| [`tesis/04_Evidencia_y_pruebas.md`](tesis/04_Evidencia_y_pruebas.md) | Pruebas por paquete, evidencia de hardware con sus números y protocolos con criterios de aceptación |
| [`tesis/06_Defensa.md`](tesis/06_Defensa.md) | Recorrido reproducible de la demostración, datos a cargar y plan de respaldo |

## Qué se construyó

| Carpeta o documento | Contenido |
|---|---|
| [`tesis/`](tesis/00_LEEME.md) | Especificación final con requisitos y estado, arquitectura y código, funcionalidades por pantalla, glosario, uso de IA, deudas y limitaciones |
| [`especificacion/`](especificacion/00_LEEME.md) | Bases de desarrollo: contrato de datos, etapas de la aplicación, hardware y firmware, criterios de prueba, alcance final |
| [`decisiones/`](decisiones/) | Decisiones de arquitectura (ADR 0001–0013). Estados: propuesta, aceptada, reemplazada |
| [`incrementos/`](incrementos/README.md) | Una entrada por etapa: versión, pruebas, datos usados, resultado y limitaciones |
| [`plantillas-inteligentes-diseno/`](plantillas-inteligentes-diseno/README.md) | Diseño de la interfaz: brief, pantallas y sistema de diseño (tokens, componentes, fuentes) |
| [`diseno/marca/`](diseno/marca/README.md) | Marca .NSL: reglas de uso, logos e íconos |
| [`capturas/`](capturas/) | Capturas de la aplicación por versión (0.11.0, 0.12.0-fsr, 0.15.3) |

Los datos de prueba, con su origen declarado, están en [`../test-data`](../test-data/).

## Uso de inteligencia artificial

La declaración está en [`tesis/08_Uso_de_IA.md`](tesis/08_Uso_de_IA.md). Como ejemplos de las instrucciones dadas a las herramientas de diseño se conservan [`diseno/prompts-claude-design.md`](diseno/prompts-claude-design.md) y [`diseno/marca/PROMPT-integracion-marca-NSL.md`](diseno/marca/PROMPT-integracion-marca-NSL.md).

## Versión evaluada en la tesis

El PDF remite a la etiqueta `entrega-final` (commit `1169f82`). Allí están, tal como se citan, [`docs/tesis/08_Uso_de_IA.md`](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes/blob/entrega-final/docs/tesis/08_Uso_de_IA.md), [`docs/diseno/prompts-claude-design.md`](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes/blob/entrega-final/docs/diseno/prompts-claude-design.md), [`docs/diseno/marca/PROMPT-integracion-marca-NSL.md`](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes/blob/entrega-final/docs/diseno/marca/PROMPT-integracion-marca-NSL.md) y [`docs/tesis/04_Evidencia_y_pruebas.md`](https://github.com/Mikel-Orgambide/usal-plantillas-inteligentes/blob/entrega-final/docs/tesis/04_Evidencia_y_pruebas.md). También quedan en la etiqueta los documentos de planificación y las instrucciones internas de trabajo retirados de la rama principal el 16/11/2026.
