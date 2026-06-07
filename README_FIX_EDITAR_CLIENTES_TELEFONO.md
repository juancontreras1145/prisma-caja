# Prisma - Editar clientes sin WhatsApp

Cambios:
- Clientes sin numero ahora muestran boton "Agregar WhatsApp".
- Clientes con numero muestran WhatsApp, Copiar, Editar y eliminar.
- Editar permite cambiar nombre y agregar/cambiar/quitar WhatsApp.
- El telefono acepta:
  - 99456548
  - 9 9945 6548
  - +56 9 9945 6548
- Se muestra formato chileno +56 9 9945 6548.
- Mantiene JSON nativo estable y clave Ganancias 1145.

## Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_fix_editar_clientes_telefono.zip
git add .
git commit -m "Permitir agregar WhatsApp a clientes existentes"
git push
```
