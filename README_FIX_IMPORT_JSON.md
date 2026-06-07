# Prisma Caja - Fix importar JSON

Cambios:
- Clave de Ganancias vuelve a 1145.
- Cargar respaldo JSON vuelve a Editar > Respaldo.
- Se elimina importación desde Ganancias.
- Se elimina bloqueo de importar una sola vez.
- APK agrega soporte nativo para seleccionar archivos JSON desde WebView.
- Barra inferior de Android queda visible.

## Subir desde Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_caja_fix_import_json_editar.zip
git add .
git commit -m "Corregir importacion JSON desde editar"
git push
```

Luego descarga el nuevo APK desde GitHub Actions.
