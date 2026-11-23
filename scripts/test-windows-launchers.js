'use strict';
const fs = require('node:fs');
const launchers = ['Iniciar-Servidor.bat', 'Iniciar-Servidor-PRUEBA.bat'];
for (const file of launchers) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('%~dp0server.js')) throw new Error(file + ': debe iniciar server.js desde la carpeta raíz.');
  if (file === 'Iniciar-Servidor.bat' && !text.includes('where node')) throw new Error('El lanzador principal debe detectar Node.js antes de reiniciar el servidor.');
  if (text.includes('servidor\\server.js')) throw new Error(file + ': conserva una ruta antigua inexistente.');
}
const install = fs.readFileSync('1-INSTALAR.bat', 'utf8');
for (const file of ['servidor-oculto.vbs', 'Iniciar-Servidor.bat', '2-Abrir-Caja.bat']) {
  if (!fs.existsSync(file)) throw new Error('Falta un archivo necesario para instalar: ' + file);
}
if (/rmdir\s+\/s\s+\/q\s+.*datos|del\s+\/q\s+.*sainei\.db/i.test(install)) {
  throw new Error('El instalador no debe borrar la base de datos ni la carpeta de datos.');
}
console.log('OK: lanzadores Windows apuntan al servidor correcto y el instalador conserva los datos.');
