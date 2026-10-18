# ADR 0003 - Servicios en la nube y distribución

- Fecha: 2026-10-18
- Estado: aceptada (Supabase: propuesta hasta crear el proyecto)

## Contexto

La demostración ante la cátedra no debe depender de la computadora del autor. La aplicación debe instalarse y funcionar en un teléfono de manera autónoma, y los datos deben poder consultarse a distancia.

## Decisión

- **EAS Build** para generar el APK en la nube y distribuirlo mediante un enlace interno (sin Play Store). Los builds locales quedan para iteración rápida.
- **Supabase** (PostgreSQL, Auth, RLS) como servicio remoto, región São Paulo, plan gratuito al inicio.
- La ejecución local (SQLite) se mantiene como fuente primaria: la app registra y consulta sesiones sin conexión; Supabase sincroniza.
- Posible panel web de historial en una etapa posterior (a evaluar).

## Consecuencias

Ningún secreto se commitea; se usan variables `EXPO_PUBLIC_*` (solo claves públicas) y secretos de EAS/GitHub para lo restante.
