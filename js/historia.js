// @ts-check
/** Ekran „Historia”: kalendarz miesiąca w kolorach nastroju, ikony epizodów, szczegóły dnia. */
import * as db from './db.js';
import { $, h, ikona } from './utils.js';
import {
  ymd, formatDzien, formatMiesiac, formatGodziny, snuZWpisu, dzienEpizodu, nazwaEpizodu, hhmm,
} from './obliczenia.js';
import { otworzEpizod } from './dolegliwosci.js';

export const tytul = 'Historia';

const DNI_TYG = ['pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.', 'niedz.'];
const DNI_TYG_KROTKIE = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const NASTROJ = ['', 'bardzo zły', 'zły', 'taki sobie', 'dobry', 'bardzo dobry'];

let rok = new Date().getFullYear();
let miesiac = new Date().getMonth();
let wybrany = ymd();
const wielkaLitera = (/** @type {string} */ t) => t.charAt(0).toUpperCase() + t.slice(1);

export function init() {
  $('#kal-poprzedni').addEventListener('click', () => przesun(-1));
  $('#kal-nastepny').addEventListener('click', () => przesun(1));
  $('#kal-legenda').replaceChildren(
    ...[1, 2, 3, 4, 5].map((n) => h('span', {}, h('i', { 'data-n': String(n) }), `${n}: ${NASTROJ[n]}`)),
    h('span', {}, h('i', { class: 'legenda__bol' }), 'dzień z bólem głowy'),
  );
}

/** @param {number} o */
function przesun(o) {
  const d = new Date(rok, miesiac + o, 1);
  rok = d.getFullYear();
  miesiac = d.getMonth();
  render();
}

export async function render() {
  const dane = await db.wczytajWszystko();
  const dzis = ymd();
  $('#kal-miesiac').textContent = formatMiesiac(rok, miesiac);
  const teraz = new Date();
  /** @type {HTMLButtonElement} */ ($('#kal-nastepny')).disabled = rok > teraz.getFullYear() || (rok === teraz.getFullYear() && miesiac >= teraz.getMonth());

  const wpisPoDacie = new Map(dane.wpisy.map((w) => [w.entry_date, w]));
  /** @type {Map<string, number>} */
  const bolePoDacie = new Map();
  for (const e of dane.epizody) {
    if (e.kind === 'other') continue;
    const d = dzienEpizodu(e);
    bolePoDacie.set(d, (bolePoDacie.get(d) ?? 0) + 1);
  }

  const przesuniecie = (new Date(rok, miesiac, 1).getDay() + 6) % 7;
  const dniWMiesiacu = new Date(rok, miesiac + 1, 0).getDate();
  const komorki = [
    ...DNI_TYG_KROTKIE.map((d, i) => h('div', { class: 'kalendarz__dzien-tyg', 'aria-hidden': 'true', title: DNI_TYG[i], text: d })),
    ...Array.from({ length: przesuniecie }, () => h('div', { 'aria-hidden': 'true' })),
  ];
  for (let dzien = 1; dzien <= dniWMiesiacu; dzien++) {
    const data = ymd(new Date(rok, miesiac, dzien));
    const w = wpisPoDacie.get(data);
    const bole = bolePoDacie.get(data) ?? 0;
    const przyszly = data > dzis;
    const opis = [
      wielkaLitera(formatDzien(data)),
      w?.mood ? `nastrój ${w.mood} z 5` : w ? 'wpis bez nastroju' : 'brak wpisu',
      bole ? `${bole} ${bole === 1 ? 'epizod' : bole < 5 ? 'epizody' : 'epizodów'} bólu głowy` : null,
    ].filter(Boolean).join(', ');
    komorki.push(h('button', {
      type: 'button', class: 'kalendarz__dzien', 'aria-label': opis, 'aria-pressed': String(data === wybrany),
      'data-n': w?.mood ? String(w.mood) : null, 'data-dzis': data === dzis ? '1' : null, 'data-przyszly': przyszly ? '1' : null,
      disabled: przyszly,
      on: { click: () => { wybrany = data; render(); } },
    }, h('span', { 'aria-hidden': 'true', text: String(dzien) }),
    bole ? h('span', { class: 'kalendarz__bol', 'aria-hidden': 'true' }, ikona('bol')) : null));
  }
  $('#kalendarz').replaceChildren(...komorki);
  renderDzien(dane);
}

