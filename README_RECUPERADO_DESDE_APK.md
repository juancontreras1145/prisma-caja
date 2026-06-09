# Prisma Caja - fuente recuperada desde APK

Este proyecto fue reconstruido tomando como base el archivo `Prisma.apk` enviado por el usuario.

## Qué se recuperó directamente del APK

- `assets/index.html`
- `assets/manifest.webmanifest`
- `assets/sw.js`
- `assets/prisma_icon.png`
- Versión detectada: `versionName "2.7"`, `versionCode 18`

## Qué se usó como estructura Android

Se usó la estructura Gradle/Android del proyecto Prisma Caja existente porque el APK no contiene los archivos fuente Gradle originales completos. El `MainActivity.java` corresponde al contenedor WebView usado por la app: carga `file:///android_asset/index.html`, permite importar/exportar JSON/CSV y compartir por WhatsApp.

## Nota importante

Un APK no permite recuperar perfectamente el proyecto original, pero en esta app la lógica principal está dentro de `index.html`, por lo que esta reconstrucción conserva la interfaz y lógica que venía dentro del APK.
