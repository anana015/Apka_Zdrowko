// @ts-check
/**
 * Czyste funkcje obliczeniowe: daty, sen, agregacje, porównania z zakresem.
 * Bez dostępu do DOM i bazy — testowane w Node (tests/obliczenia.test.js).
 * Daty dzienne (YYYY-MM-DD) liczone w lokalnej strefie czasowej urządzenia.
 */

/** @typedef {{ id?: string, entry_date: string, sleep_start?: string|null, sleep_end?: string|null, sleep_hours?: number|null, sleep_quality?: number|null, awakenings?: number|null, mood?: number|null, energy?: number|null, stress?: number|null, tags?: string[], note?: string|null }} Wpis */
/** @typedef {{ id?: string, kind: 'headache'|'migraine'|'back'|'pelvic'|'other', custom_name?: string|null, started_at: string, ended_at?: string|null, intensity?: number|null, location?: string|null, features?: string[], triggers?: string[], relief?: 'none'|'partial'|'full'|null, note?: string|null }} Epizod */
/** @typedef {{ id?: string, name: string, kind: 'medication'|'supplement', dose_text?: string|null, schedule?: { type: 'daily', times: string[] } | { type: 'as_needed' } | null, start_date?: string|null, end_date?: string|null, active?: boolean, note?: string|null }} Lek */
/** @typedef {{ id?: string, medication_id: string, taken_at: string, dose_text?: string|null, reason?: string|null, episode_id?: string|null, scheduled_time?: string|null }} Przyjecie */

const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');

