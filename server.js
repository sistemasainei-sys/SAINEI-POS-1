'use strict';
/* SAINEI POS - servidor local (sin dependencias). Requiere Node.js 22.13 o superior.
   Datos: base SQLite en la carpeta "datos". Todo queda dentro del establecimiento. */
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
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
const ENV_INSTALL_ID = String(process.env.SAINEI_INSTALL_ID || '').trim().toUpperCase();
// ID anterior de SAINEI POS: se acepta su licencia firmada durante la migración.
const LEGACY_INSTALL_IDS = ['7D217B560F4A5093C640751E'];
let INSTALL_ID = /^[A-F0-9]{24}$/.test(ENV_INSTALL_ID) ? ENV_INSTALL_ID : getMeta('installId');
if (!INSTALL_ID) INSTALL_ID = crypto.randomBytes(12).toString('hex').toUpperCase();
// El identificador configurado en Render prevalece sobre SQLite para que no cambie al redeplegar.
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

const COLLS = { products: 'prod', sales: 'sale', clients: 'client', purchases: 'purch', payments: 'pay', expenses: 'exp', shifts: 'shift', moves: 'move', spay: 'spay', budgets: 'budget' };
const ORDER = ['products', 'clients', 'budgets', 'purchases', 'expenses', 'spay', 'shifts', 'sales', 'payments', 'moves'];
const SING = ['shop', 'scale', 'print', 'scan', 'sec', 'check'];
const DELETABLE = { products: 1, clients: 1 };
const PERM = {
  cajero: { sales: { ins: 1 }, moves: { ins: 1 }, clients: { ins: 1, upd: 1 }, budgets: { ins: 1, upd: 1 }, payments: { ins: 1 }, shifts: { ins: 1, upd: 1 } },
  encargado: { products: { ins: 1, upd: 1, del: 1 }, sales: { ins: 1, upd: 1 }, clients: { ins: 1, upd: 1, del: 1 }, budgets: { ins: 1, upd: 1 }, purchases: { ins: 1, upd: 1 }, payments: { ins: 1 }, expenses: { ins: 1, upd: 1 }, shifts: { ins: 1, upd: 1 }, moves: { ins: 1 }, spay: { ins: 1, upd: 1 } }
};
const round3 = n => Math.round(n * 1000) / 1000;
const nowIso = () => new Date().toISOString();

