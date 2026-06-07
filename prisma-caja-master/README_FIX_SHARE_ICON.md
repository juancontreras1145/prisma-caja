# Prisma Caja - Fix compartir e icono

Cambios:
- Reduce el peso de la imagen al compartir desde APK.
- Evita doble toque: el boton queda en "Preparando imagen..." mientras genera la boleta.
- El procesamiento nativo de compartir corre fuera del hilo principal para evitar parpadeos.
- Agrega icono de prisma multicolor a la app.
- Mantiene importacion JSON desde Editar > Respaldo.
- Mantiene clave Ganancias 1145.

## Subir desde Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_caja_fix_share_icon.zip
git add .
git commit -m "Mejorar compartir boleta e icono"
git push
```

Luego descarga el APK nuevo desde GitHub Actions.
