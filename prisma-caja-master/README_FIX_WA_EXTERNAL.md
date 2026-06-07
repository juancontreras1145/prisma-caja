# Prisma - Fix wa.me externo

Corrige el error:
`Página web no disponible ... net::ERR_CACHE_MISS`

Causa:
El WebView intentaba abrir `https://wa.me/...` dentro de la app.

Solución:
- Intercepta enlaces wa.me / api.whatsapp.com / whatsapp://.
- Los abre fuera del WebView usando Android Intent.
- Agrega AndroidBridge.openWhatsapp(phone, text).
- Agrega permiso INTERNET por seguridad.
- Mantiene botón Atrás dentro de la app.
- Mantiene importar JSON desde Editar > Respaldo.
- Mantiene clave Ganancias 1145.

## Subir desde Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_fix_wa_external.zip
git add .
git commit -m "Corregir apertura externa WhatsApp"
git push
```
