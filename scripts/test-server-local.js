'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sainei-pos-api-'));
const dataDir = path.join(root, 'datos-comercio');
const sourceRoot = process.cwd();
let child;
let peerChild;
let output = '';
let peerOutput = '';

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function freePort() {
  const s = net.createServer();
  await new Promise((resolve, reject) => s.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = s.address().port;
  await new Promise(resolve => s.close(resolve));
  return port;
}
async function startServer(port) {
  child = spawn(process.execPath, [path.join(root, 'server.js'), '--port=' + port, '--data=' + dataDir], {
    cwd: root,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', b => { output += b.toString(); });
  child.stderr.on('data', b => { output += b.toString(); });
  const base = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error('El servidor terminó al iniciar:\n' + output);
    try { const r = await fetch(base + '/api/ping'); if (r.ok) return base; } catch (_) {}
    await sleep(100);
  }
  throw new Error('El servidor no respondió a tiempo:\n' + output);
}
async function startPeerServer(port) {
  peerChild = spawn(process.execPath, [path.join(root, 'server.js'), '--port=' + port, '--data=' + dataDir], {
    cwd: root,
    env: { ...process.env, SAINEI_LOCAL_MODE: '1', SAINEI_INSTALL_ID: 'AAAAAAAAAAAAAAAAAAAAAAAA' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  peerChild.stdout.on('data', b => { peerOutput += b.toString(); });
  peerChild.stderr.on('data', b => { peerOutput += b.toString(); });
  const base = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 100; i++) {
    if (peerChild.exitCode !== null || peerChild.signalCode !== null) throw new Error('El segundo servidor terminó al iniciar:\n' + peerOutput);
    try { const r = await fetch(base + '/api/ping'); if (r.ok) return base; } catch (_) {}
    await sleep(100);
  }
  throw new Error('El segundo servidor no respondió a tiempo:\n' + peerOutput);
}
async function stopPeerServer() {
  if (!peerChild || peerChild.exitCode !== null || peerChild.signalCode !== null) return;
  const current = peerChild;
  current.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => current.once('exit', resolve)),
    sleep(5000).then(() => { if (current.exitCode === null && current.signalCode === null) current.kill('SIGKILL'); })
  ]);
  peerChild = null;
}
async function stopServer() {
  if (!child || child.exitCode !== null) return;
  const current = child;
  current.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => current.once('exit', resolve)),
    sleep(5000).then(() => { if (current.exitCode === null) current.kill('SIGKILL'); })
  ]);
  child = null;
}
async function json(base, route, options = {}) {
  const response = await fetch(base + route, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  let body = {};
  try { body = await response.json(); } catch (_) {}
  return { status: response.status, body };
}
async function main() {
  fs.mkdirSync(dataDir, { recursive: true });
  let serverSource = fs.readFileSync(path.join(sourceRoot, 'server.js'), 'utf8');
  fs.copyFileSync(path.join(sourceRoot, 'index.html'), path.join(root, 'index.html'));
  fs.writeFileSync(path.join(root, 'server.js'), serverSource, 'utf8');
  const port = await freePort();
  let base = await startServer(port);
  const status0 = await json(base, '/api/license/status');
  assert.equal(status0.status, 200);
  assert.equal(status0.body.active, true, 'El sistema debe estar habilitado sin licencia.');
  assert.equal(status0.body.required, false, 'No debe requerir activación.');
  const setup = await json(base, '/api/setup', { method: 'POST', body: JSON.stringify({ name: 'Administrador', pin: '5729' }) });
  assert.equal(setup.status, 200, 'Debe permitir crear el administrador después de activar la licencia.');
  const adminLogin = await json(base, '/api/login', { method: 'POST', body: JSON.stringify({ userId: setup.body.userId, pin: '5729' }) });
  assert.equal(adminLogin.status, 200);
  const adminHeaders = { Authorization: 'Bearer ' + adminLogin.body.token };

  // Alta de producto, ingreso de stock y venta real mediante la API de sincronización.
  const productId = (await json(base, '/api/ids?kind=prod&n=1', { headers: adminHeaders })).body.start;
  const stockMoveId = (await json(base, '/api/ids?kind=move&n=1', { headers: adminHeaders })).body.start;
  const now = new Date().toISOString();
  const stockIn = await json(base, '/api/sync', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ since: 0, changes: {
      products: { up: [{ id: productId, name: 'Producto de prueba', price: 1000, cost: 500, min: 0, type: 'u', stock: 0 }] },
      moves: { up: [{ id: stockMoveId, pid: productId, qty: 10, date: now, type: 'ingreso', note: 'Carga inicial de prueba' }] }
    } })
  });
  assert.equal(stockIn.status, 200);
  assert.deepEqual(stockIn.body.rejected || [], [], 'Debe aceptar producto y entrada de stock.');
  assert.equal(stockIn.body.recs.products.find(p => p.id === productId).stock, 10);

  const saleId = (await json(base, '/api/ids?kind=sale&n=1', { headers: adminHeaders })).body.start;
  const saleMoveId = (await json(base, '/api/ids?kind=move&n=1', { headers: adminHeaders })).body.start;
  const sale = await json(base, '/api/sync', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ since: 0, changes: {
      sales: { up: [{ id: saleId, date: now, items: [{ id: productId, name: 'Producto de prueba', qty: 2, price: 1000, cost: 500, amount: 2000 }], total: 2000, iva5: 0, iva10: 0, cmv: 1000, method: 'efectivo', discPct: 0 }] },
      moves: { up: [{ id: saleMoveId, pid: productId, qty: -2, date: now, type: 'venta', note: 'Ticket ' + saleId }] }
    } })
  });
  assert.equal(sale.status, 200);
  assert.deepEqual(sale.body.rejected || [], [], 'Debe aceptar la venta y su salida de stock como una sola operación.');
  assert.equal(sale.body.recs.products.find(p => p.id === productId).stock, 8);
  assert.equal(sale.body.recs.sales.find(x => x.id === saleId).total, 2000);

  // Dos procesos independientes comparten la misma SQLite, como dos cajas conectadas por LAN.
  const peerBase = await startPeerServer(await freePort());
  const peerLogin = await json(peerBase, '/api/login', { method: 'POST', body: JSON.stringify({ userId: setup.body.userId, pin: '5729' }) });
  assert.equal(peerLogin.status, 200, 'La segunda caja debe autenticarse contra la misma base local.');
  const peerHeaders = { Authorization: 'Bearer ' + peerLogin.body.token };
  // Dos cajas venden simultáneamente las últimas unidades: solo una venta puede confirmar.
  const concurrentSaleIds = [];
  const concurrentMoveIds = [];
  for (let i = 0; i < 2; i++) {
    concurrentSaleIds.push((await json(base, '/api/ids?kind=sale&n=1', { headers: adminHeaders })).body.start);
    concurrentMoveIds.push((await json(base, '/api/ids?kind=move&n=1', { headers: adminHeaders })).body.start);
  }
  const concurrentRequests = concurrentSaleIds.map((id, i) => json(i === 0 ? base : peerBase, '/api/sync', {
    method: 'POST', headers: i === 0 ? adminHeaders : peerHeaders,
    body: JSON.stringify({ since: 0, changes: {
      sales: { up: [{ id, date: now, items: [{ id: productId, name: 'Producto de prueba', qty: 5, price: 1000, cost: 500, amount: 5000 }], total: 5000, iva5: 0, iva10: 0, cmv: 2500, method: 'efectivo', discPct: 0 }] },
      moves: { up: [{ id: concurrentMoveIds[i], pid: productId, qty: -5, date: now, type: 'venta', note: 'Ticket ' + id }] }
    } })
  }));
  const concurrentResults = await Promise.all(concurrentRequests);
  assert.ok(concurrentResults.every(x => x.status === 200));
  const acceptedConcurrent = concurrentResults.filter(x => !(x.body.rejected || []).some(r => r.coll === 'sales'));
  const rejectedConcurrent = concurrentResults.filter(x => (x.body.rejected || []).some(r => r.coll === 'sales'));
  assert.equal(acceptedConcurrent.length, 1, 'Solo una de las dos cajas debe vender las últimas cinco unidades.');
  assert.equal(rejectedConcurrent.length, 1, 'La segunda caja debe recibir rechazo por stock insuficiente.');
  const concurrentState = await json(base, '/api/sync', { method: 'POST', headers: adminHeaders, body: JSON.stringify({ since: 0 }) });
  assert.equal(concurrentState.body.recs.products.find(p => p.id === productId).stock, 3);
  const acceptedConcurrentId = concurrentSaleIds.find(id => concurrentState.body.recs.sales.some(x => x.id === id));
  assert.ok(acceptedConcurrentId, 'La venta aceptada debe quedar registrada.');

  await stopPeerServer();

  // Una devolución parcial repone stock; una devolución que supera lo vendido se rechaza.
  const originalSale = sale.body.recs.sales.find(x => x.id === saleId);
  const returnId = (await json(base, '/api/ids?kind=move&n=1', { headers: adminHeaders })).body.start;
  const returnRecord = { id: 'return-test-1', date: now, amount: 1000, totalAmount: 1000, method: 'caja', cashAmount: 1000, bankAmount: 0, creditAmount: 0, items: [{ lineIndex: 0, id: productId, qty: 1 }] };
  const returned = await json(base, '/api/sync', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ since: 0, changes: {
      sales: { up: [{ ...originalSale, returns: [returnRecord] }] },
      moves: { up: [{ id: returnId, pid: productId, qty: 1, date: now, type: 'devolucion', note: 'Devolución ticket ' + saleId }] }
    } })
  });
  assert.equal(returned.status, 200);
  assert.deepEqual(returned.body.rejected || [], [], 'Debe aceptar devolución parcial y reposición juntas.');
  assert.equal(returned.body.recs.products.find(p => p.id === productId).stock, 4);
  const saleAfterReturn = returned.body.recs.sales.find(x => x.id === saleId);
  const invalidReturnMoveId = (await json(base, '/api/ids?kind=move&n=1', { headers: adminHeaders })).body.start;
  const invalidReturn = await json(base, '/api/sync', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ since: 0, changes: {
      sales: { up: [{ ...saleAfterReturn, returns: [...saleAfterReturn.returns, { id: 'return-test-over', date: now, amount: 2000, totalAmount: 2000, method: 'caja', cashAmount: 2000, bankAmount: 0, creditAmount: 0, items: [{ lineIndex: 0, id: productId, qty: 2 }] }] }] },
      moves: { up: [{ id: invalidReturnMoveId, pid: productId, qty: 2, date: now, type: 'devolucion', note: 'Devolución ticket ' + saleId }] }
    } })
  });
  assert.ok(invalidReturn.body.rejected.some(x => x.coll === 'sales' && x.id === saleId), 'No debe devolver más unidades de las vendidas.');
  assert.equal(invalidReturn.body.recs.products.find(p => p.id === productId).stock, 4, 'Una devolución inválida no debe aumentar el stock.');

  const fullReturnMoveId = (await json(base, '/api/ids?kind=move&n=1', { headers: adminHeaders })).body.start;
  const fullReturnRecord = { id: 'return-test-2', date: now, amount: 1000, totalAmount: 1000, method: 'caja', cashAmount: 1000, bankAmount: 0, creditAmount: 0, items: [{ lineIndex: 0, id: productId, qty: 1 }] };
  const fullReturn = await json(base, '/api/sync', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ since: 0, changes: {
      sales: { up: [{ ...saleAfterReturn, returns: [...saleAfterReturn.returns, fullReturnRecord] }] },
      moves: { up: [{ id: fullReturnMoveId, pid: productId, qty: 1, date: now, type: 'devolucion', note: 'Devolución ticket ' + saleId }] }
    } })
  });
  assert.deepEqual(fullReturn.body.rejected || [], [], 'Debe aceptar la devolución total acumulada de la venta.');
  assert.equal(fullReturn.body.recs.products.find(p => p.id === productId).stock, 5);
  assert.equal(fullReturn.body.recs.sales.find(x => x.id === saleId).returns.length, 2);

  // Una venta que supera el stock disponible debe rechazarse completa.
  const excessiveSaleId = (await json(base, '/api/ids?kind=sale&n=1', { headers: adminHeaders })).body.start;
  const excessiveMoveId = (await json(base, '/api/ids?kind=move&n=1', { headers: adminHeaders })).body.start;
  const excessive = await json(base, '/api/sync', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ since: 0, changes: {
      sales: { up: [{ id: excessiveSaleId, date: now, items: [{ id: productId, name: 'Producto de prueba', qty: 9, price: 1000, cost: 500, amount: 9000 }], total: 9000, iva5: 0, iva10: 0, cmv: 4500, method: 'efectivo', discPct: 0 }] },
      moves: { up: [{ id: excessiveMoveId, pid: productId, qty: -9, date: now, type: 'venta', note: 'Ticket ' + excessiveSaleId }] }
    } })
  });
  assert.equal(excessive.status, 200);
  assert.ok(excessive.body.rejected.some(x => x.coll === 'sales' && x.id === excessiveSaleId), 'Debe rechazar el ticket que excede el stock.');
  assert.equal(excessive.body.recs.products.find(p => p.id === productId).stock, 5, 'El stock no debe quedar negativo.');

  const cashier = await json(base, '/api/users', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ name: 'Caja prueba', role: 'cajero', pin: '8372' })
  });
  assert.equal(cashier.status, 200);
  const cashierUser = cashier.body.users.find(u => u.name === 'Caja prueba');
  assert.ok(cashierUser);
  const cashierLogin = await json(base, '/api/login', { method: 'POST', body: JSON.stringify({ userId: cashierUser.id, pin: '8372' }) });
  assert.equal(cashierLogin.status, 200);
  const cashierHeaders = { Authorization: 'Bearer ' + cashierLogin.body.token };
  const deniedUsers = await json(base, '/api/users', { headers: cashierHeaders });
  assert.equal(deniedUsers.status, 403, 'El cajero no debe administrar usuarios.');

  // Conflictos de configuración: una segunda edición basada en una revisión vieja no pisa la primera.
  const configFirst = await json(base, '/api/sync', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ since: 0, sing: { shop: { name: 'Comercio de prueba' } } })
  });
  assert.deepEqual(configFirst.body.rejected || [], []);
  const configStale = await json(base, '/api/sync', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ since: 0, sing: { shop: { name: 'Configuración antigua' } } })
  });
  assert.ok(configStale.body.rejected.some(x => x.sing === 'shop' && x.conflict), 'Debe rechazar una configuración obsoleta.');
  const configCashier = await json(base, '/api/sync', {
    method: 'POST', headers: cashierHeaders,
    body: JSON.stringify({ since: 0, sing: { shop: { name: 'Cambio no autorizado' } } })
  });
  assert.ok(configCashier.body.rejected.some(x => x.sing === 'shop'), 'Un cajero no puede modificar la configuración principal.');

  // Compras a crédito y pagos parciales a proveedor, sin permitir sobrepagos.
  const purchaseId = (await json(base, '/api/ids?kind=purch&n=1', { headers: adminHeaders })).body.start;
  const supplierPayId = (await json(base, '/api/ids?kind=spay&n=1', { headers: adminHeaders })).body.start;
  const purchaseAndPayment = await json(base, '/api/sync', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ since: 0, changes: {
      purchases: { up: [{ id: purchaseId, supplier: 'Proveedor de prueba', date: now, cond: 'credito', due: new Date(Date.now() + 86400000).toISOString(), total: 1000, items: [{ pid: productId, qty: 1, cost: 1000 }] }] },
      spay: { up: [{ id: supplierPayId, purchId: purchaseId, amount: 500, method: 'banco', date: now, shiftId: 0 }] }
    } })
  });
  assert.deepEqual(purchaseAndPayment.body.rejected || [], [], 'Debe aceptar compra a crédito y primer pago parcial.');
  const secondSupplierPayId = (await json(base, '/api/ids?kind=spay&n=1', { headers: adminHeaders })).body.start;
  const secondSupplierPay = await json(base, '/api/sync', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ since: 0, changes: { spay: { up: [{ id: secondSupplierPayId, purchId: purchaseId, amount: 500, method: 'banco', date: now, shiftId: 0 }] } } })
  });
  assert.deepEqual(secondSupplierPay.body.rejected || [], [], 'Debe aceptar el saldo restante de la compra.');
  const excessSupplierPayId = (await json(base, '/api/ids?kind=spay&n=1', { headers: adminHeaders })).body.start;
  const excessSupplierPay = await json(base, '/api/sync', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ since: 0, changes: { spay: { up: [{ id: excessSupplierPayId, purchId: purchaseId, amount: 1, method: 'banco', date: now, shiftId: 0 }] } } })
  });
  assert.ok(excessSupplierPay.body.rejected.some(x => x.coll === 'spay' && x.id === excessSupplierPayId), 'No debe permitir pagar más que el total de la compra.');

  // Caja propia de cajero, cobro, gasto, arqueo y revocación inmediata del usuario.
  const cashierClientId = (await json(base, '/api/ids?kind=client&n=1', { headers: cashierHeaders })).body.start;
  const clientCreate = await json(base, '/api/sync', {
    method: 'POST', headers: cashierHeaders,
    body: JSON.stringify({ since: 0, changes: { clients: { up: [{ id: cashierClientId, name: 'Cliente de prueba', phone: '0981000000' }] } } })
  });
  assert.deepEqual(clientCreate.body.rejected || [], []);
  const shiftId = (await json(base, '/api/ids?kind=shift&n=1', { headers: cashierHeaders })).body.start;
  const openShift = { id: shiftId, uid: cashierUser.id, by: cashierUser.name, openAt: now, openAmt: 100000, closedAt: '' };
  const shiftOpen = await json(base, '/api/sync', {
    method: 'POST', headers: cashierHeaders,
    body: JSON.stringify({ since: 0, changes: { shifts: { up: [openShift] } } })
  });
  assert.deepEqual(shiftOpen.body.rejected || [], [], 'El cajero debe poder abrir su propia caja.');
  const duplicateShiftId = (await json(base, '/api/ids?kind=shift&n=1', { headers: cashierHeaders })).body.start;
  const duplicateShift = await json(base, '/api/sync', {
    method: 'POST', headers: cashierHeaders,
    body: JSON.stringify({ since: 0, changes: { shifts: { up: [{ ...openShift, id: duplicateShiftId }] } } })
  });
  assert.ok(duplicateShift.body.rejected.some(x => x.coll === 'shifts' && x.id === duplicateShiftId), 'No debe abrir dos cajas simultáneas para el mismo cajero.');

  const clientPaymentId = (await json(base, '/api/ids?kind=pay&n=1', { headers: cashierHeaders })).body.start;
  const clientPayment = await json(base, '/api/sync', {
    method: 'POST', headers: cashierHeaders,
    body: JSON.stringify({ since: 0, changes: { payments: { up: [{ id: clientPaymentId, clientId: cashierClientId, amount: 500, method: 'efectivo', date: now, shiftId }] } } })
  });
  assert.deepEqual(clientPayment.body.rejected || [], [], 'Debe aceptar un cobro en efectivo en la caja propia.');

  const expenseId = (await json(base, '/api/ids?kind=exp&n=1', { headers: adminHeaders })).body.start;
  const expense = await json(base, '/api/sync', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ since: 0, changes: { expenses: { up: [{ id: expenseId, concept: 'Gasto de prueba', amount: 100, method: 'caja', date: now, shiftId }] } } })
  });
  assert.deepEqual(expense.body.rejected || [], [], 'Debe aceptar un gasto válido asociado a una caja abierta.');

  const closedAt = new Date(Date.now() + 1000).toISOString();
  const closeShift = await json(base, '/api/sync', {
    method: 'POST', headers: cashierHeaders,
    body: JSON.stringify({ since: 0, changes: { shifts: { up: [{ ...openShift, closedAt, counted: 100400, expected: 100400, diff: 0, closedBy: cashierUser.name, closedByRole: 'cajero' }] } } })
  });
  assert.deepEqual(closeShift.body.rejected || [], [], 'Debe aceptar el arqueo coherente del cajero.');
  const latePaymentId = (await json(base, '/api/ids?kind=pay&n=1', { headers: cashierHeaders })).body.start;
  const latePayment = await json(base, '/api/sync', {
    method: 'POST', headers: cashierHeaders,
    body: JSON.stringify({ since: 0, changes: { payments: { up: [{ id: latePaymentId, clientId: cashierClientId, amount: 100, method: 'efectivo', date: now, shiftId }] } } })
  });
  assert.ok(latePayment.body.rejected.some(x => x.coll === 'payments' && x.id === latePaymentId), 'No debe aceptar cobros en una caja cerrada.');

  const deactivated = await json(base, '/api/users', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ id: cashierUser.id, name: cashierUser.name, role: 'cajero', active: false })
  });
  assert.equal(deactivated.status, 200);
  const revokedSession = await json(base, '/api/ids?kind=client&n=1', { headers: cashierHeaders });
  assert.equal(revokedSession.status, 401, 'Desactivar un cajero debe revocar su sesión inmediatamente.');

  const backup = await json(base, '/api/backups/make', { method: 'POST', headers: adminHeaders, body: '{}' });
  assert.equal(backup.status, 200);
  assert.ok(fs.existsSync(path.join(dataDir, 'copias', backup.body.name)), 'Debe crear una copia SQLite real.');

  // Borrar el producto y recuperarlo desde la copia para probar restauración real.
  const deleted = await json(base, '/api/sync', {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ since: 0, changes: { products: { del: [productId] } } })
  });
  assert.equal(deleted.status, 200);
  const restored = await json(base, '/api/backups/restore', {
    method: 'POST', headers: adminHeaders, body: JSON.stringify({ name: backup.body.name })
  });
  assert.equal(restored.status, 200, 'Debe restaurar la copia SQLite seleccionada.');
  const adminAfterRestore = await json(base, '/api/login', { method: 'POST', body: JSON.stringify({ userId: setup.body.userId, pin: '5729' }) });
  assert.equal(adminAfterRestore.status, 200, 'Debe conservar el administrador al restaurar.');
  const stateAfterRestore = await json(base, '/api/sync', {
    method: 'POST', headers: { Authorization: 'Bearer ' + adminAfterRestore.body.token },
    body: JSON.stringify({ since: 0 })
  });
  assert.equal(stateAfterRestore.status, 200);
  assert.equal(stateAfterRestore.body.recs.products.find(p => p.id === productId).stock, 5, 'La restauración debe recuperar el stock correcto.');
  assert.ok(stateAfterRestore.body.recs.sales.some(x => x.id === saleId && (x.returns || []).length === 2), 'La restauración debe recuperar la venta y su devolución.');

  const db = new DatabaseSync(path.join(dataDir, 'sainei.db'));
  db.close();

  await stopServer();
  base = await startServer(port);
  const statusAfterRestart = await json(base, '/api/license/status');
  assert.equal(statusAfterRestart.body.active, true, 'El sistema debe seguir habilitado tras reiniciar sin licencia.');
  assert.equal(statusAfterRestart.body.required, false);
  const info = await json(base, '/api/info');
  assert.equal(info.body.hasAdmin, true, 'El usuario administrador debe persistir tras reiniciar.');
  const relogin = await json(base, '/api/login', { method: 'POST', body: JSON.stringify({ userId: setup.body.userId, pin: '5729' }) });
  assert.equal(relogin.status, 200, 'El administrador debe poder volver a iniciar sesión tras reiniciar.');

  await stopServer();
  console.log('OK: operación sin licencia, permisos, ventas/stock concurrentes, devoluciones, compras/pagos, clientes/cobros, cajas/arqueos, gastos, conflictos de configuración, revocación, respaldos y persistencia.');
}
main().catch(async error => {
  console.error(error && error.stack || error);
  console.error(output);
  process.exitCode = 1;
}).finally(async () => {
  await stopPeerServer();
  await stopServer();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {}
});
