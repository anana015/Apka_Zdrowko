// @ts-check
/**
 * Ekran „Dziś”: wpis dzienny (sen, nastrój, energia, stres, znaczniki, notatka),
 * przycisk „Zaczął się ból”, leki na dziś, dolegliwości z danego dnia.
 * Cel: wpis w < 30 s i ≤ 3 dotknięcia (domyślnie wartości z poprzedniego dnia).
 */
import * as db from './db.js';
import { $, $$, h, ikona, toast, ustawRadio, wartoscRadia, dwaDotkniecia } from './utils.js';
import {
  ymd, dodajDni, formatDzien, formatKrotki, zbudujCzasySnu, godzinySnu, formatGodziny, hhmm,
  poprzedniWpis, dawkiNaDzien, dzienEpizodu, nazwaEpizodu, czasNaDate, parsujLiczbe, roznicaDni, parsujSenZeSchowka, parsujNoceZeSchowka,
} from './obliczenia.js';
import { pobierzTagi, dodajTag, budujChipy, zaznaczoneChipy, dolaczChip } from './tagi.js';
import { otworzEpizod, zacznijBol, zakonczBol } from './dolegliwosci.js';
import { otworzPrzyjecie } from './leki.js';

export const tytul = 'Dziś';

let data = ymd();
/** @type {any|null} */ let biezacyWpis = null;
/** Ostatnio zaznaczone radio w każdej skali — pozwala odznaczyć wartość drugim dotknięciem. */
const ostatnieWSkali = new WeakMap();

const wielkaLitera = (/** @type {string} */ t) => t.charAt(0).toUpperCase() + t.slice(1);

/** Buduje skale 1–5 z atrybutów data-* w index.html. */
function zbudujSkale() {
  for (const fs of $$('fieldset[data-skala]')) {
    const nazwa = /** @type {string} */ (fs.dataset.skala);
    const legenda = fs.querySelector('legend')?.textContent ?? nazwa;
    const opcje = h('div', { class: 'skala__opcje' });
    for (let w = 1; w <= 5; w++) {
      const id = `skala-${nazwa}-${w}`;
      const opis = w === 1 ? ` – ${fs.dataset.min}` : w === 5 ? ` – ${fs.dataset.max}` : '';
      opcje.append(
        h('input', { type: 'radio', name: nazwa, id, value: String(w), 'aria-label': `${legenda}: ${w} z 5${opis}` }),
        h('label', { for: id, 'data-w': String(w), 'aria-hidden': 'true', text: String(w) }),
      );
    }
    fs.append(opcje, h('div', { class: 'skala__krance', 'aria-hidden': 'true' },
      h('span', { text: fs.dataset.min ?? '' }), h('span', { text: fs.dataset.max ?? '' })));
    fs.addEventListener('click', (e) => {
      const input = /** @type {HTMLElement} */ (e.target).closest('input');
      if (!input) return;
      if (ostatnieWSkali.get(fs) === input) {
        input.checked = false;
        ostatnieWSkali.set(fs, null);
        oznaczZmiany();
      } else {
        ostatnieWSkali.set(fs, input);
      }
    });
  }
}

function synchronizujSkale() {
  for (const fs of $$('fieldset[data-skala]')) ostatnieWSkali.set(fs, fs.querySelector('input:checked'));
}

function pokazTrybSnu() {
  const tryb = wartoscRadia($('#form-wpis'), 'tryb_snu');
  for (const el of $$('.pola-snu')) el.hidden = el.dataset.tryb !== tryb;
  przeliczSen();
}

function przeliczSen() {
  const z = /** @type {HTMLInputElement} */ ($('#wpis-zasniecie')).value;
  const p = /** @type {HTMLInputElement} */ ($('#wpis-pobudka')).value;
  const wyj = $('#wpis-sen-wynik');
  if (z && p) {
    const c = zbudujCzasySnu(data, z, p);
    wyj.textContent = `${formatGodziny(godzinySnu(c.sleep_start, c.sleep_end))} snu`;
  } else {
    wyj.textContent = '';
  }
}

