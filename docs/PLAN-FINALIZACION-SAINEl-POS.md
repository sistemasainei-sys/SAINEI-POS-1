# SAINEI POS — Plan de finalización por prioridad

Este plan pertenece a la rama de desarrollo. No autoriza despliegues, merges a main ni cambios en datos de comercios.

## Modalidad principal acordada — instalación local por comercio

- [x] Base SQLite local en la computadora principal de cada comercio; no requiere Render ni base de datos en la nube para guardar ventas.
- [x] Las cajas adicionales se conectan a la computadora principal por la red local y usan la misma base del comercio.
- [x] La carpeta de datos se mantiene separada de los archivos del programa para protegerla durante actualizaciones.
- [x] Unificar el instalador Windows (`1-INSTALAR.bat`), inicio manual y automático, acceso directo y carpeta de datos separada. La actualización conserva los datos si no se reemplaza `%LOCALAPPDATA%\\SAINEI-POS\\datos`.
- [x] Incorporar actualizador guiado desde carpeta extraída: detiene el servidor, guarda copia completa de los datos en `actualizaciones` y excluye datos, repositorio, dependencias y configuración local al copiar el programa. Falta que el usuario lo verifique en su PC.
- [ ] Verificar copia externa y restauración cuando el usuario autorice sus pruebas.

**Decisión de alcance:** Render no es requisito para vender ni operar la versión local. Dentro del comercio, las operaciones necesitan la red local y la computadora principal encendida, pero no internet. El modo local actual no solicita activación. Si se pierde la conexión con la computadora principal, las cajas adicionales no pueden confirmar operaciones. No se implementará modo offline ni sincronización posterior.

## Prioridad 1 — Operación local y respaldo de datos

- [ ] Verificar restauración y copias antes/después de cada actualización. La guía de riesgos está en `docs/REVISION-SEGURIDAD-OPERACION.md` y el procedimiento para el administrador en `docs/PROCEDIMIENTO-RESPALDO-RESTAURACION.md`.
- [x] Mantener Render fuera del camino crítico de instalación, licencias y almacenamiento local en la modalidad local actual.

## Prioridad 2 — Seguridad de conexión y acceso

- [ ] HTTPS para conexiones LAN y acceso remoto seguro, sin exponer la base de datos ni el puerto interno directamente a internet. Revisión estática de riesgos documentada en `docs/REVISION-SEGURIDAD-OPERACION.md`.
- [ ] Definir acceso remoto mediante VPN o túnel autenticado y documentar instalación/rotación de certificados.
- [x] Documentar controles existentes y brechas de sesiones, permisos, intentos fallidos y Origin/CSRF en `docs/REVISION-SEGURIDAD-OPERACION.md`.
- [x] Reforzar autorización del lado del servidor: exportar/restaurar datos, vaciar datos, consultar/crear/restaurar respaldos y generar códigos de recuperación requiere rol administrador; no depende solo de ocultar botones en la interfaz.
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

- [ ] Prueba de instalación limpia y actualización en Windows 10/11 (la realizará el usuario en su computadora).
- [ ] Pruebas de navegador en PC, tablet, Android y Safari iPhone.
- [ ] Pruebas de impresión y exportación en los dispositivos admitidos.
- [ ] Ensayo de backup/restore en una copia de prueba; nunca sobre datos de clientes (lo realizará el usuario en su computadora).
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
- [x] Revisión estática: el servidor valida las cantidades devueltas acumuladas por línea contra lo vendido, impide modificar devoluciones anteriores y solo acepta movimientos de reposición cuando llegan junto con una nueva devolución válida del ticket. No se ejecutaron pruebas.

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


### Corrección estática — validación de cantidades en devoluciones

- [x] Evitar que una cantidad inválida mezclada con otras líneas deje un importe de reembolso desfasado respecto de los artículos finalmente guardados.
- [x] Rechazar cantidades no numéricas, negativas o fraccionarias para productos vendidos por unidad.
- [x] Impedir registrar una devolución si el producto ya no existe en el inventario, para no confirmar una devolución sin reposición de stock.

- [x] El servidor rechaza devoluciones que traen IDs de movimientos de reposición inválidos, repetidos o ya utilizados, evitando aceptar la devolución con solo una parte de sus movimientos de stock.
- [ ] Revisar la regla contable para reembolsos de ventas mixtas y ejecutar pruebas funcionales aisladas cuando el usuario las autorice.

No se ejecutaron pruebas. Cambio incorporado únicamente en la rama de finalización.


### Validación estática — cobros de clientes

- [x] El servidor valida los cobros nuevos antes de guardarlos: cliente existente y activo, importe entero positivo, medio permitido (efectivo, transferencia o tarjeta), fecha válida y caja vinculada existente cuando se informa.
- [x] Los cobros inválidos se rechazan en el servidor aunque se intente enviar la solicitud sin utilizar la interfaz.

- [x] Un cobro en efectivo solo puede asociarse a una caja existente; si lo registra un cajero, el servidor exige que esa caja pertenezca a su propio usuario. Los medios transferencia y tarjeta no pueden alterar el arqueo de efectivo mediante un `shiftId` enviado manualmente.
- [ ] Falta verificar en ejecución el flujo de cobros, arqueo de caja y sincronización multiusuario. No se ejecutaron pruebas.


### Validación estática — pagos a proveedores

