# SAINEI POS — Revisión de seguridad y operación

Estado: revisión estática del código de la rama `sainei-pos-finalizacion-segura`. No equivale a una auditoría externa ni a pruebas de penetración.

## Controles identificados en el código

- Las contraseñas/PIN se almacenan como hash derivado con scrypt y sal aleatoria.
- Las comparaciones de hash usan `timingSafeEqual`.
- El acceso se entrega mediante token aleatorio Bearer; las sesiones expiran por inactividad/tiempo y se mantienen en memoria del proceso.
- Hay limitación progresiva de intentos fallidos de inicio de sesión.
- Los usuarios tienen roles admin, encargado y cajero; la API aplica permisos por colección y algunas reglas por propietario.
- Al desactivar un usuario o cambiar su PIN se revocan sus sesiones activas.
- La API agrega encabezados de seguridad básicos y rechaza orígenes distintos en peticiones mutables cuando el navegador envía el encabezado Origin.
- Las escrituras SQLite usan transacciones en las operaciones que lo requieren y el stock de ventas se valida en el servidor.

## Riesgos y límites que siguen abiertos

1. **HTTP en red local:** el servidor local entrega la aplicación por HTTP. Los tokens y datos de negocio no quedan cifrados en tránsito dentro de la LAN. No habilitar acceso desde redes públicas ni Wi-Fi compartido/no confiable.
2. **Sesiones en memoria:** reiniciar el servidor invalida las sesiones; esto es seguro para cierre, pero obliga a iniciar sesión de nuevo. No existe un panel de revocación individual de sesiones.
3. **Origen ausente:** la protección actual compara el encabezado Origin cuando está presente; una petición sin Origin no es bloqueada por esa comprobación. La autorización sigue dependiendo del token Bearer. Antes de cambiar esta regla hay que confirmar los clientes HTTP compatibles.
4. **Bloqueo de intentos:** el contador de intentos fallidos vive en memoria y se pierde al reiniciar el servidor; no es un control distribuido ni persistente.
5. **Backups locales:** las copias automáticas quedan en el mismo equipo y disco que la base principal. Un daño, robo o ransomware puede afectar ambas. La copia USB es manual y todavía requiere verificar restauración.
6. **HTTP/HTTPS externo:** no hay VPN, túnel autenticado ni proxy HTTPS configurado en esta rama.
7. **Periféricos:** la impresión del navegador y lectores HID pueden depender de controladores/configuración del sistema; la integración directa ESC/POS y balanzas requiere modelos y protocolos concretos.

## Reglas operativas hasta cerrar los pendientes

- Mantener el servidor detrás del firewall de Windows, en una red marcada como Privada.
- No abrir TCP 8080 en el router ni compartir el enlace LAN por internet.
- Usar PIN distinto por persona; evitar claves compartidas y códigos fáciles.
- Desactivar inmediatamente usuarios que ya no trabajan en el comercio.
- Mantener una copia externa desconectada cuando no se esté respaldando.
- No cargar datos reales en el servicio gratuito de Render.
- Antes de operar con dinero real, configurar almacenamiento persistente y demostrar una restauración desde una copia externa en un entorno aislado.

## Próximas tareas necesarias

- Implementar y validar HTTPS/VPN para el escenario remoto, si se requiere.
- Evaluar persistencia de sesiones y revocación administrativa individual solo si el flujo operativo lo necesita.
- Persistir y limitar intentos fallidos para que el control sobreviva reinicios.
- Reforzar la política de Origin/CSRF sin romper el acceso de las aplicaciones cliente.
- Ejecutar la revisión de permisos, concurrencia, backup y restauración en un entorno de prueba autorizado.
- Configurar el servidor y los respaldos en el equipo real del comercio.

**No declarar producción lista** hasta resolver los riesgos de transporte, persistencia y recuperación de datos, y completar las verificaciones del entorno real.
