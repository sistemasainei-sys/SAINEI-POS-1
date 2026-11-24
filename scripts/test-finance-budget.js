'use strict';
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
const server = fs.readFileSync(path.join(process.cwd(), 'server.js'), 'utf8');
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
need('medios de pago bancarios en compras', /value="banco">Transferencia \/ banco/);
need('pagos a proveedores registrados por colección', /spay/ , server);
need('control de pagos a proveedores en servidor', /Pago de proveedor[\s\S]*?sobrepago|sobrepago[\s\S]*?spay/i, server);
console.log('OK: presupuestos, conversión controlada, impresión, sincronización y pagos bancarios a proveedores tienen verificaciones estáticas.');