function oznaczZmiany() {
  $('#wpis-stan').textContent = 'Masz niezapisane zmiany';
}

export function init() {
  zbudujSkale();
  const form = /** @type {HTMLFormElement} */ ($('#form-wpis'));
  for (const r of $$('input[name="tryb_snu"]')) r.addEventListener('change', pokazTrybSnu);
  $('#wpis-zasniecie').addEventListener('input', przeliczSen);
  $('#wpis-pobudka').addEventListener('input', przeliczSen);
  form.addEventListener('input', oznaczZmiany);

  for (const b of $$('[data-licznik]')) {
    b.addEventListener('click', () => {
      const pole = /** @type {HTMLInputElement} */ ($('#wpis-wybudzenia'));
      const obecna = parsujLiczbe(pole.value) ?? 0;
      pole.value = String(Math.max(0, Math.min(30, obecna + Number(b.dataset.licznik))));
      oznaczZmiany();
    });
  }

  const nowyTag = /** @type {HTMLInputElement} */ ($('#wpis-nowy-tag'));
  const dodaj = async () => {
    const t = await dodajTag(nowyTag.value);
    if (!t) return;
    dolaczChip($('#wpis-tagi'), 'tagi', t);
    nowyTag.value = '';
    oznaczZmiany();
  };
  $('#wpis-dodaj-tag').addEventListener('click', dodaj);
  nowyTag.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); dodaj(); } });

  form.addEventListener('submit', (e) => { e.preventDefault(); zapiszWpis(); });

  $('#dzis-poprzedni').addEventListener('click', () => { location.hash = `#dzis?data=${dodajDni(data, -1)}`; });
  $('#dzis-nastepny').addEventListener('click', () => {
    const nast = dodajDni(data, 1);
    location.hash = nast >= ymd() ? '#dzis' : `#dzis?data=${nast}`;
  });
  $('#dzis-dodaj-epizod').addEventListener('click', () => otworzEpizod(null, { data }));
  zainicjujSenZeZdrowia();
  $('#dzis-dorazny').addEventListener('click', () => otworzPrzyjecie({ data }));
}

/** @param {URLSearchParams} parametry */
export async function render(parametry) {
  const dzis = ymd();
  const zParam = parametry.get('data');
  data = zParam && /^\d{4}-\d{2}-\d{2}$/.test(zParam) && zParam <= dzis ? zParam : dzis;

  const roznica = roznicaDni(data, dzis);
  $('#dzis-tytul').textContent = roznica === 0 ? 'Dziś' : roznica === 1 ? 'Wczoraj' : wielkaLitera(formatDzien(data));
  $('#dzis-data').textContent = roznica <= 1 ? wielkaLitera(formatDzien(data)) : 'Uzupełniasz wcześniejszy dzień';
  /** @type {HTMLButtonElement} */ ($('#dzis-nastepny')).disabled = data >= dzis;

  await wypelnijFormularz();
  await odswiez();
}

