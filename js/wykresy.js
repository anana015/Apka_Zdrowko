// @ts-check
/**
 * Ekran „Wykresy” (sekcje 4.5, 4.6): wykresy SVG bez zewnętrznych bibliotek, podsumowanie,
 * zależności i raport do druku. Każdy wykres ma opis tekstowy i tabelę danych (dostępność).
 */
import * as db from './db.js';
import { $, h, s, wartoscRadia } from './utils.js';
import {
  ymd, dodajDni, zYmd, formatKrotki, formatPelny, formatGodziny, liczbaPL, seriaDzienna, podsumowanieOkresu,
  dzienEpizodu, nazwaEpizodu, hhmm, opisHarmonogramu, pozaZakresem, snuZWpisu,
} from './obliczenia.js';
import { analizujZaleznosci, ZDANIE_OSTRZEGAWCZE } from './korelacje.js';
import { OBJAWY } from './dolegliwosci.js';
import { ZASTRZEZENIE } from './teksty.js';

export const tytul = 'Wykresy';

/** Szerokość układu współrzędnych = szerokość kontenera w px, więc tekst osi ma realny rozmiar. */
let W = 640;
const H = 190;
/** @param {number|undefined} px */
const ustawSzerokosc = (px) => { W = Math.max(300, Math.round(px || 640)); };
const M = { l: 34, r: 12, t: 14, b: 28 };
const fmtDzienTyg = new Intl.DateTimeFormat('pl-PL', { weekday: 'short' });

/** @param {number} n */
const skalaX = (n) => (/** @type {number} */ i) => M.l + ((i + 0.5) * (W - M.l - M.r)) / n;
/** @param {number} min @param {number} max */
const skalaY = (min, max) => (/** @type {number} */ v) => H - M.b - ((v - min) / (max - min)) * (H - M.t - M.b);

