# SAINEI POS — Instalación local en Windows (sin licencia)

## Qué instala

- **Sin licencia, activación, pago recurrente ni conexión obligatoria a Render.**
- Una PC principal guarda la base SQLite del comercio en `%LOCALAPPDATA%\SAINEI-POS\datos\sainei.db`.
- Las demás computadoras del mismo local se conectan por la red privada a esa PC y trabajan sobre la misma base.
- Cada comercio instala su propia copia y conserva su propia base de datos independiente.
- El servidor se inicia al iniciar sesión en Windows mediante una tarea programada.

## Instalación

1. Descarga el paquete **SAINEI-POS-Windows** generado por la compilación oficial y extrae toda la carpeta en la PC principal.
2. Ejecuta `1-INSTALAR.bat` y acepta los permisos de Windows cuando los solicite.
3. El instalador identifica Windows 10/11, instala Node.js LTS si falta (requiere `winget` e internet durante esa instalación), prepara la carpeta de datos, configura el inicio automático y el firewall para la red privada.
4. Abre el acceso directo **SAINEI POS** del Escritorio.

No muevas ni elimines la carpeta de programa después de instalar. Los datos quedan separados en la carpeta de datos indicada arriba.

## Agregar cajas en otras computadoras

1. Conecta la PC principal y las cajas a la misma red local.
2. En cada PC adicional, extrae el mismo paquete y ejecuta `1-INSTALAR.bat`.
3. El instalador busca el servidor SAINEI POS por la red local. Si lo detecta, configura esa PC como caja cliente y crea el acceso directo.
4. Todas las cajas usan la base SQLite de la PC principal. **No copies la base de datos a las cajas ni compartas una base entre comercios.**

La PC principal debe permanecer encendida, con la sesión de Windows iniciada y conectada a la red. Si se apaga o pierde conexión, las cajas no podrán operar hasta que vuelva.

## Datos, copias y actualizaciones

- Base de datos: `%LOCALAPPDATA%\SAINEI-POS\datos\sainei.db`.
- Copias automáticas: `%LOCALAPPDATA%\SAINEI-POS\datos\copias`.
- Usa `respaldar-sainei-pos-windows.bat` para copiar respaldos a una unidad externa.
- Antes de actualizar, cierra las cajas y ejecuta `ACTUALIZAR-SAINEl-POS.bat`. El actualizador crea una copia de seguridad antes de reemplazar archivos.

## Seguridad y límites

- Configura la red de Windows como **Privada**. El firewall permite el acceso únicamente desde la subred local.
- No abras el puerto 8080 en el router ni publiques la dirección LAN en internet.
- El acceso remoto requiere una VPN configurada por separado.
- Los clientes necesitan conexión LAN con la PC principal; no es un modo desconectado.
- La instalación automática de Node.js requiere Windows Package Manager (`winget`) e internet. Si el equipo no tiene winget, instala Node.js LTS 22.13 o superior y vuelve a ejecutar el instalador.

## Alcance de validación

La automatización y las pruebas de código se ejecutan en CI de Windows. La validación final de impresoras/periféricos y de dos computadoras físicas en la red del comercio debe hacerse en el hardware de destino; no se debe presentar como probada si no se realizó.
