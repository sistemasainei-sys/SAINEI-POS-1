'use strict';
const fs = require('node:fs');

function read(file) {
  if (!fs.existsSync(file)) throw new Error('Falta archivo requerido: ' + file);
  return fs.readFileSync(file, 'utf8');
}

const mainLauncher = read('1-INSTALAR.bat');
const installer = read('instalar-sainei-pos-windows.bat');
const manual = read('iniciar-sainei-pos-windows.bat');
const hidden = read('ejecutar-servidor-sainei.ps1');
const scheduled = read('configurar-inicio-automatico-sainei.ps1');
const firewallElevated = read('configurar-firewall-elevado.ps1');
const vbs = read('servidor-oculto.vbs');
const server = read('server.js');
const discovery = read('descubrir-servidor-sainei.ps1');
const clientLauncher = read('2-Abrir-Caja.bat');
const firewall = read('configurar-firewall-sainei.ps1');
const updaterBat = read('ACTUALIZAR-SAINEl-POS.bat');
const updater = read('actualizar-sainei-pos.ps1');

if (!mainLauncher.includes('instalar-sainei-pos-windows.bat')) {
  throw new Error('1-INSTALAR.bat debe delegar al instalador principal.');
}
if (!installer.includes('configurar-inicio-automatico-sainei.ps1') || !installer.includes('configurar-firewall-elevado.ps1')) {
  throw new Error('El instalador debe configurar el inicio automatico.');
}
if (!installer.includes('SAINEI-POS') || /rmdir\s+\/s\s+\/q\s+.*datos|del\s+\/q\s+.*sainei\.db/i.test(installer)) {
  throw new Error('El instalador debe conservar los datos comerciales.');
}
if (!manual.includes('SAINEI_LOCAL_MODE=1') || !manual.includes('SAINEI-POS\\datos')) {
  throw new Error('El inicio manual debe usar modo local y datos permanentes.');
}
if (!hidden.includes("SAINEI_LOCAL_MODE = '1'") || !hidden.includes('SAINEI-POS\\datos')) {
  throw new Error('El inicio automatico debe usar la misma modalidad y ruta de datos.');
}
if (!firewallElevated.includes('configurar-firewall-sainei.ps1') || !firewallElevated.includes('RunAs')) {
  throw new Error('El instalador debe solicitar elevacion para configurar el firewall privado.');
}
if (!scheduled.includes('ejecutar-servidor-sainei.ps1') || !scheduled.includes('AtLogOn')) {
  throw new Error('La tarea programada debe ejecutar el servidor al iniciar sesion.');
}
if (!vbs.includes('ejecutar-servidor-sainei.ps1') && !vbs.includes('Iniciar-Servidor.bat')) {
  throw new Error('El iniciador oculto debe delegar a un lanzador existente.');
}
if (!updaterBat.includes('actualizar-sainei-pos.ps1') || !updaterBat.includes('Source') || !updaterBat.includes('Target')) {
  throw new Error('El acceso de actualizacion debe solicitar la carpeta de origen y delegar al actualizador PowerShell.');
}
if (!updater.includes('datos-antes-de-actualizar-') || !updater.includes('sainei.db') || !updater.includes('robocopy.exe')) {
  throw new Error('El actualizador debe respaldar la base y copiar archivos del programa.');
}
if (!updater.includes("'datos'") || !updater.includes("'.env'") || !updater.includes("'.env.local'")) {
  throw new Error('El actualizador debe excluir datos y configuraciones locales.');
}
if (!updater.includes('Start-ScheduledTask') || !updater.includes('Stop-ScheduledTask') || !updater.includes('updateSucceeded') || !updater.includes("$scheduledTask.State -eq 'Running'") || !updater.includes('$taskWasRunning')) {
  throw new Error('El actualizador debe detener y reactivar el servidor solo si estaba ejecutandose antes de actualizar.');
}
if (!updater.includes('sourceFull.StartsWith($targetFull') || !updater.includes('targetFull.StartsWith($sourceFull')) {
  throw new Error('El actualizador debe impedir carpetas de origen y destino anidadas.');
}
if (!server.includes("process.env.SAINEI_LOCAL_MODE === '1'")) {
  throw new Error('El servidor debe reconocer la modalidad local configurada por los lanzadores.');
}
if (!server.includes("dgram = require('dgram')") || !server.includes('SAINEI_POS_DISCOVER_V1') || !server.includes('discovery.bind(45808')) {
  throw new Error('El servidor debe anunciarse para la deteccion automatica en LAN.');
}
if (!installer.includes('descubrir-servidor-sainei.ps1') || !installer.includes('cliente.url') || !installer.includes(':mantener_cliente') || installer.indexOf('descubrir-servidor-sainei.ps1') > installer.indexOf('where node')) {
  throw new Error('El instalador debe detectar cajas cliente antes de instalar dependencias del servidor.');
}
if (!installer.includes('servidor.local') || installer.indexOf('servidor.local') > installer.indexOf('cliente.url')) {
  throw new Error('El instalador debe conservar la identidad del servidor antes de intentar detectar otra PC.');
}
if (!discovery.includes('SAINEI_POS_DISCOVER_V1') || !discovery.includes('IPAddress]::Broadcast')) {
  throw new Error('El detector de LAN debe emitir la solicitud de descubrimiento.');
}
if (!clientLauncher.includes('cliente.url') || !clientLauncher.includes('descubrir-servidor-sainei.ps1')) {
  throw new Error('La caja cliente debe reconectar al servidor detectado.');
}
if (!firewall.includes('UDP -LocalPort 45808') || !firewall.includes('TCP -LocalPort')) {
  throw new Error('El firewall debe permitir el servicio y el descubrimiento solo en LAN privada.');
}
for (const file of ['2-Abrir-Caja.bat', 'Conectar-desde-otra-PC.bat', 'respaldar-sainei-pos-windows.bat']) read(file);

console.log('OK: estructura estatica de instalacion, inicio local, actualizacion y conservacion de datos.');
