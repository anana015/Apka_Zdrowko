// @ts-check
/**
 * Dolegliwości (specyfikacja, sekcja 4.2): epizody bólu głowy i inne.
 * „Zaczął się ból” zapisuje początek jednym dotknięciem; resztę uzupełnia się później.
 */
import * as db from './db.js';
import { $, h, toast, otworzDialog, pokazBlad, ustawRadio, wartoscRadia, dwaDotkniecia, uuid } from './utils.js';
import { doDatetimeLocal, zDatetimeLocal, hhmm, ymd, czasNaDate, nazwaEpizodu, formatKrotki, parsujLiczbe, liczbaPL, czyBol } from './obliczenia.js';
import { FLAGI, sprawdzEpizod, OBSZARY_RODZAJU, NAZWY_OBSZAROW, PROG_GORACZKI } from './flagi.js';
import { TEMAT_RODZAJU } from './wiedza.js';
import { pobierzTagi, dodajTag, budujChipy, zaznaczoneChipy, dolaczChip } from './tagi.js';

const BOLE = ['headache', 'migraine', 'back', 'pelvic', 'herpes', 'other'];
/** Objawy towarzyszące; `rodzaje` = przy jakich rodzajach dolegliwości je pokazać. */
export const OBJAWY = Object.freeze([
  { id: 'nudnosci', etykieta: 'Nudności', rodzaje: BOLE },
  { id: 'swiatlo', etykieta: 'Nadwrażliwość na światło', rodzaje: BOLE },
  { id: 'dzwiek', etykieta: 'Nadwrażliwość na dźwięk', rodzaje: BOLE },
  { id: 'aura', etykieta: 'Aura', rodzaje: BOLE },
  { id: 'zawroty', etykieta: 'Zawroty głowy', rodzaje: BOLE },
  // Infekcja (NHS: common-cold, flu, sore-throat)
  { id: 'goraczka', etykieta: 'Gorączka (38°C lub więcej)', rodzaje: ['infection'] },
  { id: 'katar', etykieta: 'Katar', rodzaje: ['infection'] },
  { id: 'zatkany_nos', etykieta: 'Zatkany nos', rodzaje: ['infection'] },
  { id: 'kichanie', etykieta: 'Kichanie', rodzaje: ['infection'] },
  { id: 'bol_gardla', etykieta: 'Ból gardła', rodzaje: ['infection'] },
  { id: 'chrypka', etykieta: 'Chrypka', rodzaje: ['infection'] },
  { id: 'kaszel', etykieta: 'Kaszel', rodzaje: ['infection'] },
  { id: 'dreszcze', etykieta: 'Dreszcze', rodzaje: ['infection'] },
  { id: 'bole_miesni', etykieta: 'Bóle mięśni', rodzaje: ['infection'] },
  { id: 'zmeczenie', etykieta: 'Zmęczenie, osłabienie', rodzaje: ['infection'] },
  { id: 'bol_glowy', etykieta: 'Ból głowy', rodzaje: ['infection'] },
  { id: 'uszy_zatoki', etykieta: 'Ucisk w uszach lub zatokach', rodzaje: ['infection'] },
  { id: 'wech_smak', etykieta: 'Utrata węchu lub smaku', rodzaje: ['infection'] },
  { id: 'apetyt', etykieta: 'Brak apetytu', rodzaje: ['infection'] },
]);

/** @type {any|null} */ let edytowany = null;
/** Przyjęcia leków dodane w dialogu nowego epizodu — zapisywane razem z nim. */
/** @type {any[]} */ let oczekujace = [];
let nasilenieUstawione = false;
let resetUsun = () => {};

const dialog = () => /** @type {HTMLDialogElement} */ ($('#dialog-epizod'));
const pole = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ ($(id));

/** Szybki start infekcji z ekranu Dziś: od razu formularz z wybranym rodzajem. */
export const zacznijInfekcje = () => otworzEpizod(null, { rodzaj: 'infection' });

