// @ts-check
/**
 * Leki i suplementy (specyfikacja, sekcja 4.3): lista, harmonogram, rejestr przyjęć,
 * przyjęcia doraźne. Bez bazy leków i interakcji — dawkę wpisuje użytkownik.
 */
import * as db from './db.js';
import { $, h, toast, otworzDialog, pokazBlad, ustawRadio, wartoscRadia, dwaDotkniecia } from './utils.js';
import {
  ymd, dodajDni, formatDzien, formatKrotki, hhmm, opisHarmonogramu, doDatetimeLocal, zDatetimeLocal,
  czasNaDate, dzienEpizodu, nazwaEpizodu,
} from './obliczenia.js';

export const tytul = 'Leki';

/** @type {any|null} */ let edytowany = null;
let resetUsun = () => {};
const pole = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ ($(id));
const wielkaLitera = (/** @type {string} */ t) => t.charAt(0).toUpperCase() + t.slice(1);

export function init() {
  $('#leki-dodaj').addEventListener('click', () => otworzLek(null));
  $('#leki-dorazny').addEventListener('click', () => otworzPrzyjecie({ data: ymd() }));
  const form = /** @type {HTMLFormElement} */ ($('#form-lek'));
  for (const r of form.querySelectorAll('input[name="lek_harmonogram"]')) r.addEventListener('change', pokazGodziny);
  $('#lek-dodaj-godzine').addEventListener('click', () => dodajGodzine(''));
  form.addEventListener('submit', (e) => { e.preventDefault(); zapiszLek(); });
  resetUsun = dwaDotkniecia(/** @type {HTMLButtonElement} */ ($('#lek-usun')), async () => {
    if (!edytowany?.id) return;
    await db.usun('medications', edytowany.id);
    /** @type {HTMLDialogElement} */ ($('#dialog-lek')).close();
    toast('Usunięto lek razem z jego rejestrem przyjęć.');
  }, 'Usunąć też rejestr przyjęć?');
  $('#form-przyjecie').addEventListener('submit', (e) => { e.preventDefault(); zapiszPrzyjecie(); });
}

export async function render() {
  const { leki, przyjecia, epizody } = await db.wczytajWszystko();
  renderLista(leki);
  renderRejestr(leki, przyjecia, epizody);
}

/** @param {any[]} leki */
function renderLista(leki) {
  const lista = $('#leki-lista');
  if (!leki.length) {
    lista.replaceChildren(h('li', { class: 'pusty' }, 'Nie masz jeszcze żadnych leków ani suplementów. Dodaj pierwszy, aby odhaczać go na ekranie Dziś.'));
    return;
  }
  const posortowane = [...leki].sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || a.name.localeCompare(b.name, 'pl'));
  lista.replaceChildren(...posortowane.map((l) => {
    const daty = [l.start_date ? `od ${formatKrotki(l.start_date)}` : null, l.end_date ? `do ${formatKrotki(l.end_date)}` : null].filter(Boolean).join(' ');
    return h('li', {},
      h('div', { class: 'lista__tresc' },
        h('p', { class: 'lista__tytul' }, l.name, ' ',
          h('span', { class: 'znacznik', text: l.kind === 'supplement' ? 'suplement' : 'lek' }),
          l.active === false ? h('span', { class: 'znacznik', text: 'nieprzyjmowany' }) : null),
        h('p', { class: 'lista__opis', text: [l.dose_text, opisHarmonogramu(l.schedule), daty].filter(Boolean).join(', ') })),
      h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Edytuj', 'aria-label': `Edytuj: ${l.name}`, on: { click: () => otworzLek(l.id) } }));
  }));
}

/** Rejestr pokazuje najpierw ostatnie dni; starsze po dotknięciu przycisku (długa lista na telefonie). */
const DNI_NA_START = 5;
let pokazWszystkieDni = false;

