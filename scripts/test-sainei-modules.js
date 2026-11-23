'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const files = fs.readdirSync(process.cwd()).filter((f) => /^sainei-mod-[a-z0-9_-]+\\.js$/i.test(f)).sort();
if (!files.length) throw new Error('No se encontraron módulos SAINEI.');
const registered = [];
const window = { SAINEI_POS_MODULES: [] };
for (const file of files) {
  const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  vm.runInNewContext(source, { window, console }, { filename: file, timeout: 3000 });
}
const api = {
  addTab(spec) {
    if (!spec || !/^[a-z][a-z0-9_-]{1,30}$/i.test(spec.id)) throw new Error('ID de pestaña inválido');
    if (!spec.label || typeof spec.render !== 'function') throw new Error('Definición de pestaña incompleta: ' + spec.id);
    if (registered.some((x) => x.id === spec.id)) throw new Error('ID duplicado: ' + spec.id);
    registered.push(spec);
  }
};
for (const mod of window.SAINEI_POS_MODULES) {
  if (!mod || typeof mod.init !== 'function') throw new Error('Módulo sin init válido');
  mod.init(api);
}
if (registered.length !== files.length) throw new Error('No todos los módulos registraron una pestaña.');
console.log('OK: ' + files.length + ' módulos cargados; pestañas: ' + registered.map((x) => x.id).join(', '));
