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

1. Copiar la carpeta completa del proyecto a la computadora principal y no moverla después.
2. Ejecutar `1-INSTALAR.bat` (usa `instalar-sainei-pos-windows.bat`). Si falta Node.js 22.13 o superior, intenta instalar Node.js LTS con `winget`.
3. El instalador configura el inicio automático al iniciar sesión en Windows y crea el acceso directo `SAINEI POS` en el Escritorio.
4. Abrir `SAINEI POS` desde el Escritorio o entrar a `http://localhost:8080`.
5. Crear el usuario principal y guardar el código de recuperación en un lugar seguro.

Para iniciar manualmente el servidor, usar `iniciar-sainei-pos-windows.bat`. Los datos se guardan en `%LOCALAPPDATA%\\SAINEI-POS\\datos`, fuera de la carpeta del programa.

El iniciador guarda la base SQLite en `%LOCALAPPDATA%\SAINEI-POS\datos`, separada de los archivos del programa. No mover, borrar ni reemplazar esa carpeta al actualizar la aplicación.

## Conectar otras computadoras

1. Conectar todas las computadoras a la misma red privada del comercio.
2. En la PC servidor, consultar la dirección LAN que aparece en la ventana del servidor o en `direcciones.txt` dentro de la carpeta de datos.
3. Desde cada caja, abrir `http://DIRECCION-LAN-DEL-SERVIDOR:8080`.
4. Iniciar sesión con el usuario correspondiente.

Configurar el firewall de Windows con `configurar-firewall-sainei.ps1`, ejecutándolo como administrador y solo después de confirmar que la red está marcada como Privada. No abrir el puerto 8080 en el router ni exponerlo directamente a internet.

## Actualizar el programa sin borrar datos

1. Descarga y extrae la carpeta completa de la nueva versión en una ubicación temporal.
2. En la PC principal, cierra las cajas abiertas y ejecuta `ACTUALIZAR-SAINEl-POS.bat` desde la instalación actual.
3. Indica la ruta de la carpeta extraída. El actualizador detiene la tarea automática y el proceso del servidor, copia la carpeta de datos a `%LOCALAPPDATA%\\SAINEI-POS\\actualizaciones` y reemplaza solo los archivos del programa.
4. La carpeta `datos`, la base `sainei.db`, las copias, `.env` y `.env.local` quedan excluidos de la copia de archivos.
5. Si la copia previa no contiene `sainei.db`, el actualizador cancela antes de copiar la nueva versión.

No actualices mientras haya cajas registrando operaciones. Conserva la copia previa hasta confirmar manualmente que la nueva versión abre y muestra los datos. El actualizador no ejecuta pruebas funcionales ni restaura automáticamente una copia.

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

- `1-INSTALAR.bat`: instalador principal de Windows; configura Node.js si hace falta, el inicio automático y el acceso directo.
- `ACTUALIZAR-SAINEl-POS.bat`: actualizador guiado que respalda los datos y reemplaza solo los archivos del programa.
- `iniciar-sainei-pos-windows.bat`: inicio manual del servidor con datos separados del programa.
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

Esta rama contiene el código y la preparación de instalación local. La instalación, restauración, periféricos y funcionamiento en equipos reales quedan pendientes de la prueba del usuario. No se debe considerar validada para ventas reales hasta completar esa prueba.


## Respaldo USB automático en Windows

SAINEI POS detecta cada 10 minutos las unidades extraíbles cuyo nombre de volumen sea exactamente `SAINEI_BACKUP` y sincroniza allí las copias `.db` en la carpeta `SAINEI-RESPALDOS`. También lo intenta al iniciar el servidor. Solo se utiliza una unidad marcada expresamente para este fin; no se copian datos a cualquier memoria USB. Para activarlo, asignar una vez esa etiqueta desde Windows sin formatear la unidad. Revisar `servidor.log` para confirmar la sincronización.


## Instalador guiado de Windows

Ejecutar `1-INSTALAR.bat` (o directamente `instalar-sainei-pos-windows.bat`). Si Node.js no está instalado, el instalador intenta instalar Node.js LTS desde Windows Package Manager (`winget`), valida la versión mínima y prepara la carpeta permanente de datos antes de iniciar el servidor. Si `winget` no está disponible, indica instalar Node.js desde el sitio oficial. La primera ejecución crea automáticamente `sainei.db` y sus tablas; la configuración inicial del comercio y el alta del administrador se completan desde la pantalla de inicio.


## Inicio automático con Windows

El instalador configura una tarea programada para iniciar el servidor SAINEI POS al iniciar sesión en la cuenta de Windows que realizó la instalación. El servidor se ejecuta en segundo plano y el instalador espera hasta 30 segundos a que responda en el puerto 8080 para abrir `http://localhost:8080`. Los datos permanecen en `%LOCALAPPDATA%\SAINEI-POS\datos`. Si el servidor no responde, revisar `servidor.log` y `servidor-inicio.log` dentro de esa carpeta. Para que otras computadoras operen, la PC principal debe permanecer encendida y el usuario de Windows debe mantener su sesión iniciada.
