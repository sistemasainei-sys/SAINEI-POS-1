# SAINEI POS — Inicio sin costo en una PC Windows

## Objetivo

Permitir que el comercio use SAINEI POS en una computadora Windows sin Render ni plan de alojamiento. La computadora principal guarda la base SQLite del comercio y debe permanecer encendida y conectada a la red local mientras se usa el sistema. El iniciador Windows establece el modo local, por lo que no exige activación en línea ni conexión a Render. Las operaciones dentro del local solo necesitan que funcione la red local.

## Inicio

1. Copiar la carpeta completa del proyecto SAINEI POS a la computadora principal y no moverla después.
2. Ejecutar `1-INSTALAR.bat`. El instalador intenta instalar Node.js LTS si hace falta, registra el inicio automático del servidor y crea el acceso directo `SAINEI POS` en el Escritorio.
3. Abrir el acceso directo `SAINEI POS` o entrar a `http://localhost:8080`.
4. Para iniciar manualmente el servidor, ejecutar `iniciar-sainei-pos-windows.bat`.

El iniciador configura `SAINEI_DATA` en `%LOCALAPPDATA%\\SAINEI-POS\\datos`. La base SQLite y las copias automáticas quedan fuera de la carpeta del programa, por lo que una actualización de los archivos de la aplicación no las reemplaza.

## Acceso desde otras computadoras de la misma red

El servidor muestra las direcciones disponibles al iniciar. En las otras computadoras del mismo comercio, abrir la dirección LAN indicada por el servidor, usando el mismo puerto (8080). Todas las cajas usan la misma base de datos de esa computadora principal. No publicar esa dirección ni abrir el puerto del router hacia internet.

Para limitar el acceso entrante en Windows:

1. Configurar la red del comercio como perfil **Privado** en Windows.
2. Abrir PowerShell como administrador en la PC servidor.
3. Ejecutar `configurar-firewall-sainei.ps1` desde la carpeta del sistema.

El script permite TCP 8080 solo desde la subred local y el perfil Privado. No crea reglas públicas ni reenvía puertos del router. Si la red no es Privada, la regla no habilitará el acceso.

## Actualizar SAINEI POS conservando los datos

1. Descarga y extrae la nueva versión completa en otra carpeta.
2. En la computadora principal, cierra las cajas y ejecuta `ACTUALIZAR-SAINEl-POS.bat` desde la instalación actual.
3. Escribe la ruta de la carpeta extraída cuando el programa la solicite.
4. El actualizador detiene la tarea automática solo si estaba activa y el proceso del servidor, guarda una copia de `%LOCALAPPDATA%\\SAINEI-POS\\datos` en `%LOCALAPPDATA%\\SAINEI-POS\\actualizaciones` y copia los archivos del programa.
5. No reemplaza `datos`, `datos-prueba`, `.git`, `node_modules`, `.env` ni `.env.local`.

La copia previa se conserva aunque falle la copia de archivos. Al finalizar o si ocurre un error, el actualizador intenta reactivar la tarea automática únicamente si estaba ejecutándose antes de actualizar; si estaba detenida, conserva ese estado. El origen y el destino deben ser carpetas independientes. No ejecutar actualizaciones con cajas en uso. Después de actualizar, el administrador debe comprobar manualmente que el sistema inicia y que aparecen sus datos. No se hace restauración automática ni se garantiza la actualización hasta completar esa comprobación.

## Copias externas

El servidor crea copias automáticas locales en `%LOCALAPPDATA%\\SAINEI-POS\\datos\\copias`. Para llevarlas a una memoria USB o disco externo:

1. Conectar la unidad externa.
2. Ejecutar `respaldar-sainei-pos-windows.bat` pasando la carpeta de destino, por ejemplo `respaldar-sainei-pos-windows.bat E:\\SAINEI-RESPALDOS`.
3. Esperar el mensaje de finalización y retirar la unidad de forma segura.

También se puede definir la variable `SAINEI_BACKUP_DEST` con la ruta de destino. El script copia únicamente archivos de respaldo `.db`; no borra archivos del destino. La restauración desde una copia debe hacerse desde la función de respaldos del sistema, no reemplazando archivos mientras el servidor está activo.

## Límites importantes

- Este modo no usa Render ni una base de datos externa: las ventas y demás datos quedan en la computadora principal de ese comercio.
- Cada comercio debe tener su propia instalación y su propia carpeta de datos. No compartir la misma base entre comercios.
- La computadora principal debe estar encendida; si se apaga, las demás computadoras no podrán operar.
- El acceso desde fuera del local requiere una VPN o túnel autenticado configurado por separado. No está habilitado por estos archivos.
- Las copias externas deben guardarse en una unidad separada y mantenerse bajo control del administrador. Este script no verifica una restauración.
- No usar el enlace gratuito de Render para ventas reales: ese servicio puede suspenderse por inactividad y su disco no es persistente.

## Alcance

El instalador intenta instalar Node.js LTS si hace falta y detecta automáticamente servidor/caja cliente en la LAN. No configura VPN, no configura impresoras y no publica el sistema en internet. Tampoco habilita modo sin conexión: las computadoras cliente necesitan conexión con la computadora servidor para confirmar operaciones.


## Inicio automático al entrar a Windows

Ejecutar una vez `1-INSTALAR.bat` (que llama a `instalar-sainei-pos-windows.bat`). El instalador registra una tarea programada para iniciar SAINEI POS en segundo plano al iniciar sesión con el mismo usuario de Windows y abre el navegador cuando el puerto 8080 responde. La PC servidor debe permanecer encendida y con esa sesión abierta durante la operación. Para iniciar manualmente, ejecutar `iniciar-sainei-pos-windows.bat`. Para revisar fallos, consultar `servidor.log` y `servidor-inicio.log` en `%LOCALAPPDATA%\SAINEI-POS\datos`.
