# Prisma - Borrar boleta visible

Corrige que la opción de borrar no aparecía en la boleta.

Cambios:
- Debajo de Cerrar aparece "Eliminar boleta".
- Se mantiene oculto el botón X del historial.
- Eliminar boleta pide confirmación.
- Recalcula numeración después de borrar.

## Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_borrar_boleta_visible.zip
git add .
git commit -m "Mostrar eliminar boleta dentro de boleta"
git push
```
