/* Lumo : mise en cache de l'appli pour un démarrage instantané (les données, elles, ne sont jamais mises en cache ici) */
const V = 'lumo-cadc46f73f', SHELL = ['/', '/boot.js', '/vendor/supabase.js', '/fonts/fonts.css', '/manifest.webmanifest', '/icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(K => Promise.all(K.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // Supabase et banque : jamais en cache
  const home = u.pathname === '/' || u.pathname === '/index.html';
  if (e.request.mode === 'navigate' && !home) { e.respondWith(fetch(e.request).catch(() => caches.match('/'))); return; } // pages annexes (confidentialité, conditions) : jamais mises à la place de l'appli
  if (home) {
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put('/', c)); } return r; }).catch(() => caches.match('/')));
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(n => { if (n.ok) { const c = n.clone(); caches.open(V).then(x => x.put(e.request, c)); } return n; })));
});
// toucher une notification : ouvrir Lumo (ou le ramener au premier plan) sur la liste des notifications
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(L => {
    const c = L.find(x => new URL(x.url).origin === location.origin);
    if (c) { c.postMessage({ kopek: 'go' }); return c.focus(); }
    return self.clients.openWindow('/');
  }));
});
