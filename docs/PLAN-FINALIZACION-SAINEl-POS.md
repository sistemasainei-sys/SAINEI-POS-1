# SAINEI POS — Plan de finalización por prioridad

Este plan pertenece a la rama de desarrollo. No autoriza despliegues, merges a main ni cambios en datos de comercios.

## Prioridad 1 — Continuidad de ventas y datos

- [ ] Diseñar modo desconectado real para instalaciones con varias cajas: persistencia local cifrada, cola durable de operaciones, identificadores idempotentes y reconciliación de stock.
- [ ] Resolver conflictos de sincronización sin sobrescribir ventas, pagos, devoluciones ni movimientos.
- [ ] Mostrar estado claro: servidor conectado, desconectado, cambios pendientes, último envío y errores.
- [ ] Pruebas de caída de red/servidor durante una venta, reinicio del navegador, reconexión y dos cajas vendiendo el mismo producto.
- [ ] Verificar restauración y copias antes/después de cada actualización.

**Criterio de aceptación:** ventas no se duplican ni se pierden; la interfaz no confirma sincronización antes de que el servidor la confirme. Hasta superar pruebas, el modo servidor sigue requiriendo conexión con la PC principal para vender.

## Prioridad 2 — Seguridad de conexión y acceso

- [ ] HTTPS para conexiones LAN y acceso remoto seguro, sin exponer la base de datos ni el puerto interno directamente a internet.
- [ ] Definir acceso remoto mediante VPN o túnel autenticado y documentar instalación/rotación de certificados.
- [ ] Pruebas de sesiones vencidas, revocación de usuarios, permisos por rol y protección CSRF/origen.
- [ ] Revisar almacenamiento de fotos y logos para evitar bases de datos excesivamente grandes.

**Criterio de aceptación:** tráfico de autenticación y negocio cifrado; ninguna ruta administrativa accesible sin permiso.

## Prioridad 3 — Caja y operación multiusuario

- [x] Cierre supervisado de turnos olvidados por principal/encargado, con efectivo contado y observación.
- [ ] Pruebas reales de varias cajas simultáneas, números de ticket, caja por usuario y arqueos.
- [ ] Control de concurrencia para apertura/cierre y movimientos de efectivo.

## Prioridad 4 — Catálogo y herramientas comerciales

- [ ] Variantes de producto (talle, color, modelo, presentación) con SKU/código y stock independiente.
- [x] Etiquetas imprimibles con nombre, precio y código del producto.
- [ ] Integración y pruebas de impresoras térmicas, lectores y balanzas compatibles.
- [x] Historial de proveedores con compras, pagos registrados, saldos y vencimientos (vista de consulta).
- [ ] Fidelización opcional de clientes y puntos, con reglas configurables.

## Prioridad 5 — Compatibilidad y publicación

- [ ] Prueba de instalación limpia y actualización en Windows 10/11.
- [ ] Pruebas de navegador en PC, tablet, Android y Safari iPhone.
- [ ] Pruebas de impresión y exportación en los dispositivos admitidos.
- [ ] Ensayo de backup/restore en una copia de prueba; nunca sobre datos de clientes.
- [ ] Publicación solo después de aprobación explícita del usuario.

## Fuera del alcance actual (no implementar sin nueva decisión)

- Facturación electrónica DNIT/SIFEN/e-Kuatia: requiere integración y habilitación oficial.
- Sucursales y transferencias entre sucursales.
- Acceso remoto directo sin VPN/túnel seguro.

## Implementaciones agregadas en la rama de finalización

Estas funciones ya tienen código incorporado en esta rama, pero no se consideran publicadas ni listas para operar hasta completar las verificaciones y la integración:

- [x] Canje de puntos de clientes con control de saldo e historial; el libro de canjes se sincroniza en modo servidor.
- [x] Ventas pausadas: guardar y restaurar el carrito, conservar descuento/cliente y volver a validar stock antes de reanudar.
- [x] Variantes agrupadas: vincular productos ya existentes por grupo y nombre, manteniendo SKU, precio y stock independientes.
- [x] Promociones porcentuales con fechas de vigencia y respeto del límite de descuento por usuario.
- [x] API interna para guardar/restaurar carritos y persistir las nuevas configuraciones en modo servidor.

**Pendiente para estas funciones:** pruebas funcionales de punta a punta con datos de prueba, revisión de permisos en cajero/encargado/administrador y verificación de sincronización en dos equipos. No usar datos reales para estas pruebas.

## Seguridad del trabajo

- Trabajar únicamente en `sainei-pos-finalizacion-independiente`.
- No modificar `main`, Render ni bases de datos reales.
- No ejecutar borrados, restauraciones ni migraciones destructivas sobre datos existentes.
- Toda nueva migración debe ser aditiva, reversible y probada con una copia aislada.
