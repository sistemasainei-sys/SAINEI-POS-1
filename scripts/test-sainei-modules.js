'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const files = fs.readdirSync(process.cwd()).filter((f) => /^sainei-mod-[a-z0-9_-]+\.js$/i.test(f)).sort();
if (!files.length) throw new Error('No se encontraron módulos SAINEI.');
const registered = [];
const window = { SAINEI_POS_MODULES: [], confirm: () => false };
for (const file of files) {
  const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  vm.runInNewContext(source, { window, console, Date, Number, String, Math, URL, Blob }, { filename: file, timeout: 3000 });
}
const state = {
  clients: [], sales: [], payments: [], expenses: [], spay: [], shifts: [],
  products: [], moves: [], purchases: [], budgets: [], users: [],
};
const api = {
  state: () => state,
  user: () => ({ id: 1, role: 'admin' }),
  addAction(name, fn) {
    if (!/^[a-z][a-z0-9_-]{1,40}$/i.test(name) || typeof fn !== 'function') throw new Error('Acción inválida: ' + name);
  },
  addTab(spec) {
    if (!spec || !/^[a-z][a-z0-9_-]{1,30}$/i.test(spec.id)) throw new Error('ID de pestaña inválido');
    if (!spec.label || typeof spec.render !== 'function') throw new Error('Definición de pestaña incompleta: ' + spec.id);
    if (registered.some((x) => x.id === spec.id)) throw new Error('ID duplicado: ' + spec.id);
    registered.push(spec);
  },
  escape: (v) => String(v).replace(/[&<>"']/g, ''),
  money: (v) => 'Gs. ' + v,
  round3: (v) => Math.round(v * 1000) / 1000,
  newId: () => 1,
  log: () => {},
  toast: () => {},
  save: () => Promise.resolve(true),
  refresh: () => {},
};
for (const mod of window.SAINEI_POS_MODULES) {
  if (!mod || typeof mod.init !== 'function') throw new Error('Módulo sin init válido');
  mod.init(api);
}
if (registered.length !== files.length) throw new Error('No todos los módulos registraron una pestaña.');
for (const tab of registered) {
  const sec = {
    html: '',
    set innerHTML(value) { this.html = value; },
    get innerHTML() { return this.html; },
    querySelector() { return { value: '', addEventListener() {} }; },
    querySelectorAll() { return []; },
  };
  tab.render(sec);
  if (!sec.innerHTML) throw new Error('El módulo no generó contenido: ' + tab.id);
}
console.log('OK: ' + files.length + ' módulos cargados, permisos registrados y renderizado inicial verificado: ' + registered.map((x) => x.id).join(', '));
