# SAINEI POS — Plan de finalización por prioridad

Este plan pertenece a la rama de desarrollo. No autoriza despliegues, merges a main ni cambios en datos de comercios.

## Prioridad 1 — Operación en línea y respaldo de datos

- [x] Definir que SAINEI POS requiere conexión a internet/servidor para confirmar ventas; no ofrecer operación sin conexión.
- [ ] Verificar restauración y copias antes/después de cada actualización. La guía de riesgos está en `docs/REVISION-SEGURIDAD-OPERACION.md` y el procedimiento para el administrador en `docs/PROCEDIMIENTO-RESPALDO-RESTAURACION.md`.
- [ ] Confirmar almacenamiento persistente de la base de datos en el servicio publicado antes de usarlo con datos reales.

**Decisión de alcance:** el usuario decidió dejar fuera el modo sin conexión. El cliente debe tener internet para operar y confirmar ventas. No se implementará cola offline ni sincronización posterior en esta entrega.

## Prioridad 2 — Seguridad de conexión y acceso

- [ ] HTTPS para conexiones LAN y acceso remoto seguro, sin exponer la base de datos ni el puerto interno directamente a internet. Revisión estática de riesgos documentada en `docs/REVISION-SEGURIDAD-OPERACION.md`.
- [ ] Definir acceso remoto mediante VPN o túnel autenticado y documentar instalación/rotación de certificados.
- [x] Documentar controles existentes y brechas de sesiones, permisos, intentos fallidos y Origin/CSRF en `docs/REVISION-SEGURIDAD-OPERACION.md`.
- [ ] Pruebas de sesiones vencidas, revocación de usuarios, permisos por rol y protección CSRF/origen.
- [x] Persistir en SQLite el contador de intentos fallidos de acceso para que sobreviva reinicios; falta verificarlo en ejecución.
- [ ] Revisar almacenamiento de fotos y logos para evitar bases de datos excesivamente grandes.

**Criterio de aceptación:** tráfico de autenticación y negocio cifrado; ninguna ruta administrativa accesible sin permiso.

## Prioridad 3 — Caja y operación multiusuario

- [x] Cierre supervisado de turnos olvidados por principal/encargado, con efectivo contado y observación.
- [ ] Pruebas reales de varias cajas simultáneas, números de ticket, caja por usuario y arqueos.
- [ ] Control de concurrencia para apertura/cierre y movimientos de efectivo.

## Prioridad 4 — Catálogo y herramientas comerciales

- [x] Variantes de producto (talle, color, modelo, presentación) con SKU/código y stock independiente (implementado; falta prueba funcional).
- [x] Etiquetas imprimibles con nombre, precio y código del producto.
- [x] Documentar compatibilidad, configuración y límites de impresoras térmicas, lectores y balanzas; la integración física por modelo sigue pendiente.
- [x] Mejorar el script de respaldo USB: comprobar que existan copias `.db` en origen, que el destino sea accesible y que haya archivos `.db` al finalizar. La restauración íntegra sigue pendiente de verificación aislada.
- [x] Historial de proveedores con compras, pagos registrados, saldos y vencimientos (vista de consulta).
- [x] Auditoría visible desde la barra principal para el administrador, con fecha, usuario y acción; consulta protegida también en el servidor y exportación CSV. En modo local utiliza el historial local.
- [x] Conteo físico de stock: si el guardado falla o es rechazado, revierte la cantidad y los movimientos locales; el registro de auditoría se agrega solo después de confirmar el guardado.
- [x] Compras y movimientos disponibles en Stock; gastos y caja en Finanzas; usuarios/permisos y copias de seguridad en Ajustes. No se duplican como pestañas independientes.
- [x] Cuentas por cobrar: descontar devoluciones registradas del crédito pendiente y recalcular vencimientos con pagos aplicados por antigüedad.
- [x] Fidelización opcional de clientes y puntos, con reglas configurables (canje e historial implementados; falta prueba funcional).

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
- [x] Corrección de cuentas por cobrar: las devoluciones reducen el saldo de crédito en el resumen general y en el detalle de cada cliente.

**Pendiente para estas funciones:** pruebas funcionales de punta a punta con datos de prueba, revisión de permisos en cajero/encargado/administrador y verificación de sincronización en dos equipos. No usar datos reales para estas pruebas.

### Hallazgo de revisión estática — devoluciones y ventas mixtas

- [ ] Definir y aplicar una regla contable para devoluciones de ventas mixtas (efectivo/tarjeta/transferencia/crédito). Actualmente el importe total devuelto se descuenta del saldo de crédito de la venta, aunque el reembolso pueda salir por caja o por banco. Esto puede reducir indebidamente la deuda del cliente cuando el reembolso se entrega en efectivo/transferencia.
- [ ] Separar explícitamente el importe aplicado a saldo de crédito del importe reembolsado por caja/banco; conservar trazabilidad por devolución y validar esa distribución en el servidor.
- [x] Revisión estática confirma que el servidor valida que las cantidades devueltas no superen las cantidades vendidas y exige movimientos de reposición de stock correspondientes; no se ejecutaron pruebas.

**No se modificó esta regla contable:** falta definir si una devolución debe acreditarse a la deuda, reembolsarse al cliente o permitir una distribución entre ambas opciones. Evitar corregirla por suposición para no alterar saldos reales.

### Hallazgo de revisión estática — sincronización de configuraciones

- [ ] Añadir control de concurrencia/versionado por clave para los registros de configuración `SING` (incluye fidelización, promociones y configuración del comercio). El servidor actualmente reemplaza cada objeto completo que recibe un administrador; dos equipos administradores que editen la misma configuración desde estados distintos pueden sobrescribirse cambios.
- [ ] Para `loyaltyRedemptions` y `promotions`, valorar migrar los registros tipo historial a colecciones con IDs individuales en vez de guardar el historial como un único objeto. Hacerlo requiere migración aditiva y compatibilidad con datos existentes.
- [x] Confirmado en revisión estática del flujo `processSync`: ahora compara la revisión del cliente con la última revisión de cada clave `SING`. No se ejecutaron pruebas.

## Seguridad del trabajo

- Trabajar únicamente en `sainei-pos-finalizacion-segura`.
- No modificar `main`, Render ni bases de datos reales.
- No ejecutar borrados, restauraciones ni migraciones destructivas sobre datos existentes.
- Toda nueva migración debe ser aditiva, reversible y probada con una copia aislada.
- Diseño técnico agregado en `docs/ARQUITECTURA-SIN-CONEXION-Y-ACCESO-SEGURO.md`; no habilita todavía el modo offline ni el acceso remoto.
- Revisión estática de seguridad y operación agregada en `docs/REVISION-SEGURIDAD-OPERACION.md`; no sustituye auditoría ni pruebas.
