#!/data/data/com.termux/files/usr/bin/bash
set -e

# Limpieza segura de archivos duplicados/obsoletos. Ejecutar desde la raiz del repo prisma-caja.
rm -f index.html
rm -f script.js script_check.js
rm -f manifest.webmanifest sw.js prisma_icon.png
rm -f app/src/main/assets/manifest.webmanifest app/src/main/assets/sw.js
rm -f .github/workflows/build-apk.yml

# Mantener solo documentacion actual importante.
find . -maxdepth 1 -type f -name 'README*.md' \
  ! -name 'README_FIRMA_GITHUB.md' \
  ! -name 'README_LIMPIEZA_V43.md' \
  ! -name 'README_DISENOS_IGUAL_HTML_V44.md' \
  -delete

# Nunca borrar la fuente real de la app.
test -f app/src/main/assets/index.html

echo 'Limpieza lista. Fuente activa: app/src/main/assets/index.html'
