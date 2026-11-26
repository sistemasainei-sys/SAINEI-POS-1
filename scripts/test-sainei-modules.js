'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const files = fs.readdirSync(process.cwd()).filter((f) => /^sainei-mod-[a-z0-9_-]+\.js$/i.test(f)).sort();
if (!files.length) throw new Error('No se encontraron módulos SAINEI.');
const registered = [];
const actions = {};
let openedModal = '';
const window = { SAINEI_POS_MODULES: [], confirm: () => false };
for (const file of files) {
  const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  vm.runInNewContext(source, { window, console, Date, Number, String, Math, URL, Blob }, { filename: file, timeout: 3000 });
}
const state = {
  clients: [{id:3,name:'Cliente prueba',phone:'0981'}], sales: [{id:9,clientId:3,total:25000,items:[],returns:[{amount:5000}]}], payments: [], expenses: [], spay: [{ id: 1, purchId: 7, amount: 20, method: 'banco' }], shifts: [],
  products: [], moves: [], suspendedSales: [], promotions: [], loyaltyRedemptions: [], purchases: [{ id: 7, supplier: 'Proveedor de prueba', total: 100, date: new Date().toISOString(), due: null, docNo: 'F-001', items: [] }], budgets: [], users: [],
};
const api = {
  state: () => state,
  user: () => ({ id: 1, role: 'admin' }),
  isAdmin: () => true,
  isServer: () => false,
  request: () => Promise.resolve({ rows: [] }),
  maxDiscount: () => 10,
  applyDiscount: () => true,
  cartSnapshot: () => ({ items: [], disc: 0, clientId: 0, pendingBudget: 0 }),
  clearCart: () => {},
  restoreCart: () => true,
  addAction(name, fn) {
    if (!/^[a-z][a-z0-9_-]{1,40}$/i.test(name) || typeof fn !== 'function') throw new Error('Acción inválida: ' + name);
    actions[name] = fn;
  },
  openModal(html) { openedModal = html; },
  closeModal() {},
  addTab(spec) {
    if (!spec || !/^[a-z][a-z0-9_-]{1,30}$/i.test(spec.id)) throw new Error('ID de pestaña inválido');
    if (!spec.label || typeof spec.render !== 'function') throw new Error('Definición de pestaña incompleta: ' + spec.id);
    if (registered.some((x) => x.id === spec.id)) throw new Error('ID duplicado: ' + spec.id);
    registered.push(spec);
  },
  escape: (v) => String(v).replace(/[&<>"']/g, ''),
  money: (v) => 'Gs. ' + v,
  number: (v) => Number(v) || 0,
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
if (registered.length < files.length) throw new Error('No todos los módulos registraron al menos una pestaña.');
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
const pausedTab = registered.find((x) => x.id === 'ventas-pausadas');
if (!pausedTab || typeof actions['vs-pausar'] !== 'function' || typeof actions['vs-restaurar'] !== 'function' || typeof actions['vs-eliminar'] !== 'function') {
  throw new Error('Falta el módulo de ventas pausadas o sus acciones.');
}
const variantTab = registered.find((x) => x.id === 'variantes');
if (!variantTab || typeof actions['var-nueva'] !== 'function' || typeof actions['var-guardar'] !== 'function') {
  throw new Error('Falta el módulo de variantes o sus acciones.');
}
const promoTab = registered.find((x) => x.id === 'promociones');
if (!promoTab || typeof actions['promo-nueva'] !== 'function' || typeof actions['promo-aplicar'] !== 'function') {
  throw new Error('Falta el módulo de promociones o sus acciones.');
}
const indexSource = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
const serverSource = fs.readFileSync(path.join(process.cwd(), 'server.js'), 'utf8');
const securityChecks = [
  ["rechazo de origen cruzado", /new URL\(origin\)\.host !== req\.headers\.host/],
  ["autenticación antes de sincronizar", /const me = auth\(req\);[\s\S]*?if \(!me\) return fail\(res, 401/],
  ["transacción SQLite para sincronización", /function processSync\(user, body\)[\s\S]*?tx\(\(\) => \{/],
  ["validación de stock no negativo", /nextStock < 0/],
  ["un solo turno abierto por cajero", /anotherOpenShift[\s\S]*?\|\| anotherOpenShift/],
  ["ventas inmutables", /Las ventas existentes son inmutables/],
  ["importe y medio de devolución validados por servidor", /ret\.method[\s\S]*?expectedAmount/],
];
for (const [label, pattern] of securityChecks) {
  if (!pattern.test(serverSource)) throw new Error("Falta protección del servidor: " + label);
}

if (!indexSource.includes("'suspendedSales'") || !serverSource.includes("suspendedSales: 'move'") || !serverSource.includes("coll === 'suspendedSales' && user.role === 'cajero'")) {
  throw new Error('Las ventas pausadas no están incluidas en la sincronización por usuario y sus permisos.');
}
const supplierTab = registered.find((x) => x.id === 'proveedores-hist');
if (!supplierTab) throw new Error('No se registró la pestaña Proveedores.');
const supplierSec = { html: '', set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; } };
supplierTab.render(supplierSec);
if (!supplierSec.innerHTML.includes('Gs. 80') || !supplierSec.innerHTML.includes('>Pagar</button>')) {
  throw new Error('El saldo del proveedor no refleja el pago parcial registrado.');
}
if (typeof actions['proveedor-pagar'] !== 'function' || typeof actions['proveedor-confirmar-pago'] !== 'function') {
  throw new Error('No se registraron las acciones de pago a proveedores.');
}
actions['proveedor-pagar']({ dataset: { id: '7' } });
if (!openedModal.includes('Gs. 80') || !openedModal.includes('Registrar pago')) {
  throw new Error('El formulario de pago no muestra el saldo pendiente correcto.');
}
const bankTab = registered.find((x) => x.id === 'bancos-cheques');
if (!bankTab || !bankTab.canView({ role: 'admin' }) || bankTab.canView({ role: 'cajero' })) throw new Error('Bancos y cheques no tiene permisos correctos.');
const valuationTab = registered.find((x) => x.id === 'valoracion-stock');
if (!valuationTab || !valuationTab.canView({ role: 'admin' }) || valuationTab.canView({ role: 'cajero' })) throw new Error('Valoración de stock no tiene permisos correctos.');
const valuationSec = { html: '', set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; }, querySelector() { return { addEventListener() {} }; } };
valuationTab.render(valuationSec);
if (!valuationSec.innerHTML.includes('Valoración de inventario') || !valuationSec.innerHTML.includes('Valor total a costo')) throw new Error('No se genera el informe de valoración.');
const rotationTab = registered.find((x) => x.id === 'rotacion-stock');
if (!rotationTab || !rotationTab.canView({ role: 'admin' }) || rotationTab.canView({ role: 'cajero' })) throw new Error('Rotación de stock no tiene permisos correctos.');
const loyaltyTab = registered.find((x) => x.id === 'fidelizacion');
if (!loyaltyTab) throw new Error('No se registró Fidelización.');
const loyaltySec = { html: '', set innerHTML(v) { this.html = v; }, get innerHTML() { return this.html; } };
loyaltyTab.render(loyaltySec);
if (!loyaltySec.innerHTML.includes('Cliente prueba') || !loyaltySec.innerHTML.includes('<strong>2</strong>')) {
  throw new Error('Fidelización no calcula los puntos netos descontando devoluciones.');
}
if (typeof actions['fidelizacion-configurar'] !== 'function' || typeof actions['fidelizacion-guardar'] !== 'function' || typeof actions['fidelizacion-csv'] !== 'function') {
  throw new Error('Faltan acciones del módulo Fidelización.');
}
console.log('OK: ' + files.length + ' módulos cargados, permisos registrados, renderizado inicial y flujo de saldo/pago parcial de proveedor verificados: ' + registered.map((x) => x.id).join(', '));
