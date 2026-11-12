/* Lumo : garde l'appli disponible sans réseau. On prend toujours la version en ligne d'abord ; les données ne sont jamais mises en cache. */
const V = 'lumo-previsions-7', COQUE = ['/', '/app.css', '/app.js', '/moteur.js', '/vendor/supabase.js', '/fonts/fonts.css', '/manifest.webmanifest', '/icons/icon-192.png?v=2', '/icons/logo-mark.png?v=1'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(COQUE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((K) => Promise.all(K.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // serveur et banque : jamais en cache
  const cle = e.request.mode === 'navigate' && (u.pathname === '/' || u.pathname === '/index.html') ? '/' : e.request;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(V).then((x) => x.put(cle, c)); } return r; }).catch(() => caches.match(cle).then((r) => r || caches.match('/'))));
});
