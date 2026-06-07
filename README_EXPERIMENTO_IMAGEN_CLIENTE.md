# Prisma - Experimento imagen directa al cliente

Cambios:
- El boton Compartir imagen intenta enviar la boleta al WhatsApp del cliente guardado.
- Usa el numero del cliente y genera JID: 569XXXXXXXX@s.whatsapp.net.
- Este metodo no es oficial de WhatsApp.
- Si WhatsApp no respeta el contacto o falla, cae al compartir normal.
- Mantiene boton WhatsApp/texto por cliente.
- Mantiene editar/copiar clientes.
- Mantiene clave Ganancias 1145.

## Subir desde Termux

```bash
cd ~/prisma-caja
unzip -o ~/storage/downloads/prisma_experimento_imagen_cliente_v2.zip
git add .
git commit -m "Probar imagen directa al cliente WhatsApp"
git push
```

Si no funciona bien, volvemos al metodo estable anterior.