/* ---------- Claves y usuarios ---------- */
const hashPin = (pin, salt) => crypto.scryptSync(String(pin), salt, 32).toString('hex');
function mkPin(pin) { const salt = crypto.randomBytes(16).toString('hex'); return { salt, hash: hashPin(pin, salt) }; }
function checkPin(u, pin) {
  if (!u || !u.salt || !u.hash) return false;
  const a = Buffer.from(hashPin(pin, u.salt), 'hex'), b = Buffer.from(u.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const weakPin = p => String(p).length < 4 || /^(.)\1+$/.test(p) || ['1234', '12345', '123456', '0123', '4321'].includes(p);
const ROLES = ['admin', 'encargado', 'cajero'];
function newRecCode() { const al = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', b = crypto.randomBytes(16); let o = ''; for (let i = 0; i < 16; i++) { o += al[b[i] % al.length]; if (i % 4 === 3 && i < 15) o += '-'; } return o; }
const normCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const pubUser = u => ({ id: u.id, name: u.name, role: u.role, active: !!u.active });
const allUsers = () => prep('SELECT * FROM users ORDER BY id').all();
const hasAdmin = () => !!prep("SELECT 1 x FROM users WHERE role='admin' AND active=1").get();
function audit(who, what) { prep('INSERT INTO audit(t,u,a) VALUES(?,?,?)').run(nowIso(), String(who || '-').slice(0, 60), String(what || '').slice(0, 300)); }

const sessions = new Map(); // token -> {uid,name,role,exp}
const SES_MS = 12 * 3600 * 1000;
const fails = new Map();
function failWait(key) { const f = fails.get(key); return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0; }
function failAdd(key) { const f = fails.get(key) || { n: 0, until: 0 }; f.n++; if (f.n >= 5) f.until = Date.now() + Math.min(300, 30 * Math.pow(2, f.n - 5)) * 1000; fails.set(key, f); return f.n; }
const failClear = key => fails.delete(key);
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
autoBackup(); setInterval(autoBackup, 3600000).unref();

/* ---------- Registros ---------- */
const getRec = (coll, id) => prep('SELECT j,del FROM rec WHERE coll=? AND id=?').get(coll, id);
const putRec = (coll, id, obj, rev, del) => prep('INSERT OR REPLACE INTO rec(coll,id,j,rev,del) VALUES(?,?,?,?,?)').run(coll, id, JSON.stringify(obj), rev, del ? 1 : 0);
function bumpCounter(kind, id) { const r = prep('SELECT n FROM counters WHERE kind=?').get(kind); if (!r) prep('INSERT INTO counters(kind,n) VALUES(?,?)').run(kind, id); else if (r.n < id) prep('UPDATE counters SET n=? WHERE kind=?').run(id, kind); }

function allowed(user, coll, op, rec, existing) {
  if (user.role === 'admin') return true;
  const p = (PERM[user.role] || {})[coll];
  if (!p || !p[op]) return false;
  if (coll === 'moves' && user.role === 'cajero') { if (!(rec.type === 'venta' && Number(rec.qty) < 0)) return false; }
  if (coll === 'shifts' && user.role === 'cajero') {
    if (op === 'ins' && rec.uid !== user.uid) return false;
    if (op === 'upd' && existing && existing.uid && existing.uid !== user.uid) return false;
  }
  return true;
}

function processSync(user, body) {
  const res = { rejected: [] }, changes = body.changes || {}, savedRev = REV;
  let wrote = false;
  const R = () => { if (!wrote) { wrote = true; REV++; } return REV; };
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
          const ex = row ? JSON.parse(row.j) : null, op = ex ? 'upd' : 'ins';
          if (!allowed(user, coll, op, rec, ex)) { res.rejected.push({ coll, id }); continue; }
          // Validar cada movimiento contra el stock vigente dentro de la transacción.
          // Evita que dos cajas descuenten simultáneamente unidades inexistentes.
          if (coll === 'moves' && !ex) {
            const pid = Number(rec.pid), qty = Number(rec.qty), productRow = Number.isInteger(pid) && pid > 0 ? getRec('products', pid) : null;
            if (!productRow || productRow.del || !Number.isFinite(qty) || qty === 0) { res.rejected.push({ coll, id }); continue; }
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
        for (const k of SING) {
          if (!(k in body.sing)) continue;
          if (user.role !== 'admin') { res.rejected.push({ sing: k }); continue; }
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

function restoreJson(s) {
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
const CT = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };

async function handle(req, res) {
  const url = new URL(req.url, 'http://x'), p = url.pathname, m = req.method;
  const ip = (req.socket.remoteAddress || '').replace('::ffff:', '');
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
    const id = tx(() => {
      const c = prep('SELECT n FROM counters WHERE kind=?').get('user'), nid = (c ? c.n : 0) + 1;
      prep('INSERT OR REPLACE INTO counters(kind,n) VALUES(?,?)').run('user', nid);
      const k = mkPin(pin); prep('INSERT INTO users(id,name,role,active,salt,hash) VALUES(?,?,?,?,?,?)').run(nid, name, 'admin', 1, k.salt, k.hash);
      setMeta('recSalt', rc.salt); setMeta('recHash', rc.hash); audit(name, 'Creo el usuario principal'); return nid;
    });
    return send(res, 200, { ok: true, code, userId: id });
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
    audit(u.name, 'Cambio su clave con el codigo de recuperacion'); return send(res, 200, { ok: true });
  }

  const me = auth(req);
  if (!me) return fail(res, 401, 'Sesion vencida');
  const admin = me.role === 'admin';

  if (p === '/api/logout' && m === 'POST') { sessions.delete(me.token); return send(res, 200, { ok: true }); }
  if (p === '/api/me' && m === 'GET') return send(res, 200, { user: { id: me.uid, name: me.name, role: me.role } });
  if (p === '/api/ids' && m === 'GET') {
    const kind = url.searchParams.get('kind'), n = Math.min(500, Math.max(1, parseInt(url.searchParams.get('n') || '1', 10)));
    if (!Object.values(COLLS).includes(kind)) return fail(res, 400, 'Tipo invalido');
    const r = tx(() => { const c = prep('SELECT n FROM counters WHERE kind=?').get(kind), cur = c ? c.n : 0; prep('INSERT OR REPLACE INTO counters(kind,n) VALUES(?,?)').run(kind, cur + n); return { start: cur + 1, end: cur + n }; });
    return send(res, 200, r);
  }
  if (p === '/api/sync' && m === 'POST') {
    const b = await readBody(req), since = Math.max(0, parseInt(b.since || 0, 10) || 0);
    if (b.epoch && b.epoch !== EPOCH) { const c = collect(0, null); return send(res, 200, { reset: true, rev: REV, epoch: EPOCH, recs: c.recs, dels: c.dels, sing: c.sing, lastBackup: lastBackup() }); }
    const r = processSync({ uid: me.uid, name: me.name, role: me.role }, b), c = collect(since, r);
    return send(res, 200, { rev: REV, epoch: EPOCH, recs: c.recs, dels: c.dels, sing: c.sing, rejected: r.rejected, lastBackup: lastBackup() });
  }
  if (p === '/api/mypin' && m === 'POST') {
    const b = await readBody(req), u = prep('SELECT * FROM users WHERE id=?').get(me.uid);
    if (!checkPin(u, String(b.old || ''))) return fail(res, 400, 'La clave actual no es correcta.');
    if (weakPin(String(b.pin || ''))) return fail(res, 400, 'La clave nueva es muy facil.');
    const k = mkPin(String(b.pin)); prep('UPDATE users SET salt=?,hash=? WHERE id=?').run(k.salt, k.hash, me.uid); audit(me.name, 'Cambio su clave');
    return send(res, 200, { ok: true });
  }

  if (!admin) return fail(res, 403, 'Solo el usuario principal puede hacer esto.');
  if (p === '/api/users' && m === 'GET') return send(res, 200, { users: allUsers().map(pubUser) });
  if (p === '/api/users' && m === 'POST') {
    const b = await readBody(req), name = String(b.name || '').trim().slice(0, 40), role = String(b.role), pin = String(b.pin || '');
    const id = b.id ? Number(b.id) : 0, ex = id ? prep('SELECT * FROM users WHERE id=?').get(id) : null, active = b.active === false ? 0 : 1;
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
        if (!active) sessions.delete(t); else { s.role = role; s.name = name; }
      }
      audit(me.name, 'Edito al usuario ' + name);
    } else {
      const nid = tx(() => { const c = prep('SELECT n FROM counters WHERE kind=?').get('user'), n = (c ? c.n : 0) + 1; prep('INSERT OR REPLACE INTO counters(kind,n) VALUES(?,?)').run('user', n); const k = mkPin(pin); prep('INSERT INTO users(id,name,role,active,salt,hash) VALUES(?,?,?,?,?,?)').run(n, name, role, 1, k.salt, k.hash); return n; });
      audit(me.name, 'Creo el usuario ' + name + ' (' + role + ')');
    }
    return send(res, 200, { users: allUsers().map(pubUser) });
  }
  if (p === '/api/newrec' && m === 'POST') { const code = newRecCode(), rc = mkPin(normCode(code)); setMeta('recSalt', rc.salt); setMeta('recHash', rc.hash); audit(me.name, 'Genero un nuevo codigo de recuperacion'); return send(res, 200, { code }); }
  if (p === '/api/audit' && m === 'GET') {
    const lim = Math.min(1000, parseInt(url.searchParams.get('limit') || '200', 10) || 200);
    return send(res, 200, { rows: prep('SELECT t,u,a FROM audit ORDER BY id DESC LIMIT ?').all(lim).map(r => ({ t: r.t, u: r.u, a: r.a })) });
  }
  if (p === '/api/export' && m === 'GET') { audit(me.name, 'Descargo una copia de seguridad'); return send(res, 200, fullState(), { 'Content-Disposition': 'attachment; filename="copia-sainei-' + dayStamp() + '.json"' }); }
  if (p === '/api/restore' && m === 'POST') {
    const b = await readBody(req), s = b.state;
    if (!s || !Array.isArray(s.products) || !Array.isArray(s.sales)) return fail(res, 400, 'El archivo no es una copia valida.');
    restoreJson(s); audit(me.name, 'Restauro una copia desde archivo'); return send(res, 200, { ok: true });
  }
  if (p === '/api/clear' && m === 'POST') { clearAll(); audit(me.name, 'Vacio todos los datos del negocio'); return send(res, 200, { ok: true }); }
  if (p === '/api/backups' && m === 'GET') return send(res, 200, { list: listBackups(), dir: COPIAS });
  if (p === '/api/backups/make' && m === 'POST') { const n = makeBackup('manual'); audit(me.name, 'Hizo una copia manual ' + n); return send(res, 200, { name: n }); }
  if (p === '/api/backups/restore' && m === 'POST') { const b = await readBody(req); restoreFile(String(b.name || '')); audit(me.name, 'Restauro la copia ' + b.name); return send(res, 200, { ok: true }); }
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
function shutdown(sig) { log('Cerrando servidor (' + sig + ')'); try { autoBackup(); db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); db.close(); } catch (e) {} process.exit(0); }
process.on('SIGINT', () => shutdown('SIGINT')); process.on('SIGTERM', () => shutdown('SIGTERM'));
