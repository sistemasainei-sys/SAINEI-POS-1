# SAINEI POS

# Compatibilidad de dispositivos

- **Servidor principal:** Windows 10 actualizado o Windows 11.
- **Cajas y consultas:** Windows, Mac, iPhone, iPad, Android y tablets mediante navegador moderno.
- Los dispositivos cliente deben conectarse a la misma red local que la PC servidor e iniciar sesión con su propio usuario.
- Mac y dispositivos móviles son clientes web en esta versión; el servidor local no se instala en ellos.
- El acceso desde fuera del comercio requiere HTTPS y acceso remoto seguro; no abrir puertos del router.
- La interfaz incluye diseño adaptable para pantallas pequeñas. La compatibilidad final debe confirmarse con pruebas en equipos reales.

La matriz completa y los criterios de prueba están en [docs/COMPATIBILIDAD-PLATAFORMAS.md](docs/COMPATIBILIDAD-PLATAFORMAS.md).


Sistema de punto de venta web para operar con un servidor central y varias cajas dentro de la misma red.

## Modalidad local: sin Render ni pago de alojamiento

SAINEI POS está preparado para guardar los datos comerciales en la computadora principal de cada comercio, usando una base SQLite local (`sainei.db`). **No necesita Render ni una base de datos en la nube para registrar ventas.** Cada comercio instala su propia copia y mantiene sus propios datos.

- La primera computadora instalada, si no encuentra otro servidor SAINEI POS activo en la red, queda configurada automáticamente como servidor y guarda la base de datos del comercio.
- Al instalar en otra computadora con el servidor encendido y en la misma red privada, el instalador detecta el servidor por LAN y la configura como caja cliente, sin crear otra base de datos comercial.
- Las cajas cliente guardan la dirección detectada y vuelven a buscar el servidor si cambia su IP. Si el servidor está apagado durante la instalación inicial, la computadora se configura como servidor; por eso instalar las cajas con la PC principal encendida.
- El servidor anuncia su presencia por UDP 45808 y el firewall privado permite TCP 9000 y UDP 45808 únicamente desde la subred local.
- Para operar dentro del local, basta con que la computadora principal y la red local estén funcionando; no se necesita internet para las operaciones locales.
- Si la computadora principal se apaga, las otras cajas no pueden operar hasta que vuelva a encenderse.
- Node.js 22.13 o superior es requisito únicamente en la PC servidor; las cajas cliente detectadas no necesitan instalar Node.js. No requiere licencia, código de activación, pago de activación ni conexión con Render.
- Se recomienda una unidad externa para copias de seguridad.

## Inicio en una computadora Windows

1. Copiar la carpeta completa del proyecto a la computadora principal y no moverla después.
2. Ejecutar `1-INSTALAR.bat`. Si no encuentra otro servidor SAINEI POS activo, esta PC queda como servidor principal; instala Node.js LTS si hace falta, prepara los datos y configura el inicio automático.
3. Abrir `SAINEI POS` desde el Escritorio, completar los datos del comercio, crear el usuario administrador y guardar el código de recuperación en un lugar seguro.
4. Mantener encendida la PC servidor y conectada a la red privada del comercio.

Para iniciar manualmente el servidor, usar `iniciar-sainei-pos-windows.bat`. Los datos se guardan en `%LOCALAPPDATA%\\SAINEI-POS\\datos`, fuera de la carpeta del programa.

El iniciador guarda la base SQLite en `%LOCALAPPDATA%\SAINEI-POS\datos`, separada de los archivos del programa. No mover, borrar ni reemplazar esa carpeta al actualizar la aplicación.

## Conectar otras computadoras automáticamente

1. Conectar la nueva PC a la misma red privada del comercio, con la PC servidor encendida.
2. Copiar la misma carpeta completa del programa a esa PC.
3. Ejecutar `Conectar-desde-otra-PC.bat` o `1-INSTALAR.bat`.
4. El instalador encuentra el servidor por la red, guarda su dirección y crea el acceso directo `SAINEI POS`. No instala Node.js ni crea otra base de datos comercial.
5. Abrir el acceso directo e iniciar sesión con el usuario de esa caja.

Si la detección no funciona, verificar que Windows tenga la red marcada como Privada y que el firewall permita TCP 9000 y UDP 45808 desde la subred local. No abrir puertos del router ni exponer el servidor directamente a internet.

## Actualizar el programa sin borrar datos

1. Descarga y extrae la carpeta completa de la nueva versión en una ubicación temporal.
2. En la PC principal, cierra las cajas abiertas y ejecuta `ACTUALIZAR-SAINEl-POS.bat` desde la instalación actual.
3. Indica la ruta de la carpeta extraída. El actualizador detiene la tarea automática solo si estaba activa y el proceso del servidor, copia la carpeta de datos a `%LOCALAPPDATA%\\SAINEI-POS\\actualizaciones` y reemplaza solo los archivos del programa.
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

- `1-INSTALAR.bat`: instalador principal de Windows; configura Node.js si hace falta, detecta automáticamente servidor/caja cliente y prepara inicio automático o acceso al servidor según corresponda.
- `descubrir-servidor-sainei.ps1`: detección automática del servidor SAINEI POS en la red local.
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

El instalador configura una tarea programada para iniciar el servidor SAINEI POS al iniciar sesión en la cuenta de Windows que realizó la instalación. El servidor se ejecuta en segundo plano y el instalador espera hasta 30 segundos a que responda en el puerto 9000 para abrir `http://localhost:9000`. Los datos permanecen en `%LOCALAPPDATA%\SAINEI-POS\datos`. Si el servidor no responde, revisar `servidor.log` y `servidor-inicio.log` dentro de esa carpeta. Para que otras computadoras operen, la PC principal debe permanecer encendida y el usuario de Windows debe mantener su sesión iniciada.