async function wypelnijFormularz() {
  const form = /** @type {HTMLFormElement} */ ($('#form-wpis'));
  form.reset();
  biezacyWpis = await db.wpisZDnia(data);
  const wszystkie = await db.wszystkie('daily_entries');
  const podpowiedz = $('#wpis-zrodlo');

  /** @type {any} */ let zrodlo = biezacyWpis;
  if (biezacyWpis) {
    podpowiedz.hidden = true;
  } else {
    const poprz = poprzedniWpis(wszystkie, data);
    if (poprz) {
      zrodlo = { ...poprz, tags: [], note: '', awakenings: null };
      podpowiedz.textContent = `Wstawiono wartości z ${formatKrotki(poprz.entry_date)}. Popraw to, co się zmieniło, i zapisz.`;
      podpowiedz.hidden = false;
    } else {
      podpowiedz.textContent = 'Pierwszy wpis. Wypełnij tyle, ile chcesz — każde pole jest opcjonalne.';
      podpowiedz.hidden = false;
    }
  }

  const tryb = zrodlo?.sleep_start ? 'czasy' : zrodlo?.sleep_hours != null ? 'liczba' : 'czasy';
  ustawRadio(form, 'tryb_snu', tryb);
  /** @type {HTMLInputElement} */ ($('#wpis-zasniecie')).value = zrodlo?.sleep_start ? hhmm(zrodlo.sleep_start) : '';
  /** @type {HTMLInputElement} */ ($('#wpis-pobudka')).value = zrodlo?.sleep_end ? hhmm(zrodlo.sleep_end) : '';
  /** @type {HTMLInputElement} */ ($('#wpis-godziny')).value = zrodlo?.sleep_hours != null ? String(zrodlo.sleep_hours) : '';
  for (const pole of ['sleep_quality', 'mood', 'energy', 'stress']) ustawRadio(form, pole, zrodlo?.[pole]);
  synchronizujSkale();
  /** @type {HTMLInputElement} */ ($('#wpis-wybudzenia')).value = zrodlo?.awakenings != null ? String(zrodlo.awakenings) : '';
  /** @type {HTMLTextAreaElement} */ ($('#wpis-notatka')).value = zrodlo?.note ?? '';
  budujChipy($('#wpis-tagi'), 'tagi', await pobierzTagi(), zrodlo?.tags ?? []);
  pokazTrybSnu();

  $('#wpis-stan').textContent = biezacyWpis
    ? `Zapisano lokalnie ${ymd(new Date(biezacyWpis.updated_at)) === ymd() ? `o ${hhmm(biezacyWpis.updated_at)}` : formatKrotki(ymd(new Date(biezacyWpis.updated_at)))}`
    : 'Jeszcze nie zapisano';
}

async function zapiszWpis() {
  const form = /** @type {HTMLFormElement} */ ($('#form-wpis'));
  const stan = $('#wpis-stan');
  const liczba = (/** @type {string} */ n) => { const v = wartoscRadia(form, n); return v == null ? null : Number(v); };

  /** @type {string|null} */ let sleep_start = null;
  /** @type {string|null} */ let sleep_end = null;
  /** @type {number|null} */ let sleep_hours = null;
  if (wartoscRadia(form, 'tryb_snu') === 'czasy') {
    const z = /** @type {HTMLInputElement} */ ($('#wpis-zasniecie')).value;
    const p = /** @type {HTMLInputElement} */ ($('#wpis-pobudka')).value;
    if (z && p) {
      ({ sleep_start, sleep_end } = zbudujCzasySnu(data, z, p));
      sleep_hours = godzinySnu(sleep_start, sleep_end);
    } else if (z || p) {
      stan.textContent = 'Uzupełnij obie godziny snu albo przełącz na liczbę godzin.';
      /** @type {HTMLInputElement} */ ($(z ? '#wpis-pobudka' : '#wpis-zasniecie')).focus();
      return;
    }
  } else {
    const pole = /** @type {HTMLInputElement} */ ($('#wpis-godziny'));
    sleep_hours = parsujLiczbe(pole.value);
    if (sleep_hours != null && (sleep_hours < 0 || sleep_hours > 24)) {
      stan.textContent = 'Liczba godzin snu musi mieścić się między 0 a 24.';
      pole.setAttribute('aria-invalid', 'true');
      pole.focus();
      return;
    }
    pole.removeAttribute('aria-invalid');
    if (sleep_hours != null) sleep_hours = Math.round(sleep_hours * 10) / 10;
  }
  const wybudzenia = parsujLiczbe(/** @type {HTMLInputElement} */ ($('#wpis-wybudzenia')).value);

  // Ten sam dzień mógł zostać zapisany w innej karcie — używamy istniejącego id (unikalna data).
  const istniejacy = biezacyWpis ?? (await db.wpisZDnia(data));
  const rekord = {
    ...(istniejacy ?? {}),
    entry_date: data,
    sleep_start, sleep_end, sleep_hours,
    sleep_quality: liczba('sleep_quality'),
    awakenings: wybudzenia == null ? null : Math.max(0, Math.round(wybudzenia)),
    mood: liczba('mood'),
    energy: liczba('energy'),
    stress: liczba('stress'),
    tags: zaznaczoneChipy($('#wpis-tagi'), 'tagi'),
    note: /** @type {HTMLTextAreaElement} */ ($('#wpis-notatka')).value.trim() || null,
  };
  try {
    biezacyWpis = await db.zapisz('daily_entries', rekord);
  } catch (e) {
    stan.textContent = `Nie udało się zapisać: ${/** @type {Error} */ (e).message}`;
    return;
  }
  $('#wpis-zrodlo').hidden = true;
  stan.textContent = `Zapisano lokalnie o ${hhmm(biezacyWpis.updated_at)}`;
  toast('Wpis zapisany');
}

