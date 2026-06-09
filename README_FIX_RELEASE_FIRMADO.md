# Fix release firmado v3.2

Este parche cambia el workflow de release para firmar el APK usando solo:

- PRISMA_KEYSTORE_BASE64
- PRISMA_KEYSTORE_PASSWORD
- PRISMA_KEY_ALIAS

Ya no usa `PRISMA_KEY_PASSWORD`; para esta firma se usa la misma clave del keystore como clave de la llave interna.

Tambien se elimina `app/prisma-release.jks` del proyecto y se agrega `.gitignore` para evitar subir llaves privadas.
