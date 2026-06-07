# Actualizacion Prisma Caja APK v3

Cambios:
- Quita botones App y pantalla completa del HTML.
- Deja visible la barra inferior de Android en el APK.
- Cambia clave de Ganancias a 4511.
- Agrega importacion JSON inicial una sola vez dentro de Ganancias.
- Despues de importar, los datos quedan guardados dentro de la app.

## Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_caja_update_local_import_v3.zip
git add .
git commit -m "Actualizar app local e importacion inicial"
git push
```

Luego descarga el nuevo APK desde GitHub Actions.
