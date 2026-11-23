# SAINEI POS — Procedimiento de respaldo y recuperación

Este procedimiento aplica a la instalación local Windows descrita en `docs/INICIO-SIN-COSTO-WINDOWS.md`. Está pensado para el administrador del comercio. No reemplaza una prueba de restauración en una copia aislada.

## 1. Dónde se guardan los datos

Con el iniciador oficial, la base principal está en:

`%LOCALAPPDATA%\SAINEI-POS\datos\sainei.db`

Las copias automáticas y manuales están en:

`%LOCALAPPDATA%\SAINEI-POS\datos\copias\`

No mover, renombrar ni reemplazar la base principal mientras SAINEI POS está funcionando. No guardar la única copia en la misma computadora.

## 2. Antes de actualizar el programa

1. Avisar a todos los cajeros que deben terminar sus operaciones y cerrar sesión.
2. Confirmar que no haya ventas pendientes de sincronizar con el servidor.
3. Desde el usuario administrador, abrir la sección de copias de seguridad y crear una copia manual.
4. Esperar la confirmación y comprobar que la copia figure en la lista.
5. Conectar una memoria USB o disco externo.
6. Ejecutar desde la carpeta del programa:

   `respaldar-sainei-pos-windows.bat E:\SAINEI-RESPALDOS`

   Cambiar la letra y carpeta por la unidad externa que realmente se utilice.
7. Comprobar que el archivo más reciente esté en la unidad externa y que su tamaño sea mayor que cero.
8. Retirar la unidad de forma segura.
9. Recién entonces actualizar los archivos del programa. No reemplazar la carpeta de datos.

## 3. Restaurar desde SAINEI POS

La restauración reemplaza los datos actuales por los de la copia elegida. Hacerlo únicamente con autorización del administrador principal.

1. Detener las operaciones y avisar a todos los usuarios.
2. Confirmar que se eligió la fecha correcta de la copia.
3. Crear y guardar fuera del equipo una copia adicional de la base actual antes de restaurar.
4. En el sistema, abrir la sección de copias y elegir la copia correcta.
5. Confirmar la restauración solo después de revisar la fecha y el nombre.
6. Iniciar sesión nuevamente; la restauración invalida las sesiones abiertas.
7. Revisar productos, existencias, últimas ventas, clientes, pagos y configuración del comercio.
8. No volver a vender hasta que el administrador confirme que los datos recuperados son los esperados.

## 4. Si la PC principal deja de funcionar

1. No reinstalar Windows ni formatear el disco antes de intentar recuperar los datos.
2. Recuperar la carpeta de datos desde el disco original o desde el respaldo externo.
3. Instalar Node.js 22.13 o superior en la PC de reemplazo.
4. Colocar el proyecto SAINEI POS en la PC nueva.
5. Recuperar la carpeta de datos en una ubicación segura y configurar `SAINEI_DATA` para apuntar a ella.
6. Iniciar el servidor y comprobar los datos con el administrador antes de habilitar las cajas.

La recuperación de una PC nueva debe realizarse con asistencia técnica si no se domina la configuración de variables de entorno y carpetas.

## 5. Frecuencia mínima recomendada

- Copia automática local: la aplicación intenta crear una por día.
- Copia externa: al cierre de cada jornada con ventas, y siempre antes de actualizar o restaurar.
- Conservación: mantener varias fechas recientes y al menos una copia desconectada del equipo.
- Prueba de recuperación: realizarla periódicamente en otra carpeta o equipo aislado, nunca sobre la base activa.

## 6. Límites conocidos

- El respaldo automático permanece en el mismo disco de la PC; no protege por sí solo contra robo, daño físico o ransomware.
- El archivo BAT copia los respaldos a la unidad externa, pero no verifica que SQLite pueda restaurarlos.
- La restauración no se considera comprobada hasta que se ensaya en un entorno aislado y se revisan los datos recuperados.
- El servicio gratuito de Render no debe utilizarse como repositorio de datos comerciales: no tiene disco persistente configurado para esta aplicación.
- No enviar archivos de base de datos por chats o correos públicos. Contienen información del negocio y de sus clientes.

## Lista de control para el administrador

- [ ] Confirmé la ruta de la base activa.
- [ ] Creé una copia manual antes de actualizar.
- [ ] Copié el respaldo a una unidad externa.
- [ ] Comprobé que el archivo externo existe y no está vacío.
- [ ] Guardé la unidad externa desconectada.
- [ ] La restauración fue ensayada en un entorno aislado.
- [ ] Revisé los datos recuperados antes de reanudar ventas.
