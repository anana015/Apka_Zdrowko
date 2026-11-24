// @ts-check
/**
 * Rozpoznawanie wyników badań w tekście odczytanym z PDF lub zdjęcia.
 * Czyste funkcje (bez DOM), żeby dało się je łatwo poprawiać i sprawdzać.
 * Wynik zawsze trafia do formularza, w którym użytkowniczka sprawdza go przed zapisem.
 */

const LICZBA = String.raw`\d+(?:[.,]\d+)?`;
/** Znaczniki wyniku poza zakresem drukowane przez laboratoria (H, L, strzałki, gwiazdki). */
const FLAGA = String.raw`(?:[HLhl]|[↑↓]|\*{1,2}|!)`;
/** Jednostka: litery, µ, %, /, ^, cyfry w potędze, kropki (np. „tys./µl”, „10^3/µl”, „µIU/ml”, „%”). */
const JEDNOSTKA = String.raw`(?:%|[A-Za-zµμ][A-Za-zµμ0-9.^/\-·*]*(?:\/[A-Za-zµμ0-9.^]+)?|10\^?\d+\/[A-Za-zµμ]+)`;

const RE_ZAKRES = new RegExp(String.raw`(${LICZBA})\s*[-–—÷]\s*(${LICZBA})`);
const RE_PONIZEJ = new RegExp(String.raw`(?:<|<=|≤|do|poniżej)\s*(${LICZBA})`, 'i');
const RE_POWYZEJ = new RegExp(String.raw`(?:>|>=|≥|od|powyżej)\s*(${LICZBA})`, 'i');
const RE_DATA = /\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/;

/** Wiersze, które na pewno nie są wynikiem (nagłówki, dane pacjenta, stopki). */
const POMIN = /pesel|telefon|tel\.|ul\.|adres|strona|str\.|nr\s|numer|zlecen|data\s+(urodz|wyd|przyj|pobr|rejestr)|godz|wiek|płeć|lekarz|kod\s|regon|nip|e-?mail|www\.|http/i;

/**
 * Popularne parametry: nazwy z formularza aplikacji (zestawy) i ich warianty z wydruków laboratoriów.
 * Klucz = nazwa w aplikacji, wartości = wzorce rozpoznawane w tekście.
 */
export const ALIASY = Object.freeze({
  'Leukocyty (WBC)': [/\bwbc\b/i, /leukocyt/i, /krwinki białe/i],
  'Erytrocyty (RBC)': [/\brbc\b/i, /erytrocyt/i, /krwinki czerwone/i],
  'Hemoglobina (HGB)': [/\bhgb\b/i, /\bhb\b/i, /hemoglobin/i],
  'Hematokryt (HCT)': [/\bhct\b/i, /hematokryt/i],
  'MCV': [/\bmcv\b/i],
  'MCH': [/\bmch\b(?!c)/i],
  'MCHC': [/\bmchc\b/i],
  'Płytki krwi (PLT)': [/\bplt\b/i, /płytki|plytki|trombocyt/i],
  'Cholesterol całkowity': [/cholesterol\s+(całk|calk|total)/i, /^cholesterol\b(?!.*(hdl|ldl|nie-?hdl))/i],
  'Cholesterol HDL': [/\bhdl\b(?!.*nie)/i],
  'Cholesterol LDL': [/\bldl\b/i],
  'Cholesterol nie-HDL': [/nie-?\s?hdl/i],
  'Triglicerydy': [/triglicer|trójglicer|trojglicer/i],
  'TSH': [/\btsh\b/i, /tyreotrop/i],
  'FT4': [/\bft4\b/i, /wolna tyroksyna/i],
  'FT3': [/\bft3\b/i, /wolna trijodotyronina/i],
  'Witamina D 25(OH)': [/witamin\w*\s*d/i, /25\s*\(?oh\)?/i],
  'Ferrytyna': [/ferrytyn/i],
  'Żelazo': [/^\s*żelazo|^\s*zelazo|\bfe\b/i],
  'Glukoza': [/glukoz/i],
  'Kreatynina': [/kreatynin/i],
  'CRP': [/\bcrp\b/i, /białko c-?reaktywne/i],
  'ALT': [/\balat?\b/i, /alaninowa/i],
  'AST': [/\bast\b|\baspat\b/i, /asparaginianowa/i],
  'Witamina B12': [/witamin\w*\s*b\s*12/i, /kobalamin/i],
  'Sód': [/^\s*s[óo]d\b|^\s*na\+?(?:\s|$)/i],
  'Potas': [/^\s*potas\b|^\s*k\+?(?:\s|$)/i],
});

