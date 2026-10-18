# ADR 0002 - Monorepo y flujo de trabajo

- Fecha: 2026-10-18
- Estado: aceptada

## Decisión

- Monorepo con npm workspaces: `apps/*` y `packages/*`, más `firmware/` fuera de los workspaces.
- El contrato de datos vive en `packages/contract` y lo consumen el simulador, la app y las pruebas.
- Rama `main` protegida; trabajo en ramas por etapa; Conventional Commits; un tag por etapa cerrada.
- GitHub Actions ejecuta verificación de tipos y pruebas en cada push y pull request.

## Consecuencias

La trazabilidad entre commits, etapas y evidencias permite documentar el desarrollo en la tesis (capítulos 4.6.3, 7 y anexo de repositorio).
