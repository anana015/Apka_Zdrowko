/* Service Worker — cache powłoki aplikacji (działanie offline).
   Lista plików i hash wersji pochodzą z precache-manifest.js, generowanego skryptem:
   npm run precache. Nie edytuj wersji ręcznie. */
/* global self, caches, importScripts */
importScripts('./precache-manifest.js');

const { wersja, pliki } = self.PRECACHE;
const CACHE = `dziennik-${wersja}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(pliki))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((klucze) => Promise.all(
        klucze
          .filter((k) => k.startsWith('dziennik-') && k !== CACHE)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Żądania do innych domen (np. Supabase) nigdy nie trafiają do cache.
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((odp) => odp || fetch(req))
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((odp) => odp || fetch(req))
  );
});
