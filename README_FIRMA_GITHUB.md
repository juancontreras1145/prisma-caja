# Firma fija para actualizaciones desde GitHub

Esta version cambia el release de GitHub Actions para publicar un APK `release` firmado siempre con la misma clave.

Android solo permite actualizar una app instalada si se cumple:

1. Mismo `applicationId` / package name.
2. Misma firma.
3. `versionCode` mayor.

Por eso esta version usa secrets de GitHub:

- `PRISMA_KEYSTORE_BASE64`
- `PRISMA_KEYSTORE_PASSWORD`
- `PRISMA_KEY_ALIAS`
- `PRISMA_KEY_PASSWORD`

## Importante

No subas el archivo `.jks` ni el archivo de secretos al repositorio publico.
Guarda una copia privada, porque esa clave es la identidad oficial de la app.

## Primera instalacion

Si ya tenias instalada una APK con otra firma, Android no va a permitir actualizar encima.
Debes hacer una vez:

1. Exportar respaldo JSON desde Prisma.
2. Desinstalar Prisma.
3. Instalar la APK firmada desde GitHub Releases.
4. Importar respaldo JSON.

Desde ahi en adelante, si GitHub sigue usando estos mismos secrets y subes `versionCode`, las actualizaciones deberian instalarse encima.
