# SAINEI POS

Sistema de punto de venta web para operar con un servidor central y varias cajas dentro de la misma red.

## Requisitos

- Windows 10/11 en la computadora que actuará como servidor.
- Node.js 22.13 o superior.
- Una conexión de red estable entre el servidor y las cajas.
- Una licencia SAINEI POS válida para activar la instalación.
- Espacio disponible y una unidad externa para copias de seguridad.

## Inicio en una computadora Windows

1. Instalar Node.js 22.13 o superior desde el sitio oficial.
2. Copiar la carpeta completa del proyecto a la computadora principal.
3. Ejecutar `iniciar-sainei-pos-windows.bat`.
4. Mantener abierta la ventana del servidor mientras se utilice el POS.
5. En la misma computadora, abrir `http://localhost:8080`.
6. Activar la instalación con el código de licencia válido.
7. Crear el usuario principal y guardar el código de recuperación en un lugar seguro.

El iniciador guarda la base SQLite en `%LOCALAPPDATA%\SAINEI-POS\datos`, separada de los archivos del programa. No mover, borrar ni reemplazar esa carpeta al actualizar la aplicación.

## Conectar otras computadoras

1. Conectar todas las computadoras a la misma red privada del comercio.
2. En la PC servidor, consultar la dirección LAN que aparece en la ventana del servidor o en `direcciones.txt` dentro de la carpeta de datos.
3. Desde cada caja, abrir `http://DIRECCION-LAN-DEL-SERVIDOR:8080`.
4. Iniciar sesión con el usuario correspondiente.

Configurar el firewall de Windows con `configurar-firewall-sainei.ps1`, ejecutándolo como administrador y solo después de confirmar que la red está marcada como Privada. No abrir el puerto 8080 en el router ni exponerlo directamente a internet.

## Copias de seguridad

- El servidor crea copias automáticas locales en la carpeta `copias` de los datos.
- El administrador también puede generar una copia manual desde el sistema.
- Para copiar los respaldos a una memoria USB, ejecutar:

```bat
respaldar-sainei-pos-windows.bat E:\SAINEI-RESPALDOS
```

- Mantener la unidad externa desconectada cuando no se esté realizando la copia.
- Antes de actualizar el programa, crear una copia manual y verificar que exista en la unidad externa.
- La guía completa de recuperación está en `docs/PROCEDIMIENTO-RESPALDO-RESTAURACION.md`.

Una copia no se considera recuperable hasta que se haya comprobado una restauración en un entorno aislado. No experimentar con la base real del comercio.

## Archivos y documentación

- `iniciar-sainei-pos-windows.bat`: inicia el servidor y separa los datos del programa.
- `respaldar-sainei-pos-windows.bat`: copia respaldos SQLite a otra unidad.
- `configurar-firewall-sainei.ps1`: limita el acceso al puerto local desde la subred privada.
- `docs/INICIO-SIN-COSTO-WINDOWS.md`: guía de instalación local.
- `docs/COMPATIBILIDAD-DISPOSITIVOS.md`: impresoras, lectores y balanzas.
- `docs/PROCEDIMIENTO-RESPALDO-RESTAURACION.md`: respaldo y recuperación.
- `docs/REVISION-SEGURIDAD-OPERACION.md`: controles y riesgos conocidos.
- `docs/PLAN-FINALIZACION-SAINEl-POS.md`: pendientes de finalización.

## Alcance y límites actuales

- El POS requiere conexión con el servidor para confirmar operaciones. No incluye ventas offline ni sincronización posterior.
- La operación multi-PC descrita es dentro de la red local; el acceso remoto seguro requiere configurar VPN o túnel autenticado.
- La conexión HTTP local no cifra el tráfico dentro de la LAN. Usar únicamente una red privada y confiable.
- La configuración de impresoras, lectores y balanzas depende de sus modelos y requiere ajuste en los equipos reales.
- No utilizar el servicio gratuito de Render para guardar datos comerciales reales: no tiene almacenamiento persistente configurado.
- No integrar sucursales ni facturación electrónica DNIT/SIFEN en esta versión.

## Estado de esta rama

Esta rama reúne funciones y preparación operativa adicionales, pero no equivale a una publicación final. Antes de usarla con ventas reales se debe completar la instalación en el equipo del comercio, configurar almacenamiento y respaldos externos, comprobar restauración y realizar las verificaciones de seguridad y periféricos correspondientes. No se ejecutaron pruebas como parte de estos cambios.


## Respaldo USB automático en Windows

SAINEI POS detecta cada 10 minutos las unidades extraíbles cuyo nombre de volumen sea exactamente `SAINEI_BACKUP` y sincroniza allí las copias `.db` en la carpeta `SAINEI-RESPALDOS`. También lo intenta al iniciar el servidor. Solo se utiliza una unidad marcada expresamente para este fin; no se copian datos a cualquier memoria USB. Para activarlo, asignar una vez esa etiqueta desde Windows sin formatear la unidad. Revisar `servidor.log` para confirmar la sincronización.
