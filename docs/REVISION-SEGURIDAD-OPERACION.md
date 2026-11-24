# SAINEI POS — Revisión de seguridad y operación

Estado: revisión estática del código de la rama `sainei-pos-finalizacion-segura`. No equivale a una auditoría externa ni a pruebas de penetración.

## Controles identificados en el código

- Las contraseñas/PIN se almacenan como hash derivado con scrypt y sal aleatoria.
- Las comparaciones de hash usan `timingSafeEqual`.
- El acceso se entrega mediante token aleatorio Bearer; las sesiones expiran por inactividad/tiempo y se mantienen en memoria del proceso.
- Hay limitación progresiva de intentos fallidos de inicio de sesión; el contador ahora se guarda en SQLite y sobrevive reinicios del proceso. Las claves de identificación se almacenan como hash.
- Los usuarios tienen roles admin, encargado y cajero; la API aplica permisos por colección y algunas reglas por propietario.
- Al desactivar un usuario o cambiar su PIN se revocan sus sesiones activas.
- La API agrega encabezados de seguridad básicos y rechaza orígenes distintos en peticiones mutables cuando el navegador envía el encabezado Origin.
- Las escrituras SQLite usan transacciones en las operaciones que lo requieren y el stock de ventas se valida en el servidor.

## Riesgos y límites que siguen abiertos

1. **HTTP en red local:** el servidor local entrega la aplicación por HTTP. Los tokens y datos de negocio no quedan cifrados en tránsito dentro de la LAN. No habilitar acceso desde redes públicas ni Wi-Fi compartido/no confiable.
2. **Sesiones en memoria:** reiniciar el servidor invalida las sesiones; esto es seguro para cierre, pero obliga a iniciar sesión de nuevo. No existe un panel de revocación individual de sesiones.
3. **Origen ausente:** la protección actual compara el encabezado Origin cuando está presente; una petición sin Origin no es bloqueada por esa comprobación. La autorización sigue dependiendo del token Bearer. Antes de cambiar esta regla hay que confirmar los clientes HTTP compatibles.
4. **Bloqueo de intentos:** el contador de intentos fallidos ya se persiste en SQLite y se limpia al cumplirse 30 días sin actualización. Sigue siendo local a una instalación y no sustituye controles perimetrales ni una protección distribuida.
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
- Revisar el limitador persistente de intentos con pruebas de reinicio y concurrencia.
- Reforzar la política de Origin/CSRF sin romper el acceso de las aplicaciones cliente.
- Ejecutar la revisión de permisos, concurrencia, backup y restauración en un entorno de prueba autorizado.
- Configurar el servidor y los respaldos en el equipo real del comercio.

**No declarar producción lista** hasta resolver los riesgos de transporte, persistencia y recuperación de datos, y completar las verificaciones del entorno real.


## Refuerzos adicionales de credenciales y recuperación

- La recuperación de la clave del administrador revoca todas las sesiones activas anteriores de esa cuenta. El usuario debe iniciar sesión nuevamente con la nueva clave.
- Las claves PIN aceptadas tienen un máximo de 64 caracteres; los intentos de autenticación que exceden ese límite se rechazan antes de calcular el hash.
- La API de administración rechaza identificadores de usuario inválidos y no convierte una edición de un usuario inexistente en un alta nueva.
- Estos cambios son una revisión estática; no se ejecutaron pruebas de autenticación ni de sesión.


## Integridad de compras

- El servidor valida que cada compra nueva tenga proveedor, fecha válida, condición contado/crédito, al menos un artículo y total positivo.
- Cada artículo debe referir a un producto existente y activo, con cantidad positiva y costo unitario entero no negativo.
- El servidor recalcula el total desde las líneas y rechaza la compra si no coincide con el total recibido.
- Las compras existentes son inmutables desde sincronización: una modificación no idéntica se rechaza para evitar cambiar documentos que ya pueden tener pagos asociados.
- No se ejecutaron pruebas; queda pendiente la validación operativa de compras, pagos y reposición de stock.


