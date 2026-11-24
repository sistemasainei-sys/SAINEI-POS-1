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
let output = '';

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
    env: { ...process.env, SAINEI_LOCAL_MODE: '1', SAINEI_INSTALL_ID: 'AAAAAAAAAAAAAAAAAAAAAAAA' },
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
  const keys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  const tick = String.fromCharCode(96);
  const replacement = 'const LICENSE_PUBLIC_KEY = ' + tick + keys.publicKey.trim() + tick + ';';
  serverSource = serverSource.replace(/const LICENSE_PUBLIC_KEY = \x60[\s\S]*?\x60;/, replacement);
  assert.ok(serverSource.includes(replacement), 'El servidor debe aceptar la clave pública de prueba.');
  fs.writeFileSync(path.join(root, 'server.js'), serverSource, 'utf8');

  const port = await freePort();
  let base = await startServer(port);
  const status0 = await json(base, '/api/license/status');
  assert.equal(status0.status, 200);
  assert.equal(status0.body.active, false, 'El modo local no debe saltarse la licencia.');
  assert.match(status0.body.installId, /^[A-F0-9]{24}$/);
  assert.notEqual(status0.body.installId, 'AAAAAAAAAAAAAAAAAAAAAAAA', 'El ID no debe poder imponerse desde el entorno.');
  const installId = status0.body.installId;

  const blockedSetup = await json(base, '/api/setup', { method: 'POST', body: JSON.stringify({ name: 'Administrador', pin: '5729' }) });
  assert.equal(blockedSetup.status, 403, 'No se debe crear el administrador sin licencia.');

  const payload = Buffer.from(JSON.stringify({ installId, type: 'permanent', customer: 'Comercio de prueba' })).toString('base64url');
  const signature = crypto.sign('RSA-SHA256', Buffer.from(payload), keys.privateKey).toString('base64url');
  const token = payload + '.' + signature;
  const activated = await json(base, '/api/license/activate', { method: 'POST', body: JSON.stringify({ code: token }) });
  assert.equal(activated.status, 200, 'Debe aceptar una licencia válida para esa instalación.');
  assert.equal(activated.body.license.active, true);

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
  assert.equal(excessive.body.recs.products.find(p => p.id === productId).stock, 8, 'El stock no debe quedar negativo.');

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
  assert.equal(stateAfterRestore.body.recs.products.find(p => p.id === productId).stock, 8, 'La restauración debe recuperar el stock correcto.');
  assert.ok(stateAfterRestore.body.recs.sales.some(x => x.id === saleId), 'La restauración debe recuperar la venta.');

  const db = new DatabaseSync(path.join(dataDir, 'sainei.db'));
  const storedId = db.prepare("SELECT v FROM meta WHERE k='installId'").get().v;
  const storedLicense = db.prepare("SELECT v FROM meta WHERE k='licenseToken'").get().v;
  db.close();
  assert.equal(storedId, installId, 'El ID debe guardarse en la base local.');
  assert.equal(storedLicense, token, 'La licencia debe guardarse en la base local.');

  await stopServer();
  base = await startServer(port);
  const statusAfterRestart = await json(base, '/api/license/status');
  assert.equal(statusAfterRestart.body.active, true, 'La licencia debe sobrevivir al reinicio.');
  assert.equal(statusAfterRestart.body.installId, installId, 'El ID debe permanecer estable tras reiniciar.');
  const info = await json(base, '/api/info');
  assert.equal(info.body.hasAdmin, true, 'El usuario administrador debe persistir tras reiniciar.');
  const relogin = await json(base, '/api/login', { method: 'POST', body: JSON.stringify({ userId: setup.body.userId, pin: '5729' }) });
  assert.equal(relogin.status, 200, 'El administrador debe poder volver a iniciar sesión tras reiniciar.');

  await stopServer();
  console.log('OK: licencia obligatoria y firmada, ID independiente, alta de administrador, permisos de cajero, venta/stock, rechazo de sobreventa, copia/restauración SQLite y persistencia tras reinicio.');
}
main().catch(async error => {
  console.error(error && error.stack || error);
  console.error(output);
  process.exitCode = 1;
}).finally(async () => {
  await stopServer();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {}
});
