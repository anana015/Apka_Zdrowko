/* Service Worker — cache powłoki aplikacji (działanie offline).
   Lista plików i hash wersji pochodzą z precache-manifest.js, generowanego skryptem:
   npm run precache. Nie edytuj wersji ręcznie. */
importScripts('./precache-manifest.js');

const { wersja, pliki } = self.PRECACHE;
const CACHE = `dziennik-${wersja}`;
// Moduł odczytu wyników (pdf.js, Tesseract, ok. 8 MB): zapisywany przy pierwszym użyciu, osobno od wersji aplikacji.
// Przy zmianie plików w js/vendor/odczyt/ zwiększ numer.
const CACHE_ODCZYTU = 'odczyt-1';

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
          .filter((k) => (k.startsWith('dziennik-') && k !== CACHE) || (k.startsWith('odczyt-') && k !== CACHE_ODCZYTU))
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

  if (url.pathname.includes('/js/vendor/odczyt/')) {
    event.respondWith(
      caches.open(CACHE_ODCZYTU).then((cache) => cache.match(req, { ignoreSearch: true }).then((odp) => odp || fetch(req).then((nowa) => {
        if (nowa.ok) cache.put(req, nowa.clone());
        return nowa;
      })))
    );
    return;
  }

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