## Inmutabilidad de cobros y pagos

- Los pagos a proveedores (`spay`) aceptados no pueden editarse ni reasignarse en sincronizaciones posteriores.
- Los cobros de clientes (`payments`) aceptados tampoco pueden alterarse retroactivamente.
- Si se necesita corregir un movimiento, debe resolverse mediante un procedimiento de ajuste o reversión auditable; la interfaz actual no debe simular una edición del comprobante original.
- No se ejecutaron pruebas.


## Validación de catálogo y movimientos de inventario

- El servidor rechaza productos sin nombre, con nombre excesivo, precio/costo negativo o no entero, mínimo negativo/no numérico o tipo de producto no reconocido.
- Los movimientos nuevos deben apuntar a un producto activo, tener cantidad finita y distinta de cero, fecha válida, cantidad acotada y campos tipo/detalle de longitud limitada.
- El stock persistido continúa derivándose de los movimientos aceptados; el valor de stock enviado directamente en una edición de producto no reemplaza el stock del servidor.
- No se ejecutaron pruebas; la compatibilidad con productos pesables y de medida queda pendiente de comprobación operativa.


## Reserva de identificadores API

- El endpoint de reserva de IDs valida que la cantidad sea un entero seguro entre 1 y 500; ya no normaliza silenciosamente valores inválidos.
- Administradores conservan acceso a todos los contadores.
- Encargados y cajeros solo pueden reservar identificadores para colecciones donde su rol tenga permiso de alta, evitando que consuman contadores de módulos no autorizados.
- No se ejecutaron pruebas.


## Límites de sincronización

- El servidor valida que `changes` sea un objeto y que cada colección pertenezca al catálogo permitido.
- Cada lote de altas/actualizaciones (`up`) y bajas (`del`) admite como máximo 1.000 registros por colección; tipos de lote inválidos o excesivos se rechazan antes de abrir la transacción.
- Este límite lógico complementa el máximo de 25 MB del cuerpo HTTP.
- No se ejecutaron pruebas.


## Escape de texto en historial de movimientos

- El tipo de movimiento mostrado en el historial se escapa antes de insertarse en `innerHTML`.
- Esto evita que un valor de tipo recibido desde registros termine interpretándose como marcado HTML.
- La revisión estática encontró otros usos de `innerHTML`; no se modificaron en bloque porque varios ya escapan los datos o usan contenido controlado por la aplicación. Requieren revisión individual.
- No se ejecutaron pruebas.


## Validación de versión de sincronización

- `/api/sync` exige un cuerpo JSON de tipo objeto, no acepta arreglos como solicitud.
- La revisión `since` debe ser un entero seguro no negativo; se rechazan cadenas, decimales, negativos y valores fuera del rango seguro en lugar de convertirlos silenciosamente.
- El identificador de época, cuando se envía, debe ser texto de hasta 128 caracteres.
- No se ejecutaron pruebas.


## Estructura completa del paquete de sincronización

- El servidor rechaza `changes` y `sing` cuando no son objetos JSON simples, y `audit` cuando no es una lista.
- Los arreglos no se aceptan como objetos de configuración o cambios; se evita tratar silenciosamente estructuras malformadas como sincronizaciones vacías.
- Se mantiene la validación previa de colecciones y límites de lote.
- No se ejecutaron pruebas.


## Validación de copias antes de restaurar

- Antes de modificar la base de datos, el servidor valida que el archivo tenga las listas esenciales de productos y ventas.
- Las colecciones presentes deben ser listas de hasta 100.000 registros; cada registro debe ser un objeto con ID entero seguro, positivo y no duplicado dentro de su colección.
- Los bloques de configuración deben ser objetos y no arreglos.
- Las copias inválidas se rechazan antes de crear la copia previa o iniciar la restauración; se evita descartar silenciosamente filas con IDs incorrectos.
- No se ejecutaron pruebas de restauración.
