// @ts-check
/** Stałe teksty i konfiguracja aplikacji. */

export const WERSJA_APLIKACJI = '0.9.0';

/** Zastrzeżenie medyczne (specyfikacja, sekcja 2) — przy pierwszym uruchomieniu i w stopce Wykresów. */
export const ZASTRZEZENIE = 'Aplikacja służy do prowadzenia własnych notatek i nie jest wyrobem medycznym. ' +
  'Wykresy i zależności są obserwacjami z Twoich danych, nie diagnozą ani zaleceniem leczenia. ' +
  'W razie niepokojących objawów skontaktuj się z lekarzem, a w stanach nagłych zadzwoń pod 112.';

/** Startowy zestaw znaczników (otwarta decyzja w sekcji 17 — przyjęto zestaw z przykładów w 4.1). */
export const DOMYSLNE_TAGI = Object.freeze([
  'kawa po 16:00', 'brak kawy', 'alkohol', 'mało wody', 'dużo pracy', 'zmęczenie',
  'intensywny trening', 'mało ruchu', 'ekrany do późna', 'podróż', 'okres', 'choroba',
]);

/** Znaczniki dodane w 0.9.0 — dopisywane raz do list zapisanych wcześniej (bez przywracania usuniętych starych). */
export const NOWE_TAGI_0_9 = Object.freeze(['brak kawy', 'mało wody', 'dużo pracy', 'zmęczenie', 'mało ruchu', 'ekrany do późna']);