/** Jednostki z wydruków laboratoriów — do poprawiania pomyłek OCR (np. „gldl” → „g/dl”, „plU/ml” → „µIU/ml”). */
export const ZNANE_JEDNOSTKI = Object.freeze([
  'g/dl', 'g/l', 'mg/dl', 'mg/l', 'µg/dl', 'µg/l', 'ng/ml', 'ng/dl', 'pg/ml', 'pg', 'fl', '%',
  'tys/µl', 'tys./µl', 'mln/µl', '10^3/µl', '10^6/µl', 'G/l', 'T/l',
  'mmol/l', 'µmol/l', 'nmol/l', 'pmol/l', 'U/l', 'IU/l', 'mIU/ml', 'µIU/ml', 'IU/ml', 'U/ml', 'mm/h', 's', 'ml/min/1,73m2',
]);

/** Odległość edycyjna (Levenshtein). @param {string} a @param {string} b */
function odleglosc(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

/**
 * Najbliższa znana jednostka, jeśli różnica wygląda na pomyłkę OCR. Inaczej jednostka bez zmian.
 * @param {string} jednostka @param {readonly string[]} [preferowane] jednostki, których użytkowniczka już używa
 */
export function normalizujJednostke(jednostka, preferowane = []) {
  // Klucz porównania odporny na typowe pomyłki OCR: µ→u, l/1/|→i, „pi” na początku członu → „ui” (µI czytane jako pl).
  const klucz = (/** @type {string} */ u) => u.toLowerCase().replace(/[µμ]/g, 'u').replace(/[l1|]/g, 'i').replace(/(^|\/)pi(?=u)/g, '$1ui');
  const lista = [...new Set([...preferowane, ...ZNANE_JEDNOSTKI])];
  const k = klucz(jednostka);
  const dokladna = lista.find((u) => klucz(u) === k);
  if (dokladna) return dokladna;
  const limit = k.length <= 4 ? 1 : 2;
  let najlepsza = null;
  let min = Infinity;
  let remis = false;
  for (const u of lista) {
    const o = odleglosc(k, klucz(u));
    if (o < min) { min = o; najlepsza = u; remis = false; } else if (o === min) remis = true;
  }
  return najlepsza && min <= limit && !remis ? najlepsza : jednostka;
}

const ZNANE_LABORATORIA = ['Diagnostyka', 'ALAB', 'Synevo', 'LUX MED', 'Luxmed', 'Medicover', 'Enel-Med', 'Cortex', 'Bruss', 'Laboratoria Medyczne', 'Centrum Medyczne'];

/** „4,6” / „4.6” → 4.6 @param {string|undefined} s */
function liczba(s) {
  if (s == null) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** @param {string} s */
const normalizuj = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Nazwa badania w aplikacji: najpierw nazwy, które użytkowniczka już ma, potem aliasy, na końcu nazwa z wydruku.
 * @param {string} surowa @param {string[]} [istniejace]
 * @returns {{ nazwa: string, znana: boolean }}
 */
export function dopasujNazwe(surowa, istniejace = []) {
  const n = normalizuj(surowa);
  const wlasna = istniejace.find((x) => normalizuj(x) === n);
  if (wlasna) return { nazwa: wlasna, znana: true };
  for (const [nazwa, wzorce] of Object.entries(ALIASY)) {
    if (wzorce.some((w) => w.test(surowa))) {
      const wlasnaAlias = istniejace.find((x) => normalizuj(x) === normalizuj(nazwa));
      return { nazwa: wlasnaAlias ?? nazwa, znana: true };
    }
  }
  return { nazwa: surowa.replace(/\s+/g, ' ').trim().slice(0, 80), znana: false };
}

/**
 * Typowe błędy OCR w liczbach: O→0, l/I→1 obok cyfr, przecinek z kropką, spacje w liczbie.
 * @param {string} linia
 */
export function oczyscLinie(linia) {
  return linia
    .replace(/\u00a0/g, ' ')
    .replace(/(\d)\s*[,.]\s*(\d)/g, '$1,$2')
    .replace(/(?<=\d)[Oo](?=\d|\b)/g, '0')
    .replace(/(?<=\s)[Oo](?=[,.]\d)/g, '0')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Rozpoznaje jeden wiersz „Nazwa  wartość  [flaga]  jednostka  zakres”.
 * @param {string} surowa
 * @returns {{ nazwa: string, wartosc: number, jednostka: string|null, dol: number|null, gora: number|null, flaga: boolean } | null}
 */
export function rozpoznajWiersz(surowa) {
  const linia = oczyscLinie(surowa);
  if (linia.length < 4 || linia.length > 160 || POMIN.test(linia) || RE_DATA.test(linia)) return null;
  // Nazwa (z literą na początku), potem pierwsza liczba, która nie jest częścią nazwy (np. „25(OH)”, „B12”, „FT4”).
  const m = linia.match(new RegExp(String.raw`^(.*?[A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ)\]][^\d<>]*?)\s*[:.]*\s+([<>]?\s*${LICZBA})(?=\s|$|%|[A-Za-zµμ↑↓*!])\s*(.*)$`));
  if (!m) return null;
  const nazwa = m[1].replace(/[.:\s]+$/, '').trim();
  if (!/[A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ]{2,}/.test(nazwa) || nazwa.length > 80) return null;
  const wartosc = liczba(m[2].replace(/[<>\s]/g, ''));
  if (wartosc == null) return null;
  let reszta = m[3].trim();

  let flaga = false;
  const f = reszta.match(new RegExp(String.raw`^${FLAGA}(?=\s|$)`));
  if (f) { flaga = true; reszta = reszta.slice(f[0].length).trim(); }

  let jednostka = null;
  const j = reszta.match(new RegExp(String.raw`^(${JEDNOSTKA})(?=\s|$|\()`));
  if (j && !/^(do|od)$/i.test(j[1])) { jednostka = j[1].replace(/μ/g, 'µ'); reszta = reszta.slice(j[0].length).trim(); }
  const f2 = reszta.match(new RegExp(String.raw`^${FLAGA}(?=\s|$)`));
  if (f2) { flaga = true; reszta = reszta.slice(f2[0].length).trim(); }

  let dol = null;
  let gora = null;
  const z = reszta.match(RE_ZAKRES);
  if (z) { dol = liczba(z[1]); gora = liczba(z[2]); } else {
    const p = reszta.match(RE_PONIZEJ);
    const w = reszta.match(RE_POWYZEJ);
    if (p) gora = liczba(p[1]);
    if (w) dol = liczba(w[1]);
  }
  if (dol != null && gora != null && dol > gora) [dol, gora] = [gora, dol];
  // Bez jednostki i bez zakresu to najpewniej nie wynik (np. numer próbki), chyba że to znany parametr.
  if (!jednostka && dol == null && gora == null && !dopasujNazwe(nazwa).znana) return null;
  return { nazwa, wartosc, jednostka, dol, gora, flaga };
}

/**
 * Data pobrania: najpierw przy słowie „pobran…”, potem pierwsza sensowna data w dokumencie.
 * @param {string[]} linie @returns {string|null} RRRR-MM-DD
 */
export function znajdzDate(linie) {
  const naDate = (/** @type {RegExpMatchArray} */ m) => {
    const [d, mies, r] = m[4] ? [m[6], m[5], m[4]] : [m[1], m[2], m[3]];
    const iso = `${r}-${String(mies).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const t = new Date(`${iso}T12:00:00`);
    return Number.isNaN(t.getTime()) || Number(r) < 2000 ? null : iso;
  };
  for (const l of linie) {
    if (!/pobr|pobra/i.test(l)) continue;
    const m = l.match(RE_DATA);
    if (m && naDate(m)) return naDate(m);
  }
  for (const l of linie) {
    if (/urodz/i.test(l)) continue;
    const m = l.match(RE_DATA);
    if (m && naDate(m)) return naDate(m);
  }
  return null;
}

/** @param {string} tekst */
export function znajdzLaboratorium(tekst) {
  return ZNANE_LABORATORIA.find((l) => tekst.toLowerCase().includes(l.toLowerCase())) ?? null;
}

/**
 * Cały dokument → propozycje wyników.
 * @param {string} tekst
 * @param {string[]} [istniejace] nazwy badań, które użytkowniczka już ma
 * @param {string[]} [jednostki] jednostki, których już używa (pierwszeństwo przy poprawianiu OCR)
 */
export function rozpoznajWyniki(tekst, istniejace = [], jednostki = []) {
  const linie = tekst.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  /** @type {{ nazwa: string, nazwaZDokumentu: string, znana: boolean, wartosc: number, jednostka: string|null, dol: number|null, gora: number|null, flaga: boolean }[]} */
  const wyniki = [];
  const widziane = new Set();
  for (const l of linie) {
    const w = rozpoznajWiersz(l);
    if (!w) continue;
    const { nazwa, znana } = dopasujNazwe(w.nazwa, istniejace);
    const klucz = `${nazwa}|${w.wartosc}`;
    if (widziane.has(klucz)) continue;
    widziane.add(klucz);
    const jednostka = w.jednostka ? normalizujJednostke(w.jednostka, jednostki) : null;
    wyniki.push({ ...w, jednostka, nazwa, nazwaZDokumentu: w.nazwa, znana });
  }
  return { wyniki, data: znajdzDate(linie), laboratorium: znajdzLaboratorium(tekst) };
}
