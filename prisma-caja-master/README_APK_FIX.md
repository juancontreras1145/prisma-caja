# Fix APK Prisma Caja

Esta versión simplifica el WebView para evitar el cierre al abrir la app.

Cambios:
- Quita `androidx.webkit` y `WebViewAssetLoader`.
- Carga `index.html` directo desde `file:///android_asset/index.html`.
- Mantiene pantalla completa inmersiva.
- Mantiene compartir boleta por Android nativo.
- Incluye `gradle.properties` con AndroidX activado.

## En Termux

Dentro del repo:

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_caja_apk_fix_webview_simple.zip
git add .
git commit -m "Corregir cierre de APK"
git push
```

Luego vuelve a GitHub Actions y descarga el nuevo APK.
