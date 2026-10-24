// Twistword offline cache. Bump VERSION when you publish changes so old caches are cleared.
const VERSION = 'twistword-2026-10-23';
const FILES = ['./', 'index.html', 'css/style.css', 'js/game.js', 'data/words.js', 'manifest.webmanifest',
  'icons/favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/Figtree-Medium.ttf', 'fonts/Figtree-SemiBold.ttf', 'fonts/Figtree-Bold.ttf', 'fonts/Figtree-ExtraBold.ttf'];
self.addEventListener('install', e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())));
// Network first so players get updates; the cache is the fallback when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request)
    .then(r => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
});
