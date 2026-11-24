# Changelog

## 0.5.0 (2026-11-24) — czerwone flagi, „Kiedy szukać pomocy”, sen ze Zdrowia

### Dodano
- Lista objawów alarmowych 1.0.0 sprawdzona ze źródłami (NHS: headaches, back-pain, pelvic-pain, testicle-pain, ectopic-pregnancy; NICE CG150): trzy obszary (ból głowy, kręgosłupa, okolice intymne i podbrzusze) i dwa poziomy (112/SOR albo kontakt z lekarzem jeszcze dziś).
- Baner w dwóch wariantach: czerwony (112, SOR) i spokojniejszy (lekarz jeszcze dziś), z linkiem do informacji.
- Ekran „Kiedy szukać pomocy” (`#wiedza`): objawy alarmowe, częste rodzaje bólu (do rozmowy z lekarzem, bez diagnozy), kiedy umówić wizytę, co zapisywać, źródła.
- Nowe rodzaje dolegliwości: ból kręgosłupa i ból w okolicy intymnej lub podbrzusza; objawy alarmowe i podpowiedzi lokalizacji dobierane do rodzaju.
- Migracja `0004_rodzaje_dolegliwosci.sql` (nowe wartości `kind`).
- iPhone: przycisk „Pobierz sen ze Zdrowia” uruchamia skrót „Dziennik sen”, a „Wklej sen” wstawia godziny ze schowka. Instrukcja budowy skrótu w Ustawieniach.

## 0.4.0 (2026-11-24) — dokumenty

### Dodano
- Badania → Dokumenty: wysyłanie zdjęć i PDF-ów (do 10 MB; PDF, JPG, PNG, HEIC) do prywatnego bucketu `dokumenty`, ścieżka `{user_id}/{uuid}.{rozszerzenie}`.
- Lista dokumentów z rodzajem, datą i opisem; otwieranie przez link ważny 60 sekund; usuwanie pliku razem z wpisem.
- „Usuń moje dane z serwera” usuwa też pliki.

### Ograniczenia
- Dokumenty wymagają internetu (zgodnie ze specyfikacją, sekcja 11); nie ma miniatur offline ani powiązania pliku z konkretnym wynikiem badania.

## 0.3.0 (2026-11-24) — logowanie, synchronizacja, zależności z lekami

### Dodano
- Ekran logowania: e-mail + hasło, potem obowiązkowy kod TOTP. Pierwsze logowanie prowadzi przez dodanie aplikacji z kodami (przycisk otpauth, kod QR, klucz do wpisania).
- Wylogowanie po 30 minutach bez aktywności (`LIMIT_NIEAKTYWNOSCI_MIN` w `js/auth.js`), także po ponownym otwarciu aplikacji.
- Synchronizacja (`js/synchronizacja.js`): wysyłka kolejki zmian, pobieranie danych i usunięć z innych urządzeń, scalanie wpisu z tego samego dnia, profil (imię, strefa, potwierdzenie zastrzeżenia). Automatycznie: po zmianach, po powrocie sieci, przy otwarciu i co 5 minut.
- Status w górnym pasku: „Zapisano lokalnie” / „Synchronizuję…” / „Zsynchronizowano” / błąd, z przyciskiem „Synchronizuj teraz”.
- Przy pierwszym logowaniu na urządzeniu z danymi sprzed logowania: wybór „wyślij na konto” albo „usuń”. Inne konto na tym samym urządzeniu nie dostaje cudzych danych.
- Ustawienia → Konto: e-mail, wylogowanie, synchronizacja, usunięcie wszystkich swoich danych z serwera.
- Zależności: para „lek lub suplement przyjmowany w ciągu 7 dni → ból głowy i nastrój” (bez leków doraźnych, z uwagą o porównywaniu różnych okresów).
- Raport dla lekarza: sekcja zależności z wybranego okresu.
- `js/vendor/supabase.js` (supabase-js 2.119.2, UMD) z sumą SHA-256 w `js/vendor/SHA256SUMS`.

### Zmieniono
- Gdy serwer jest skonfigurowany, nie ma przycisku danych przykładowych (trafiłyby na konto), a „Usuń dane z tego urządzenia” wylogowuje.

### Ograniczenia
- Logowanie wymaga internetu; zalogowana sesja działa offline.
- Konflikt edycji tego samego wpisu na dwóch urządzeniach: wygrywa urządzenie, które wyśle później, bez osobnego ostrzeżenia.

## 0.2.0 (2026-11-24) — konfiguracja GitHub i Supabase

### Dodano
- `supabase/config.jsonc` (Supabase CLI 3.4.0 w devDependencies): rejestracja wyłączona, hasło min. 12 znaków, TOTP włączone, potwierdzanie e-maila i bezpieczna zmiana hasła, Data API tylko dla `public`, nowe tabele bez automatycznego dostępu.
- Migracja `0003_mfa_i_uprawnienia.sql`: restrykcyjne polityki `aal2` na wszystkich tabelach (obowiązkowe MFA wymuszone w bazie), odebranie domyślnych uprawnień dla nowych obiektów, automatyczny profil po utworzeniu konta.
- `0002_storage.sql`: wymóg `aal2` także dla plików w buckecie `dokumenty`.
- GitHub Actions: CI ze skanem sekretów (gitleaks, suma SHA-256), wdrażanie migracji (podgląd automatycznie, wdrożenie ręcznie słowem `ZASTOSUJ`), codzienna kopia bazy szyfrowana `age`. Akcje przypięte do pełnych SHA.
- `.github/dependabot.yml`, `.gitleaks.toml`, hook `scripts/git-hooks/pre-commit`.
- `scripts/ustaw-supabase.mjs` i `js/konfiguracja.js`: adres projektu i klucz publikowalny w konfiguracji i CSP jednym poleceniem; odrzuca klucz sekretny i `service_role`.
- `docs/konfiguracja.md`: instrukcja krok po kroku.
- Testy: 50 (w tym MFA `aal1`/`aal2`, polityki na każdej tabeli, uprawnienia domyślne, profil, skrypt konfiguracji).

