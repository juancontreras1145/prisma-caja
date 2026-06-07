# Prisma - Clientes editar/copiar teléfono

Cambios:
- Muestra WhatsApp en formato chileno: +56 9 9945 6548.
- Permite copiar el número con botón Copiar.
- Agrega botón Editar para clientes registrados.
- El campo WhatsApp acepta:
  - 99456548
  - 9 9945 6548
  - +56 9 9945 6548
- Genera link wa.me automáticamente.
- Corrige apertura de wa.me fuera del WebView mediante AndroidBridge.openWhatsapp.
- Mantiene clave Ganancias 1145.

## Subir desde Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_fix_clientes_editar_copiar.zip
git add .
git commit -m "Agregar editar y copiar clientes"
git push
```
