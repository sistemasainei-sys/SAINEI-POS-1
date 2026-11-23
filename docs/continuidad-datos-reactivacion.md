# SAINEI POS — continuidad de datos y reactivación

Requisito obligatorio de la versión multiempresa.

## Comportamiento esperado
- La identidad del comercio y sus datos se conservan independientemente del código de activación, de la versión del programa y de las actualizaciones.
- Renovar, reemplazar o volver a introducir un código de activación válido no puede crear un comercio nuevo, reiniciar la instalación ni borrar usuarios o registros.
- Después de una actualización, el propietario debe poder ingresar con el mismo usuario y PIN y recuperar todos sus productos, ventas, clientes, compras, gastos, movimientos, configuraciones y demás datos.
- El estado de suscripción/licencia se almacena separado de la identidad del comercio y de sus datos operativos.
- La autorización se vincula al comercio/contrato, no a una base de datos efímera ni a un identificador regenerado al desplegar.
- Las migraciones deben ser aditivas, transaccionales y conservar al administrador existente; no deben ejecutar seeds que sustituyan datos reales.
- Las restauraciones deben ser por comercio y nunca afectar a otros comercios.

## Pruebas de aceptación obligatorias
1. Crear un comercio, administrador, productos, ventas, clientes, compras y gastos.
2. Cerrar sesión, reiniciar el servicio y volver a iniciar: todo permanece.
3. Actualizar el programa y aplicar migraciones: el administrador y todos los registros permanecen.
4. Renovar/reintroducir un código válido: se mantiene el mismo comercio, login y datos.
5. Probar código vencido/inválido: bloquear el acceso según política sin borrar ni reinicializar datos.
6. Restaurar copia de ese comercio: recupera solo sus datos y no altera los demás.
7. Verificar que un comercio recién creado no ve datos de los existentes.

## Incidente observado durante pruebas manuales
La pantalla «Creá el usuario principal» aparece cuando el endpoint de información del servidor informa que no hay administrador activo. No debe interpretarse como permiso para crear otro usuario ni como prueba de que los datos anteriores desaparecieron. Antes de continuar, verificar que el servicio apunta a la misma base PostgreSQL persistente y que el administrador existente está asociado al comercio correcto. No pedir al usuario que vuelva a configurar el dueño hasta completar esa comprobación.
