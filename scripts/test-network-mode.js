'use strict';
const fs = require('node:fs');
function read(p) { if (!fs.existsSync(p)) throw new Error('Falta archivo: ' + p); return fs.readFileSync(p, 'utf8'); }
const server = read('server.js');
const html = read('index.html');
const sw = read('sw.js');
const remote = read('configurar-acceso-remoto-tailscale.ps1');
const lanFirewall = read('configurar-firewall-sainei.ps1');
if (!server.includes("server.listen(PORT, '0.0.0.0'")) throw new Error('El servidor local debe aceptar conexiones LAN/VPN.');
if (!server.includes("new DatabaseSync(path.join(DATA, 'sainei.db'))")) throw new Error('La base de datos debe permanecer en la PC principal.');
if (!server.includes("if (p === '/api/sync' && m === 'POST')")) throw new Error('La sincronización de datos debe seguir protegida por autenticación.');
if (!sw.includes("u.pathname.startsWith('/api/')")) throw new Error('El service worker no debe cachear escrituras/API como si fueran confirmadas.');
if (!sw.includes("return fetch(e.request)")) throw new Error('Las solicitudes API deben llegar al servidor real.');
if (html.includes('src="http') || html.includes("src='http") || html.includes('href="http') && !html.includes('https://www.dnit.gov.py')) {
  throw new Error('La interfaz no debe depender de recursos externos para operar sin internet.');
}
if (!remote.includes("'100.64.0.0/10'") || !remote.includes('-InterfaceAlias') || !remote.includes('Tailscale')) {
  throw new Error('El acceso remoto debe limitarse a la interfaz y rango privado de Tailscale.');
}
if (!lanFirewall.includes('-RemoteAddress LocalSubnet') || !lanFirewall.includes('-Profile Private')) {
  throw new Error('El acceso LAN debe continuar limitado a la red privada local.');
}
console.log('OK: modo local sin internet, API sin cache falsa y acceso remoto limitado a Tailscale.');
