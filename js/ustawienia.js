// @ts-check
/** Ekran „Ustawienia”: profil, motyw, znaczniki, eksport/import, dane przykładowe, usunięcie danych. */
import * as db from './db.js';
import { $, h, toast, dwaDotkniecia, wartoscRadia, ustawRadio } from './utils.js';
import { ymd, formatPelny, hhmm } from './obliczenia.js';
import { pobierzTagi, usunTag } from './tagi.js';
import { zbudujEksport, sprawdzImport, doCSV, pobierzPlik, KOLUMNY, TABELE_EKSPORTU } from './eksport.js';
import { generujDaneDemo } from './demo.js';
import { WERSJA_APLIKACJI, DOMYSLNE_TAGI } from './teksty.js';
import { WERSJA_LISTY, ZWERYFIKOWANO } from './flagi.js';

export const tytul = 'Ustawienia';

const strefaUrzadzenia = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function init() {
  const lista = $('#lista-stref');
  const strefy = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['Europe/Warsaw'];
  lista.replaceChildren(...strefy.map((s) => h('option', { value: s })));

  $('#form-profil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const profil = (await db.meta('profil', {})) ?? {};
    const strefa = /** @type {HTMLInputElement} */ ($('#profil-strefa')).value.trim() || 'Europe/Warsaw';
    await db.ustawMeta('profil', {
      ...profil,
      display_name: /** @type {HTMLInputElement} */ ($('#profil-imie')).value.trim() || null,
      timezone: strefa,
    });
    toast('Zapisano profil.');
  });

  for (const r of document.querySelectorAll('input[name="motyw"]')) {
    r.addEventListener('change', async () => {
      const m = wartoscRadia($('#ekran-ustawienia'), 'motyw') ?? 'system';
      document.documentElement.dataset.motyw = m;
      await db.ustawMeta('motyw', m);
    });
  }

  $('#eksport-json').addEventListener('click', eksportujJSON);
  $('#eksport-csv').addEventListener('click', eksportujCSV);
  $('#import-plik').addEventListener('change', wczytajPlik);

  dwaDotkniecia(/** @type {HTMLButtonElement} */ ($('#dane-demo')), async () => {
    const d = generujDaneDemo();
    await db.zastapWszystko(d, { tagi: d.tagi });
    toast('Wczytano dane przykładowe (90 dni).');
    location.hash = '#wykresy';
  }, 'Zastąpić moje dane przykładowymi?');

  dwaDotkniecia(/** @type {HTMLButtonElement} */ ($('#dane-usun')), async () => {
    await db.wyczyscWszystko();
    location.hash = '#dzis';
    location.reload();
  }, 'Usunąć wszystko z tego urządzenia?');
}

export async function render() {
  const profil = (await db.meta('profil', {})) ?? {};
  /** @type {HTMLInputElement} */ ($('#profil-imie')).value = profil.display_name ?? '';
  /** @type {HTMLInputElement} */ ($('#profil-strefa')).value = profil.timezone ?? 'Europe/Warsaw';
  const urz = strefaUrzadzenia();
  $('#profil-strefa-uwaga').textContent = (profil.timezone ?? 'Europe/Warsaw') === urz
    ? ''
    : `To urządzenie używa strefy ${urz}. W tej wersji daty dni liczone są według strefy urządzenia.`;
  ustawRadio($('#ekran-ustawienia'), 'motyw', (await db.meta('motyw', 'system')) ?? 'system');

  const tagi = await pobierzTagi();
  $('#ustawienia-tagi').replaceChildren(...(tagi.length ? tagi.map((t) => h('li', {},
    h('span', { class: 'lista__tresc', text: t }),
    h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Usuń', 'aria-label': `Usuń znacznik ${t}`, on: { click: () => usunTag(t) } }))) : [
    h('li', {}, h('span', { class: 'lista__tresc drobny', text: 'Lista jest pusta.' }),
      h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Przywróć domyślne', on: { click: () => db.ustawMeta('tagi', [...DOMYSLNE_TAGI]) } })),
  ]));

  $('#zastrzezenie-data').textContent = profil.disclaimer_accepted_at
    ? `Potwierdzono ${formatPelny(ymd(new Date(profil.disclaimer_accepted_at)))}, ${hhmm(profil.disclaimer_accepted_at)}.`
    : '';
  $('#wersja').textContent = `Wersja aplikacji ${WERSJA_APLIKACJI}. Lista sytuacji alarmowych ${WERSJA_LISTY}${ZWERYFIKOWANO ? '' : ', wersja robocza przed weryfikacją medyczną'}.`;
}

async function zebrane() {
  const { wpisy, epizody, leki, przyjecia, wyniki } = await db.wczytajWszystko();
  return {
    daily_entries: wpisy, symptom_episodes: epizody, medications: leki,
    medication_intakes: przyjecia, lab_results: wyniki,
  };
}

async function eksportujJSON() {
  const dane = await zebrane();
  const meta = { profil: await db.meta('profil', {}), tagi: await pobierzTagi(), motyw: await db.meta('motyw', 'system') };
  pobierzPlik(`dziennik-zdrowia-${ymd()}.json`, JSON.stringify(zbudujEksport(dane, meta), null, 2), 'application/json');
  $('#dane-stan').textContent = 'Pobrano kopię. Przechowuj plik w bezpiecznym miejscu: zawiera dane o zdrowiu.';
}

async function eksportujCSV() {
  const dane = await zebrane();
  // Osobny plik na tabelę; przeglądarka może zapytać o zgodę na pobranie kilku plików.
  for (const [i, t] of TABELE_EKSPORTU.entries()) {
    setTimeout(() => pobierzPlik(`dziennik-zdrowia-${t}-${ymd()}.csv`, doCSV(/** @type {any} */ (dane)[t], KOLUMNY[t]), 'text/csv;charset=utf-8'), i * 400);
  }
  $('#dane-stan').textContent = `Pobieranie ${TABELE_EKSPORTU.length} plików CSV (separator: średnik).`;
}

/** @param {Event} e */
async function wczytajPlik(e) {
  const input = /** @type {HTMLInputElement} */ (e.target);
  const stan = $('#dane-stan');
  const plik = input.files?.[0];
  if (!plik) return;
  let obj;
  try {
    obj = JSON.parse(await plik.text());
  } catch {
    stan.textContent = 'Nie udało się odczytać pliku. Wybierz plik JSON pobrany przyciskiem „Pobierz kopię”.';
    input.value = '';
    return;
  }
  const wynik = sprawdzImport(obj);
  if ('blad' in wynik) { stan.textContent = wynik.blad; input.value = ''; return; }
  const { dane, meta } = wynik;
  const przycisk = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'btn btn-niebezpieczny', text: 'Zastąp dane na tym urządzeniu' }));
  dwaDotkniecia(przycisk, async () => {
    const nowaMeta = {};
    if (Array.isArray(meta.tagi)) Object.assign(nowaMeta, { tagi: meta.tagi });
    await db.zastapWszystko(dane, nowaMeta);
    stan.textContent = 'Wczytano kopię.';
    input.value = '';
  }, 'Na pewno zastąpić?');
  stan.replaceChildren(
    h('span', { text: `Plik zawiera: ${dane.daily_entries.length} wpisów dziennych, ${dane.symptom_episodes.length} dolegliwości, ${dane.medications.length} leków, ${dane.lab_results.length} wyników badań. ` }),
    przycisk);
}
