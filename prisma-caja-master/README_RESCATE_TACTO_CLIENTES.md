# Prisma - Rescate tacto + editar clientes

Esta version vuelve a una base estable y agrega edicion de clientes con modal simple.

Corrige:
- Evita el cambio anterior que dejaba la app sin responder.
- Clientes sin telefono muestran "Agregar WhatsApp".
- Editar cliente permite agregar/cambiar/quitar WhatsApp.
- Mantiene JSON nativo estable.
- Mantiene clave Ganancias 1145.
- Mantiene WhatsApp estable sin experimento de imagen directa.

## Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_rescate_tacto_clientes.zip
git add .
git commit -m "Rescatar tacto y editar clientes estable"
git push
```
