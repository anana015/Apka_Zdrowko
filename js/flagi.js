// @ts-check
/**
 * Czerwone flagi (specyfikacja, sekcja 4.7). Czyste funkcje, bez DOM.
 *
 * UWAGA: lista jest SZKICEM na podstawie przykładów ze specyfikacji i NIE została jeszcze
 * zweryfikowana z wiarygodnym źródłem medycznym (np. pacjent.gov.pl, wytyczne towarzystw lekarskich).
 * Przed publikacją: weryfikacja, aktualizacja pola `zrodlo` i ustawienie ZWERYFIKOWANO = true.
 * Numery telefonów sprawdzono 23.11.2026 na gov.pl (patrz docs/CHANGELOG.md).
 */

export const WERSJA_LISTY = '0.1.0-szkic';
export const ZWERYFIKOWANO = false;

/**
 * @typedef {{ id: string, etykieta: string, wEpizodzie: boolean, typ: 'pilne'|'kryzys', slowa: string[] }} Flaga
 */

/** @type {readonly Flaga[]} */
export const FLAGI = Object.freeze([
  {
    id: 'alarm_najsilniejszy',
    etykieta: 'Nagły, bardzo silny ból, najsilniejszy w życiu',
    wEpizodzie: true,
    typ: 'pilne',
    slowa: ['najsilniejszy bol w zyciu', 'najgorszy bol w zyciu', 'najsilniejszy w zyciu', 'jak uderzenie piorunem', 'piorunujacy bol'],
  },
  {
    id: 'alarm_goraczka_kark',
    etykieta: 'Ból głowy z gorączką i sztywnością karku',
    wEpizodzie: true,
    typ: 'pilne',
    slowa: ['sztywnosc karku', 'sztywny kark', 'nie moge zgiac szyi'],
  },
  {
    id: 'alarm_neurologiczne',
    etykieta: 'Zaburzenia mowy, niedowład lub drętwienie połowy ciała, opadający kącik ust',
    wEpizodzie: true,
    typ: 'pilne',
    slowa: ['zaburzenia mowy', 'belkot', 'niewyrazna mowa', 'niedowlad', 'opadajacy kacik', 'opada kacik', 'opadniety kacik', 'dretwienie polowy', 'dretwieje polowa', 'dretwienie reki i twarzy'],
  },
  {
    id: 'alarm_widzenie_przytomnosc',
    etykieta: 'Zaburzenia widzenia, utrata przytomności lub drgawki',
    wEpizodzie: true,
    typ: 'pilne',
    slowa: ['utrata przytomnosci', 'stracilem przytomnosc', 'stracilam przytomnosc', 'zemdlal', 'drgaw', 'podwojne widzenie', 'utrata wzroku', 'stracilem wzrok', 'stracilam wzrok'],
  },
  {
    id: 'alarm_uraz',
    etykieta: 'Ból głowy po urazie głowy',
    wEpizodzie: true,
    typ: 'pilne',
    slowa: ['uraz glowy', 'uderzenie w glowe', 'uderzylem sie w glowe', 'uderzylam sie w glowe', 'upadek na glowe'],
  },
  {
    id: 'kryzys_samobojcze',
    etykieta: 'Myśli samobójcze',
    wEpizodzie: false,
    typ: 'kryzys',
    slowa: ['samoboj', 'zabic sie', 'odebrac sobie zycie', 'nie chce zyc', 'nie chce juz zyc', 'skonczyc ze soba', 'chce umrzec'],
  },
]);

export const FLAGA_NASILENIE_10 = Object.freeze({
  id: 'nasilenie_10', etykieta: 'Ból o nasileniu 10/10', typ: /** @type {const} */ ('pilne'),
});

/** Numery pomocy (sprawdzone na gov.pl, 23.11.2026). */
export const NUMERY = Object.freeze({
  alarmowy: { numer: '112', opis: 'Numer alarmowy' },
  centrumWsparcia: { numer: '800 70 2222', opis: 'Centrum Wsparcia dla osób dorosłych w kryzysie psychicznym, bezpłatnie, całą dobę' },
  telefonZaufania: { numer: '116 123', opis: 'Telefon zaufania dla dorosłych w kryzysie emocjonalnym, bezpłatnie' },
  dzieciMlodziez: { numer: '116 111', opis: 'Telefon zaufania dla dzieci i młodzieży, bezpłatnie, całą dobę' },
});

/** Małe litery, bez polskich znaków, pojedyncze spacje. @param {string} t */
export function normalizuj(t) {
  return t
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Identyfikatory flag wykrytych w tekście (słowa kluczowe). @param {string|null|undefined} tekst */
export function sprawdzTekst(tekst) {
  if (!tekst) return [];
  const t = ` ${normalizuj(tekst)} `;
  return FLAGI.filter((f) => f.slowa.some((s) => t.includes(s))).map((f) => f.id);
}

/** @param {import('./obliczenia.js').Epizod} e */
export function sprawdzEpizod(e) {
  const ids = new Set(sprawdzTekst(e.note));
  for (const f of e.features ?? []) if (FLAGI.some((fl) => fl.id === f)) ids.add(f);
  if (e.intensity === 10) ids.add(FLAGA_NASILENIE_10.id);
  return [...ids];
}

/** @param {import('./obliczenia.js').Wpis} w */
export const sprawdzWpis = (w) => sprawdzTekst(w.note);

/**
 * Flagi aktywne w oknie czasowym (domyślnie 48 h) — do baneru.
 * @param {{ wpisy: import('./obliczenia.js').Wpis[], epizody: import('./obliczenia.js').Epizod[], teraz?: Date, oknoGodzin?: number }} p
 */
export function aktywneFlagi({ wpisy, epizody, teraz = new Date(), oknoGodzin = 48 }) {
  const granica = teraz.getTime() - oknoGodzin * 3600000;
  const ids = new Set();
  for (const e of epizody) {
    const t = new Date(e.started_at).getTime();
    if (t >= granica && t <= teraz.getTime() + 3600000) sprawdzEpizod(e).forEach((id) => ids.add(id));
  }
  for (const w of wpisy) {
    const [y, m, d] = w.entry_date.split('-').map(Number);
    const koniecDnia = new Date(y, m - 1, d, 23, 59, 59).getTime();
    if (koniecDnia >= granica && new Date(y, m - 1, d).getTime() <= teraz.getTime()) {
      sprawdzWpis(w).forEach((id) => ids.add(id));
    }
  }
  const wszystkie = [...FLAGI, FLAGA_NASILENIE_10];
  const lista = wszystkie.filter((f) => ids.has(f.id));
  return {
    flagi: lista,
    pilne: lista.some((f) => f.typ === 'pilne'),
    kryzys: lista.some((f) => f.typ === 'kryzys'),
  };
}
