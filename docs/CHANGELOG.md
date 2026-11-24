# Changelog

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
