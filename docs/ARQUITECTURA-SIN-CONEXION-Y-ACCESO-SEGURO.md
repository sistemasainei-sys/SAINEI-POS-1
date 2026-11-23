# SAINEI POS — Diseño técnico de continuidad y acceso seguro

Estado: diseño y criterios de aceptación; **no habilita todavía ventas sin conexión ni acceso remoto**.

## 1. Operación sin conexión entre varias cajas

No se debe habilitar un modo offline que guarde ventas localmente y después las mezcle sin un protocolo de confirmación. Dos cajas pueden vender la última unidad al mismo tiempo y una venta local no puede garantizar stock global.

### Protocolo requerido antes de implementar
1. Cada instalación/caja tendrá un identificador persistente propio.
2. Cada acción de negocio tendrá un `operationId` UUID generado una sola vez y conservado en todos los reintentos.
3. La caja guardará las operaciones en una outbox durable (IndexedDB), con estados `pending`, `sent`, `accepted` o `rejected`; nunca marcará una venta como sincronizada por el solo hecho de enviarla.
4. El servidor mantendrá una tabla de operaciones procesadas con índice único por `operationId`. Repetir una operación aceptada devolverá el resultado anterior y no volverá a descontar stock.
5. Venta, líneas, movimientos de stock, pago y registro de idempotencia se confirmarán en una sola transacción SQLite.
6. El servidor será autoridad del stock. Si dos cajas compiten por las últimas unidades, la primera transacción válida se acepta y la otra queda rechazada para revisión; no se permite stock negativo.
7. Una devolución será una operación nueva vinculada al ticket original; nunca se reescribirá silenciosamente una venta aceptada.
8. La cola sobrevivirá a cerrar/reabrir el navegador y a reiniciar el equipo. Se mostrará claramente qué ventas siguen pendientes.
9. La reconciliación será por operación, no por reemplazo completo de listas o snapshots.

### Límites de seguridad
- Mientras no estén implementados el outbox, la idempotencia del servidor y la reconciliación, la caja en modo servidor debe exigir conexión con el servidor para confirmar ventas.
- No se debe prometer disponibilidad offline compartida ni aceptar ventas pendientes como stock confirmado.
- No se debe resolver un conflicto borrando ventas, movimientos o pagos.

### Pruebas de aceptación obligatorias
- Reintentar diez veces la misma operación no duplica ticket, pago ni movimiento.
- Cortar internet antes, durante y después del envío; reiniciar navegador y equipo; reconectar y verificar una única venta.
- Dos cajas venden simultáneamente la última unidad: solo una venta queda aceptada.
- Respuesta perdida después del commit: el reintento devuelve la operación previamente aceptada.
- Backup y restauración conservan identificadores y estados de operaciones.

## 2. Acceso remoto y transporte seguro

El servidor actual escucha en la interfaz de red local y publica direcciones HTTP de LAN. Esto es útil para una red interna confiable, pero **no equivale a acceso remoto seguro**.

### Arquitectura recomendada
- No publicar el puerto interno del POS directamente en el router ni exponer SQLite.
- Para acceso desde fuera del local, usar una VPN privada (por ejemplo, WireGuard o una solución administrada equivalente) entre equipos autorizados.
- Mantener el servidor accesible solo dentro de la red privada; limitar firewall a las IP/rangos de la VPN.
- Si se necesita acceso por navegador sin VPN, colocar un proxy HTTPS administrado delante del servicio, con TLS válido, autenticación fuerte y reglas de acceso; no improvisar certificados ni secretos.
- Rotar credenciales, limitar usuarios y revisar auditoría/sesiones antes de habilitar acceso externo.

### Pruebas de aceptación
- HTTP no queda accesible desde internet público.
- HTTPS/VPN cifra el tráfico y solo permite dispositivos autorizados.
- Sesiones vencidas y usuarios desactivados pierden acceso.
- Cajero y encargado no pueden ejecutar acciones administrativas.
- Se verifica el acceso desde una red externa real y se revisan logs.

## 3. Estado actual verificado
- El servidor ya exige sesión para sincronización y rutas administrativas.
- Las mutaciones API con encabezado Origin rechazan hosts de origen distintos.
- La sincronización usa transacciones SQLite y valida movimientos para impedir stock negativo.
- Las ventas aceptadas son inmutables salvo devoluciones validadas.
- Estas protecciones reducen riesgos, pero no sustituyen las pruebas de dos equipos, el protocolo offline completo ni VPN/HTTPS.

## 4. No habilitar hasta completar
No marcar modo offline multi-caja ni acceso remoto como terminado hasta implementar y ejecutar todas las pruebas anteriores. Mantener el despliegue y la base de datos de producción sin cambios hasta aprobación expresa.
