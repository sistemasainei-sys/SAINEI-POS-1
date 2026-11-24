'use strict';
/* SAINEI POS - servidor local (sin dependencias). Requiere Node.js 22.13 o superior.
   Datos: base SQLite en la carpeta "datos". Todo queda dentro del establecimiento. */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os'), childProcess = require('child_process'), dgram = require('dgram');
let DatabaseSync;
try { ({ DatabaseSync } = require('node:sqlite')); } catch (e) {
  console.error('Este programa necesita Node.js 22.13 o superior (incluye SQLite). Version actual: ' + process.version);
  process.exit(2);
}
const argv = process.argv.slice(2);
const arg = (n, d) => { const a = argv.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const DEMO = argv.includes('--demo');
const PORT = parseInt(arg('port', process.env.PORT || process.env.SAINEI_PORT || '8080'), 10);
const ROOT = __dirname;
const DATA = path.resolve(arg('data', process.env.SAINEI_DATA || path.join(ROOT, DEMO ? 'datos-prueba' : 'datos')));
const APP = path.resolve(arg('app', fs.existsSync(path.join(ROOT, 'index.html')) ? path.join(ROOT, 'index.html') : path.join(ROOT, 'app', 'index.html')));
const COPIAS = path.join(DATA, 'copias');
fs.mkdirSync(COPIAS, { recursive: true });
const LOGF = path.join(DATA, 'servidor.log');
function log(m) { const l = new Date().toISOString() + ' ' + m; console.log(l); try { fs.appendFileSync(LOGF, l + '\n'); } catch (e) {} }
process.on('uncaughtException', e => log('ERROR no controlado: ' + (e && e.stack || e)));
process.on('unhandledRejection', e => log('ERROR promesa: ' + (e && e.stack || e)));

/* ---------- Base de datos ---------- */
const db = new DatabaseSync(path.join(DATA, 'sainei.db'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
db.exec(`
CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS rec(coll TEXT NOT NULL, id INTEGER NOT NULL, j TEXT NOT NULL, rev INTEGER NOT NULL, del INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(coll,id));
CREATE INDEX IF NOT EXISTS rec_rev ON rec(rev);
CREATE TABLE IF NOT EXISTS sing(k TEXT PRIMARY KEY, j TEXT NOT NULL, rev INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS counters(kind TEXT PRIMARY KEY, n INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, active INTEGER NOT NULL, salt TEXT, hash TEXT);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, t TEXT, u TEXT, a TEXT);
CREATE TABLE IF NOT EXISTS login_attempts(k TEXT PRIMARY KEY, n INTEGER NOT NULL, blocked_until INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL);
`);
const P = {}; const prep = s => P[s] || (P[s] = db.prepare(s));
const getMeta = k => { const r = prep('SELECT v FROM meta WHERE k=?').get(k); return r ? r.v : null; };
const setMeta = (k, v) => prep('INSERT OR REPLACE INTO meta(k,v) VALUES(?,?)').run(k, String(v));

/* ---------- Licencia SAINEI (firma RSA; la clave privada solo queda en el paquete del administrador) ---------- */
const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoaGt4FXqgVp3aehlIJGh
Job3e1PkuucaLpICYHHIlId4TfO1RbYO2pjo7OYBvNE1sGAgiTyWYgIo78ojGqh/
BobbJuYRo7uqMK0Twf7qEUlHeZSUVLowkRt3a2ga+9blMuuBGrhCWmJ8XVPV7cDv
BEX85l4c+0ev8bbyYo/nxBhsa8g0OdeX36Qog749mh04+jN7PhkoUWSH4RGP2y/i
G27FPmXlmXdyiQdOm+hj4kT11gNIyHCkZ/RklF+EGTPR5jTCnnoR5WegMM6Wh56M
Vj1lHKEcgIdrkMFwGfI1RbmLYIH2X9JBD59IZicO5x13ywqKC8LTUKMC/JpyjNwM
hwIDAQAB
-----END PUBLIC KEY-----`;
// ID anterior de SAINEI POS: se acepta su licencia firmada durante la migración.
const LEGACY_INSTALL_IDS = ['7D217B560F4A5093C640751E'];
let INSTALL_ID = getMeta('installId');
if (!INSTALL_ID) INSTALL_ID = crypto.randomBytes(12).toString('hex').toUpperCase();
// Cada instalación conserva su propio identificador dentro de su base SQLite local.
if (getMeta('installId') !== INSTALL_ID) setMeta('installId', INSTALL_ID);
function licenseState() {
  const raw = getMeta('licenseToken');
  if (!raw) return { active: false, installId: INSTALL_ID };
  try {
    const parts = raw.split('.'); if (parts.length !== 2) throw new Error('formato');
    const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
    const sig = Buffer.from(parts[1], 'base64url');
    if (!crypto.verify('RSA-SHA256', Buffer.from(parts[0]), LICENSE_PUBLIC_KEY, sig)) throw new Error('firma');
    const data = JSON.parse(payload);
    if (data.installId !== INSTALL_ID && !LEGACY_INSTALL_IDS.includes(String(data.installId || '').toUpperCase())) throw new Error('instalacion');
    if (data.type === 'monthly' && (!data.expiresAt || Date.now() > data.expiresAt)) return { active: false, expired: true, installId: INSTALL_ID, type: data.type, expiresAt: data.expiresAt };
    if (!['permanent','monthly'].includes(data.type)) throw new Error('tipo');
    return { active: true, installId: INSTALL_ID, type: data.type, expiresAt: data.expiresAt || null, customer: data.customer || '' };
  } catch (_) { return { active: false, invalid: true, installId: INSTALL_ID }; }
}
let REV = parseInt(getMeta('rev') || '0', 10);
let EPOCH = getMeta('epoch'); if (!EPOCH) { EPOCH = crypto.randomBytes(6).toString('hex'); setMeta('epoch', EPOCH); }
function tx(fn) { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { try { db.exec('ROLLBACK'); } catch (_) {} throw e; } }

const COLLS = { products: 'prod', sales: 'sale', clients: 'client', purchases: 'purch', payments: 'pay', expenses: 'exp', shifts: 'shift', moves: 'move', spay: 'spay', budgets: 'budget', suspendedSales: 'move' };
const ORDER = ['products', 'clients', 'budgets', 'purchases', 'expenses', 'spay', 'shifts', 'sales', 'payments', 'moves', 'suspendedSales'];
const SING = ['shop', 'scale', 'print', 'scan', 'sec', 'check', 'loyaltyRedemptions', 'promotions'];
const DELETABLE = { products: 1, clients: 1 };
const PERM = {
  cajero: { sales: { ins: 1 }, moves: { ins: 1 }, clients: { ins: 1, upd: 1 }, budgets: { ins: 1, upd: 1 }, payments: { ins: 1 }, shifts: { ins: 1, upd: 1 }, suspendedSales: { ins: 1, upd: 1 } },
  encargado: { products: { ins: 1, upd: 1, del: 1 }, sales: { ins: 1, upd: 1 }, clients: { ins: 1, upd: 1, del: 1 }, budgets: { ins: 1, upd: 1 }, purchases: { ins: 1, upd: 1 }, payments: { ins: 1 }, expenses: { ins: 1, upd: 1 }, shifts: { ins: 1, upd: 1 }, moves: { ins: 1 }, spay: { ins: 1, upd: 1 }, suspendedSales: { ins: 1, upd: 1 } }
};
const round3 = n => Math.round(n * 1000) / 1000;
const nowIso = () => new Date().toISOString();

/* ---------- Claves y usuarios ---------- */
const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString('hex');
function mkPin(pin) { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: hashPin(pin, salt) }; }
function checkPin(u, pin) {
  if (!u || !u.salt || !u.hash || String(pin).length > 64) return false;
  const a = Buffer.from(hashPin(pin, u.salt), 'hex'), b = Buffer.from(u.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const weakPin = p => String(p).length < 4 || String(p).length > 64 || /^(.)\1+$/.test(String(p)) || ['1234', '12345', '123456', '0123', '4321'].includes(String(p));
const ROLES = ['admin', 'encargado', 'cajero'];
function newRecCode() { const al = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = crypto.randomBytes(16); let o = ''; for (let i = 0; i < 16; i++) { o += al[b[i] % al.length]; if (i % 4 === 3 && i < 15) o += '-'; } return o; }
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const pubUser = u => ({ id: u.id, name: u.name, role: u.role, active: !!u.active });
const allUsers = () => prep('SELECT * FROM users ORDER BY id').all();
const hasAdmin = () => !!prep("SELECT 1 x FROM users WHERE role='admin' AND active=1").get();
function audit(who, what) { prep('INSERT INTO audit(t,u,a) VALUES(?,?,?)').run(nowIso(), String(who || '-').slice(0, 60), String(what || '').slice(0, 300)); }

const sessions = new Map(); // token -> {uid,name,role,exp}
const SES_MS = 12 * 3600 * 1000;
// El bloqueo de intentos queda en SQLite para sobrevivir reinicios del proceso.
function failKey(key) { return crypto.createHash('sha256').update(String(key)).digest('hex'); }
function failWait(key) {
  const row = prep('SELECT blocked_until FROM login_attempts WHERE k=?').get(failKey(key));
  return row && row.blocked_until > Date.now() ? Math.ceil((row.blocked_until - Date.now()) / 1000) : 0;
}
function failAdd(key) {
  const k = failKey(key), now = Date.now();
  const row = prep('SELECT n FROM login_attempts WHERE k=?').get(k);
  const n = (row ? Number(row.n) : 0) + 1;
  const until = n >= 5 ? now + Math.min(300, 30 * Math.pow(2, n - 5)) * 1000 : 0;
  prep('INSERT OR REPLACE INTO login_attempts(k,n,blocked_until,updated) VALUES(?,?,?,?)').run(k, n, until, now);
  // Limitar el crecimiento de la tabla sin borrar bloqueos recientes.
  prep('DELETE FROM login_attempts WHERE updated < ?').run(now - 30 * 24 * 60 * 60 * 1000);
  return n;
}
const failClear = key => prep('DELETE FROM login_attempts WHERE k=?').run(failKey(key));
function newSession(u) { const t = crypto.randomBytes(24).toString('hex'); sessions.set(t, { uid: u.id, name: u.name, role: u.role, exp: Date.now() + SES_MS }); return t; }
setInterval(() => { const n = Date.now(); for (const [t, s] of sessions) if (s.exp < n) sessions.delete(t); }, 600000).unref();

/* ---------- Copias de seguridad ---------- */
const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); };
const dayStamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); };
function makeBackup(label, name) {
  const file = path.join(COPIAS, (name || (label + '-' + stamp())) + '.db');
  if (fs.existsSync(file)) return path.basename(file);
  db.exec("VACUUM INTO '" + file.replace(/'/g, "''") + "'");
  pruneBackups();
  setMeta('lastBackup', nowIso());
  return path.basename(file);
}
function listBackups() {
  return fs.readdirSync(COPIAS).filter(f => /^[a-z]+-[0-9T-]+\.db$/.test(f)).map(f => { const s = fs.statSync(path.join(COPIAS, f)); return { name: f, size: s.size, at: s.mtime.toISOString() }; }).sort((a, b) => b.at.localeCompare(a.at));
}
function pruneBackups() {
  const keep = { auto: 14, manual: 30, antes: 10 }, all = listBackups();
  for (const k of Object.keys(keep)) all.filter(b => b.name.startsWith(k + '-')).slice(keep[k]).forEach(b => { try { fs.unlinkSync(path.join(COPIAS, b.name)); } catch (e) {} });
}
function autoBackup() { try { const n = 'auto-' + dayStamp(); if (!fs.existsSync(path.join(COPIAS, n + '.db'))) { makeBackup('auto', n); log('Copia automatica creada: ' + n + '.db'); } } catch (e) { log('ERROR copia automatica: ' + e.message); } }
function copyToConfiguredUsb() {
  if (process.platform !== 'win32') return;
  try {
    const ps = "$ErrorActionPreference='Stop'; Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=2' | Where-Object { $_.VolumeName -eq 'SAINEI_BACKUP' } | Select-Object -ExpandProperty DeviceID | ConvertTo-Json -Compress";
    const raw = childProcess.execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', timeout: 12000, windowsHide: true }).trim();
    if (!raw) return;
    const parsed = JSON.parse(raw), drives = (Array.isArray(parsed) ? parsed : [parsed]).filter(x => /^[A-Z]:$/.test(String(x)));
    for (const drive of drives) {
      const dest = path.join(drive + path.sep, 'SAINEI-RESPALDOS');
      fs.mkdirSync(dest, { recursive: true });
      for (const backup of listBackups()) {
        const source = path.join(COPIAS, backup.name), target = path.join(dest, backup.name);
        if (fs.existsSync(target) && fs.statSync(target).size === backup.size) continue;
        const temp = target + '.partial';
        fs.copyFileSync(source, temp);
        if (fs.statSync(temp).size !== backup.size) { fs.unlinkSync(temp); throw new Error('Verificacion de tamaño fallida: ' + backup.name); }
        fs.renameSync(temp, target);
      }
      log('Respaldos sincronizados en unidad externa SAINEI_BACKUP: ' + dest);
    }
  } catch (e) { log('AVISO: no se pudo sincronizar la copia USB: ' + e.message); }
}
autoBackup();
copyToConfiguredUsb();
setInterval(() => { autoBackup(); copyToConfiguredUsb(); }, 600000).unref();

/* ---------- Registros ---------- */
const getRec = (coll, id) => prep('SELECT j,del FROM rec WHERE coll=? AND id=?').get(coll, id);
const putRec = (coll, id, obj, rev, del) => prep('INSERT OR REPLACE INTO rec(coll,id,j,rev,del) VALUES(?,?,?,?,?)').run(coll, id, JSON.stringify(obj), rev, del ? 1 : 0);
function bumpCounter(kind, id) { const r = prep('SELECT n FROM counters WHERE kind=?').get(kind); if (!r) prep('INSERT INTO counters(kind,n) VALUES(?,?)').run(kind, id); else if (r.n < id) prep('UPDATE counters SET n=? WHERE kind=?').run(id, kind); }

function allowed(user, coll, op, rec, existing) {
  if (user.role === 'admin') return true;
  const p = (PERM[user.role] || {})[coll];
  if (!p || !p[op]) return false;
  if (coll === 'moves' && user.role === 'cajero') { if (!(rec.type === 'venta' && Number(rec.qty) < 0)) return false; }
  if (coll === 'shifts' && user.role !== 'admin') {
    if (op === 'ins' && Number(rec.uid) !== Number(user.uid)) return false;
    if (op === 'upd' && existing && Number(existing.uid) !== Number(user.uid)) return false;
  }
  return true;
}

function processSync(user, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      (body.changes != null && (typeof body.changes !== 'object' || Array.isArray(body.changes))) ||
      (body.sing != null && (typeof body.sing !== 'object' || Array.isArray(body.sing))) ||
      (body.audit != null && !Array.isArray(body.audit))) {
    throw Object.assign(new Error('Estructura de sincronización inválida.'), { code: 400 });
  }
  const res = { rejected: [] }, changes = body.changes || {}, savedRev = REV;
  // Limitar el tamaño lógico de cada lote además del límite HTTP en bytes.
  // Evita que un cliente autenticado monopolice la transacción con miles de filas.
  for (const [coll, batch] of Object.entries(changes)) {
    if (!Object.prototype.hasOwnProperty.call(COLLS, coll) || !batch || typeof batch !== 'object' || Array.isArray(batch) ||
        (batch.up != null && (!Array.isArray(batch.up) || batch.up.length > 1000)) ||
        (batch.del != null && (!Array.isArray(batch.del) || batch.del.length > 1000))) {
      throw Object.assign(new Error('Lote de sincronización inválido o demasiado grande.'), { code: 400 });
    }
  }
  let wrote = false;
  const R = () => { if (!wrote) { wrote = true; REV++; } return REV; };
  // Una venta y sus movimientos de salida se aceptan como una sola unidad.
  // Si falta un movimiento o el stock no alcanza, se rechaza el ticket completo.
  const incomingSales = Array.isArray(changes.sales && changes.sales.up) ? changes.sales.up : [];
  const incomingMoves = Array.isArray(changes.moves && changes.moves.up) ? changes.moves.up : [];
  const rejectedTickets = new Set();
  const rejectedReturnTickets = new Set();
  const validReturnTickets = new Set();
  const virtualStock = new Map();
  const ticketMoves = new Map();
  // Una devolución y su reposición de inventario deben aceptarse juntas.
  const returnMoves = new Map();
  const returnMoveIds = new Set();
  const duplicateReturnMoveTickets = new Set();
  for (const move of incomingMoves) {
    const match = /^Devolución ticket (\\d+)$/.exec(String(move && move.note || ''));
    if (!match) continue;
    const ticket = Number(match[1]);
    if (!returnMoves.has(ticket)) returnMoves.set(ticket, []);
    returnMoves.get(ticket).push(move);
    const moveId = Number(move && move.id);
    if (!Number.isInteger(moveId) || moveId <= 0 || returnMoveIds.has(moveId) || getRec('moves', moveId)) duplicateReturnMoveTickets.add(ticket);
    returnMoveIds.add(moveId);
  }
  for (const sale of incomingSales) {
    const saleId = Number(sale && sale.id), row = Number.isInteger(saleId) ? getRec('sales', saleId) : null;
    if (!row || row.del) continue;
    const previous = JSON.parse(row.j), before = Array.isArray(previous.returns) ? previous.returns : [];
    const after = Array.isArray(sale.returns) ? sale.returns : [];
    if (after.length <= before.length) continue;
    const required = new Map(), supplied = new Map(), cumulative = new Map();
    let valid = !duplicateReturnMoveTickets.has(saleId);
    for (let i = 0; i < before.length; i++) if (JSON.stringify(before[i]) !== JSON.stringify(after[i])) valid = false;
    if (after.length < before.length) valid = false;
    const sold = Array.isArray(previous.items) ? previous.items : [];
    // Sumar devoluciones anteriores y nuevas por línea de venta: nunca permitir
    // que la cantidad acumulada devuelta supere lo que realmente se vendió.
    let creditedTotal = 0;
    const originalCredit = previous.creditAmount != null ? Math.max(0, Number(previous.creditAmount) || 0) : (previous.method === 'credito' ? Math.max(0, Number(previous.total) || 0) : 0);
    for (const ret of after) {
      if (!ret || !ret.id || !Array.isArray(ret.items) || !ret.items.length ||
          !Number.isSafeInteger(Number(ret.amount)) || Number(ret.amount) < 0 ||
          !['caja', 'banco', 'credito', 'mixto'].includes(ret.method) || !Number.isFinite(Date.parse(ret.date || ''))) { valid = false; break; }
      const hasAllocation = ['cashAmount','bankAmount','creditAmount'].some(k => Object.prototype.hasOwnProperty.call(ret, k));
      const cashPart = hasAllocation ? Number(ret.cashAmount || 0) : (ret.method === 'caja' ? Number(ret.amount) : 0);
      const bankPart = hasAllocation ? Number(ret.bankAmount || 0) : (ret.method === 'banco' ? Number(ret.amount) : 0);
      const creditPart = hasAllocation ? Number(ret.creditAmount || 0) : 0;
      if (![cashPart, bankPart, creditPart].every(v => Number.isSafeInteger(v) && v >= 0) ||
          cashPart + bankPart + creditPart !== Number(ret.amount) ||
          (ret.totalAmount != null && Number(ret.totalAmount) !== Number(ret.amount))) { valid = false; break; }
      creditedTotal += creditPart;
      let expectedAmount = 0;
      const discount = Math.max(0, Math.min(100, Number(previous.discPct) || 0));
      for (const item of ret.items) {
        const ix = Number(item.lineIndex), qty = Number(item.qty), src = sold[ix];
        if (!Number.isInteger(ix) || ix < 0 || ix >= sold.length || !src || !Number.isFinite(qty) || qty <= 0 || Number(item.id) !== Number(src.id)) { valid = false; break; }
        const lineAmount = Number(src.amount != null ? src.amount : Number(src.price || 0) * Number(src.qty || 0));
        const soldQty = Number(src.qty || 0);
        if (!Number.isFinite(lineAmount) || lineAmount < 0 || !Number.isFinite(soldQty) || soldQty <= 0 || qty > soldQty) { valid = false; break; }
        expectedAmount += Math.round((lineAmount / soldQty) * qty * (1 - discount / 100));
        cumulative.set(ix, round3((cumulative.get(ix) || 0) + qty));
      }
      if (!valid || Math.round(Number(ret.amount)) !== expectedAmount) { valid = false; break; }
    }
    for (const [ix, qty] of cumulative) if (qty > Number(sold[ix].qty || 0) + 0.001) valid = false;
    if (creditedTotal > originalCredit + 0.001) valid = false;
    for (const ret of after.slice(before.length)) {
      if (!ret || !ret.id || !Array.isArray(ret.items) || !ret.items.length) { valid = false; break; }
      for (const item of ret.items) {
        const ix = Number(item.lineIndex), qty = Number(item.qty), src = sold[ix];
        if (!Number.isInteger(ix) || ix < 0 || ix >= sold.length || !src || !Number.isFinite(qty) || qty <= 0 || Number(item.id) !== Number(src.id)) { valid = false; break; }
        const pid = Number(src.id);
        required.set(pid, round3((required.get(pid) || 0) + qty));
      }
      if (!valid) break;
    }
    for (const move of (returnMoves.get(saleId) || [])) {
      const pid = Number(move.pid), qty = Number(move.qty);
      if (!Number.isInteger(pid) || !Number.isFinite(qty) || qty <= 0 || move.type !== 'devolucion') { valid = false; continue; }
      supplied.set(pid, round3((supplied.get(pid) || 0) + qty));
    }
    if (required.size !== supplied.size) valid = false;
    for (const [pid, qty] of required) if (Math.abs((supplied.get(pid) || 0) - qty) > 0.001) valid = false;
    for (const pid of supplied.keys()) if (!required.has(pid)) valid = false;
    if (!valid) rejectedReturnTickets.add(saleId); else validReturnTickets.add(saleId);
  }
  for (const move of incomingMoves) {
    const match = /^Ticket (\d+)$/.exec(String(move && move.note || ''));
    if (!match) continue;
    const ticket = Number(match[1]);
    if (!ticketMoves.has(ticket)) ticketMoves.set(ticket, []);
    ticketMoves.get(ticket).push(move);
  }
  for (const sale of incomingSales) {
    const saleId = Number(sale && sale.id);
    if (!Number.isInteger(saleId) || saleId <= 0 || getRec('sales', saleId)) continue;
    const moves = ticketMoves.get(saleId) || [];
    const required = new Map(), delivered = new Map();
    for (const item of (Array.isArray(sale.items) ? sale.items : [])) {
      const pid = Number(item && item.id), qty = Number(item && item.qty);
      if (!Number.isInteger(pid) || pid <= 0 || !Number.isFinite(qty) || qty <= 0) { rejectedTickets.add(saleId); break; }
      required.set(pid, round3((required.get(pid) || 0) + qty));
    }
    if (!rejectedTickets.has(saleId)) {
      for (const move of moves) {
        const pid = Number(move.pid), qty = Number(move.qty);
        if (!Number.isInteger(pid) || !Number.isFinite(qty) || qty >= 0) continue;
        delivered.set(pid, round3((delivered.get(pid) || 0) - qty));
      }
      for (const [pid, qty] of required) if (Math.abs((delivered.get(pid) || 0) - qty) > 0.001) rejectedTickets.add(saleId);
      for (const pid of delivered.keys()) if (!required.has(pid)) rejectedTickets.add(saleId);
      // Reservar virtualmente el stock para validar también varias ventas del mismo lote.
      if (!rejectedTickets.has(saleId)) {
        for (const [pid, qty] of required) {
          const productRow = getRec('products', pid);
          const current = virtualStock.has(pid) ? virtualStock.get(pid) : (productRow && !productRow.del ? Number(JSON.parse(productRow.j).stock || 0) : NaN);
          if (!Number.isFinite(current) || round3(current - qty) < 0) { rejectedTickets.add(saleId); break; }
        }
        if (!rejectedTickets.has(saleId)) for (const [pid, qty] of required) {
          const productRow = getRec('products', pid), current = virtualStock.has(pid) ? virtualStock.get(pid) : Number(JSON.parse(productRow.j).stock || 0);
          virtualStock.set(pid, round3(current - qty));
        }
      }
    }
    if (!moves.length) rejectedTickets.add(saleId);
  }
  try {
    tx(() => {
      for (const coll of ORDER) {
        const c = changes[coll]; if (!c) continue;
        const kind = COLLS[coll];
        for (const rec of (Array.isArray(c.up) ? c.up : [])) {
          const id = Number(rec && rec.id);
          if (!rec || !Number.isInteger(id) || id <= 0) { res.rejected.push({ coll, id }); continue; }
          const row = getRec(coll, id);
          if (row && row.del) { res.rejected.push({ coll, id }); continue; }
          if (coll === 'sales' && !row && rejectedTickets.has(id)) { res.rejected.push({ coll, id }); continue; }
          if (coll === 'sales' && rejectedReturnTickets.has(id)) { res.rejected.push({ coll, id }); continue; }
          if (coll === 'moves' && !row) {
            const returnTicket = /^Devolución ticket (\\d+)$/.exec(String(rec.note || ''));
            if (returnTicket && !validReturnTickets.has(Number(returnTicket[1]))) { res.rejected.push({ coll, id }); continue; }
          }
          if (coll === 'moves' && !row) {
            const ticket = /^Ticket (\d+)$/.exec(String(rec.note || ''));
            if (ticket && rejectedTickets.has(Number(ticket[1]))) { res.rejected.push({ coll, id }); continue; }
          }
          const ex = row ? JSON.parse(row.j) : null, op = ex ? 'upd' : 'ins';
          if (coll === 'purchases') {
            // Las compras son documentos contables: no permitir alterar su total,
            // proveedor o detalle después de registrarlas y posiblemente pagarlas.
            if (ex) {
              if (JSON.stringify(ex) !== JSON.stringify(rec)) res.rejected.push({ coll, id });
              continue;
            }
            const supplier = String(rec.supplier || '').trim();
            const items = Array.isArray(rec.items) ? rec.items : [];
            let computedTotal = 0, validPurchase = !!supplier && supplier.length <= 120 && items.length > 0 &&
              ['contado', 'credito'].includes(String(rec.cond || '')) &&
              Number.isSafeInteger(Number(rec.total)) && Number(rec.total) > 0 &&
              Number.isFinite(Date.parse(rec.date));
            for (const item of items) {
              const pid = Number(item && item.pid), qty = Number(item && item.qty), cost = Number(item && item.cost);
              const productRow = Number.isInteger(pid) && pid > 0 ? getRec('products', pid) : null;
              if (!productRow || productRow.del || !Number.isFinite(qty) || qty <= 0 ||
                  !Number.isSafeInteger(cost) || cost < 0) { validPurchase = false; break; }
              computedTotal += Math.round(qty * cost);
              if (!Number.isSafeInteger(computedTotal)) { validPurchase = false; break; }
            }
            if (!validPurchase || computedTotal !== Number(rec.total) ||
                (rec.cond === 'credito' && rec.due != null && !Number.isFinite(Date.parse(rec.due)))) {
              res.rejected.push({ coll, id });
              continue;
            }
          }
          if (coll === 'products') {
            const name = String(rec.name || '').trim();
            const price = Number(rec.price), cost = Number(rec.cost || 0), min = Number(rec.min || 0);
            if (!name || name.length > 160 || !Number.isSafeInteger(price) || price < 0 ||
                !Number.isSafeInteger(cost) || cost < 0 || !Number.isFinite(min) || min < 0 ||
                !['u', 'peso', 'medida'].includes(String(rec.type || 'u'))) {
              res.rejected.push({ coll, id });
              continue;
            }
          }
          if (coll === 'shifts' && user.role !== 'admin') {
            const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
            if (!ex) {
              const anotherOpenShift = prep('SELECT id,j FROM rec WHERE coll=? AND del=0').all('shifts')
                .some(row => Number(row.id) !== id && Number(JSON.parse(row.j).uid) === Number(user.uid) && !JSON.parse(row.j).closedAt);
              if (Number(rec.uid) !== Number(user.uid) || !validDate(rec.openAt) ||
                  !Number.isSafeInteger(Number(rec.openAmt)) || Number(rec.openAmt) < 0 ||
                  (rec.closedAt != null && rec.closedAt !== '') || anotherOpenShift) {
                res.rejected.push({ coll, id }); continue;
              }
            } else {
              if (Number(ex.uid) !== Number(user.uid) || Number(rec.uid) !== Number(ex.uid) ||
                  rec.openAt !== ex.openAt || Number(rec.openAmt) !== Number(ex.openAmt) ||
                  rec.by !== ex.by || ex.closedAt) {
                res.rejected.push({ coll, id }); continue;
              }
              const counted = Number(rec.counted), expected = Number(rec.expected), diff = Number(rec.diff);
              if (!validDate(rec.closedAt) || !Number.isSafeInteger(counted) || counted < 0 ||
                  !Number.isFinite(expected) || !Number.isFinite(diff) ||
                  Math.abs((counted - expected) - diff) > 0.001 ||
                  String(rec.closedBy || '') !== user.name || String(rec.closedByRole || '') !== user.role) {
                res.rejected.push({ coll, id }); continue;
              }
            }
          }
          if (coll === 'payments' && !ex) {
            const clientId = Number(rec.clientId), amount = Number(rec.amount), shiftId = Number(rec.shiftId || 0);
            const clientRow = Number.isInteger(clientId) && clientId > 0 ? getRec('clients', clientId) : null;
            const validMethods = ['efectivo', 'transferencia', 'tarjeta'];
            const dateValue = Date.parse(rec.date);
            const shiftRow = shiftId > 0 ? getRec('shifts', shiftId) : null;
            if (!clientRow || clientRow.del || !Number.isSafeInteger(amount) || amount <= 0 ||
                !validMethods.includes(String(rec.method || '')) ||
                !Number.isFinite(dateValue) || !Number.isInteger(shiftId) || shiftId < 0 ||
                (shiftId > 0 && (!shiftRow || shiftRow.del)) ||
                (shiftId > 0 && rec.method !== 'efectivo') ||
                (shiftId > 0 && !!JSON.parse(shiftRow.j).closedAt) ||
                (shiftId > 0 && user.role !== 'admin' && Number(JSON.parse(shiftRow.j).uid) !== Number(user.uid))) {
              res.rejected.push({ coll, id });
              continue;
            }
          }
          if (coll === 'spay' && ex) {
            // Los comprobantes de pago son registros de auditoría: no se editan ni
            // se reasignan después de aceptados. Los ajustes requieren un registro nuevo.
            if (JSON.stringify(ex) !== JSON.stringify(rec)) res.rejected.push({ coll, id });
            continue;
          }
          if (coll === 'payments' && ex) {
            // Evitar alterar retroactivamente cobros ya asentados.
            if (JSON.stringify(ex) !== JSON.stringify(rec)) res.rejected.push({ coll, id });
            continue;
          }
          if (coll === 'spay') {
            const purchId = Number(rec.purchId), amount = Number(rec.amount), shiftId = Number(rec.shiftId || 0);
            const purchaseRow = Number.isInteger(purchId) && purchId > 0 ? getRec('purchases', purchId) : null;
            const methods = ['caja', 'banco'];
            const dateValue = Date.parse(rec.date);
            const shiftRow = shiftId > 0 ? getRec('shifts', shiftId) : null;
            let paidBefore = 0;
            if (purchaseRow && !purchaseRow.del) {
              for (const item of prep('SELECT id,j FROM rec WHERE coll=? AND del=0').all('spay')) {
                if (Number(item.id) === id) continue;
                const payment = JSON.parse(item.j);
                if (Number(payment.purchId) === purchId) paidBefore += Number(payment.amount) || 0;
              }
            }
            const purchase = purchaseRow && !purchaseRow.del ? JSON.parse(purchaseRow.j) : null;
            if (!purchase || !Number.isSafeInteger(Number(purchase.total)) || Number(purchase.total) <= 0 ||
                !Number.isSafeInteger(amount) || amount <= 0 || !methods.includes(String(rec.method || '')) ||
                !Number.isFinite(dateValue) || !Number.isInteger(shiftId) || shiftId < 0 ||
                paidBefore + amount > Number(purchase.total) ||
                (shiftId > 0 && (!shiftRow || shiftRow.del)) ||
                (shiftId > 0 && rec.method !== 'caja') ||
                (shiftId > 0 && !!JSON.parse(shiftRow.j).closedAt) ||
                (shiftId > 0 && user.role !== 'admin' && Number(JSON.parse(shiftRow.j).uid) !== Number(user.uid)) ||
                (shiftId === 0 && rec.method === 'caja')) {
              res.rejected.push({ coll, id });
              continue;
            }
          }
          if (coll === 'expenses') {
            const amount = Number(rec.amount), shiftId = Number(rec.shiftId || 0);
            const methods = ['caja', 'banco'];
            const dateValue = Date.parse(rec.date);
            const concept = String(rec.concept || '').trim();
            const shiftRow = shiftId > 0 ? getRec('shifts', shiftId) : null;
            const shift = shiftRow && !shiftRow.del ? JSON.parse(shiftRow.j) : null;
            if (!concept || concept.length > 80 || !Number.isSafeInteger(amount) || amount <= 0 ||
                !methods.includes(String(rec.method || '')) || !Number.isFinite(dateValue) ||
                !Number.isInteger(shiftId) || shiftId < 0 ||
                (shiftId > 0 && (!shift || rec.method !== 'caja')) ||
                (shiftId === 0 && rec.method === 'caja') ||
                (shiftId > 0 && !!shift.closedAt) ||
                (shiftId > 0 && user.role !== 'admin' && Number(shift.uid) !== Number(user.uid))) {
              res.rejected.push({ coll, id });
              continue;
            }
          }
          if (coll === 'suspendedSales' && user.role === 'cajero' && ((ex && Number(ex.uid) !== user.id) || Number(rec.uid) !== user.id)) { res.rejected.push({ coll, id }); continue; }
          if (!allowed(user, coll, op, rec, ex)) { res.rejected.push({ coll, id }); continue; }
          // Validar cada movimiento contra el stock vigente dentro de la transacción.
          // Evita que dos cajas descuenten simultáneamente unidades inexistentes.
          if (coll === 'moves' && !ex) {
            const pid = Number(rec.pid), qty = Number(rec.qty), productRow = Number.isInteger(pid) && pid > 0 ? getRec('products', pid) : null;
            if (!productRow || productRow.del || !Number.isFinite(qty) || qty === 0 ||
                Math.abs(qty) > 1000000000 || !Number.isFinite(Date.parse(rec.date)) ||
                String(rec.type || '').length > 32 || String(rec.note || '').length > 240) {
              res.rejected.push({ coll, id }); continue;
            }
            const product = JSON.parse(productRow.j), nextStock = round3(Number(product.stock || 0) + qty);
            if (!Number.isFinite(nextStock) || nextStock < 0) { res.rejected.push({ coll, id }); continue; }
          }
          let out = rec;
          if (coll === 'products') { out = Object.assign({}, rec, { stock: ex ? ex.stock : 0 }); }
          else if (coll === 'sales' && ex) {
            if (ex.void || rec.void) {
              if (!ex.void && rec.void) out = Object.assign({}, ex, { void: true, voidBy: String(rec.voidBy || user.name) });
              else continue;
            } else {
              // Las ventas existentes son inmutables, salvo agregar devoluciones verificadas.
              const before = Object.assign({}, ex), after = Object.assign({}, rec);
              delete before.returns; delete after.returns;
              if (JSON.stringify(before) !== JSON.stringify(after)) { res.rejected.push({ coll, id }); continue; }
              const oldReturns = Array.isArray(ex.returns) ? ex.returns : [];
              const newReturns = Array.isArray(rec.returns) ? rec.returns : [];
              if (newReturns.length < oldReturns.length || oldReturns.some((r, i) => JSON.stringify(r) !== JSON.stringify(newReturns[i]))) { res.rejected.push({ coll, id }); continue; }
              const known = new Set(oldReturns.map(r => String(r.id)));
              const sold = Array.isArray(ex.items) ? ex.items : [];
              const used = sold.map((_, i) => oldReturns.reduce((n, r) => n + (r.items || []).filter(x => Number(x.lineIndex) === i).reduce((a, x) => a + Number(x.qty || 0), 0), 0));
              let valid = true;
              for (const ret of newReturns.slice(oldReturns.length)) {
                if (!ret || !ret.id || known.has(String(ret.id)) || !Array.isArray(ret.items) || !ret.items.length) { valid = false; break; }
                known.add(String(ret.id));
                for (const item of ret.items) {
                  const ix = Number(item.lineIndex), qty = Number(item.qty);
                  if (!Number.isInteger(ix) || ix < 0 || ix >= sold.length || !Number.isFinite(qty) || qty <= 0 || used[ix] + qty > Number(sold[ix].qty || 0) + 1e-9) { valid = false; break; }
                  used[ix] += qty;
                }
                if (!valid) break;
              }
              if (!valid) { res.rejected.push({ coll, id }); continue; }
              out = Object.assign({}, ex, { returns: newReturns });
            }
          }
          else if ((coll === 'payments' || coll === 'moves') && ex) continue;
          else if (coll === 'clients' && user.role === 'cajero') { out = Object.assign({}, rec, { limit: ex ? ex.limit : 0 }); }
          if (coll === 'sales' && !ex) out = Object.assign({}, rec, { uname: rec.uname || user.name });
          putRec(coll, id, out, R(), 0); bumpCounter(kind, id);
          if (coll === 'moves' && !ex) {
            const pr = getRec('products', Number(rec.pid));
            if (pr && !pr.del) { const p = JSON.parse(pr.j); p.stock = Math.max(0, round3((p.stock || 0) + Number(rec.qty || 0))); putRec('products', p.id, p, R(), 0); }
          }
        }
        for (const id0 of (Array.isArray(c.del) ? c.del : [])) {
          const id = Number(id0), row = getRec(coll, id);
          if (!row || row.del) continue;
          if (!DELETABLE[coll] || !allowed(user, coll, 'del', {}, null)) { res.rejected.push({ coll, id }); continue; }
          prep('UPDATE rec SET del=1, rev=? WHERE coll=? AND id=?').run(R(), coll, id);
        }
      }
      if (body.sing && typeof body.sing === 'object') {
        const clientSince = Math.max(0, parseInt(body.since || 0, 10) || 0);
        for (const k of SING) {
          if (!(k in body.sing)) continue;
          if (user.role !== 'admin') { res.rejected.push({ sing: k }); continue; }
          // Rechazar escrituras basadas en una revisión anterior a la última edición
          // de esta configuración. collect() devolverá al cliente el valor vigente.
          const current = prep('SELECT rev FROM sing WHERE k=?').get(k);
          if (current && Number(current.rev) > clientSince) {
            res.rejected.push({ sing: k, conflict: true });
            continue;
          }
          const v = Object.assign({}, body.sing[k]); if (k === 'sec') delete v.rec;
          prep('INSERT OR REPLACE INTO sing(k,j,rev) VALUES(?,?,?)').run(k, JSON.stringify(v), R());
        }
      }
      for (const e of (Array.isArray(body.audit) ? body.audit.slice(0, 200) : [])) audit(user.name, e && e.a);
      if (wrote) setMeta('rev', REV);
    });
  } catch (e) { REV = savedRev; throw e; }
  return res;
}

function collect(since, res) {
  const recs = {}, dels = {}, sing = {};
  for (const coll of Object.keys(COLLS)) {
    recs[coll] = []; dels[coll] = [];
    for (const r of prep('SELECT id,j,del FROM rec WHERE coll=? AND rev>?').all(coll, since)) {
      if (r.del) { if (since > 0) dels[coll].push(r.id); } else recs[coll].push(JSON.parse(r.j));
    }
  }
  for (const r of prep('SELECT k,j FROM sing WHERE rev>?').all(since)) sing[r.k] = JSON.parse(r.j);
  if (res && res.rejected && res.rejected.length) {
    for (const x of res.rejected) {
      if (x.sing) { const r = prep('SELECT j FROM sing WHERE k=?').get(x.sing); if (r) sing[x.sing] = JSON.parse(r.j); continue; }
      const row = getRec(x.coll, x.id);
      if (row && !row.del) { if (!recs[x.coll].some(o => o.id === x.id)) recs[x.coll].push(JSON.parse(row.j)); }
      else dels[x.coll].push(x.id);
    }
  }
  return { recs, dels, sing };
}

function fullState() {
  const st = { v: 2, exportedAt: nowIso() };
  const c = collect(0, null);
  Object.assign(st, c.sing, c.recs);
  st.users = allUsers().map(pubUser);
  return st;
}

function resetEpoch() { EPOCH = crypto.randomBytes(6).toString('hex'); setMeta('epoch', EPOCH); }

function validateRestoreState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s) ||
      !Array.isArray(s.products) || !Array.isArray(s.sales)) return false;
  for (const coll of Object.keys(COLLS)) {
    if (s[coll] == null) continue;
    if (!Array.isArray(s[coll]) || s[coll].length > 100000) return false;
    const ids = new Set();
    for (const rec of s[coll]) {
      if (!rec || typeof rec !== 'object' || Array.isArray(rec) ||
          !Number.isSafeInteger(rec.id) || rec.id <= 0 || ids.has(rec.id)) return false;
      ids.add(rec.id);
    }
  }
  for (const k of SING) {
    if (s[k] != null && (typeof s[k] !== 'object' || Array.isArray(s[k]))) return false;
  }
  return true;
}

function restoreJson(s) {
  if (!validateRestoreState(s)) throw Object.assign(new Error('El archivo no es una copia válida o contiene registros incorrectos.'), { code: 400 });
  makeBackup('antes');
  tx(() => {
    REV++; prep('DELETE FROM rec').run();
    for (const coll of Object.keys(COLLS)) for (const rec of (Array.isArray(s[coll]) ? s[coll] : [])) {
      const id = Number(rec && rec.id); if (!Number.isInteger(id) || id <= 0) continue;
      putRec(coll, id, rec, REV, 0); bumpCounter(COLLS[coll], id);
    }
    for (const k of SING) if (s[k] && typeof s[k] === 'object') { const v = Object.assign({}, s[k]); if (k === 'sec') delete v.rec; prep('INSERT OR REPLACE INTO sing(k,j,rev) VALUES(?,?,?)').run(k, JSON.stringify(v), REV); }
    setMeta('rev', REV);
  });
  resetEpoch();
}
function restoreFile(name) {
  const file = path.join(COPIAS, path.basename(name));
  if (!/^[a-z]+-[0-9T-]+\.db$/.test(path.basename(name)) || !fs.existsSync(file)) throw new Error('No existe esa copia.');
  makeBackup('antes');
  db.exec("ATTACH DATABASE '" + file.replace(/'/g, "''") + "' AS bk");
  try {
    tx(() => {
      const bkRev = (db.prepare("SELECT v FROM bk.meta WHERE k='rev'").get() || { v: '0' }).v;
      REV = Math.max(REV, parseInt(bkRev, 10) || 0) + 1;
      for (const t of ['rec', 'sing', 'counters', 'users', 'audit']) { db.exec('DELETE FROM main.' + t); db.exec('INSERT INTO main.' + t + ' SELECT * FROM bk.' + t); }
      db.exec('UPDATE main.rec SET rev=' + REV + '; UPDATE main.sing SET rev=' + REV);
      for (const k of ['recSalt', 'recHash']) { const r = db.prepare('SELECT v FROM bk.meta WHERE k=?').get(k); if (r) setMeta(k, r.v); }
      setMeta('rev', REV);
    });
  } finally { db.exec('DETACH DATABASE bk'); }
  resetEpoch(); sessions.clear();
}
function clearAll() {
  makeBackup('antes');
  tx(() => { REV++; prep('DELETE FROM rec').run(); setMeta('rev', REV); });
  resetEpoch();
}

/* ---------- HTTP ---------- */
const MAXB = 25 * 1024 * 1024;
function readBody(req) {
  return new Promise((res, rej) => {
    const ch = []; let n = 0;
    req.on('data', d => { n += d.length; if (n > MAXB) { rej(Object.assign(new Error('Demasiado grande'), { code: 413 })); req.destroy(); } else ch.push(d); });
    req.on('end', () => { try { res(ch.length ? JSON.parse(Buffer.concat(ch).toString('utf8')) : {}); } catch (e) { rej(Object.assign(new Error('JSON invalido'), { code: 400 })); } });
    req.on('error', rej);
  });
}
function send(res, code, obj, extra) {
  const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' }, extra || {}));
  res.end(body);
}
const fail = (res, code, msg, more) => send(res, code, Object.assign({ error: msg }, more || {}));
function auth(req) {
  const h = req.headers['authorization'] || ''; const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  const s = sessions.get(t); if (!s || s.exp < Date.now()) return null;
  s.exp = Date.now() + SES_MS; return Object.assign({ token: t }, s);
}
function lastBackup() { return getMeta('lastBackup'); }
function info() {
  const sh = prep("SELECT j FROM sing WHERE k='shop'").get();
  return { server: true, demo: DEMO, version: 1, hasAdmin: hasAdmin(), shopName: sh ? (JSON.parse(sh.j).name || '') : '', users: allUsers().filter(u => u.active).map(pubUser), lastBackup: lastBackup() };
}
const networkClients = new Map();
function localAddresses() {
  const out=[]; for (const list of Object.values(os.networkInterfaces())) for (const a of (list||[])) if (a.family==='IPv4'&&!a.internal) out.push(a.address);
  return [...new Set(out)];
}
function trackClient(req, ip) {
  if (!ip || ip==='127.0.0.1' || ip==='::1') return;
  const token=String(req.headers.authorization||'').replace('Bearer ','');
  const session=sessions.get(token), ua=String(req.headers['user-agent']||'');
  const key=ip+'|'+ua.slice(0,100);
  networkClients.set(key,{ip,ua:ua.slice(0,180),name:session?session.name:'Dispositivo sin identificar',role:session?session.role:'visitante',lastSeen:Date.now(),authenticated:!!session});
  const cutoff=Date.now()-30*60*1000;
  for(const [k,v] of networkClients) if(v.lastSeen<cutoff) networkClients.delete(k);
}
const CT = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };

async function handle(req, res) {
  const url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method;
  const ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
  trackClient(req, ip);
  // Rechazar peticiones mutables iniciadas desde otro sitio web.
  if (p.startsWith('/api/') && !['GET','HEAD','OPTIONS'].includes(m)) {
    const origin = req.headers.origin;
    if (origin) {
      try { if (new URL(origin).host !== req.headers.host) return fail(res, 403, 'Origen no permitido.'); }
      catch (_) { return fail(res, 403, 'Origen no permitido.'); }
    }
  }
  if (!p.startsWith('/api/')) {
    if (m !== 'GET' && m !== 'HEAD') return fail(res, 405, 'Metodo no permitido');
    if (p === '/' || p === '/index.html') {
      if (!fs.existsSync(APP)) return fail(res, 500, 'Falta app/index.html');
      res.writeHead(200, { 'Content-Type': CT['.html'], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      return res.end(fs.readFileSync(APP));
    }
    if (/^\/sainei-mod-[a-z0-9_-]+\.js$/i.test(p)) {
      const name = p.slice(1), file = path.join(ROOT, name);
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return fail(res, 404, 'Módulo no encontrado');
      res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      return res.end(fs.readFileSync(file));
    }
    const ST = { '/manifest.webmanifest': 'application/manifest+json', '/sw.js': 'text/javascript; charset=utf-8', '/icon-192.png': 'image/png', '/icon-512.png': 'image/png', '/icon-maskable-512.png': 'image/png', '/apple-touch-icon.png': 'image/png' };
    if (ST[p]) {
      const f = path.join(path.dirname(APP), p.slice(1));
      if (!fs.existsSync(f)) return fail(res, 404, 'No encontrado');
      res.writeHead(200, { 'Content-Type': ST[p], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Service-Worker-Allowed': '/' });
      return res.end(fs.readFileSync(f));
    }
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
    return fail(res, 404, 'No encontrado');
  }
  if (p === '/api/ping') return send(res, 200, { ok: true, server: true });
  if (p === '/api/modules' && m === 'GET') {
    const modules = fs.readdirSync(ROOT).filter(f => /^sainei-mod-[a-z0-9_-]+\.js$/i.test(f) && fs.statSync(path.join(ROOT, f)).isFile()).sort();
    return send(res, 200, { modules });
  }
  if (p === '/api/license/status' && m === 'GET') return send(res, 200, licenseState());
  if (p === '/api/license/activate' && m === 'POST') {
    const b = await readBody(req), token = String(b.code || '').trim();
    const parts = token.split('.');
    if (parts.length !== 2) return fail(res, 400, 'Código de activación inválido.');
    try {
      const payload = Buffer.from(parts[0], 'base64url').toString('utf8');
      const sig = Buffer.from(parts[1], 'base64url');
      if (!crypto.verify('RSA-SHA256', Buffer.from(parts[0]), LICENSE_PUBLIC_KEY, sig)) return fail(res, 400, 'Código no válido.');
      const d = JSON.parse(payload);
      if (d.installId !== INSTALL_ID && !LEGACY_INSTALL_IDS.includes(String(d.installId || '').toUpperCase())) return fail(res, 400, 'Este código pertenece a otra instalación.');
      if (!['permanent','monthly'].includes(d.type)) return fail(res, 400, 'Tipo de licencia inválido.');
      if (d.type === 'monthly' && (!d.expiresAt || Date.now() > d.expiresAt)) return fail(res, 400, 'La licencia mensual ya venció.');
      setMeta('licenseToken', token); audit('LICENCIA', 'Activación ' + d.type + ' para ' + String(d.customer || 'cliente'));
      return send(res, 200, { ok: true, license: licenseState() });
    } catch (_) { return fail(res, 400, 'No se pudo verificar el código.'); }
  }
  if (p === '/api/info' && m === 'GET') return send(res, 200, info());

  if (p === '/api/setup' && m === 'POST') {
    if (!licenseState().active) return fail(res, 403, 'Activá SAINEI POS con tu código de licencia.');
    const b = await readBody(req);
    if (hasAdmin()) return fail(res, 409, 'Ya existe un usuario principal.');
    const name = String(b.name || '').trim().slice(0, 40), pin = String(b.pin || '');
    if (!name) return fail(res, 400, 'Escribi el nombre.');
    if (weakPin(pin)) return fail(res, 400, 'La clave es muy facil. Usa al menos 4 caracteres y evita 1234 o repetidos.');
    const code = newRecCode(), rc = mkPin(normCode(code));
    const setup = tx(() => {
      // Volver a comprobar dentro de la misma transacción evita dos administradores
      // si llegan solicitudes de configuración inicial al mismo tiempo.
      if (hasAdmin()) return { conflict: true };
      const c = prep('SELECT n FROM counters WHERE kind=?').get('user'), nid = (c ? c.n : 0) + 1;
      prep('INSERT OR REPLACE INTO counters(kind,n) VALUES(?,?)').run('user', nid);
      const k = mkPin(pin); prep('INSERT INTO users(id,name,role,active,salt,hash) VALUES(?,?,?,?,?,?)').run(nid, name, 'admin', 1, k.salt, k.hash);
      setMeta('recSalt', rc.salt); setMeta('recHash', rc.hash); audit(name, 'Creo el usuario principal'); return { id: nid };
    });
    if (setup.conflict) return fail(res, 409, 'Ya existe un usuario principal.');
    return send(res, 200, { ok: true, code, userId: setup.id });
  }
  if (p === '/api/login' && m === 'POST') {
    if (!licenseState().active) return fail(res, 403, 'La licencia no está activa.');
    const b = await readBody(req), uid = Number(b.userId), key = ip + '|' + uid, w = failWait(key);
    if (w > 0) return fail(res, 429, 'Demasiados intentos. Espera ' + w + ' segundos.', { wait: w });
    const u = prep('SELECT * FROM users WHERE id=?').get(uid);
    if (!u || !u.active || !checkPin(u, String(b.pin || ''))) {
      const n = failAdd(key); audit(u ? u.name : '-', 'Clave incorrecta (intento ' + n + ')');
      const w2 = failWait(key); return fail(res, 401, w2 > 0 ? 'Demasiados intentos. Espera ' + w2 + ' segundos.' : 'Clave incorrecta.', { wait: w2 });
    }
    failClear(key); const t = newSession(u); audit(u.name, 'Ingreso al sistema (' + ip + ')');
    return send(res, 200, { token: t, user: pubUser(u) });
  }
  if (p === '/api/recover' && m === 'POST') {
    const b = await readBody(req), uid = Number(b.userId), key = ip + '|rec', w = failWait(key);
    if (w > 0) return fail(res, 429, 'Demasiados intentos. Espera ' + w + ' segundos.', { wait: w });
    const u = prep('SELECT * FROM users WHERE id=?').get(uid), rc = { salt: getMeta('recSalt'), hash: getMeta('recHash') };
    if (!u || u.role !== 'admin' || !u.active || !checkPin(rc, normCode(b.code))) { failAdd(key); audit(u ? u.name : '-', 'Codigo de recuperacion incorrecto'); return fail(res, 401, 'El codigo no es correcto.'); }
    if (weakPin(String(b.pin || ''))) return fail(res, 400, 'La clave nueva es muy facil.');
    failClear(key); const k = mkPin(String(b.pin)); prep('UPDATE users SET salt=?,hash=? WHERE id=?').run(k.salt, k.hash, uid);
    // La recuperación cambia la credencial: revocar todas las sesiones anteriores del administrador.
    for (const [token, session] of [...sessions]) if (session.uid === uid) sessions.delete(token);
    audit(u.name, 'Cambio su clave con el codigo de recuperacion y revoco sus sesiones activas');
    return send(res, 200, { ok: true, reauthenticate: true });
  }

  const me = auth(req);
  if (!me) return fail(res, 401, 'Sesion vencida');
  const admin = me.role === 'admin';
  if (p === '/api/network/status' && m === 'GET') {
    if (!admin) return fail(res,403,'Solo el usuario principal puede consultar la red.');
    const now=Date.now(), clients=[...networkClients.values()].filter(x=>now-x.lastSeen<120000).sort((a,b)=>b.lastSeen-a.lastSeen);
    return send(res,200,{server:true,port:PORT,addresses:localAddresses(),clients,activeSessions:sessions.size,database:fs.existsSync(path.join(DATA,'sainei.db')),lastBackup:lastBackup(),updatedAt:nowIso()});
  }

  if (p === '/api/logout' && m === 'POST') { sessions.delete(me.token); return send(res, 200, { ok: true }); }
  if (p === '/api/me' && m === 'GET') return send(res, 200, { user: { id: me.uid, name: me.name, role: me.role } });
  if (p === '/api/ids' && m === 'GET') {
    const kind = url.searchParams.get('kind'), rawN = url.searchParams.get('n') || '1';
    const requested = Number(rawN), n = Number.isSafeInteger(requested) ? requested : 0;
    if (!Object.values(COLLS).includes(kind) || n < 1 || n > 500) return fail(res, 400, 'Tipo o cantidad invalida');
    // Un usuario limitado solo puede reservar IDs para colecciones donde
    // tenga permiso de alta; conocer otros contadores no debe habilitar su uso.
    if (me.role !== 'admin') {
      const permitted = Object.keys(COLLS).some(coll => COLLS[coll] === kind &&
        !!((PERM[me.role] || {})[coll] || {}).ins);
      if (!permitted) return fail(res, 403, 'No tenes permiso para reservar identificadores de este tipo.');
    }
    const r = tx(() => { const c = prep('SELECT n FROM counters WHERE kind=?').get(kind), cur = c ? c.n : 0; prep('INSERT OR REPLACE INTO counters(kind,n) VALUES(?,?)').run(kind, cur + n); return { start: cur + 1, end: cur + n }; });
    return send(res, 200, r);
  }
  if (p === '/api/sync' && m === 'POST') {
    const b = await readBody(req);
    if (!b || typeof b !== 'object' || Array.isArray(b)) return fail(res, 400, 'Solicitud de sincronización inválida.');
    const since = b.since == null ? 0 : b.since;
    if (!Number.isSafeInteger(since) || since < 0 || (b.epoch != null && (typeof b.epoch !== 'string' || b.epoch.length > 128))) {
      return fail(res, 400, 'Versión de sincronización inválida.');
    }
    if (b.epoch && b.epoch !== EPOCH) { const c = collect(0, null); return send(res, 200, { reset: true, rev: REV, epoch: EPOCH, recs: c.recs, dels: c.dels, sing: c.sing, lastBackup: lastBackup() }); }
    const r = processSync({ uid: me.uid, name: me.name, role: me.role }, b), c = collect(since, r);
    return send(res, 200, { rev: REV, epoch: EPOCH, recs: c.recs, dels: c.dels, sing: c.sing, rejected: r.rejected, lastBackup: lastBackup() });
  }
  if (p === '/api/mypin' && m === 'POST') {
    const b = await readBody(req), u = prep('SELECT * FROM users WHERE id=?').get(me.uid);
    if (!checkPin(u, String(b.old || ''))) return fail(res, 400, 'La clave actual no es correcta.');
    if (weakPin(String(b.pin || ''))) return fail(res, 400, 'La clave nueva es muy facil.');
    const k = mkPin(String(b.pin)); prep('UPDATE users SET salt=?,hash=? WHERE id=?').run(k.salt, k.hash, me.uid);
    // Mantener la sesión actual y revocar las demás sesiones abiertas con la clave anterior.
    for (const [token, session] of [...sessions]) if (session.uid === me.uid && token !== me.token) sessions.delete(token);
    audit(me.name, 'Cambio su clave');
    return send(res, 200, { ok: true });
  }

  if (!admin) return fail(res, 403, 'Solo el usuario principal puede hacer esto.');
  if (p === '/api/users' && m === 'GET') return send(res, 200, { users: allUsers().map(pubUser) });
  if (p === '/api/users' && m === 'POST') {
    const b = await readBody(req), name = String(b.name || '').trim().slice(0, 40), role = String(b.role), pin = String(b.pin || '');
    const id = b.id ? Number(b.id) : 0, ex = id ? prep('SELECT * FROM users WHERE id=?').get(id) : null, active = b.active === false ? 0 : 1;
    if (b.id && (!Number.isSafeInteger(id) || id <= 0)) return fail(res, 400, 'Identificador de usuario invalido.');
    if (id && !ex) return fail(res, 404, 'El usuario que intentas modificar no existe.');
    if (!name) return fail(res, 400, 'Escribi el nombre.');
    if (!ROLES.includes(role)) return fail(res, 400, 'Tipo invalido.');
    if (allUsers().some(o => o.name.toLowerCase() === name.toLowerCase() && (!ex || o.id !== ex.id))) return fail(res, 400, 'Ya existe un usuario con ese nombre.');
    if ((!ex && weakPin(pin)) || (ex && pin && weakPin(pin))) return fail(res, 400, 'La clave es muy facil. Usa al menos 4 caracteres y evita 1234 o repetidos.');
    if (ex) {
      if (ex.id === me.uid && (role !== 'admin' || !active)) return fail(res, 400, 'No podes quitarte tu propio permiso.');
      if (ex.role === 'admin' && ex.active && (role !== 'admin' || !active) && prep("SELECT COUNT(*) n FROM users WHERE role='admin' AND active=1 AND id<>?").get(ex.id).n === 0) return fail(res, 400, 'Tiene que quedar al menos un usuario principal activo.');
      const k = pin ? mkPin(pin) : { salt: ex.salt, hash: ex.hash };
      prep('UPDATE users SET name=?,role=?,active=?,salt=?,hash=? WHERE id=?').run(name, role, active, k.salt, k.hash, ex.id);
      for (const [t, s] of [...sessions]) {
        if (s.uid !== ex.id) continue;
        // Un cambio de clave invalida todas las sesiones anteriores.
        // Un usuario desactivado también pierde acceso inmediatamente.
        if (!active || pin) sessions.delete(t);
        else { s.role = role; s.name = name; }
      }
      audit(me.name, 'Edito al usuario ' + name);
    } else {
      const nid = tx(() => { const c = prep('SELECT n FROM counters WHERE kind=?').get('user'), n = (c ? c.n : 0) + 1; prep('INSERT OR REPLACE INTO counters(kind,n) VALUES(?,?)').run('user', n); const k = mkPin(pin); prep('INSERT INTO users(id,name,role,active,salt,hash) VALUES(?,?,?,?,?,?)').run(n, name, role, 1, k.salt, k.hash); return n; });
      audit(me.name, 'Creo el usuario ' + name + ' (' + role + ')');
    }
    return send(res, 200, { users: allUsers().map(pubUser) });
  }
  if (p === '/api/newrec' && m === 'POST') { if (!admin) return fail(res, 403, 'Solo el administrador principal puede generar un código de recuperación.'); const code = newRecCode(), rc = mkPin(normCode(code)); setMeta('recSalt', rc.salt); setMeta('recHash', rc.hash); audit(me.name, 'Genero un nuevo codigo de recuperacion'); return send(res, 200, { code }); }
  if (p === '/api/audit' && m === 'GET') {
    if (!admin) return fail(res, 403, 'Solo el administrador principal puede consultar la auditoría.');
    const lim = Math.min(1000, Math.max(1, parseInt(url.searchParams.get('limit') || '200', 10) || 200));
    return send(res, 200, { rows: prep('SELECT t,u,a FROM audit ORDER BY id DESC LIMIT ?').all(lim).map(r => ({ t: r.t, u: r.u, a: r.a })) });
  }
  if (p === '/api/export' && m === 'GET') { if (!admin) return fail(res, 403, 'Solo el administrador principal puede exportar los datos.'); audit(me.name, 'Descargo una copia de seguridad'); return send(res, 200, fullState(), { 'Content-Disposition': 'attachment; filename="copia-sainei-' + dayStamp() + '.json"' }); }
  if (p === '/api/restore' && m === 'POST') {
    if (!admin) return fail(res, 403, 'Solo el administrador principal puede restaurar una copia.');
    const b = await readBody(req), s = b && b.state;
    if (!validateRestoreState(s)) return fail(res, 400, 'El archivo no es una copia válida o contiene registros incorrectos.');
    restoreJson(s); audit(me.name, 'Restauro una copia desde archivo'); return send(res, 200, { ok: true });
  }
  if (p === '/api/clear' && m === 'POST') { if (!admin) return fail(res, 403, 'Solo el administrador principal puede vaciar los datos.'); clearAll(); audit(me.name, 'Vacio todos los datos del negocio'); return send(res, 200, { ok: true }); }
  if (p === '/api/backups' && m === 'GET') { if (!admin) return fail(res, 403, 'Solo el administrador principal puede consultar las copias.'); return send(res, 200, { list: listBackups(), dir: COPIAS }); }
  if (p === '/api/backups/make' && m === 'POST') { if (!admin) return fail(res, 403, 'Solo el administrador principal puede crear copias manuales.'); const n = makeBackup('manual'); audit(me.name, 'Hizo una copia manual ' + n); return send(res, 200, { name: n }); }
  if (p === '/api/backups/restore' && m === 'POST') { if (!admin) return fail(res, 403, 'Solo el administrador principal puede restaurar copias.'); const b = await readBody(req); restoreFile(String(b.name || '')); audit(me.name, 'Restauro la copia ' + b.name); return send(res, 200, { ok: true }); }
  return fail(res, 404, 'No encontrado');
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(e => { log('ERROR ' + req.method + ' ' + req.url + ': ' + (e && e.stack || e)); if (!res.headersSent) fail(res, e && e.code === 413 ? 413 : (e && e.code === 400 ? 400 : 500), e && e.code ? e.message : 'Error interno del servidor'); else res.end(); });
});
server.on('error', e => { log(e.code === 'EADDRINUSE' ? 'El puerto ' + PORT + ' ya esta en uso. Cerra otra copia del servidor o cambia el puerto.' : 'ERROR del servidor: ' + e.message); process.exit(1); });
server.listen(PORT, '0.0.0.0', () => {
  const ips = []; for (const l of Object.values(os.networkInterfaces())) for (const a of (l || [])) if (a.family === 'IPv4' && !a.internal) ips.push(a.address);
  const lines = ['SAINEI POS - servidor ' + (DEMO ? 'DE PRUEBA ' : '') + 'en marcha', 'Datos: ' + DATA, 'En esta PC:      http://localhost:' + PORT, ...ips.map(i => 'Desde otras PC:   http://' + i + ':' + PORT)];
  lines.forEach(l => log(l)); try { fs.writeFileSync(path.join(DATA, 'direcciones.txt'), lines.join('\r\n') + '\r\n'); } catch (e) {}
});

/* Descubrimiento automático de servidor para cajas Windows en la misma LAN. */
const discovery = dgram.createSocket({ type: 'udp4', reuseAddr: true });
discovery.on('error', e => log('Aviso descubrimiento LAN: ' + e.message));
discovery.on('message', (msg, remote) => {
  if (msg.toString('utf8').trim() !== 'SAINEI_POS_DISCOVER_V1') return;
  const response = Buffer.from(JSON.stringify({ service: 'SAINEI_POS', version: 1, port: PORT, installId: INSTALL_ID }));
  discovery.send(response, remote.port, remote.address, e => { if (e) log('No se pudo responder al descubrimiento LAN: ' + e.message); });
});
discovery.bind(45808, '0.0.0.0', () => log('Detección automática de cajas activa en UDP 45808'));

function shutdown(sig) { log('Cerrando servidor (' + sig + ')'); try { autoBackup(); db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); db.close(); } catch (e) {} process.exit(0); }
process.on('SIGINT', () => shutdown('SIGINT')); process.on('SIGTERM', () => shutdown('SIGTERM'));
