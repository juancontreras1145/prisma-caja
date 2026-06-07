# Prisma - Back Android, WhatsApp clientes y titulo arcoiris

Cambios:
- La app ahora se llama solo Prisma.
- El titulo Prisma tiene efecto arcoiris animado.
- El boton Atrás de Android navega dentro de la app y no la cierra.
- En clientes, si escribes solo 8 digitos, se guarda como +569XXXXXXXX.
- En Editar > Clientes aparece un boton WhatsApp para probar el enlace de cada contacto.
- Muestra el link wa.me generado para cada cliente.
- Mantiene icono prisma multicolor.
- Mantiene importar JSON desde Editar > Respaldo.
- Mantiene clave Ganancias 1145.

## Subir desde Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_fix_back_whatsapp_rainbow.zip
git add .
git commit -m "Ajustar Prisma back WhatsApp y titulo"
git push
```

Luego descarga el nuevo APK desde GitHub Actions.