### Zmieniono
- `0001_schemat.sql`: funkcja `ustaw_updated_at` ze stałym `search_path` (zalecenie Security Advisora). Migracje nie były jeszcze wdrożone, więc zmiana jest bezpieczna.

### Sprawdzono
- Migracje 0001–0003 na PostgreSQL 16 z atrapą Auth i Storage, wgrane przez `supabase db push`; zachowanie polityk Storage (własny folder, wymóg `aal2`).
- Workflowy zgodne ze schematem GitHub Actions (action-validator). Skan gitleaks nie był uruchamiany lokalnie; pierwszy raz uruchomi się w CI.

### Różnice wobec specyfikacji
- Secret scanning GitHub niedostępny dla prywatnych repozytoriów na koncie osobistym → gitleaks.
- Limity czasu sesji Supabase tylko w planie Pro → wylogowanie po nieaktywności zrobimy w aplikacji.
- Klucz `anon` wycofywany do końca 2026 r. → klucz publikowalny `sb_publishable_…`.

## 0.1.0-szkic (2026-11-23)

Pierwszy szkic aplikacji na podstawie specyfikacji v0.1. Dane wyłącznie lokalnie (IndexedDB), bez serwera.

### Dodano
- Szkielet PWA: `index.html`, manifest, ikony, Service Worker z precache generowanym skryptem (hash zamiast ręcznej wersji).
- Ekran **Dziś**: wpis dzienny (sen z godzin lub liczby godzin, jakość, wybudzenia, nastrój, energia, stres, znaczniki, notatka), wartości domyślne z poprzedniego dnia, edycja wstecz, przycisk „Zaczął się ból”, leki na dziś do odhaczenia, przyjęcia doraźne, lista dolegliwości.
- **Dolegliwości**: pełny formularz epizodu (rodzaj, czas, nasilenie 0–10, lokalizacja, objawy, objawy alarmowe, czynniki, leki, ulga po 2 h).
- **Czerwone flagi**: baner z numerem 112 (i numerami wsparcia przy myślach samobójczych) na podstawie zaznaczonych objawów, nasilenia 10/10 i słów kluczowych w notatkach z ostatnich 48 h.
- **Historia**: kalendarz miesiąca w kolorach nastroju z ikonami bólu, szczegóły dnia.
- **Wykresy**: 7/30/90 dni, sen (słupki), nastrój i energia (linie), ból (znaczniki z nasileniem), podsumowanie, zależności, raport do druku/PDF.
- **Zależności** (`js/korelacje.js`): Spearman, różnica odsetków, p permutacyjne, 95% CI bootstrap, korekta Benjaminiego-Hochberga, progi z sekcji 10.
- **Leki**: lista, harmonogram (codziennie o godzinach / doraźnie), rejestr przyjęć z 30 dni.
- **Badania**: zestawy (morfologia, lipidogram, TSH, witamina D, ferrytyna) bez norm, zakresy z wyniku laboratorium, walidacja i podgląd przed zapisem, wykres z pasmem zakresu.
- **Ustawienia**: profil, motyw jasny/ciemny/systemowy, znaczniki, eksport JSON i CSV, import JSON, dane przykładowe, usunięcie danych.
- Migracje Supabase `0001_schemat.sql` (tabele, CHECK, RLS) i `0002_storage.sql` (prywatny bucket).
- Testy: 41 testów (`node --test`), w tym RLS na PGlite; kontrola typów `tsc --checkJs` (0 błędów).

### Zmiany względem specyfikacji v0.1 (do zatwierdzenia)
- `updated_at` we wszystkich tabelach (w specyfikacji brakowało go w `medications`, `medication_intakes`, `documents`, `lab_results`, `profiles`, a sekcja 11 opiera na nim rozwiązywanie konfliktów).
- `medication_intakes.scheduled_time` — bez tego nie wiadomo, którą dawkę stałego leku odhaczono.
- Złożone klucze obce `(id, user_id)` — w wersji ze specyfikacji można było powiązać przyjęcie z cudzym lekiem lub epizodem (sprawdzenie FK omija RLS).
- Dodatkowe CHECK: kolejność dat snu i epizodu, `ref_low <= ref_high`, typy MIME dokumentów.
- Startowy zestaw znaczników dnia (otwarta decyzja z sekcji 17).

### Sprawdzone źródła
- Numery pomocy w banerze (23.11.2026): 800 70 2222 (Centrum Wsparcia, całodobowo), 116 123, 116 111, 112 — gov.pl/web/zdrowie/gdzie-uzyskac-pomoc-psychologiczna-i-psychiatryczna.

### Do zrobienia przed użyciem produkcyjnym
- Weryfikacja listy czerwonych flag z wiarygodnym źródłem medycznym (`js/flagi.js`, `ZWERYFIKOWANO = false`).
- Etap 0: Supabase (UE), logowanie z MFA, synchronizacja kolejki `outbox`, ESLint w CI.
