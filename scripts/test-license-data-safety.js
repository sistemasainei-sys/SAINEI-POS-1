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
assert.match(server, /function hasAdmin\(\)/);

// La restauración desde JSON mantiene la tabla users y el token de licencia,
// ya que solo sustituye registros comerciales y preferencias.
const restore = server.slice(server.indexOf('function restoreJson('), server.indexOf('function restoreFile('));
assert.match(restore, /DELETE FROM rec/);
assert.doesNotMatch(restore, /DELETE FROM users|DELETE FROM meta/);

// Ante una caída de red, la sincronización debe conservar la marca de cambios pendientes.
const sync = index.slice(index.indexOf('function syncOnce('), index.indexOf('var _nbc='));
assert.match(sync, /catch\(function\(e\)\s*\{\s*SYNC\.dirty=true/);
assert.match(sync, /if\(e&&e\.status===401\)\{sessionLost\(\)/);

console.log('OK: activación, usuario principal, restauración JSON y manejo de desconexión protegidos.');