/** @param {ReturnType<typeof seriaDzienna>} seria @param {(i: number) => number} x */
function etykietyX(seria, x) {
  const n = seria.length;
  const co = n <= 7 ? 1 : n <= 31 ? 5 : 15;
  return seria.map((d, i) => ((n - 1 - i) % co === 0
    ? s('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'os-tekst', text: n <= 7 ? fmtDzienTyg.format(zYmd(d.data)) : formatKrotki(d.data) })
    : null));
}

/** @param {(v: number) => number} y @param {number[]} wartosci @param {(v: number) => string} format */
function siatkaY(y, wartosci, format) {
  return wartosci.map((v) => s('g', {},
    s('line', { x1: M.l, x2: W - M.r, y1: y(v), y2: y(v), class: 'os' }),
    s('text', { x: M.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'os-tekst', text: format(v) })));
}

/** @param {string} opis @param {...any} dzieci */
const svg = (opis, ...dzieci) => s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': opis, preserveAspectRatio: 'xMidYMid meet' }, ...dzieci);

/** @param {string[]} naglowki @param {(string|number)[][]} wiersze */
function tabelaDanych(naglowki, wiersze) {
  return h('details', { class: 'dane-tabela' },
    h('summary', { text: 'Pokaż dane w tabeli' }),
    h('div', { class: 'tabela-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, naglowki.map((n) => h('th', { scope: 'col', text: n })))),
      h('tbody', {}, wiersze.map((w) => h('tr', {}, w.map((k, i) => (i === 0 ? h('th', { scope: 'row', text: k }) : h('td', { text: k })))))))));
}

/** @param {ReturnType<typeof seriaDzienna>} seria */
export function wykresSnu(seria, szer = 640) {
  ustawSzerokosc(szer);
  const n = seria.length;
  const x = skalaX(n);
  const sny = seria.map((d) => d.sen).filter((v) => v != null).map(Number);
  const max = Math.max(10, Math.ceil(Math.max(0, ...sny) / 2) * 2);
  const y = skalaY(0, max);
  const szerSlupka = Math.max(2, ((W - M.l - M.r) / n) * 0.66);
  const srednia = sny.length ? sny.reduce((a, b) => a + b, 0) / sny.length : null;
  const opis = sny.length
    ? `Sen, ${n} dni: średnio ${formatGodziny(srednia)}, najkrócej ${formatGodziny(Math.min(...sny))}, najdłużej ${formatGodziny(Math.max(...sny))}, ${sny.length} dni z wpisem.`
    : `Sen, ${n} dni: brak wpisów.`;
  return h('div', {},
    svg(opis,
      ...siatkaY(y, Array.from({ length: max / 2 + 1 }, (_, i) => i * 2), (v) => `${v} h`),
      ...seria.map((d, i) => (d.sen != null
        ? s('rect', { x: x(i) - szerSlupka / 2, y: y(d.sen), width: szerSlupka, height: Math.max(0, y(0) - y(d.sen)), rx: Math.min(4, szerSlupka / 3), class: 'slupek' })
        : null)),
      ...etykietyX(seria, x)),
    tabelaDanych(['Data', 'Sen'], seria.map((d) => [formatKrotki(d.data), d.sen != null ? formatGodziny(d.sen) : '–'])));
}

/** @param {ReturnType<typeof seriaDzienna>} seria */
export function wykresNastroju(seria, szer = 640) {
  ustawSzerokosc(szer);
  const n = seria.length;
  const x = skalaX(n);
  const y = skalaY(1, 5);
  /** @param {'nastroj'|'energia'} pole */
  const sciezka = (pole) => {
    let d = '';
    let poprzedni = false;
    seria.forEach((p, i) => {
      const v = p[pole];
      if (v == null) { poprzedni = false; return; }
      d += `${poprzedni ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      poprzedni = true;
    });
    return d.trim();
  };
  const punkty = (/** @type {'nastroj'|'energia'} */ pole, /** @type {string} */ klasa) => (n <= 31
    ? seria.map((p, i) => (p[pole] != null ? s('circle', { cx: x(i), cy: y(/** @type {number} */ (p[pole])), r: 3.5, class: klasa }) : null))
    : []);
  const nastroje = seria.map((d) => d.nastroj).filter((v) => v != null).map(Number);
  const energie = seria.map((d) => d.energia).filter((v) => v != null).map(Number);
  const sr = (/** @type {number[]} */ t) => (t.length ? t.reduce((a, b) => a + b, 0) / t.length : null);
  const opis = nastroje.length
    ? `Nastrój i energia, ${n} dni, skala 1–5: średni nastrój ${liczbaPL(sr(nastroje))}, średnia energia ${liczbaPL(sr(energie))}.`
    : `Nastrój i energia, ${n} dni: brak wpisów.`;
  return h('div', {},
    svg(opis,
      ...siatkaY(y, [1, 2, 3, 4, 5], String),
      s('path', { d: sciezka('energia'), class: 'linia-energia' }),
      s('path', { d: sciezka('nastroj'), class: 'linia-nastroj' }),
      ...punkty('energia', 'punkt-energia'),
      ...punkty('nastroj', 'punkt-nastroj'),
      ...etykietyX(seria, x)),
    h('div', { class: 'wykres-legenda', 'aria-hidden': 'true' },
      h('span', {}, h('i', {}), 'Nastrój'), h('span', {}, h('i', { class: 'l-energia' }), 'Energia')),
    tabelaDanych(['Data', 'Nastrój', 'Energia'], seria.map((d) => [formatKrotki(d.data), d.nastroj ?? '–', d.energia ?? '–'])));
}

/** @param {ReturnType<typeof seriaDzienna>} seria */
export function wykresBolu(seria, szer = 640) {
  ustawSzerokosc(szer);
  const n = seria.length;
  const x = skalaX(n);
  const y = skalaY(0, 10);
  const dniBolu = seria.filter((d) => d.liczbaEpizodow > 0);
  const duze = n <= 31;
  const opis = dniBolu.length
    ? `Epizody bólu głowy, ${n} dni: ${dniBolu.length} dni z bólem, ${dniBolu.reduce((a, d) => a + d.liczbaEpizodow, 0)} epizodów. Wysokość znacznika to najwyższe nasilenie danego dnia w skali 0–10.`
    : `Epizody bólu głowy, ${n} dni: brak epizodów.`;
  return h('div', {},
    svg(opis,
      ...siatkaY(y, [0, 5, 10], String),
      ...seria.map((d, i) => {
        if (!d.liczbaEpizodow) return null;
        const v = d.bolMax ?? 0;
        return s('g', {},
          s('line', { x1: x(i), x2: x(i), y1: y(0), y2: y(v), class: 'bol-trzon' }),
          s('circle', { cx: x(i), cy: y(v), r: duze ? 9 : 4, class: 'bol-punkt' }),
          duze ? s('text', { x: x(i), y: y(v) + 3.5, 'text-anchor': 'middle', class: 'bol-tekst', text: d.bolMax ?? '?' }) : null);
      }),
      ...etykietyX(seria, x)),
    tabelaDanych(['Data', 'Epizody', 'Najwyższe nasilenie'], dniBolu.map((d) => [formatKrotki(d.data), d.liczbaEpizodow, d.bolMax ?? 'nie podano'])));
}

/**
 * Wykres wyników jednego badania z zakresem referencyjnym laboratorium.
 * @param {any[]} wyniki posortowane rosnąco po dacie @param {number} [szer]
 */
export function wykresBadania(wyniki, szer = 640) {
  ustawSzerokosc(szer);
  const czasy = wyniki.map((w) => zYmd(w.taken_on).getTime());
  const t0 = Math.min(...czasy), t1 = Math.max(...czasy);
  const x = (/** @type {number} */ t) => (t1 === t0 ? (M.l + W - M.r) / 2 : M.l + 16 + ((t - t0) / (t1 - t0)) * (W - M.l - M.r - 32));
  const wartosci = wyniki.flatMap((w) => [w.value, w.ref_low, w.ref_high]).filter((v) => v != null).map(Number);
  const minDanych = Math.min(...wartosci), maxDanych = Math.max(...wartosci);
  const zapas = (maxDanych - minDanych || Math.abs(maxDanych) || 1) * 0.15;
  const { min, max, ticki } = ladnaSkala(minDanych >= 0 ? Math.max(0, minDanych - zapas) : minDanych - zapas, maxDanych + zapas);
  const y = skalaY(min, max);
  const takieSameZakresy = wyniki.every((w) => w.ref_low === wyniki[0].ref_low && w.ref_high === wyniki[0].ref_high);
  const r0 = wyniki[0];
  /** @type {any[]} */ const pasma = [];
  if (takieSameZakresy && (r0.ref_low != null || r0.ref_high != null)) {
    const gora = y(r0.ref_high ?? max), dol = y(r0.ref_low ?? min);
    pasma.push(s('rect', { x: M.l, y: gora, width: W - M.l - M.r, height: Math.max(0, dol - gora), class: 'pasmo-ref' }));
    if (r0.ref_high != null) pasma.push(s('line', { x1: M.l, x2: W - M.r, y1: gora, y2: gora, class: 'pasmo-ref-krawedz' }));
    if (r0.ref_low != null) pasma.push(s('line', { x1: M.l, x2: W - M.r, y1: dol, y2: dol, class: 'pasmo-ref-krawedz' }));
  } else {
    for (const w of wyniki) {
      if (w.ref_low == null && w.ref_high == null) continue;
      const gora = y(w.ref_high ?? max), dol = y(w.ref_low ?? min);
      pasma.push(s('rect', { x: x(zYmd(w.taken_on).getTime()) - 8, y: gora, width: 16, height: Math.max(0, dol - gora), rx: 3, class: 'pasmo-ref' }));
    }
  }
  const d = wyniki.map((w, i) => `${i ? 'L' : 'M'}${x(czasy[i]).toFixed(1)},${y(w.value).toFixed(1)}`).join(' ');
  const jednostka = wyniki[wyniki.length - 1].unit ?? '';
  const opis = `${wyniki[0].test_name}: ${wyniki.length} wyników od ${formatPelny(wyniki[0].taken_on)} do ${formatPelny(wyniki[wyniki.length - 1].taken_on)}. Ostatni: ${liczbaPL(wyniki[wyniki.length - 1].value, 3)} ${jednostka}. Jasne pole oznacza zakres podany przez laboratorium.`;
  return svg(opis,
    ...pasma,
    ...siatkaY(y, ticki, (v) => liczbaPL(v, 2)),
    wyniki.length > 1 ? s('path', { d, class: 'linia-wynik' }) : null,
    ...wyniki.map((w, i) => {
      const poza = pozaZakresem(w.value, w.ref_low, w.ref_high);
      return s('circle', { cx: x(czasy[i]), cy: y(w.value), r: 5, class: poza === 'ponizej' || poza === 'powyzej' ? 'punkt-wynik punkt-wynik--poza' : 'punkt-wynik' });
    }),
    ...wyniki.map((w, i) => s('text', { x: x(czasy[i]), y: H - 8, 'text-anchor': 'middle', class: 'os-tekst', text: formatKrotki(w.taken_on) })));
}

/**
 * „Ładne” podziałki osi (1, 2, 2,5, 5 × 10^k).
 * @param {number} lo @param {number} hi @param {number} [n]
 */
function ladnaSkala(lo, hi, n = 4) {
  const surowy = (hi - lo) / n || 1;
  const potega = 10 ** Math.floor(Math.log10(surowy));
  const krok = [1, 2, 2.5, 5, 10].map((m) => m * potega).find((k) => k >= surowy) ?? 10 * potega;
  const min = Math.floor(lo / krok) * krok;
  const max = Math.ceil(hi / krok) * krok;
  const ticki = [];
  for (let v = min; v <= max + krok / 2; v += krok) ticki.push(Math.round(v / krok) * krok);
  return { min, max, ticki };
}

let ostatniKluczZaleznosci = '';

export function init() {
  for (const r of document.querySelectorAll('input[name="zakres"]')) r.addEventListener('change', () => render());
  $('#raport-drukuj').addEventListener('click', drukujRaport);
  window.addEventListener('afterprint', () => { $('#raport').hidden = true; });
  /** @type {ReturnType<typeof setTimeout>|undefined} */ let zegar;
  window.addEventListener('resize', () => {
    clearTimeout(zegar);
    zegar = setTimeout(() => { if (!$('#ekran-wykresy').hidden) render(); }, 250);
  });
}

export async function render() {
  const dni = Number(wartoscRadia($('#ekran-wykresy'), 'zakres') ?? 30);
  const do_ = ymd();
  const od = dodajDni(do_, -(dni - 1));
  const dane = await db.wczytajWszystko();
  const seria = seriaDzienna({ wpisy: dane.wpisy, epizody: dane.epizody, od, do_ });
  const p = podsumowanieOkresu({ ...dane, od, do_ });

  const liczba = (/** @type {string} */ etykieta, /** @type {string} */ wartosc) => h('div', {}, h('dt', { text: etykieta }), h('dd', { text: wartosc }));
  $('#podsumowanie').replaceChildren(
    liczba('Średni sen', formatGodziny(p.sredniSen)),
    liczba('Dni z wpisem', `${p.dniZWpisem} z ${p.liczbaDni}`),
    liczba('Dni z bólem głowy', String(p.dniZBolem)),
    liczba('Średnie nasilenie bólu', p.srednieNasilenie != null ? `${liczbaPL(p.srednieNasilenie)}/10` : '–'),
    liczba('Leki doraźne', String(p.lekiDorazne)),
    liczba('Średni nastrój', p.sredniNastroj != null ? `${liczbaPL(p.sredniNastroj)}/5` : '–'),
  );
  const szer = $('#wykres-sen').clientWidth;
  $('#wykres-sen').replaceChildren(wykresSnu(seria, szer));
  $('#wykres-nastroj').replaceChildren(wykresNastroju(seria, szer));
  $('#wykres-bol').replaceChildren(wykresBolu(seria, szer));

  const raportOd = /** @type {HTMLInputElement} */ ($('#raport-od'));
  const raportDo = /** @type {HTMLInputElement} */ ($('#raport-do'));
  if (!raportOd.value) raportOd.value = dodajDni(do_, -29);
  if (!raportDo.value) raportDo.value = do_;

  renderZaleznosci(dane);
}

/** @param {Awaited<ReturnType<typeof db.wczytajWszystko>>} dane */
function renderZaleznosci({ wpisy, epizody, leki, przyjecia }) {
  const kontener = $('#zaleznosci');
  const klucz = [wpisy.length, epizody.length, leki.length, przyjecia.length, ...wpisy.map((w) => w.updated_at), ...epizody.map((e) => e.updated_at), ...leki.map((l) => l.updated_at)].sort().join('|');
  if (klucz === ostatniKluczZaleznosci && kontener.childElementCount) return;
  ostatniKluczZaleznosci = klucz;
  kontener.replaceChildren(h('p', { class: 'drobny', text: 'Liczę zależności…' }));
  // Obliczenia (~0,3 s dla 90 dni) po narysowaniu ekranu, żeby nie blokować interfejsu.
  setTimeout(() => {
    const w = analizujZaleznosci({ wpisy, epizody, leki, przyjecia });
    if (w.status === 'za_malo_danych') {
      kontener.replaceChildren(h('p', { class: 'pusty', text:
        `Za mało danych, by szukać zależności. Masz ${w.dni} dni z wpisem (potrzeba ${w.progi.minDni}) i ${w.epizody} epizodów bólu głowy (potrzeba ${w.progi.minEpizodow}).` }));
      return;
    }
    const okres = w.okres ? `od ${formatPelny(w.okres.od)} do ${formatPelny(w.okres.do)}` : '';
    const metoda = h('p', { class: 'drobny', text:
      `Sprawdzono ${w.liczbaTestow} możliwych zależności w okresie ${okres}. Przy wielu porównaniach część zależności może wyjść przypadkiem, dlatego wyniki są korygowane (metoda Benjaminiego-Hochberga) i pokazujemy tylko wyraźne efekty.` });
    if (!w.wyniki.length) {
      kontener.replaceChildren(h('p', { class: 'pusty', text: 'Nie widać wyraźnych zależności w Twoich danych.' }), metoda);
      return;
    }
    kontener.replaceChildren(...[
      // Zastrzeżenie raz nad listą zamiast w każdej karcie; w karcie tylko uwagi szczególne (np. przy lekach).
      h('p', { class: 'zaleznosc__zastrzezenie', text: ZDANIE_OSTRZEGAWCZE }),
      ...w.wyniki.map((r) => h('div', { class: 'zaleznosc' },
        h('p', { text: r.zdanie }),
        r.ostrzezenie && r.ostrzezenie !== ZDANIE_OSTRZEGAWCZE ? h('p', { class: 'drobny', text: r.ostrzezenie.replace(ZDANIE_OSTRZEGAWCZE, '').trim() }) : null,
        r.powtarzalny ? h('p', { class: 'drobny', text: 'Wzór powtarza się w obu połowach okresu.' }) : null)),
      w.wyniki.some((r) => r.powtarzalny) ? h('p', { class: 'zaleznosc__omow', text: 'Powtarzające się wzorce warto omówić z lekarzem.' }) : null,
      metoda].filter((x) => x != null));
  }, 30);
}

async function drukujRaport() {
  const od = /** @type {HTMLInputElement} */ ($('#raport-od')).value;
  const do_ = /** @type {HTMLInputElement} */ ($('#raport-do')).value;
  if (!od || !do_ || od > do_) { $('#raport-od').focus(); return; }
  const dane = await db.wczytajWszystko();
  const profil = (await db.meta('profil', {})) ?? {};
  const seria = seriaDzienna({ wpisy: dane.wpisy, epizody: dane.epizody, od, do_ });
  const zal = analizujZaleznosci({
    wpisy: dane.wpisy.filter((w) => w.entry_date >= od && w.entry_date <= do_),
    epizody: dane.epizody.filter((e) => dzienEpizodu(e) >= od && dzienEpizodu(e) <= do_),
    leki: dane.leki,
    przyjecia: dane.przyjecia,
  });
  const sekcjaZaleznosci = h('section', {}, h('h2', { text: 'Zależności w danych (obserwacje, nie dowód przyczyny)' }),
    zal.status === 'za_malo_danych'
      ? h('p', { text: `Za mało danych w tym okresie (${zal.dni} dni z wpisem, ${zal.epizody} epizodów bólu głowy; potrzeba ${zal.progi.minDni} i ${zal.progi.minEpizodow}).` })
      : zal.wyniki.length
        ? h('ul', {}, zal.wyniki.map((r) => h('li', { text: r.zdanie })))
        : h('p', { text: `Sprawdzono ${zal.liczbaTestow} możliwych zależności; żadna nie przekroczyła progu wielkości efektu.` }));
  const p = podsumowanieOkresu({ ...dane, od, do_ });
  const lekPoId = new Map(dane.leki.map((l) => [l.id, l]));
  const objaw = (/** @type {string} */ id) => OBJAWY.find((o) => o.id === id)?.etykieta ?? null;
  const epizody = dane.epizody.filter((e) => dzienEpizodu(e) >= od && dzienEpizodu(e) <= do_).sort((a, b) => (a.started_at < b.started_at ? -1 : 1));
  const wpisy = dane.wpisy.filter((w) => w.entry_date >= od && w.entry_date <= do_).sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1));
  const wyniki = dane.wyniki.filter((w) => w.taken_on >= od && w.taken_on <= do_).sort((a, b) => (a.taken_on < b.taken_on ? -1 : 1));
  const ULGA = { none: 'brak', partial: 'częściowa', full: 'pełna' };

  const tabela = (/** @type {string[]} */ nag, /** @type {any[][]} */ wiersze) => h('table', {},
    h('thead', {}, h('tr', {}, nag.map((n) => h('th', { text: n })))),
    h('tbody', {}, wiersze.map((w) => h('tr', {}, w.map((k) => h('td', { text: k ?? '–' }))))));

  $('#raport').replaceChildren(h('div', {},
    h('h1', { text: 'Dziennik zdrowia: raport' }),
    h('p', { text: `${profil.display_name ? `${profil.display_name}. ` : ''}Okres: ${formatPelny(od)} – ${formatPelny(do_)}. Wygenerowano: ${formatPelny(ymd())}.` }),
    h('p', { text: 'Notatki prowadzone przez pacjenta. Bez interpretacji.' }),
    h('section', {}, h('h2', { text: 'Podsumowanie' }), tabela(['Dni z wpisem', 'Średni sen', 'Dni z bólem głowy', 'Epizody', 'Średnie nasilenie', 'Leki doraźne'],
      [[`${p.dniZWpisem} z ${p.liczbaDni}`, formatGodziny(p.sredniSen), p.dniZBolem, p.liczbaEpizodow, p.srednieNasilenie != null ? `${liczbaPL(p.srednieNasilenie)}/10` : '–', p.lekiDorazne]])),
    h('section', { class: 'wykres' }, h('h2', { text: 'Sen' }), wykresSnu(seria)),
    h('section', { class: 'wykres' }, h('h2', { text: 'Nastrój i energia (1–5)' }), wykresNastroju(seria)),
    h('section', { class: 'wykres' }, h('h2', { text: 'Epizody bólu głowy (nasilenie 0–10)' }), wykresBolu(seria)),
    h('section', {}, h('h2', { text: 'Dolegliwości' }), epizody.length ? tabela(['Data', 'Rodzaj', 'Godziny', 'Nasilenie', 'Objawy', 'Leki', 'Ulga po 2 h'],
      epizody.map((e) => [
        formatKrotki(dzienEpizodu(e)), nazwaEpizodu(e), e.ended_at ? `${hhmm(e.started_at)}–${hhmm(e.ended_at)}` : `od ${hhmm(e.started_at)}`,
        e.intensity != null ? `${e.intensity}/10` : null,
        [e.temperature != null ? `${liczbaPL(e.temperature, 1)}°C` : null, ...(e.features ?? []).map(objaw)].filter(Boolean).join(', ') || null,
        dane.przyjecia.filter((x) => x.episode_id === e.id).map((x) => `${lekPoId.get(x.medication_id)?.name ?? '?'} ${hhmm(x.taken_at)}`).join(', ') || null,
        e.relief ? ULGA[/** @type {'none'|'partial'|'full'} */ (e.relief)] : null,
      ])) : h('p', { text: 'Brak w tym okresie.' })),
    h('section', {}, h('h2', { text: 'Leki i suplementy' }), dane.leki.length ? tabela(['Nazwa', 'Rodzaj', 'Dawka', 'Harmonogram', 'Od', 'Do'],
      dane.leki.map((l) => [l.name, l.kind === 'supplement' ? 'suplement' : 'lek', l.dose_text, opisHarmonogramu(l.schedule), l.start_date, l.end_date])) : h('p', { text: 'Brak.' })),
    wyniki.length ? h('section', {}, h('h2', { text: 'Wyniki badań' }), tabela(['Data', 'Badanie', 'Wynik', 'Zakres laboratorium', 'Laboratorium'],
      wyniki.map((w) => [formatKrotki(w.taken_on), w.test_name, `${liczbaPL(w.value, 3)} ${w.unit ?? ''}`,
        w.ref_low != null || w.ref_high != null ? `${liczbaPL(w.ref_low, 3)}–${liczbaPL(w.ref_high, 3)}` : null, w.lab_name]))) : null,
    sekcjaZaleznosci,
    h('section', {}, h('h2', { text: 'Wpisy dzienne' }), tabela(['Data', 'Sen', 'Jakość', 'Nastrój', 'Energia', 'Stres', 'Znaczniki'],
      wpisy.map((w) => [formatKrotki(w.entry_date), formatGodziny(snuZWpisu(w)), w.sleep_quality, w.mood, w.energy, w.stress, (w.tags ?? []).join(', ') || null]))),
    h('p', { class: 'drobny', text: ZASTRZEZENIE }),
  ));
  $('#raport').hidden = false;
  window.print();
}

