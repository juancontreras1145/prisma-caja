# Prisma - Borrar boleta seguro

Cambios:
- Oculta el boton rojo X del listado de historial para evitar toques accidentales.
- Mantiene la funcion borrar boleta dentro de la boleta.
- Agrega boton "Eliminar boleta" al final de la ventana de boleta.
- Pide confirmacion antes de borrar.
- Recalcula numeracion de boletas despues de borrar.

## Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_borrar_boleta_seguro.zip
git add .
git commit -m "Hacer borrado de boletas mas seguro"
git push
```