/** @param {any[]} leki @param {any[]} przyjecia @param {any[]} epizody */
function renderRejestr(leki, przyjecia, epizody) {
  const kontener = $('#leki-rejestr');
  const od = dodajDni(ymd(), -29);
  const lekPoId = new Map(leki.map((l) => [l.id, l]));
  const epPoId = new Map(epizody.map((e) => [e.id, e]));
  const ostatnie = przyjecia.filter((p) => ymd(new Date(p.taken_at)) >= od).sort((a, b) => (a.taken_at < b.taken_at ? 1 : -1));
  if (!ostatnie.length) {
    kontener.replaceChildren(h('p', { class: 'pusty', text: 'Brak przyjęć w ostatnich 30 dniach. Stałe dawki odhaczysz na ekranie Dziś.' }));
    return;
  }
  /** @type {Map<string, any[]>} */
  const poDniu = new Map();
  for (const p of ostatnie) {
    const d = ymd(new Date(p.taken_at));
    if (!poDniu.has(d)) poDniu.set(d, []);
    poDniu.get(d)?.push(p);
  }
  const dni = [...poDniu];
  const widoczne = pokazWszystkieDni ? dni : dni.slice(0, DNI_NA_START);
  const wiecej = dni.length > widoczne.length
    ? h('button', { type: 'button', class: 'btn btn-drugorzedny', text: `Pokaż starsze dni (${dni.length - widoczne.length})`, on: { click: () => { pokazWszystkieDni = true; renderRejestr(leki, przyjecia, epizody); } } })
    : null;
  kontener.replaceChildren(...widoczne.map(([d, lista]) => h('div', { class: 'sekcja' },
    h('h3', { text: wielkaLitera(formatDzien(d)) }),
    h('ul', { class: 'lista lista--zwarta' }, lista.map((p) => {
      const lek = lekPoId.get(p.medication_id);
      const ep = p.episode_id ? epPoId.get(p.episode_id) : null;
      const usun = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Usuń', 'aria-label': `Usuń przyjęcie: ${lek?.name ?? ''}, ${hhmm(p.taken_at)}` }));
      dwaDotkniecia(usun, () => db.usun('medication_intakes', p.id), 'Na pewno?');
      return h('li', {},
        h('div', { class: 'lista__tresc' },
          h('p', { class: 'lista__tytul', text: `${hhmm(p.taken_at)} ${lek?.name ?? 'Usunięty lek'}` }),
          h('p', { class: 'lista__opis', text: [p.dose_text, p.scheduled_time ? `dawka z ${p.scheduled_time}` : 'doraźnie', p.reason, ep ? `przy: ${nazwaEpizodu(ep).toLowerCase()}` : null].filter(Boolean).join(', ') })),
        usun);
    })))), ...(wiecej ? [wiecej] : []));
}

function pokazGodziny() {
  $('#lek-godziny-pole').hidden = wartoscRadia($('#form-lek'), 'lek_harmonogram') !== 'daily';
}

/** @param {string} wartosc */
function dodajGodzine(wartosc) {
  const lista = $('#lek-godziny');
  const nr = lista.children.length + 1;
  const id = `lek-godzina-${Date.now()}-${nr}`;
  const li = h('li', {},
    h('label', { for: id, class: 'sr-only', text: `Godzina ${nr}` }),
    h('input', { type: 'time', id, value: wartosc, 'data-godzina': '1', required: true }),
    h('button', { type: 'button', class: 'przycisk-ikona', 'aria-label': `Usuń godzinę ${nr}`, on: { click: () => li.remove() } },
      h('span', { 'aria-hidden': 'true', text: '×' })));
  lista.append(li);
  if (!wartosc) /** @type {HTMLInputElement} */ (li.querySelector('input')).focus();
}

/** @param {string|null} id */
export async function otworzLek(id) {
  const lek = id ? await db.pobierz('medications', id) : null;
  edytowany = lek;
  resetUsun();
  const form = /** @type {HTMLFormElement} */ ($('#form-lek'));
  form.reset();
  pokazBlad($('#lek-blad'), '');
  $('#lek-tytul').textContent = lek ? lek.name : 'Nowy lek lub suplement';
  $('#lek-usun').hidden = !lek;
  pole('#lek-nazwa').value = lek?.name ?? '';
  ustawRadio(form, 'lek_kind', lek?.kind ?? 'medication');
  pole('#lek-dawka').value = lek?.dose_text ?? '';
  ustawRadio(form, 'lek_harmonogram', lek?.schedule?.type ?? 'daily');
  $('#lek-godziny').replaceChildren();
  const godziny = lek?.schedule?.type === 'daily' ? lek.schedule.times : lek ? [] : ['08:00'];
  for (const g of godziny) dodajGodzine(g);
  pole('#lek-od').value = lek?.start_date ?? ymd();
  pole('#lek-do').value = lek?.end_date ?? '';
  /** @type {HTMLTextAreaElement} */ ($('#lek-notatka')).value = lek?.note ?? '';
  pole('#lek-aktywny').checked = lek?.active !== false;
  pokazGodziny();
  otworzDialog(/** @type {HTMLDialogElement} */ ($('#dialog-lek')));
}