- [x] El servidor exige una compra existente, fecha válida, importe entero positivo y medio permitido para registrar un pago a proveedor.
- [x] La suma de pagos anteriores y nuevos no puede superar el total de la compra; se calcula dentro de la transacción para impedir sobrepagos concurrentes.
- [x] Los pagos en efectivo deben referenciar una caja existente; los pagos bancarios no pueden alterar el arqueo mediante un identificador de caja.
- [ ] Falta verificar en ejecución compras de contado, pagos parciales, arqueo y sincronización. No se ejecutaron pruebas.


### Validación estática — gastos y caja

- [x] El servidor exige concepto no vacío (máximo 80 caracteres), monto entero positivo, fecha válida y medio de pago permitido al registrar o modificar gastos.
- [x] Un gasto en efectivo debe referenciar una caja vigente; un gasto bancario no puede asociarse a la caja para alterar el arqueo.
- [x] Encargados y cajeros solo pueden imputar el gasto a una caja de su propio usuario; el administrador conserva acceso general.
- [ ] Falta verificar en ejecución el arqueo con gastos, pagos a proveedores y cierres simultáneos. No se ejecutaron pruebas.


### Protección adicional — turnos y arqueos de caja

- [x] Los usuarios no administradores solo pueden crear y modificar turnos de caja propios; se aplica a cajeros y encargados.
- [x] Al abrir una caja, el servidor valida propietario, fecha y fondo inicial no negativo.
- [x] Al cerrar, el servidor impide cambiar el propietario, la fecha/fondo de apertura o volver a modificar una caja ya cerrada.
- [x] El cierre exige fecha válida, efectivo contado entero no negativo, valores de arqueo numéricos coherentes y el usuario autenticado como responsable del cierre.
- [ ] Falta verificar en ejecución apertura/cierre concurrente y arqueos con varios medios de pago. No se ejecutaron pruebas.


### Integridad del arqueo — movimientos posteriores al cierre

- [x] El servidor rechaza pagos a proveedores asociados a una caja cerrada.
- [x] El servidor rechaza gastos asociados a una caja cerrada.
- [x] Para pagos/gastos en efectivo, usuarios no administradores solo pueden usar una caja propia; se valida en servidor aunque la solicitud se envíe manualmente.
- [ ] Falta verificar en ejecución la secuencia de cierre y sincronización diferida. No se ejecutaron pruebas.

- [x] Los cobros de clientes en efectivo se rechazan si la caja está cerrada o pertenece a otro usuario no administrador.


### Automatización de respaldo externo

- [x] En Windows, detectar cada 10 minutos unidades extraíbles con etiqueta exacta `SAINEI_BACKUP` y copiar los respaldos a `SAINEI-RESPALDOS`.
- [x] Verificar tamaño de los archivos copiados y registrar incidencias en `servidor.log`.
- [ ] Verificar físicamente detección, copia y restauración con una unidad USB de prueba en el equipo de instalación. No se ejecutaron pruebas.


### Instalación y respaldo automatizados

- [x] Agregar instalador guiado Windows con instalación de Node.js LTS mediante `winget` cuando no esté disponible, validación de versión y preparación de carpeta de datos.
- [x] La primera ejecución del servidor crea automáticamente la base SQLite y las tablas requeridas.
- [x] Detectar unidades extraíbles con etiqueta `SAINEI_BACKUP` y sincronizar respaldos locales a la unidad externa cada 10 minutos, con verificación de tamaño.
- [ ] Verificar instalación y detección de USB en equipo Windows real; confirmar copia y restauración aislada. No se ejecutaron pruebas.
- [ ] Completar instalación silenciosa como servicio de Windows y apertura automática del navegador, si se decide que el servidor deba arrancar con Windows sin dejar una consola abierta.


### Inicio automático de Windows

- [x] Agregar tarea programada por usuario para iniciar el servidor SAINEI POS en segundo plano al iniciar sesión en Windows.
- [x] El instalador espera disponibilidad del puerto local y abre el navegador cuando el servidor responde.
- [x] Agregar registro de errores de inicio del proceso en la carpeta de datos.
- [ ] Verificar la tarea programada y el reinicio real en una PC Windows del comercio. No se ejecutaron pruebas.


### Estado actualizado del paquete local — 23/11/2026

- [x] El instalador principal `1-INSTALAR.bat` delega al instalador guiado.
- [x] El instalador valida Node.js 22.13+, intenta instalar Node.js LTS con winget, crea la carpeta permanente de datos, registra el inicio automático y genera el acceso directo del Escritorio.
- [x] El inicio manual y el automático configuran `SAINEI_LOCAL_MODE=1` y utilizan `%LOCALAPPDATA%\\SAINEI-POS\\datos`.
- [x] Se actualizó la verificación estática del paquete para comprobar que los dos caminos de inicio usan la misma ruta y que el instalador no borra los datos.
- [ ] No se ejecutaron pruebas funcionales ni de instalación. La validación real queda para el usuario.
- [ ] No hay un instalador MSI/EXE firmado; la distribución inicial es la carpeta completa del proyecto con sus archivos BAT/PowerShell.
- [ ] No existe emisión comercial offline de claves por cliente. El modo local está diseñado actualmente sin activación. No se incluye una clave privada en el repositorio.


### Validación adicional — integridad de importes de devolución

- [x] El servidor valida que cada devolución nueva tenga identificador, fecha, medio permitido e importe coherente con las líneas devueltas y el descuento de la venta.
- [x] El importe enviado por el navegador ya no se acepta como dato confiable: se recalcula en el servidor antes de sincronizar la devolución.
- [ ] Falta prueba funcional aislada de devoluciones parciales/totales y conciliación contable. No se ejecutaron pruebas.
