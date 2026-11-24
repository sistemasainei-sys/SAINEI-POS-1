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
if (!updater.includes('Start-ScheduledTask') || !updater.includes('updateSucceeded')) {
  throw new Error('El actualizador debe intentar reactivar el servidor si la actualizacion falla.');
}
if (!server.includes("process.env.SAINEI_LOCAL_MODE === '1'")) {
  throw new Error('El servidor debe reconocer la modalidad local configurada por los lanzadores.');
}
for (const file of ['2-Abrir-Caja.bat', 'Conectar-desde-otra-PC.bat', 'respaldar-sainei-pos-windows.bat']) read(file);

console.log('OK: estructura estatica de instalacion, inicio local, actualizacion y conservacion de datos.');