/** Odświeża listy (bez czyszczenia formularza, w którym ktoś może pisać). */
export async function odswiez() {
  const dane = await db.wczytajWszystko();
  renderBol(dane);
  renderLeki(dane);
  renderEpizody(dane);
}

/** @param {Awaited<ReturnType<typeof db.wczytajWszystko>>} dane */
function renderBol({ epizody }) {
  const strefa = $('#dzis-bol');
  if (data !== ymd()) { strefa.replaceChildren(); strefa.hidden = true; return; }
  strefa.hidden = false;
  const granica = Date.now() - 72 * 3600000;
  const trwa = epizody
    .filter((e) => !e.ended_at && new Date(e.started_at).getTime() >= granica)
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0];
  if (trwa) {
    strefa.replaceChildren(h('div', { class: 'trwa-bol' },
      h('p', { text: `${nazwaEpizodu(trwa)} trwa od ${hhmm(trwa.started_at)}${dzienEpizodu(trwa) !== data ? ` (${formatKrotki(dzienEpizodu(trwa))})` : ''}` }),
      h('div', { class: 'przyciski' },
        h('button', { type: 'button', class: 'btn btn-glowny', text: 'Ból minął', on: { click: () => zakonczBol(trwa.id) } }),
        h('button', { type: 'button', class: 'btn btn-drugorzedny', text: 'Uzupełnij szczegóły', on: { click: () => otworzEpizod(trwa.id) } }),
      )));
  } else {
    strefa.replaceChildren(h('button', { type: 'button', class: 'btn-bol', on: { click: zacznijBol } }, ikona('bol'), 'Zaczął się ból'));
  }
}

