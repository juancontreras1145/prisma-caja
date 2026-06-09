# Fix release firmado GitHub

Version 3.1.

Este parche evita que Gradle firme directamente el APK. Primero compila un release sin firmar y despues lo firma con zipalign/apksigner usando los secrets de GitHub.

Secrets requeridos:
- PRISMA_KEYSTORE_BASE64
- PRISMA_KEYSTORE_PASSWORD
- PRISMA_KEY_ALIAS
- PRISMA_KEY_PASSWORD

Si falla en "Crear y validar archivo de firma", algun secret esta mal copiado.
Si falla en "Compilar APK release sin firmar", el problema es de codigo/Gradle.
Si falla en "Firmar APK release", el problema es password, alias o keystore.
