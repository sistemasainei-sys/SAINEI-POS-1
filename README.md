# SAINEI POS

Sistema de punto de venta web para operar con un servidor central y varias cajas dentro de la misma red.

## Modalidad local: sin Render ni pago de alojamiento

SAINEI POS está preparado para guardar los datos comerciales en la computadora principal de cada comercio, usando una base SQLite local (`sainei.db`). **No necesita Render ni una base de datos en la nube para registrar ventas.** Cada comercio instala su propia copia y mantiene sus propios datos.

- La computadora principal ejecuta el servidor y guarda la base de datos.
- Las demás cajas se conectan a esa computadora por la red local (Wi-Fi o cable).
- Para operar dentro del local, basta con que la computadora principal y la red local estén funcionando; no se necesita internet para las operaciones locales.
- Si la computadora principal se apaga, las otras cajas no pueden operar hasta que vuelva a encenderse.
- Node.js 22.13 o superior es requisito. La instalación local no exige código de activación ni conexión a Render.
- Se recomienda una unidad externa para copias de seguridad.

## Inicio en una computadora Windows

1. Instalar Node.js 22.13 o superior desde el sitio oficial.
2. Copiar la carpeta completa del proyecto a la computadora principal.
3. Ejecutar `iniciar-sainei-pos-windows.bat`.
4. Mantener abierta la ventana del servidor mientras se utilice el POS.
5. En la misma computadora, abrir `http://localhost:8080`.
6. Crear el usuario principal y guardar el código de recuperación en un lugar seguro.

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

- El POS requiere conexión con la computadora servidor para confirmar operaciones. Esto es conexión de red local, no conexión a Render. No incluye ventas offline cuando se pierde la conexión con la computadora principal.
- La operación multi-PC descrita es dentro de la red local; el acceso remoto seguro requiere configurar VPN o túnel autenticado.
- La conexión HTTP local no cifra el tráfico dentro de la LAN. Usar únicamente una red privada y confiable.
- La configuración de impresoras, lectores y balanzas depende de sus modelos y requiere ajuste en los equipos reales.
- No utilizar el servicio gratuito de Render para guardar datos comerciales reales: no tiene almacenamiento persistente configurado.
- No integrar sucursales ni facturación electrónica DNIT/SIFEN en esta versión.

## Estado de esta rama

Esta rama reúne funciones y preparación operativa adicionales, pero no equivale a una publicación final. Antes de usarla con ventas reales se debe completar la instalación en el equipo del comercio, configurar almacenamiento y respaldos externos, comprobar restauración y realizar las verificaciones de seguridad y periféricos correspondientes. No se ejecutaron pruebas como parte de estos cambios.


## Respaldo USB automático en Windows

SAINEI POS detecta cada 10 minutos las unidades extraíbles cuyo nombre de volumen sea exactamente `SAINEI_BACKUP` y sincroniza allí las copias `.db` en la carpeta `SAINEI-RESPALDOS`. También lo intenta al iniciar el servidor. Solo se utiliza una unidad marcada expresamente para este fin; no se copian datos a cualquier memoria USB. Para activarlo, asignar una vez esa etiqueta desde Windows sin formatear la unidad. Revisar `servidor.log` para confirmar la sincronización.


## Instalador guiado de Windows

Ejecutar `instalar-sainei-pos-windows.bat`. Si Node.js no está instalado, el instalador intenta instalar Node.js LTS desde Windows Package Manager (`winget`), valida la versión mínima y prepara la carpeta permanente de datos antes de iniciar el servidor. Si `winget` no está disponible, indica instalar Node.js desde el sitio oficial. La primera ejecución crea automáticamente `sainei.db` y sus tablas; la configuración inicial del comercio y el alta del administrador se completan desde la pantalla de inicio.


## Inicio automático con Windows

El instalador configura una tarea programada para iniciar el servidor SAINEI POS al iniciar sesión en la cuenta de Windows que realizó la instalación. El servidor se ejecuta en segundo plano y el instalador espera hasta 30 segundos a que responda en el puerto 8080 para abrir `http://localhost:8080`. Los datos permanecen en `%LOCALAPPDATA%\SAINEI-POS\datos`. Si el servidor no responde, revisar `servidor.log` y `servidor-inicio.log` dentro de esa carpeta. Para que otras computadoras operen, la PC principal debe permanecer encendida y el usuario de Windows debe mantener su sesión iniciada.