/** @param {Awaited<ReturnType<typeof db.wczytajWszystko>>} dane */
function renderLeki({ leki, przyjecia, epizody }) {
  const kontener = $('#dzis-leki');
  const fokus = /** @type {HTMLElement|null} */ (document.activeElement)?.dataset?.klucz;
  const dawki = dawkiNaDzien(leki, data);
  const przyjeciaDnia = przyjecia.filter((p) => ymd(new Date(p.taken_at)) === data);
  const dorazne = przyjeciaDnia.filter((p) => !p.scheduled_time).sort((a, b) => (a.taken_at < b.taken_at ? -1 : 1));
  const lekPoId = new Map(leki.map((l) => [l.id, l]));

  const odhaczone = dawki.filter(({ lek, godzina }) => przyjeciaDnia.some((p) => p.medication_id === lek.id && p.scheduled_time === godzina)).length;
  $('#dzis-leki-postep').textContent = dawki.length ? `${odhaczone} z ${dawki.length}` : '';
  if (!dawki.length && !dorazne.length) {
    kontener.replaceChildren(h('p', { class: 'pusty' },
      leki.length ? 'Brak stałych dawek na ten dzień.' : 'Nie masz jeszcze leków ani suplementów. ',
      leki.length ? null : h('a', { href: '#leki', text: 'Dodaj je w zakładce Leki' })));
    return;
  }

  const elementy = dawki.map(({ lek, godzina }) => {
    const klucz = `${lek.id}@${godzina}`;
    const przyjecie = przyjeciaDnia.find((p) => p.medication_id === lek.id && p.scheduled_time === godzina);
    return h('label', { class: 'lek-dnia' },
      h('input', {
        type: 'checkbox', checked: Boolean(przyjecie), 'data-klucz': klucz,
        on: {
          change: async (/** @type {Event} */ e) => {
            const zaznaczony = /** @type {HTMLInputElement} */ (e.target).checked;
            if (zaznaczony) {
              await db.zapisz('medication_intakes', {
                medication_id: lek.id,
                taken_at: data === ymd() ? new Date().toISOString() : czasNaDate(data, godzina).toISOString(),
                dose_text: lek.dose_text ?? null, reason: null, episode_id: null, scheduled_time: godzina,
              });
            } else if (przyjecie) {
              await db.usun('medication_intakes', przyjecie.id);
            }
          },
        },
      }),
      h('span', { class: 'lek-dnia__godzina', text: godzina }),
      h('span', { class: 'lek-dnia__nazwa', text: `${lek.name}${lek.dose_text ? `, ${lek.dose_text}` : ''}` }));
  });

  const listaDoraznych = dorazne.length ? h('ul', { class: 'lista lista--zwarta' }, dorazne.map((p) => {
    const lek = lekPoId.get(p.medication_id);
    const ep = p.episode_id ? epizody.find((e) => e.id === p.episode_id) : null;
    const usun = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Usuń', 'aria-label': `Usuń przyjęcie ${lek?.name ?? ''} o ${hhmm(p.taken_at)}` }));
    dwaDotkniecia(usun, () => db.usun('medication_intakes', p.id), 'Na pewno?');
    return h('li', {},
      h('div', { class: 'lista__tresc' },
        h('p', { class: 'lista__tytul', text: `${hhmm(p.taken_at)} ${lek?.name ?? 'Usunięty lek'}` }),
        h('p', { class: 'lista__opis', text: [p.dose_text, p.reason, ep ? `przy: ${nazwaEpizodu(ep).toLowerCase()}` : null].filter(Boolean).join(', ') || 'doraźnie' })),
      usun);
  })) : null;

  kontener.replaceChildren(...elementy, ...(listaDoraznych ? [h('h3', { class: 'drobny', text: 'Doraźnie' }), listaDoraznych] : []));
  if (fokus) /** @type {HTMLElement|null} */ (kontener.querySelector(`[data-klucz="${CSS.escape(fokus)}"]`))?.focus();
}