export async function zacznijBol() {
  const ep = await db.zapisz('symptom_episodes', {
    kind: 'headache', custom_name: null, started_at: new Date().toISOString(), ended_at: null,
    intensity: null, location: null, features: [], triggers: [], relief: null, note: null,
  });
  toast(`Zapisano początek bólu o ${hhmm(ep.started_at)}.`, { akcja: 'Uzupełnij', poKliknieciu: () => otworzEpizod(ep.id) });
}

/** @param {string} id */
export async function zakonczBol(id) {
  const ep = await db.pobierz('symptom_episodes', id);
  if (!ep) return;
  await db.zapisz('symptom_episodes', { ...ep, ended_at: new Date().toISOString() });
  toast(czyBol(ep) ? 'Zapisano koniec bólu.' : `Zapisano koniec: ${nazwaEpizodu(ep).toLowerCase()}.`, { akcja: 'Uzupełnij', poKliknieciu: () => otworzEpizod(id) });
}

function pokazNasilenie() {
  const wyj = $('#ep-nasilenie-wartosc');
  wyj.textContent = nasilenieUstawione ? pole('#ep-nasilenie').value : '–';
  pole('#ep-nasilenie').setAttribute('aria-valuetext', nasilenieUstawione ? `${pole('#ep-nasilenie').value} z 10` : 'nie podano');
}

const LOKALIZACJE = {
  glowa: ['Czoło', 'Skronie', 'Potylica', 'Jedna strona głowy', 'Cała głowa', 'Za okiem'],
  kregoslup: ['Odcinek szyjny', 'Między łopatkami', 'Odcinek lędźwiowy (dół pleców)', 'Kość krzyżowa', 'Promieniuje do nogi'],
  intymne: ['Podbrzusze', 'Prawa strona podbrzusza', 'Lewa strona podbrzusza', 'Krocze', 'Okolica pochwy lub sromu', 'Jądro'],
  opryszczka: ['Warga górna', 'Warga dolna', 'Kącik ust', 'Okolica nosa', 'Narządy płciowe', 'Pośladki lub uda'],
  infekcja: ['Nos i zatoki', 'Gardło', 'Krtań (chrypka)', 'Oskrzela, kaszel', 'Uszy', 'Całe ciało'],
};

/** Pokazuje pole nazwy, objawy alarmowe i podpowiedzi lokalizacji pasujące do rodzaju dolegliwości. */
function pokazPoleNazwy() {
  const rodzaj = /** @type {keyof typeof OBSZARY_RODZAJU} */ (wartoscRadia($('#form-epizod'), 'kind') ?? 'headache');
  $('#ep-nazwa-pole').hidden = rodzaj !== 'other';
  const obszary = /** @type {readonly string[]} */ (OBSZARY_RODZAJU[rodzaj] ?? []);
  for (const g of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#ep-alarmowe [data-obszar]'))) {
    g.hidden = !obszary.includes(/** @type {string} */ (g.dataset.obszar));
  }
  const temat = TEMAT_RODZAJU[/** @type {keyof typeof TEMAT_RODZAJU} */ (rodzaj)];
  const link = /** @type {HTMLAnchorElement} */ ($('#ep-wiedza-link'));
  link.hidden = !temat;
  link.href = temat ? `#wiedza?temat=${temat}` : '#wiedza';
  // Objawy towarzyszące, temperatura i etykiety zależne od rodzaju.
  for (const c of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#ep-objawy [data-rodzaje]'))) {
    c.hidden = !(c.dataset.rodzaje ?? '').split(' ').includes(rodzaj);
  }
  const infekcja = rodzaj === 'infection';
  $('#ep-temp-pole').hidden = !infekcja;
  $('#ep-ulga').hidden = infekcja || rodzaj === 'herpes';
  $('#ep-nasilenie-etykieta').textContent = infekcja ? 'Jak źle się czujesz (0–10)' : 'Nasilenie (0–10)';
  $('#ep-lokalizacja-etykieta').textContent = infekcja ? 'Co najbardziej dokucza' : rodzaj === 'herpes' ? 'Gdzie' : 'Gdzie boli';
  $('#lista-lokalizacji').replaceChildren(...obszary.flatMap((o) => LOKALIZACJE[/** @type {keyof typeof LOKALIZACJE} */ (o)] ?? []).map((l) => h('option', { value: l })));
}

