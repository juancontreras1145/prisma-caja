# Prisma Caja - Compartir directo a WhatsApp

Este fix cambia el compartir boleta:

- Ya no abre primero el panel genérico inferior de Android.
- Intenta abrir WhatsApp normal directamente.
- Si no está, intenta WhatsApp Business.
- Si no hay WhatsApp, recién usa el panel normal de Android.
- Mantiene icono prisma multicolor.
- Mantiene importar JSON desde Editar > Respaldo.
- Mantiene clave Ganancias 1145.

## Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_caja_fix_whatsapp_direct.zip
git add .
git commit -m "Abrir WhatsApp directo al compartir boleta"
git push
```

Después descarga el nuevo APK desde GitHub Actions.
