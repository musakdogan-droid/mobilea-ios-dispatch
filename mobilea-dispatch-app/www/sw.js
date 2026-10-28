// MOBILEA Service Worker v3.6 — robust, no pre-cache hang
// Changements v3.6 :
//  - Plus de pré-cache lourd à l'install (plus d'install qui "mouline" sur mobile lent)
//  - Mise en cache uniquement à l'usage (runtime cache)
//  - Nettoie automatiquement TOUS les anciens caches v3.x
//  - skipWaiting + clients.claim immédiats
const VERSION = 'mobilea-v3.6';
const CACHE_STATIC = `${VERSION}-static`;
const CACHE_DYNAMIC = `${VERSION}-dynamic`;
const DYNAMIC_MAX_ENTRIES = 60;

// Les fichiers absolument nécessaires pour fonctionner hors-ligne — on les
// garde minimaux : juste la coquille HTML + l'app.js. Le pré-cache a un
// timeout individuel pour qu'un seul fetch lent ne gèle pas l'install.
const PRECACHE_URLS = [
  '/index.html',
  '/app.js',
];

async function fetchWithTimeout(url, ms) {
  return Promise.race([
    fetch(url, { cache: 'no-cache', credentials: 'same-origin' }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

async function cleanResponse(response) {
  if (!response.redirected) return response;
  const body = await response.blob();
  const headers = new Headers(response.headers);
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}

async function trimCache(name, max) {
  try {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
  } catch(e){}
}

// ── MESSAGE ──────────────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── INSTALL ──────────────────────────────────────────────────────────────────
// Pré-cache ultra-léger avec timeout individuel. Chaque échec est silencieux :
// l'install n'échoue JAMAIS à cause d'un asset. L'app marche quand même, elle
// se cache juste au premier chargement réussi grâce au runtime cache.
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_STATIC);
      await Promise.all(PRECACHE_URLS.map(async (url) => {
        try {
          const res = await fetchWithTimeout(url, 5000);
          if (res && res.ok) {
            const clean = await cleanResponse(res);
            await cache.put(url, clean);
          }
        } catch(e) { /* ignoré */ }
      }));
    } catch(e){}
    await self.skipWaiting();
  })());
});

// ── ACTIVATE ─────────────────────────────────────────────────────────────────
// Supprime TOUS les anciens caches (y compris ceux des versions précédentes
// qui pouvaient servir une version pré-split de index.html → écran blanc ou
// loader infini).
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
        .map(k => caches.delete(k)));
    } catch(e){}
    try { await self.clients.claim(); } catch(e){}
  })());
});

// ── FETCH — Network First, cache en secours ──────────────────────────────────
// Chaque navigation va d'abord sur le réseau. Si réseau indispo, on retombe
// sur le cache. Si rien en cache, on sert /index.html (SPA fallback).
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.headers.has('range')) return;

  const isNavigation = request.mode === 'navigate';
  const dest = request.destination;
  // On ne cache PAS les manifests JSON (ils changent) ni les requêtes SW elles-mêmes
  const isSWFile = url.pathname === '/sw.js';

  event.respondWith((async () => {
    // Pour les navigations : courte course (3s) pour éviter l'écran blanc si
    // le réseau rame.
    try {
      const netPromise = fetch(request);
      const timeout = isNavigation ? 4000 : 15000;
      const response = await Promise.race([
        netPromise,
        new Promise((_, rej) => setTimeout(() => rej(new Error('net-timeout')), timeout))
      ]);

      if (response && response.status === 200 && !response.redirected && !isSWFile &&
          (response.type === 'basic' || response.type === 'cors')) {
        const clone = response.clone();
        caches.open(CACHE_DYNAMIC)
          .then(c => c.put(request, clone))
          .then(() => trimCache(CACHE_DYNAMIC, DYNAMIC_MAX_ENTRIES))
          .catch(() => {});
      }
      return response;
    } catch (err) {
      // Secours : chercher dans tous les caches
      const cached = await caches.match(request, { ignoreSearch: isNavigation });
      if (cached) return cached;
      if (isNavigation) {
        // Fallback SPA : /index.html pour n'importe quelle navigation
        const fallback = await caches.match('/index.html') || await caches.match('/');
        if (fallback) return fallback;
      }
      // Rien : on relance l'appel réseau une dernière fois, sans timeout
      try { return await fetch(request); } catch(e){ return Response.error(); }
    }
  })());
});

// ── PUSH NOTIFICATIONS ───────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'MOBILEA', body: 'Nouvelle notification' };
  try { data = event.data?.json() || data; } catch(e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/client-192.png',
      badge: '/icons/client-96.png',
      vibrate: [200, 100, 200],
      tag: data.tag || 'mobilea',
      renotify: true,
      data: { url: data.url || '/' },
    })
  );
});

// ── NOTIFICATION CLICK ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(c => (c || client).navigate(url)).catch(() => {});
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── BACKGROUND SYNC ──────────────────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-courses') console.log('[SW] Background sync: courses');
});

self.addEventListener('periodicsync', event => {
  if (event.tag === 'update-courses') console.log('[SW] Periodic sync: update courses');
});
