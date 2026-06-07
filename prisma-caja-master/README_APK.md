# Prisma Caja - APK desde GitHub

Este paquete agrega un proyecto Android WebView y un workflow de GitHub Actions.

## Desde Termux

Copia este ZIP a Descargas y ejecuta dentro de tu repo `~/prisma-caja`:

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_caja_github_apk.zip
git add .
git commit -m "Agregar build APK"
git push
```

Luego en GitHub:

1. Entra al repo `prisma-caja`.
2. Abre la pestaña **Actions**.
3. Entra a **Build APK**.
4. Ejecuta **Run workflow** si no corre solo.
5. Descarga el artifact **PrismaCaja-debug-apk**.
6. Dentro viene `app-debug.apk`.

## Nota

La app WebView incluye pantalla completa real y comparte la boleta con Android nativo.
