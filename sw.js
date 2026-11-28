/* SAINEI POS - service worker: guarda la pantalla del programa para que abra rápido y,
   si el servidor está apagado, muestre el aviso "Sin conexión con el servidor".
   NUNCA guarda datos del negocio: las rutas /api/ siempre van directo al servidor. */
const V = 'sainei-shell-v2';
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(['/', '/manifest.webmanifest', '/icon.svg'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; })
      .catch(() => caches.match(e.request).then(m => m || (e.request.mode === 'navigate' ? caches.match('/') : Response.error())))
  );
});