function pokazKoniec() {
  const trwa = pole('#ep-trwa').checked;
  pole('#ep-koniec').disabled = trwa;
  if (trwa) pole('#ep-koniec').value = '';
}

export function zainicjujEpizody() {
  const form = /** @type {HTMLFormElement} */ ($('#form-epizod'));
  $('#ep-objawy').replaceChildren(...OBJAWY.map((o) => h('label', { class: 'chip', 'data-rodzaje': o.rodzaje.join(' ') },
    h('input', { type: 'checkbox', name: 'objawy', value: o.id }), h('span', { text: o.etykieta }))));
  // Wpisana temperatura od 38°C zaznacza „gorączkę” (próg NHS).
  pole('#ep-temperatura').addEventListener('input', () => {
    const t = parsujLiczbe(pole('#ep-temperatura').value);
    const goraczka = /** @type {HTMLInputElement|null} */ (form.querySelector('input[name="objawy"][value="goraczka"]'));
    if (t != null && t >= PROG_GORACZKI && goraczka) goraczka.checked = true;
  });
  const opcja = (/** @type {typeof FLAGI[number]} */ f) => h('label', { class: 'opcja' },
    h('input', { type: 'checkbox', name: 'alarmowe', value: f.id }), h('span', { text: f.etykieta }));
  $('#ep-alarmowe').replaceChildren(...(/** @type {const} */ (['glowa', 'kregoslup', 'intymne', 'opryszczka', 'infekcja'])).map((obszar) => h('div', { class: 'grupa-alarmowa', 'data-obszar': obszar },
    h('h3', { text: NAZWY_OBSZAROW[obszar] }),
    h('div', { class: 'wybor-pionowy' }, FLAGI.filter((f) => f.wEpizodzie && f.obszar === obszar).map(opcja)))));

  for (const r of form.querySelectorAll('input[name="kind"]')) r.addEventListener('change', pokazPoleNazwy);
  pole('#ep-trwa').addEventListener('change', pokazKoniec);
  pole('#ep-koniec').addEventListener('input', () => { if (pole('#ep-koniec').value) pole('#ep-trwa').checked = false; });
  pole('#ep-nasilenie').addEventListener('input', () => { nasilenieUstawione = true; pokazNasilenie(); });

  const dodajCzynnik = async () => {
    const t = await dodajTag(pole('#ep-nowy-czynnik').value);
    if (!t) return;
    dolaczChip($('#ep-czynniki'), 'czynniki', t);
    pole('#ep-nowy-czynnik').value = '';
  };
  $('#ep-dodaj-czynnik').addEventListener('click', dodajCzynnik);
  pole('#ep-nowy-czynnik').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); dodajCzynnik(); } });

  $('#ep-lek-dodaj').addEventListener('click', () => {
    const wybor = /** @type {HTMLSelectElement} */ ($('#ep-lek-wybor'));
    const czas = zDatetimeLocal(pole('#ep-lek-czas').value);
    if (!wybor.value || !czas) { pokazBlad($('#ep-blad'), 'Wybierz lek i godzinę przyjęcia.'); return; }
    pokazBlad($('#ep-blad'), '');
    oczekujace.push({ id: uuid(), medication_id: wybor.value, taken_at: czas, dose_text: null, reason: 'dolegliwość', scheduled_time: null });
    renderLekiEpizodu();
  });

  form.addEventListener('submit', (e) => { e.preventDefault(); zapisz(); });
  resetUsun = dwaDotkniecia(/** @type {HTMLButtonElement} */ ($('#ep-usun')), async () => {
    if (!edytowany || edytowany.nowy) return;
    await db.usun('symptom_episodes', edytowany.id);
    dialog().close();
    toast('Usunięto dolegliwość.');
  }, 'Na pewno usunąć?');
}

