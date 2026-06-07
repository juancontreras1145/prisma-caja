# Prisma - Ganancias compacto por pantallas

Cambios:
- Ganancias abre por defecto en Todo.
- Reemplaza pantalla larga por panel deslizable horizontal:
  - Resumen
  - Productos
  - Clientes
- Separa claramente:
  - Ventas totales
  - Utilidad descontando costos
- Mantiene compartir con cliente principal y JSON nativo.

## Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_ganancias_compacto_slides.zip
git add .
git commit -m "Compactar ganancias en pantallas deslizables"
git push
```
