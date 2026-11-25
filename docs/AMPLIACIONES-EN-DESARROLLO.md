# SAINEI POS — ampliaciones en desarrollo

Rama: `sainei-pos-finalizacion-independiente`

Estas ampliaciones son aditivas y no reemplazan los archivos ni la versión principal.

## Módulos añadidos

- **Cuentas por cobrar** (`sainei-mod-cuentas-cobrar.js`): antigüedad de saldos por cliente, pagos aplicados de más antiguo a más reciente, deuda vencida y exportación CSV.
- **Arqueos X/Z** (`sainei-mod-arqueos-xz.js`): consulta de caja abierta, cierres históricos, efectivo esperado/contado, diferencias y exportación CSV.
- **Informes +** (`sainei-mod-informes-plus.js`): ventas por período, costo de mercadería, margen bruto estimado, gastos, resultado estimado, desglose de IVA registrado, medios de pago, productos más vendidos y exportación CSV.
- **Fiscal (opcional)** (`sainei-mod-fiscal-preparacion.js`): sección administrativa deshabilitada con requisitos previos. No emite comprobantes ni se conecta a DNIT.
- **Conteo stock** (`sainei-mod-conteo-stock.js`): búsqueda de productos, carga de cantidad física, cálculo de diferencia y aplicación confirmada como movimiento de ajuste. Registra el usuario en auditoría.

## Acceso

Ambos módulos están disponibles para usuario principal y encargado. No se muestran al cajero.

## Validación automática

Se agregó un flujo de GitHub Actions que revisa la sintaxis JavaScript de todos los módulos adicionales y del servidor en cada actualización de esta rama. Esta verificación no reemplaza pruebas de funcionamiento con ventas y datos de prueba.

## Límites conocidos

- El informe de IVA es informativo y no reemplaza una liquidación ni una factura fiscal.
- El resultado estimado equivale a ventas menos costo de mercadería y gastos registrados; no contempla otros costos que el comercio no haya cargado.
- El conteo modifica el stock solo después de confirmar cada producto; el movimiento queda registrado en el historial existente.
- Estos módulos todavía requieren pruebas funcionales en una instalación de prueba con datos de ejemplo antes de considerarse listos para producción.

## Pendientes del proyecto

Pagos divididos, devoluciones/cambios, ventas suspendidas, promociones/cupones, pruebas de recuperación y persistencia de datos, empaquetado de escritorio y publicación móvil.
