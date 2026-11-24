'use strict';
const fs = require('fs');
const path = require('path');
const read = (name) => fs.readFileSync(path.join(process.cwd(), name), 'utf8');
const src = read('index.html');
const server = read('server.js');
const tools = read('sainei-mod-herramientas.js');
function need(label, pattern, text = src) {
  if (!pattern.test(text)) throw new Error('Falta validación de ' + label);
}
need('presupuestos persistidos en el estado', /'budgets'[^;]*Array\.isArray/);
need('pantalla de presupuestos', /id="v-presupuestos"/);
need('listado y estados de presupuestos', /function renderBudgets\([\s\S]*?status==='convertido'[\s\S]*?Pendiente/);
need('creación y guardado de presupuestos', /function saveBudget\([\s\S]*?state\.budgets\.push\(b\)/);
need('conversión de presupuesto a venta', /function convertBudget\([\s\S]*?ui\.pendingBudget=b\.id/);
need('impresión o PDF de presupuesto', /function printBudget\([\s\S]*?printArea/);
need('presupuesto convertido solo después de confirmar la venta', /if\(ui\.pendingBudget\)[\s\S]*?pb\.status='convertido'[\s\S]*?pb\.saleId=sid/);
need('colección de presupuestos sincronizada', /budgets: 'budget'/, server);
need('presupuestos incluidos en sincronización', /'budgets'/);
need('opción de transferencia bancaria para pagos a proveedores', /value="banco"[\s\S]*?Transferencia \/ banco/, tools);
need('pagos a proveedores registrados por colección', /spay/, server);
need('rechazo de sobrepagos a proveedores', /paidBefore \+ amount > Number\(purchase\.total\)/, server);
console.log('OK: presupuestos, conversión controlada, impresión, sincronización y pagos bancarios a proveedores tienen verificaciones estáticas.');
