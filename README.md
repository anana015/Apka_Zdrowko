# Dziennik zdrowia

Prywatna aplikacja PWA do zapisywania snu, nastroju, dolegliwości, leków i wyników badań. Pokazuje wykresy i możliwe zależności w danych. Nie stawia diagnoz i nie zastępuje lekarza.

**Stan: pierwszy szkic (0.1.0-szkic).** Wszystkie ekrany działają na danych zapisanych lokalnie w przeglądarce. Serwer (Supabase), logowanie i synchronizacja dojdą w etapie 0.

## Uruchomienie

```bash
npm install          # zależności deweloperskie: PGlite (test RLS), TypeScript (kontrola typów)
npm run serve        # http://localhost:8080
npm test             # 41 testów: obliczenia, korelacje, flagi, eksport, precache, RLS
npm run typecheck    # tsc --checkJs na plikach js/
npm run precache     # po każdej zmianie plików aplikacji (CI sprawdza aktualność)
```

Aplikacja nie ma bundlera. Musi być serwowana przez HTTP (moduły ES i Service Worker nie działają z `file://`).

Aby obejrzeć wykresy i zależności bez wpisywania danych: **Ustawienia → Wczytaj dane przykładowe** (90 dni danych syntetycznych).

## Struktura

```
index.html, manifest.webmanifest, sw.js, precache-manifest.js, _headers
css/style.css
js/app.js           routing, zastrzeżenie, baner flag
js/db.js            IndexedDB + kolejka outbox
js/offline.js       Service Worker, stan synchronizacji
js/wpis.js          ekran Dziś
js/dolegliwosci.js  epizody, „Zaczął się ból”
js/leki.js          leki, harmonogram, przyjęcia
js/badania.js       wyniki badań
js/historia.js      kalendarz
js/wykresy.js       wykresy SVG, zależności, raport
js/ustawienia.js    profil, eksport/import
js/obliczenia.js    czyste funkcje (daty, sen, agregacje)      ← testowane
js/korelacje.js     algorytm zależności (sekcja 10)             ← testowane
js/flagi.js         czerwone flagi (sekcja 4.7)                 ← testowane
js/eksport.js       JSON/CSV                                    ← testowane
js/demo.js          generator danych syntetycznych
fonts/              Atkinson Hyperlegible Next (OFL), lokalnie
supabase/migrations/  0001_schemat.sql (tabele, RLS), 0002_storage.sql
tests/              node --test
```

## Bezpieczeństwo w szkicu

- CSP bez `unsafe-inline`, brak zewnętrznych skryptów i fontów, brak analityki.
- Tekst użytkownika zawsze przez `textContent` (bez `innerHTML`).
- Dane w IndexedDB nie są szyfrowane; chroni je blokada ekranu urządzenia.
- Lista czerwonych flag jest **wersją roboczą** i wymaga weryfikacji medycznej przed użyciem.
