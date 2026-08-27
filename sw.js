// sw.js - offline cache so the board works on the training ground with no signal.
//
// Bump CACHE on every release that changes a file below. The name is the only
// thing that evicts the old copy.
const CACHE = 'micharlatac-v6';
const ASSETS = [
  './', './index.html', './css/styles.css', './css/present.css', './manifest.webmanifest',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png',
  './js/main.js', './js/state.js', './js/render.js', './js/pitch.js', './js/view.js',
  './js/interact.js', './js/animate.js', './js/export.js', './js/formations.js',
  './js/i18n.js', './js/svg.js', './js/legacy.js', './js/present.js',
  './fonts/inter-latin.woff2', './fonts/inter-latin-ext.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;

  // The page shell and the modules go network-first: a coach who opens the
  // board with signal always gets the current build, instead of running one
  // release behind until the second visit. Falls back to the cache offline.
  const fresh = e.request.mode === 'navigate' || /\.(js|css|webmanifest)$/.test(url.pathname);

  if (fresh) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Fonts and icons never change under the same name: cache first, refill behind.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      const net = fetch(e.request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
