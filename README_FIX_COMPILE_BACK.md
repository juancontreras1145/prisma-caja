# Prisma - Fix compilacion MainActivity

Corrige error Java:
- Elimina `super.onBackPressed();` sobrante que quedo fuera del metodo.
- Mantiene boton Atrás Android navegando dentro de la app.
- Mantiene titulo Prisma arcoiris.
- Mantiene WhatsApp clientes con +569.
- Mantiene icono prisma multicolor.
- Mantiene clave Ganancias 1145.

## Subir desde Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_fix_back_whatsapp_rainbow_compile.zip
git add .
git commit -m "Corregir compilacion back android"
git push
```
