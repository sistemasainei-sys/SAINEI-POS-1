'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');

const server = fs.readFileSync('server.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

// Activar una licencia solo guarda el token; no debe recrear, borrar ni resetear usuarios/datos.
const activation = server.slice(server.indexOf("if (p === '/api/license/activate'"), server.indexOf("if (p === '/api/info'"));
assert.match(activation, /setMeta\('licenseToken', token\)/);
assert.doesNotMatch(activation, /DELETE FROM users|DELETE FROM rec|clearAll\(|restoreJson\(|restoreFile\(/);

// El asistente de configuración nunca debe crear un segundo administrador.
const setup = server.slice(server.indexOf("if (p === '/api/setup'"), server.indexOf("if (p === '/api/login'"));
assert.match(setup, /if \(hasAdmin\(\)\) return fail\(res, 409/);
assert.match(server, /const hasAdmin = \(\) =>/);

// La restauración desde JSON mantiene la tabla users y el token de licencia,
// ya que solo sustituye registros comerciales y preferencias.
const restore = server.slice(server.indexOf('function restoreJson('), server.indexOf('function restoreFile('));
assert.match(restore, /DELETE FROM rec/);
assert.doesNotMatch(restore, /DELETE FROM users|DELETE FROM meta/);

// Ante una caída de red, la sincronización debe conservar la marca de cambios pendientes.
const sync = index.slice(index.indexOf('function syncOnce('), index.indexOf('var _nbc='));
assert.match(sync, /catch\(function\(e\)\s*\{\s*SYNC\.dirty=true/);
assert.match(sync, /if\(e&&e\.status===401\)\{sessionLost\(\)/);


// El principal y encargado pueden cerrar turnos ajenos; el cajero sigue limitado a su propio turno.
assert.match(server, /encargado:\s*\{[^\n]*shifts:\s*\{[^}]*upd:\s*1/);
assert.match(server, /if \(coll === 'shifts' && user\.role === 'cajero'\)/);
assert.match(index, /function closeShiftModal\(id\)/);
assert.match(index, /function doCloseShift\(\)\s*\{\s*var sh=closingShiftTarget\?/);
assert.match(index, /closeothershift:function\(el,id\)\{closeShiftModal\(id\);\}/);

// Los movimientos de stock se validan dentro de la transacción contra el saldo actual.
assert.match(server, /if \(coll === 'moves' && !ex\)/);
assert.match(server, /const product = JSON\.parse\(productRow\.j\), nextStock = round3\(Number\(product\.stock \|\| 0\) \+ qty\)/);
assert.match(server, /nextStock < 0/);

// Cambiar la clave o desactivar una cuenta invalida sus sesiones existentes.
assert.match(server, /if \(!active \|\| pin\) sessions\.delete\(t\)/);
assert.match(server, /if \(!active \|\| pin\) sessions\.delete\(t\);\s*else \{ s\.role = role; s\.name = name; \}/);

// El cambio de PIN propio conserva la sesión actual y revoca las sesiones hermanas.
const mypin = server.slice(server.indexOf("if (p === '/api/mypin'"), server.indexOf("if (!admin)"));
assert.match(mypin, /session\.uid === me\.uid && token !== me\.token\) sessions\.delete\(token\)/);

// Una venta nueva debe incluir sus salidas de inventario completas; si no, se rechaza el ticket y sus movimientos.
assert.match(server, /const rejectedTickets = new Set\(\)/);
assert.match(server, /if \(Math\.abs\(\(delivered\.get\(pid\) \|\| 0\) - qty\) > 0\.001\) rejectedTickets\.add\(saleId\)/);
assert.match(server, /coll === 'sales' && !row && rejectedTickets\.has\(id\)/);
assert.match(server, /coll === 'moves' && !row[\s\S]{0,180}rejectedTickets\.has\(Number\(ticket\[1\]\)\)/);

assert.match(server, /const virtualStock = new Map\(\)/);
assert.match(server, /round3\(current - qty\) < 0/);
console.log('OK: activación, restauración, sincronización y cierre controlado de turnos verificados.');
