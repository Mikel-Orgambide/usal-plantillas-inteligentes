# Registro de incrementos

Una entrada por etapa cerrada, con nombre `etapa-NN-descripcion.md`. Campos: fecha, commit/tag, versiones, configuración, prueba ejecutada, datos usados (simulados o físicos), resultado observado, limitaciones y próxima tarea.

| Etapa | Estado | Tag |
|---|---|---|
| 0 - Preparación del entorno | cerrada 2026-10-18 | v0.0-etapa0 |
| 1 - Contrato y validación | cerrada 2026-10-18 | v0.1-etapa1 |
| 2 - Simulador determinista | cerrada 2026-10-18 | v0.2-etapa2 |
| 3 - Persistencia básica | cerrada 2026-10-18 | v0.3-etapa3 |
| 4 - Coordinación de sesiones | cerrada 2026-10-18 | v0.4-etapa4 |
| 5 - Pantallas mínimas | cerrada 2026-10-18 | v0.5-etapa5 |
| 6 - Métricas descriptivas | cerrada 2026-10-18 | v0.6-etapa6 |
| 7 - Historial y comparación | cerrada 2026-10-18 | v0.7-etapa7 |
| 8 - Fuente física BLE | cerrada 2026-10-20 (H0, H1, H5, H6; faltan H2–H4 con sensores) | v0.8-etapa8 |
| 9 - Fuente física: banco FSR (H2–H4, módulo unilateral de 3 canales) | en curso desde 2026-11-03: banco ensayado, software de 3 canales validado por USB y BLE, dos sesiones físicas (apoyo con el pie); falta H3 por sensor | - |
| 10 - Respaldo y paquete | cerrada 2026-10-20 | v0.10-etapa10 |
| 11 - Complemento remoto | cerrada 2026-10-27 (correo y contraseña; Google como evolución futura) | v0.11-etapa11 |
| 12 - Informe para revisión profesional (PDF) y marca .NSL | implementada 2026-11-03 (ADR 0009 y 0010); validada en la build preview 0.12.0 el 3/11 (ícono, marca, PDF compartido) | v0.12-etapa12 |
| 13 - Sesión bilateral con dos módulos (ADR 0011) | implementada 2026-11-04 con dos fuentes simuladas (coordinador, BLE doble, métricas `bilateral-1.0`, pantallas, informe); esquema remoto con todas las configuraciones (migración 0003, probada en PostgreSQL local); validada con dos placas el 11/11 en su recorrido básico (`9befa503`, corte `2523ea01`; ver `etapa-13-bilateral.md`); pendiente la sesión de ≥ 120 s, la comparación y la sincronización bilateral | v0.13-etapa13 |
| 14 - Asistente explicativo (LLM, ADR 0012) | implementado 2026-11-04 en dos modos: nube gestionada (Edge Function `assistant`, clave en el backend, OpenRouter · `qwen/qwen3-14b`, límite por hora) y servidor propio (LM Studio); chat flotante, Ajustes → Asistente, registro local de intercambios. Pendiente: desplegar la función y validar en ambos modos | - |
| 15 - Rutinas y entrenamiento (ADR 0013) | implementada 2026-11-04: rutinas con ejercicios (fuerza, caminata/carrera, otro), entrenamientos con series declaradas, vínculo sesión↔ejercicio, tarjeta en Hoy, fila en Historial, chip en Detalle, sección en el PDF y carga asistida por el chat con confirmación; esquema remoto preparado (migración 0005), transferencia pendiente. Validación en el teléfono con la build 0.15.0 pendiente | - |

Mejoras menores (0.13.1, 2026-11-04): modo de números grandes en Grabación y exportación de sesión a CSV, implementadas; pendientes de verificar en el teléfono con la próxima build.
