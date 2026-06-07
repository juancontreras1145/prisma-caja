# Prisma - Compartir con cliente principal

Cambios:
- Deja un solo boton: Compartir con cliente.
- Si la boleta tiene cliente con WhatsApp guardado, intenta abrir directo su conversacion con la imagen.
- Si el cliente no tiene WhatsApp, abre el compartir generico.
- Quita boton separado "Enviar al cliente".
- Mantiene ventana de boleta mas arriba para que la barra Android no tape botones.
- Mantiene JSON nativo y editar clientes.

## Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_compartir_cliente_principal.zip
git add .
git commit -m "Usar compartir con cliente como principal"
git push
```