/** Data lokalna w formacie YYYY-MM-DD. @param {Date} [d] */
export function ymd(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** @param {string} s YYYY-MM-DD → Date (lokalna północ) */
export function zYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** @param {string} s @param {number} n */
export function dodajDni(s, n) {
  const d = zYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/** Liczba dni od a do b (b − a), odporna na zmianę czasu. @param {string} a @param {string} b */
export function roznicaDni(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/** Wszystkie dni od–do włącznie. @param {string} od @param {string} do_ */
export function zakresDni(od, do_) {
  const n = roznicaDni(od, do_);
  return Array.from({ length: Math.max(0, n + 1) }, (_, i) => dodajDni(od, i));
}

/** @param {string} data YYYY-MM-DD @param {string} hhmm */
export function czasNaDate(data, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = zYmd(data);
  d.setHours(h, m, 0, 0);
  return d;
}

/** @param {string|Date} iso */
export function hhmm(iso) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Wartość dla <input type="datetime-local">. @param {string|Date} iso */
export function doDatetimeLocal(iso) {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${ymd(d)}T${hhmm(d)}`;
}

/** @param {string} wartosc z <input type="datetime-local"> → ISO (UTC) */
export function zDatetimeLocal(wartosc) {
  if (!wartosc) return null;
  const [data, czas] = wartosc.split('T');
  return czasNaDate(data, czas).toISOString();
}

/**
 * Wpis z dnia D opisuje noc przed D (pobudka w dniu D).
 * Jeśli godzina zaśnięcia jest późniejsza lub równa godzinie pobudki, zaśnięcie było dzień wcześniej.
 * @param {string} dataWpisu @param {string} zasniecie HH:MM @param {string} pobudka HH:MM
 */
export function zbudujCzasySnu(dataWpisu, zasniecie, pobudka) {
  const koniec = czasNaDate(dataWpisu, pobudka);
  let poczatek = czasNaDate(dataWpisu, zasniecie);
  if (poczatek >= koniec) poczatek = czasNaDate(dodajDni(dataWpisu, -1), zasniecie);
  return { sleep_start: poczatek.toISOString(), sleep_end: koniec.toISOString() };
}

/** Godziny snu z dokładnością do 0,1 h; liczone z rzeczywistych znaczników czasu (uwzględnia zmianę czasu). */
export function godzinySnu(/** @type {string} */ startIso, /** @type {string} */ endIso) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round((ms / 3600000) * 10) / 10;
}

/** @param {number|null|undefined} h */
export function formatGodziny(h) {
  if (h == null || !Number.isFinite(h)) return '–';
  const calk = Math.floor(h);
  const min = Math.round((h - calk) * 60);
  if (min === 60) return `${calk + 1} h`;
  return min ? `${calk} h ${min} min` : `${calk} h`;
}

const fmtDzien = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtKrotki = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' });
const fmtPelny = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtMiesiac = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' });

/** @param {string} s */ export const formatDzien = (s) => fmtDzien.format(zYmd(s));
/** @param {string} s */ export const formatKrotki = (s) => fmtKrotki.format(zYmd(s));
/** @param {string} s */ export const formatPelny = (s) => fmtPelny.format(zYmd(s));
/** @param {number} rok @param {number} miesiac 0–11 */
export const formatMiesiac = (rok, miesiac) => {
  const t = fmtMiesiac.format(new Date(rok, miesiac, 1));
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** @param {number|null|undefined} x @param {number} [miejsca] */
export function liczbaPL(x, miejsca = 1) {
  if (x == null || !Number.isFinite(x)) return '–';
  return x.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: miejsca });
}

/** Parsuje liczbę wpisaną z przecinkiem lub kropką. @param {string|number|null|undefined} v */
export function parsujLiczbe(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = v.trim().replace(/\s/g, '').replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** @param {Epizod} e */
export const dzienEpizodu = (e) => ymd(new Date(e.started_at));

/** @param {Epizod} e */
export const czyBolGlowy = (e) => e.kind === 'headache' || e.kind === 'migraine';

/** @param {Epizod} e */
export function nazwaEpizodu(e) {
  if (e.kind === 'headache') return 'Ból głowy';
  if (e.kind === 'migraine') return 'Migrena';
  if (e.kind === 'back') return 'Ból kręgosłupa';
  if (e.kind === 'pelvic') return 'Ból w okolicy intymnej';
  return e.custom_name?.trim() || 'Inna dolegliwość';
}

/** Ostatni wpis sprzed danej daty (do wypełnienia domyślnymi wartościami). @param {Wpis[]} wpisy @param {string} data */
export function poprzedniWpis(wpisy, data) {
  let najlepszy = null;
  for (const w of wpisy) {
    if (w.entry_date < data && (!najlepszy || w.entry_date > najlepszy.entry_date)) najlepszy = w;
  }
  return najlepszy;
}

/** Długość snu z wpisu: z godzin zaśnięcia i pobudki albo wpisana liczba. @param {Wpis} w */
export function snuZWpisu(w) {
  if (w.sleep_hours != null) return Number(w.sleep_hours);
  if (w.sleep_start && w.sleep_end) return godzinySnu(w.sleep_start, w.sleep_end);
  return null;
}

/**
 * Seria dzienna do wykresów.
 * @param {{ wpisy: Wpis[], epizody: Epizod[], od: string, do_: string }} p
 */
export function seriaDzienna({ wpisy, epizody, od, do_ }) {
  const poDacie = new Map(wpisy.map((w) => [w.entry_date, w]));
  /** @type {Map<string, Epizod[]>} */
  const epPoDacie = new Map();
  for (const e of epizody) {
    if (!czyBolGlowy(e)) continue;
    const d = dzienEpizodu(e);
    if (d < od || d > do_) continue;
    if (!epPoDacie.has(d)) epPoDacie.set(d, []);
    epPoDacie.get(d)?.push(e);
  }
  return zakresDni(od, do_).map((data) => {
    const w = poDacie.get(data);
    const eps = epPoDacie.get(data) ?? [];
    const nasilenia = eps.map((e) => e.intensity).filter((x) => x != null).map(Number);
    return {
      data,
      sen: w ? snuZWpisu(w) : null,
      jakosc: w?.sleep_quality ?? null,
      nastroj: w?.mood ?? null,
      energia: w?.energy ?? null,
      stres: w?.stress ?? null,
      liczbaEpizodow: eps.length,
      bolMax: eps.length ? (nasilenia.length ? Math.max(...nasilenia) : null) : null,
    };
  });
}

/** @param {number[]} xs */
const srednia = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Podsumowanie okresu (ekran Wykresy i raport).
 * @param {{ wpisy: Wpis[], epizody: Epizod[], przyjecia: Przyjecie[], leki: Lek[], od: string, do_: string }} p
 */
export function podsumowanieOkresu({ wpisy, epizody, przyjecia, leki, od, do_ }) {
  const wOkresie = wpisy.filter((w) => w.entry_date >= od && w.entry_date <= do_);
  const sny = wOkresie.map(snuZWpisu).filter((x) => x != null).map(Number);
  const bole = epizody.filter((e) => czyBolGlowy(e) && dzienEpizodu(e) >= od && dzienEpizodu(e) <= do_);
  const dniZBolem = new Set(bole.map(dzienEpizodu)).size;
  const nasilenia = bole.map((e) => e.intensity).filter((x) => x != null).map(Number);
  const dorazneId = new Set(leki.filter((l) => l.schedule?.type === 'as_needed').map((l) => l.id));
  const lekiDorazne = przyjecia.filter((p) => {
    const d = ymd(new Date(p.taken_at));
    return dorazneId.has(p.medication_id) && d >= od && d <= do_;
  }).length;
  const nastroje = wOkresie.map((w) => w.mood).filter((x) => x != null).map(Number);
  return {
    liczbaDni: roznicaDni(od, do_) + 1,
    dniZWpisem: wOkresie.length,
    sredniSen: srednia(sny),
    sredniNastroj: srednia(nastroje),
    dniZBolem,
    liczbaEpizodow: bole.length,
    srednieNasilenie: srednia(nasilenia),
    lekiDorazne,
  };
}

/**
 * Czyste porównanie liczb z zakresem z wyniku laboratorium. Bez interpretacji.
 * @param {number} wartosc @param {number|null|undefined} dol @param {number|null|undefined} gora
 * @returns {'ponizej'|'powyzej'|'w_zakresie'|null}
 */
export function pozaZakresem(wartosc, dol, gora) {
  if (dol == null && gora == null) return null;
  if (dol != null && wartosc < dol) return 'ponizej';
  if (gora != null && wartosc > gora) return 'powyzej';
  return 'w_zakresie';
}

/**
 * Walidacja wyniku przed zapisem (ryzyko: błąd w ręcznie wpisanej wartości).
 * @param {{ test_name: string, value: number|null, unit?: string|null, ref_low?: number|null, ref_high?: number|null }} w
 * @param {{ test_name: string, unit?: string|null, taken_on: string }[]} poprzednie
 */
export function walidujWynik(w, poprzednie = []) {
  /** @type {string[]} */ const bledy = [];
  /** @type {string[]} */ const ostrzezenia = [];
  if (!w.test_name?.trim()) bledy.push('Podaj nazwę badania.');
  if (w.value == null) bledy.push(`${w.test_name || 'Badanie'}: podaj wartość liczbową.`);
  if (w.ref_low != null && w.ref_high != null && w.ref_low > w.ref_high) {
    bledy.push(`${w.test_name}: dolna granica zakresu jest większa niż górna.`);
  }
  const wczesniejsze = poprzednie
    .filter((p) => p.test_name.trim().toLowerCase() === w.test_name.trim().toLowerCase() && p.unit)
    .sort((a, b) => (a.taken_on < b.taken_on ? 1 : -1));
  const ostatnia = wczesniejsze[0];
  if (ostatnia && w.unit && ostatnia.unit?.trim() !== w.unit.trim()) {
    ostrzezenia.push(`${w.test_name}: poprzednio wpisano jednostkę „${ostatnia.unit}”, teraz „${w.unit}”. Sprawdź, czy wartości są porównywalne.`);
  }
  if (w.value != null && w.value < 0) ostrzezenia.push(`${w.test_name}: wartość jest ujemna. Sprawdź wpis.`);
  return { bledy, ostrzezenia };
}

/** @param {Lek['schedule']} h */
export function opisHarmonogramu(h) {
  if (!h) return 'bez harmonogramu';
  if (h.type === 'as_needed') return 'doraźnie';
  const godz = [...(h.times ?? [])].sort();
  return godz.length ? `codziennie: ${godz.join(', ')}` : 'codziennie';
}

/** Czy lek obowiązuje danego dnia. @param {Lek} l @param {string} data */
export function lekAktywnyWDniu(l, data) {
  if (l.active === false) return false;
  if (l.start_date && data < l.start_date) return false;
  if (l.end_date && data > l.end_date) return false;
  return true;
}

/** Stałe dawki na dany dzień, posortowane po godzinie. @param {Lek[]} leki @param {string} data */
export function dawkiNaDzien(leki, data) {
  /** @type {{ lek: Lek, godzina: string }[]} */
  const wynik = [];
  for (const l of leki) {
    if (!lekAktywnyWDniu(l, data) || l.schedule?.type !== 'daily') continue;
    for (const g of l.schedule.times ?? []) wynik.push({ lek: l, godzina: g });
  }
  return wynik.sort((a, b) => a.godzina.localeCompare(b.godzina) || a.lek.name.localeCompare(b.lek.name, 'pl'));
}

/** Normalizacja nazwy znacznika. @param {string} t */
export function normalizujTag(t) {
  return t.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Odczyt snu skopiowanego przez skrót „Dziennik sen” z aplikacji Skróty (iPhone).
 * Format skrótu: „DZIENNIK-SEN;RRRR-MM-DD GG:MM;RRRR-MM-DD GG:MM”. Akceptuje też dwie godziny w dowolnym tekście.
 * @param {string} tekst
 * @returns {{ zasniecie: string, pobudka: string, dataPobudki: string|null }|null}
 */
export function parsujSenZeSchowka(tekst) {
  if (!tekst) return null;
  const pelne = [...tekst.matchAll(/(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})/g)];
  const n2 = (/** @type {string} */ x) => x.padStart(2, '0');
  if (pelne.length >= 2) {
    const [a, b] = [pelne[0], pelne[pelne.length - 1]];
    return { zasniecie: `${n2(a[2])}:${a[3]}`, pobudka: `${n2(b[2])}:${b[3]}`, dataPobudki: b[1] };
  }
  const godziny = [...tekst.matchAll(/\b(\d{1,2})[:.](\d{2})\b/g)].filter((m) => Number(m[1]) < 24 && Number(m[2]) < 60);
  if (godziny.length >= 2) {
    const [a, b] = [godziny[0], godziny[godziny.length - 1]];
    return { zasniecie: `${n2(a[1])}:${a[2]}`, pobudka: `${n2(b[1])}:${b[2]}`, dataPobudki: null };
  }
  return null;
}