/** @param {Awaited<ReturnType<typeof db.wczytajWszystko>>} dane */
function renderEpizody({ epizody }) {
  const lista = $('#dzis-epizody');
  const dnia = epizody.filter((e) => dzienEpizodu(e) === data).sort((a, b) => (a.started_at < b.started_at ? -1 : 1));
  if (!dnia.length) {
    lista.replaceChildren(h('li', { class: 'pusty' }, 'Brak dolegliwości tego dnia.'));
    return;
  }
  lista.replaceChildren(...dnia.map((e) => h('li', {},
    h('div', { class: 'lista__tresc' },
      h('p', { class: 'lista__tytul' }, nazwaEpizodu(e), ' ',
        e.intensity != null ? h('span', { class: 'znacznik znacznik--bol', text: `${e.intensity}/10` }) : null),
      h('p', { class: 'lista__opis', text: e.ended_at ? `${hhmm(e.started_at)}–${hhmm(e.ended_at)}` : `od ${hhmm(e.started_at)}, trwa` })),
    h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Edytuj', 'aria-label': `Edytuj: ${nazwaEpizodu(e)} od ${hhmm(e.started_at)}`, on: { click: () => otworzEpizod(e.id) } }))));
}

// ---------- Sen z aplikacji Zdrowie (iPhone, przez aplikację Skróty) ----------
const KLUCZ_CZEKAM = 'dziennik:czekamNaSen';
const NAZWA_SKROTU = 'Dziennik sen';

function zainicjujSenZeZdrowia() {
  const naIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!naIOS) return;
  $('#sen-zdrowie').hidden = false;
  const stan = $('#sen-zdrowie-stan');
  const wklej = $('#sen-wklej');
  const czeka = () => { try { return sessionStorage.getItem(KLUCZ_CZEKAM) === '1'; } catch { return false; } };

  $('#sen-pobierz').addEventListener('click', () => {
    try { sessionStorage.setItem(KLUCZ_CZEKAM, '1'); } catch { /* brak */ }
    wklej.hidden = false;
    stan.textContent = 'Po powrocie ze Skrótów dotknij „Wklej sen”.';
    location.href = `shortcuts://run-shortcut?name=${encodeURIComponent(NAZWA_SKROTU)}`;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && czeka()) {
      wklej.hidden = false;
      stan.textContent = 'Dotknij „Wklej sen”, aby wstawić godziny z aplikacji Zdrowie.';
    }
  });

  wklej.addEventListener('click', async () => {
    let tekst = '';
    try {
      tekst = await navigator.clipboard.readText();
    } catch {
      stan.textContent = 'Nie udało się odczytać schowka. Zezwól na wklejenie, gdy iPhone zapyta.';
      return;
    }
    const noce = parsujNoceZeSchowka(tekst).filter((n) => n.dataPobudki <= ymd());
    if (noce.length > 1) {
      try { sessionStorage.removeItem(KLUCZ_CZEKAM); } catch { /* brak */ }
      stan.textContent = await importujNoce(noce);
      return;
    }
    const sen = parsujSenZeSchowka(tekst);
    if (!sen) {
      stan.textContent = 'W schowku nie ma godzin snu. Sprawdź skrót „Dziennik sen” (Ustawienia → Sen z aplikacji Zdrowie).';
      return;
    }
    const form = /** @type {HTMLFormElement} */ ($('#form-wpis'));
    ustawRadio(form, 'tryb_snu', 'czasy');
    /** @type {HTMLInputElement} */ ($('#wpis-zasniecie')).value = sen.zasniecie;
    /** @type {HTMLInputElement} */ ($('#wpis-pobudka')).value = sen.pobudka;
    pokazTrybSnu();
    oznaczZmiany();
    try { sessionStorage.removeItem(KLUCZ_CZEKAM); } catch { /* brak */ }
    const innyDzien = sen.dataPobudki && sen.dataPobudki !== data;
    stan.textContent = `Wstawiono sen ${sen.zasniecie}–${sen.pobudka}${innyDzien ? ` (pobudka ${formatKrotki(sen.dataPobudki)}, a wpis dotyczy innego dnia; sprawdź datę)` : ''}. Zapisz wpis.`;
  });
}

/**
 * Zapis wielu nocy naraz: brakujące dni dostają wpis z samym snem, istniejące — zaktualizowany sen
 * (pozostałe pola wpisu, np. nastrój i notatka, zostają bez zmian).
 * @param {ReturnType<typeof parsujNoceZeSchowka>} noce
 */
async function importujNoce(noce) {
  const wpisy = new Map((await db.wszystkie('daily_entries')).map((w) => [w.entry_date, w]));
  let nowe = 0, zmienione = 0, bezZmian = 0;
  for (const n of noce) {
    const w = wpisy.get(n.dataPobudki);
    if (w && w.sleep_start === n.sleep_start && w.sleep_end === n.sleep_end) { bezZmian++; continue; }
    await db.zapisz('daily_entries', {
      ...(w ?? { entry_date: n.dataPobudki, tags: [], note: null }),
      sleep_start: n.sleep_start, sleep_end: n.sleep_end, sleep_hours: n.godziny,
    });
    if (w) zmienione++; else nowe++;
  }
  await wypelnijFormularz();
  const od = formatKrotki(noce[0].dataPobudki), do_ = formatKrotki(noce[noce.length - 1].dataPobudki);
  return `Wczytano ${noce.length} nocy (${od}–${do_}): nowe wpisy ${nowe}, uzupełnione ${zmienione}, bez zmian ${bezZmian}.`;
}
