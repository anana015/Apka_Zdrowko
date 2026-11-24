# Dziennik zdrowia

Prywatna aplikacja PWA do zapisywania snu, nastroju, dolegliwości, leków i wyników badań. Pokazuje wykresy i możliwe zależności w danych. Nie stawia diagnoz i nie zastępuje lekarza.

**Stan: 0.9.0.** Logowanie z obowiązkowym TOTP, synchronizacja z Supabase (Frankfurt, UE), działanie offline, dolegliwości z listą objawów alarmowych, leki, badania z dokumentami i odczytem wyników z PDF lub zdjęć (na urządzeniu), wykresy, zależności i raport dla lekarza. Historia zmian: [docs/CHANGELOG.md](docs/CHANGELOG.md).

Hosting: GitHub Pages z publicznego repozytorium. Migracje bazy wgrywa się ręcznie w SQL Editorze Supabase (pliki `supabase/migrations/`, po kolei).

## Uruchomienie

```bash
npm install          # zależności deweloperskie: PGlite (test RLS), TypeScript (kontrola typów)
npm run serve        # http://localhost:8080
npm test             # 50 testów: obliczenia, korelacje, flagi, eksport, precache, RLS i MFA, skrypty
npm run lint         # ESLint
npm run typecheck    # tsc --checkJs na plikach js/
npm run precache     # po każdej zmianie plików aplikacji (CI sprawdza aktualność)
```

Aplikacja nie ma bundlera. Musi być serwowana przez HTTP (moduły ES i Service Worker nie działają z `file://`).

Konfiguracja GitHub i Supabase krok po kroku: **[docs/konfiguracja.md](docs/konfiguracja.md)**.

```bash
npm run ustaw-supabase -- --url https://<ref>.supabase.co --klucz sb_publishable_...   # adres i klucz w konfiguracji i CSP
npx supabase config push                 # ustawienia Auth/API z supabase/config.jsonc
npx supabase db push --remote --dry-run  # podgląd migracji
```

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
js/odczyt.js        odczyt tekstu z PDF/zdjęć (pdf.js, Tesseract.js z js/vendor/odczyt/)
js/odczyt-parser.js rozpoznawanie wyników w tekście            ← testowane
js/historia.js      kalendarz
js/wykresy.js       wykresy SVG, zależności, raport
js/ustawienia.js    profil, eksport/import
js/obliczenia.js    czyste funkcje (daty, sen, agregacje)      ← testowane
js/korelacje.js     algorytm zależności (sekcja 10)             ← testowane
js/flagi.js         czerwone flagi (sekcja 4.7)                 ← testowane
js/eksport.js       JSON/CSV                                    ← testowane
js/demo.js          generator danych syntetycznych
fonts/              Atkinson Hyperlegible Next (OFL), lokalnie
supabase/config.jsonc ustawienia Auth i API (CLI 3.x)
supabase/migrations/  0001 tabele i RLS, 0002 Storage, 0003 obowiązkowe MFA, 0004–0005 rodzaje dolegliwości, 0006 zgoda, 0007 infekcja i temperatura
.github/workflows/    ci.yml (lint, typy, precache, testy)
tests/              node --test
```

## Bezpieczeństwo

- CSP bez `unsafe-inline`, brak zewnętrznych skryptów i fontów, brak analityki.
- Tekst użytkownika zawsze przez `textContent` (bez `innerHTML`).
- Dane w IndexedDB nie są szyfrowane; chroni je blokada ekranu urządzenia.
- Obowiązkowe MFA wymuszone w bazie (polityki `aal2`), RLS na każdej tabeli i w Storage.
- Blokada osadzania w ramce w `js/app.js` (GitHub Pages nie obsługuje `frame-ancestors`; plik `_headers` działa tylko na Cloudflare Pages/Netlify).
- Lista objawów alarmowych sprawdzona ze źródłami (NHS, NICE), wersja w `js/flagi.js`.
- Nigdy nie commituj eksportów danych ani kluczy (`.gitignore`, skan sekretów GitHub).
