# Limpieza v4.3

Esta versión parte desde v4.2 y deja respaldo separado antes de borrar duplicados.

## Eliminado

- `script.js` y `script_check.js` porque duplicaban el JavaScript embebido.
- `index.html` raíz porque la APK usa `app/src/main/assets/index.html`.
- `manifest.webmanifest` y `sw.js` porque no estaban conectados al HTML.
- Copias de `manifest.webmanifest` y `sw.js` dentro de assets.
- `build-apk.yml` porque duplicaba el flujo de compilación; queda `release-apk.yml`.
- README antiguos de parches.
- Funciones JavaScript sin referencias directas en la app.

## Mantener

- `app/src/main/assets/index.html` como fuente real del WebView.
- `README_FIRMA_GITHUB.md` porque documenta la firma.
- `.github/workflows/release-apk.yml` para publicar versiones firmadas.
