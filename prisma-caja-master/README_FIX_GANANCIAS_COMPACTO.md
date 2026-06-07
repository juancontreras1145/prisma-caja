# Prisma - Fix ganancias compacto

Corrige el panel de Ganancias que quedaba vacío.

Causa:
- La versión anterior intentaba leer `data.sales`, pero Prisma usa `data.movements`.
- También usaba `money()`, pero la función real es `formatMoney()`.

Cambios:
- Ganancias vuelve a mostrar datos.
- Mantiene pantallas deslizables: Resumen, Productos, Clientes.
- Abre por defecto en Todo.
- Separa Ventas totales y Utilidad descontando costos.

## Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_ganancias_compacto_fix.zip
git add .
git commit -m "Corregir ganancias compacto"
git push
```
