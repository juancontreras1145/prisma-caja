# Fix fecha local v3.5

Esta version corrige el calculo de "hoy" para que use la fecha local del telefono en vez de UTC.

Cambios:
- Agrega `localDayKey()` para obtener YYYY-MM-DD segun zona local del dispositivo.
- `Ventas hoy`, `Debe hoy` y `Abonos hoy` ahora filtran por fecha local basada en `createdAt`.
- Las nuevas ventas y abonos guardan `day` con fecha local.
- El nombre del respaldo JSON tambien usa fecha local.
- Version: 3.5 / versionCode 26.