async function zapiszLek() {
  const form = /** @type {HTMLFormElement} */ ($('#form-lek'));
  const blad = $('#lek-blad');
  const nazwa = pole('#lek-nazwa').value.trim();
  if (!nazwa) { pokazBlad(blad, 'Podaj nazwę.'); pole('#lek-nazwa').focus(); return; }
  const typ = wartoscRadia(form, 'lek_harmonogram');
  const godziny = [...new Set([.../** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('input[data-godzina]'))].map((i) => i.value).filter(Boolean))].sort();
  if (typ === 'daily' && !godziny.length) { pokazBlad(blad, 'Dodaj co najmniej jedną godzinę albo wybierz „Doraźnie”.'); return; }
  const od = pole('#lek-od').value || null;
  const do_ = pole('#lek-do').value || null;
  if (od && do_ && do_ < od) { pokazBlad(blad, 'Data końca nie może być wcześniejsza niż data początku.'); pole('#lek-do').focus(); return; }
  pokazBlad(blad, '');
  await db.zapisz('medications', {
    ...(edytowany ?? {}),
    name: nazwa,
    kind: wartoscRadia(form, 'lek_kind') ?? 'medication',
    dose_text: pole('#lek-dawka').value.trim() || null,
    schedule: typ === 'daily' ? { type: 'daily', times: godziny } : { type: 'as_needed' },
    start_date: od,
    end_date: do_,
    active: pole('#lek-aktywny').checked,
    note: /** @type {HTMLTextAreaElement} */ ($('#lek-notatka')).value.trim() || null,
  });
  /** @type {HTMLDialogElement} */ ($('#dialog-lek')).close();
  toast(`Zapisano: ${nazwa}`);
}

/**
 * Dialog przyjęcia doraźnego.
 * @param {{ data?: string, episodeId?: string|null }} [o]
 */
export async function otworzPrzyjecie({ data = ymd(), episodeId = null } = {}) {
  const { leki, epizody } = await db.wczytajWszystko();
  const aktywne = leki.filter((l) => l.active !== false)
    .sort((a, b) => Number(b.schedule?.type === 'as_needed') - Number(a.schedule?.type === 'as_needed') || a.name.localeCompare(b.name, 'pl'));
  const form = /** @type {HTMLFormElement} */ ($('#form-przyjecie'));
  form.reset();
  pokazBlad($('#prz-blad'), '');
  const wybor = /** @type {HTMLSelectElement} */ ($('#prz-lek'));
  wybor.replaceChildren(
    h('option', { value: '', text: aktywne.length ? 'Wybierz' : 'Najpierw dodaj lek w zakładce Leki' }),
    ...aktywne.map((l) => h('option', { value: l.id, text: `${l.name}${l.schedule?.type === 'as_needed' ? '' : ' (stały)'}` })));
  pole('#prz-czas').value = doDatetimeLocal(data === ymd() ? new Date() : czasNaDate(data, '12:00'));
  const dnia = epizody.filter((e) => dzienEpizodu(e) === data);
  const ep = /** @type {HTMLSelectElement} */ ($('#prz-epizod'));
  ep.replaceChildren(
    h('option', { value: '', text: 'Bez powiązania' }),
    ...dnia.map((e) => h('option', { value: e.id, text: `${nazwaEpizodu(e)} od ${hhmm(e.started_at)}`, selected: e.id === episodeId })));
  otworzDialog(/** @type {HTMLDialogElement} */ ($('#dialog-przyjecie')));
}

async function zapiszPrzyjecie() {
  const blad = $('#prz-blad');
  const lekId = /** @type {HTMLSelectElement} */ ($('#prz-lek')).value;
  const kiedy = zDatetimeLocal(pole('#prz-czas').value);
  if (!lekId) { pokazBlad(blad, 'Wybierz lek lub suplement.'); return; }
  if (!kiedy) { pokazBlad(blad, 'Podaj, kiedy go przyjęto.'); return; }
  const lek = await db.pobierz('medications', lekId);
  await db.zapisz('medication_intakes', {
    medication_id: lekId,
    taken_at: kiedy,
    dose_text: pole('#prz-dawka').value.trim() || lek?.dose_text || null,
    reason: pole('#prz-powod').value.trim() || null,
    episode_id: /** @type {HTMLSelectElement} */ ($('#prz-epizod')).value || null,
    scheduled_time: null,
  });
  /** @type {HTMLDialogElement} */ ($('#dialog-przyjecie')).close();
  toast(`Zapisano przyjęcie: ${lek?.name ?? ''}`);
}