/** @param {Awaited<ReturnType<typeof db.wczytajWszystko>>} dane */
function renderDzien({ wpisy, epizody, przyjecia, leki }) {
  const kontener = $('#kal-dzien');
  const w = wpisy.find((x) => x.entry_date === wybrany);
  const eps = epizody.filter((e) => dzienEpizodu(e) === wybrany).sort((a, b) => (a.started_at < b.started_at ? -1 : 1));
  const prz = przyjecia.filter((p) => ymd(new Date(p.taken_at)) === wybrany).sort((a, b) => (a.taken_at < b.taken_at ? -1 : 1));
  const lekPoId = new Map(leki.map((l) => [l.id, l]));
  const wiersz = (/** @type {string} */ etykieta, /** @type {any} */ wartosc) => (wartosc == null || wartosc === '' ? null : [h('dt', { text: etykieta }), h('dd', { text: String(wartosc) })]);
  const sen = w ? snuZWpisu(w) : null;

  kontener.replaceChildren(h('div', { class: 'dzien-szczegoly' },
    h('h2', { text: wielkaLitera(formatDzien(wybrany)) }),
    w ? h('dl', {},
      wiersz('Sen', sen != null ? `${formatGodziny(sen)}${w.sleep_start ? ` (${hhmm(w.sleep_start)}–${hhmm(w.sleep_end)})` : ''}` : null),
      wiersz('Jakość snu', w.sleep_quality ? `${w.sleep_quality}/5` : null),
      wiersz('Wybudzenia', w.awakenings),
      wiersz('Nastrój', w.mood ? `${w.mood}/5` : null),
      wiersz('Energia', w.energy ? `${w.energy}/5` : null),
      wiersz('Stres', w.stress ? `${w.stress}/5` : null),
      wiersz('Znaczniki', (w.tags ?? []).join(', ')),
      wiersz('Notatka', w.note)) : h('p', { class: 'pusty', text: 'Brak wpisu z tego dnia.' }),
    h('a', { class: 'btn btn-drugorzedny', href: wybrany === ymd() ? '#dzis' : `#dzis?data=${wybrany}`, text: w ? 'Edytuj wpis' : 'Dodaj wpis' }),
    eps.length ? h('h3', { class: 'sekcja', text: 'Dolegliwości' }) : null,
    eps.length ? h('ul', { class: 'lista' }, eps.map((e) => h('li', {},
      h('div', { class: 'lista__tresc' },
        h('p', { class: 'lista__tytul' }, nazwaEpizodu(e), ' ', e.intensity != null ? h('span', { class: 'znacznik znacznik--bol', text: `${e.intensity}/10` }) : null),
        h('p', { class: 'lista__opis', text: e.ended_at ? `${hhmm(e.started_at)}–${hhmm(e.ended_at)}` : `od ${hhmm(e.started_at)}` })),
      h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Edytuj', 'aria-label': `Edytuj: ${nazwaEpizodu(e)} od ${hhmm(e.started_at)}`, on: { click: () => otworzEpizod(e.id) } })))) : null,
    prz.length ? h('h3', { class: 'sekcja', text: 'Przyjęte leki i suplementy' }) : null,
    prz.length ? h('ul', { class: 'lista lista--zwarta' }, prz.map((p) => h('li', { text: `${hhmm(p.taken_at)} ${lekPoId.get(p.medication_id)?.name ?? 'Usunięty lek'}${p.reason ? `, ${p.reason}` : ''}` }))) : null,
  ));
}