/**
 * Otwiera dialog nowego lub istniejącego epizodu.
 * @param {string|null} id @param {{ data?: string, rodzaj?: string }} [o]
 */
export async function otworzEpizod(id, { data, rodzaj } = {}) {
  const ep = id ? await db.pobierz('symptom_episodes', id) : null;
  const dzis = ymd();
  edytowany = ep ?? { id: uuid(), nowy: true };
  oczekujace = [];
  resetUsun();
  const form = /** @type {HTMLFormElement} */ ($('#form-epizod'));
  form.reset();
  pokazBlad($('#ep-blad'), '');
  $('#ep-tytul').textContent = ep ? `${nazwaEpizodu(ep)}, ${formatKrotki(ymd(new Date(ep.started_at)))}` : rodzaj === 'infection' ? 'Przeziębienie, grypa, ból gardła' : 'Nowa dolegliwość';
  $('#ep-usun').hidden = !ep;

  ustawRadio(form, 'kind', ep?.kind ?? rodzaj ?? 'headache');
  pole('#ep-temperatura').value = ep?.temperature != null ? liczbaPL(ep.temperature, 1) : '';
  pole('#ep-nazwa').value = ep?.custom_name ?? '';
  const domyslnyStart = !data || data === dzis ? new Date() : czasNaDate(data, '12:00');
  pole('#ep-poczatek').value = doDatetimeLocal(ep?.started_at ?? domyslnyStart);
  pole('#ep-koniec').value = ep?.ended_at ? doDatetimeLocal(ep.ended_at) : '';
  pole('#ep-trwa').checked = Boolean(ep && !ep.ended_at);
  nasilenieUstawione = ep?.intensity != null;
  pole('#ep-nasilenie').value = String(ep?.intensity ?? 5);
  pole('#ep-lokalizacja').value = ep?.location ?? '';
  for (const c of /** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('input[name="objawy"], input[name="alarmowe"]'))) {
    c.checked = (ep?.features ?? []).includes(c.value);
  }
  /** @type {HTMLDetailsElement} */ ($('#ep-alarmowe-blok')).open = Boolean(form.querySelector('input[name="alarmowe"]:checked'));
  budujChipy($('#ep-czynniki'), 'czynniki', await pobierzTagi(), ep?.triggers ?? []);
  ustawRadio(form, 'relief', ep?.relief ?? '');
  /** @type {HTMLTextAreaElement} */ ($('#ep-notatka')).value = ep?.note ?? '';

  const leki = (await db.wszystkie('medications')).filter((l) => l.active !== false)
    .sort((a, b) => Number(b.schedule?.type === 'as_needed') - Number(a.schedule?.type === 'as_needed') || a.name.localeCompare(b.name, 'pl'));
  const wybor = /** @type {HTMLSelectElement} */ ($('#ep-lek-wybor'));
  wybor.replaceChildren(
    h('option', { value: '', text: leki.length ? 'Wybierz lek' : 'Najpierw dodaj lek w zakładce Leki' }),
    ...leki.map((l) => h('option', { value: l.id, text: `${l.name}${l.dose_text ? ` (${l.dose_text})` : ''}` })));
  /** @type {HTMLButtonElement} */ ($('#ep-lek-dodaj')).disabled = !leki.length;
  pole('#ep-lek-czas').value = doDatetimeLocal(new Date());

  pokazPoleNazwy();
  pokazKoniec();
  pokazNasilenie();
  await renderLekiEpizodu();
  otworzDialog(dialog());
}

async function renderLekiEpizodu() {
  const lista = $('#ep-leki');
  const [przyjecia, leki] = await Promise.all([db.wszystkie('medication_intakes'), db.wszystkie('medications')]);
  const lekPoId = new Map(leki.map((l) => [l.id, l]));
  const zapisane = edytowany?.nowy ? [] : przyjecia.filter((p) => p.episode_id === edytowany?.id);
  const wszystkie = [...zapisane.map((p) => ({ ...p, zapisane: true })), ...oczekujace];
  if (!wszystkie.length) {
    lista.replaceChildren(h('li', { class: 'drobny', text: 'Brak powiązanych leków.' }));
    return;
  }
  lista.replaceChildren(...wszystkie.map((p) => h('li', {},
    h('span', { class: 'lista__tresc', text: `${hhmm(p.taken_at)} ${lekPoId.get(p.medication_id)?.name ?? 'Usunięty lek'}` }),
    h('button', {
      type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Usuń',
      on: {
        click: async () => {
          if (p.zapisane) await db.usun('medication_intakes', p.id);
          else oczekujace = oczekujace.filter((x) => x.id !== p.id);
          renderLekiEpizodu();
        },
      },
    }))));
}

async function zapisz() {
  const form = /** @type {HTMLFormElement} */ ($('#form-epizod'));
  const blad = $('#ep-blad');
  const kind = /** @type {import('./obliczenia.js').Epizod['kind']} */ (wartoscRadia(form, 'kind') ?? 'headache');
  const tekstTemp = pole('#ep-temperatura').value.trim();
  const temperatura = kind === 'infection' && tekstTemp ? parsujLiczbe(tekstTemp) : null;
  if (tekstTemp && kind === 'infection' && (temperatura == null || temperatura < 34 || temperatura > 43)) {
    pokazBlad(blad, 'Temperatura powinna być liczbą od 34 do 43 °C, np. 38,2.'); pole('#ep-temperatura').focus(); return;
  }
  const nazwa = pole('#ep-nazwa').value.trim();
  if (kind === 'other' && !nazwa) { pokazBlad(blad, 'Podaj nazwę dolegliwości.'); pole('#ep-nazwa').focus(); return; }
  const start = zDatetimeLocal(pole('#ep-poczatek').value);
  if (!start) { pokazBlad(blad, 'Podaj początek dolegliwości.'); pole('#ep-poczatek').focus(); return; }
  const trwa = pole('#ep-trwa').checked;
  const koniec = trwa ? null : zDatetimeLocal(pole('#ep-koniec').value);
  if (koniec && koniec < start) { pokazBlad(blad, 'Koniec nie może być wcześniejszy niż początek.'); pole('#ep-koniec').focus(); return; }
  pokazBlad(blad, '');

  const { nowy, ...bazowy } = edytowany ?? {};
  const rekord = {
    ...bazowy,
    kind,
    custom_name: kind === 'other' ? nazwa : null,
    started_at: start,
    ended_at: koniec,
    intensity: nasilenieUstawione ? Number(pole('#ep-nasilenie').value) : null,
    location: pole('#ep-lokalizacja').value.trim() || null,
    // Kolumna temperature (migracja 0007): wysyłana tylko, gdy jest wartość albo trzeba ją wyczyścić.
    ...(temperatura != null || bazowy.temperature != null ? { temperature: temperatura } : {}),
    relief: kind === 'infection' || kind === 'herpes' ? null : wartoscRadia(form, 'relief') || null,
    // Tylko objawy i objawy alarmowe widoczne dla wybranego rodzaju dolegliwości.
    features: [...[.../** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('#ep-objawy label:not([hidden]) input:checked'))].map((c) => c.value), ...[.../** @type {NodeListOf<HTMLInputElement>} */ (form.querySelectorAll('#ep-alarmowe [data-obszar]:not([hidden]) input:checked'))].map((c) => c.value)],
    triggers: zaznaczoneChipy($('#ep-czynniki'), 'czynniki'),
    note: /** @type {HTMLTextAreaElement} */ ($('#ep-notatka')).value.trim() || null,
  };
  const zapisany = await db.zapisz('symptom_episodes', rekord);
  for (const p of oczekujace) {
    await db.zapisz('medication_intakes', { ...p, episode_id: zapisany.id });
  }
  oczekujace = [];
  dialog().close();
  if (sprawdzEpizod(/** @type {any} */ (zapisany)).length) {
    window.scrollTo({ top: 0 });
    toast('Zapisano. Na górze ekranu jest podpowiedź, gdzie szukać pomocy.');
  } else {
    toast('Zapisano dolegliwość.');
  }
}
