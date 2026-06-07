# Prisma - Restaurar estable + JSON nativo

Esta version elimina el experimento de enviar imagen directo al cliente.

Corrige:
- Compartir imagen vuelve al modo estable.
- Guardar respaldo JSON usa Android nativo ACTION_CREATE_DOCUMENT.
- Compartir respaldo JSON usa Android nativo ACTION_SEND.
- Cargar respaldo JSON mantiene selector nativo del WebView.
- WhatsApp de clientes abre fuera del WebView.
- Mantiene editar/copiar clientes.
- Mantiene appBack, Prisma arcoiris e icono prisma.

## Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_restore_stable_json_native.zip
git add .
git commit -m "Restaurar estable y corregir JSON nativo"
git push
```
