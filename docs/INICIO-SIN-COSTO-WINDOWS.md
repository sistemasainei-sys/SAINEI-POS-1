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

## Acceso remoto seguro desde fuera del comercio

El acceso remoto recomendado es mediante **Tailscale (VPN privada)**. No se debe publicar el puerto 9000 directamente en internet ni configurar reenvío de puertos en el router.

1. Instala Tailscale en la PC principal y en cada dispositivo remoto autorizado.
2. Inicia sesión en la misma red privada de Tailscale (tailnet) y verifica que ambos dispositivos se vean entre sí.
3. En la PC principal, abre PowerShell como administrador y ejecuta `configurar-acceso-remoto-tailscale.ps1` desde la carpeta de SAINEI POS.
4. En el dispositivo remoto, abre `http://IP-TAILSCALE-DE-LA-PC-PRINCIPAL:9000` (usa la IP Tailscale real de la PC principal).
5. Inicia sesión en SAINEI POS con el usuario y clave del comercio.

El script crea una regla de Windows Firewall limitada a la interfaz Tailscale, TCP 9000 y el rango privado Tailscale `100.64.0.0/10`. El acceso queda además sujeto a la autenticación y permisos propios de SAINEI POS y a los dispositivos autorizados en Tailscale. Protege la cuenta Tailscale con autenticación multifactor y no compartas invitaciones ni dispositivos. Si Tailscale no está instalado o su interfaz no está activa, el script falla sin abrir el acceso.

Para retirar el acceso remoto, elimina la regla **SAINEI POS - Acceso remoto Tailscale** desde Firewall de Windows con seguridad avanzada. La regla de LAN privada sigue funcionando por separado.

## Funcionamiento sin internet

SAINEI POS guarda los datos en SQLite en la PC principal y no necesita conectarse a Render ni a un servicio externo para vender. **Si se corta internet pero el router/switch y la red local siguen funcionando, la PC principal y las cajas del comercio pueden seguir trabajando entre sí.** Los recursos esenciales de la interfaz se sirven desde el propio servidor local; el enlace externo de información de DNIT es solo una referencia.

Hay dos situaciones distintas:

- **Sin internet, con la red local activa:** las cajas siguen conectadas a la PC principal y pueden operar normalmente.
- **Sin conexión entre una caja y la PC principal (Wi-Fi/LAN caída o servidor apagado):** esa caja no puede confirmar ventas ni sincronizar cambios. La pantalla de reconexión lo informa; no se guardan ventas falsas ni se crea una segunda base independiente en cada caja.

En una sola PC, el sistema se usa desde `http://localhost:9000`. Para varias cajas, mantén activa la red local aunque no haya internet. La conexión remota por Tailscale sí necesita que ambos extremos tengan internet.

## Datos, copias y actualizaciones

- Base de datos: `%LOCALAPPDATA%\SAINEI-POS\datos\sainei.db`.
- Copias automáticas: `%LOCALAPPDATA%\SAINEI-POS\datos\copias`.
- Usa `respaldar-sainei-pos-windows.bat` para copiar respaldos a una unidad externa.
- Antes de actualizar, cierra las cajas y ejecuta `ACTUALIZAR-SAINEl-POS.bat`. El actualizador crea una copia de seguridad antes de reemplazar archivos.
- El paquete Windows debe descargarse de una compilación exitosa de GitHub Actions correspondiente al commit actual de `main`; no reutilices paquetes de compilaciones anteriores.

## Seguridad y límites

- Configura la red de Windows como **Privada**. El firewall permite el acceso LAN únicamente desde la subred local.
- No abras el puerto 9000 en el router ni publiques la dirección LAN en internet.
- El acceso remoto solo se habilita después de instalar y autorizar Tailscale y ejecutar el script específico.
- Cada comercio debe tener su propia instalación y base de datos.
- La instalación automática de Node.js requiere Windows Package Manager (`winget`) e internet. Si el equipo no tiene winget, instala Node.js LTS 22.13 o superior y vuelve a ejecutar el instalador.

## Alcance de validación

Las pruebas automatizadas verifican el servidor local, persistencia, operaciones y reglas de red configuradas por código. La validación final de Tailscale en dispositivos reales, impresoras/periféricos y de dos computadoras físicas debe hacerse en el hardware de destino; no se debe presentar como probada si no se realizó.
