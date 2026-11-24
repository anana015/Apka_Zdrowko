// @ts-check
/**
 * Punkt wejścia: routing (hash), zastrzeżenie przy pierwszym uruchomieniu,
 * baner czerwonych flag, motyw, odświeżanie widoków po zmianie danych.
 */
import * as db from './db.js';
import { zainicjujOffline } from './offline.js';
import { aktywneFlagi, NUMERY } from './flagi.js';
import { ZASTRZEZENIE } from './teksty.js';
import { $, $$, h, ikona } from './utils.js';
import * as dzis from './wpis.js';
import * as historia from './historia.js';
import * as wykresy from './wykresy.js';
import * as leki from './leki.js';
import * as badania from './badania.js';
import * as ustawienia from './ustawienia.js';
import * as wiedza from './wiedza.js';
import { zainicjujEpizody } from './dolegliwosci.js';
import { skonfigurowano, zainicjujLogowanie, zdarzeniaAuth } from './auth.js';
import { startSynchronizacji, uruchomHarmonogram } from './synchronizacja.js';

/** @type {Record<string, { init?: () => void, render: (p: URLSearchParams) => Promise<void>|void, odswiez?: () => Promise<void>|void, tytul: string }>} */
const EKRANY = { dzis, historia, wykresy, leki, badania, ustawienia, wiedza };

/** @type {string|null} */
let aktywny = null;

function parsujHash() {
  const [nazwa, zapytanie] = location.hash.slice(1).split('?');
  return { nazwa: nazwa in EKRANY ? nazwa : 'dzis', parametry: new URLSearchParams(zapytanie ?? '') };
}

/** @param {boolean} [pierwsze] */
async function przejdz(pierwsze = false) {
  const { nazwa, parametry } = parsujHash();
  const zmianaEkranu = nazwa !== aktywny;
  for (const sekcja of $$('.ekran')) sekcja.hidden = sekcja.dataset.ekran !== nazwa;
  for (const a of $$('.nawigacja a')) {
    if (a.dataset.cel === nazwa) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  aktywny = nazwa;
  document.title = `${EKRANY[nazwa].tytul} · Dziennik zdrowia`;
  await EKRANY[nazwa].render(parametry);
  if (!pierwsze) {
    if (zmianaEkranu) window.scrollTo(0, 0);
    /** @type {HTMLElement} */ ($(`#ekran-${nazwa} h1`)).focus({ preventScroll: !zmianaEkranu });
  }
}

let zaplanowane = false;
function poZmianieDanych() {
  if (zaplanowane) return;
  zaplanowane = true;
  queueMicrotask(async () => {
    zaplanowane = false;
    if (aktywny) {
      const e = EKRANY[aktywny];
      await (e.odswiez ? e.odswiez() : e.render(parsujHash().parametry));
    }
    await odswiezFlagi();
  });
}

let ostatnieFlagi = '';
async function odswiezFlagi() {
  const { wpisy, epizody } = await db.wczytajWszystko();
  const wynik = aktywneFlagi({ wpisy, epizody });
  const klucz = wynik.flagi.map((f) => f.id).join(',');
  if (klucz === ostatnieFlagi) return;
  ostatnieFlagi = klucz;
  const baner = $('#baner-flag');
  if (!wynik.flagi.length) { baner.hidden = true; baner.replaceChildren(); return; }

  const tel = (/** @type {{numer: string}} */ n, /** @type {string} */ etykieta, drugorzedny = false) => h('a', {
    class: `btn ${drugorzedny ? 'btn-drugorzedny' : ''}`, href: `tel:${n.numer.replace(/\s/g, '')}`,
  }, ikona('tel'), etykieta);

  const tylkoLekarz = !wynik.pilne && !wynik.kryzys;
  const tresc = h('div', { class: `baner-flag__tresc${tylkoLekarz ? ' baner-flag__tresc--lekarz' : ''}`, role: 'alert' });
  if (tylkoLekarz) {
    tresc.append(
      h('p', { class: 'baner-flag__tytul' }, ikona('alarm'), h('span', { text: 'Skontaktuj się jeszcze dziś z lekarzem' })),
      h('p', { text: 'W dzień: przychodnia POZ (także teleporada). Wieczorem, w nocy i w święta: nocna i świąteczna opieka zdrowotna. Jeśli objawy się nasilą, dzwoń pod 112.' }),
    );
  }
  if (wynik.pilne) {
    tresc.append(
      h('p', { class: 'baner-flag__tytul' }, ikona('alarm'), h('span', { text: 'Zadzwoń pod 112 albo jedź na SOR' })),
      h('p', { text: 'Nie prowadź samochodu samodzielnie: poproś kogoś o podwiezienie albo wezwij karetkę.' }),
    );
  }
  if (wynik.kryzys) {
    tresc.append(
      h('p', { class: 'baner-flag__tytul' }, ikona('alarm'), h('span', { text: 'Jeśli masz myśli o odebraniu sobie życia, porozmawiaj z kimś teraz' })),
      h('p', { text: 'Rozmowa jest bezpłatna. Możesz zadzwonić także wtedy, gdy nie wiesz, co powiedzieć.' }),
    );
  }
  tresc.append(
    h('ul', {}, wynik.flagi.map((f) => h('li', { text: f.etykieta }))),
    h('div', { class: 'przyciski' },
      tel(NUMERY.alarmowy, 'Zadzwoń pod 112', tylkoLekarz),
      wynik.kryzys ? tel(NUMERY.centrumWsparcia, `Centrum Wsparcia ${NUMERY.centrumWsparcia.numer}`, true) : null,
      wynik.kryzys ? tel(NUMERY.telefonZaufania, `Telefon zaufania ${NUMERY.telefonZaufania.numer}`, true) : null,
    ),
    h('p', { class: 'drobny' }, 'Baner pojawia się na podstawie Twoich wpisów z ostatnich 48 godzin. To pomoc, nie gwarancja: jeśli dzieje się coś niepokojącego, dzwoń niezależnie od tego, co pokazuje aplikacja. ',
      h('a', { href: '#wiedza', text: 'Kiedy szukać pomocy' })),
  );
  baner.replaceChildren(tresc);
  baner.hidden = false;
}

/** @param {string} motyw */
export function zastosujMotyw(motyw) {
  document.documentElement.dataset.motyw = motyw;
}

async function sprawdzZastrzezenie() {
  const profil = (await db.meta('profil', {})) ?? {};
  if (profil.disclaimer_accepted_at) return;
  const dialog = /** @type {HTMLDialogElement} */ ($('#dialog-zastrzezenie'));
  const zgoda = /** @type {HTMLInputElement} */ ($('#dz-zgoda'));
  const przycisk = /** @type {HTMLButtonElement} */ ($('#dz-akceptuj'));
  dialog.addEventListener('cancel', (e) => e.preventDefault()); // Esc nie zamyka — wymagane potwierdzenie
  zgoda.addEventListener('change', () => { przycisk.disabled = !zgoda.checked; });
  $('#form-zastrzezenie').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!zgoda.checked) return;
    const aktualny = (await db.meta('profil', {})) ?? {};
    await db.ustawMeta('profil', { ...aktualny, disclaimer_accepted_at: new Date().toISOString() });
    dialog.close();
    /** @type {HTMLElement} */ ($('#ekran-dzis h1')).focus();
  });
  dialog.showModal();
}

async function start() {
  try {
    await db.otworz();
  } catch (e) {
    $('#tresc').replaceChildren(h('p', { class: 'pusty', text: `Nie udało się otworzyć lokalnej bazy danych: ${/** @type {Error} */ (e).message} Sprawdź, czy przeglądarka nie jest w trybie, który blokuje zapis danych.` }));
    return;
  }
  for (const el of $$('[data-zastrzezenie]')) el.textContent = ZASTRZEZENIE;
  zastosujMotyw((await db.meta('motyw', 'system')) ?? 'system');
  for (const e of Object.values(EKRANY)) e.init?.();
  zainicjujEpizody();
  window.addEventListener('hashchange', () => przejdz());
  db.zdarzenia.addEventListener('zmiana', poZmianieDanych);
  await przejdz(true);
  await odswiezFlagi();
  zainicjujOffline();
  if (skonfigurowano) {
    // Każde logowanie (także po wylogowaniu z powodu nieaktywności) uruchamia synchronizację.
    /** @type {() => void} */ let gotowe = () => {};
    const poPierwszymLogowaniu = new Promise((r) => { gotowe = /** @type {() => void} */ (r); });
    zdarzeniaAuth.addEventListener('zalogowano', async (e) => {
      await startSynchronizacji(/** @type {CustomEvent} */ (e).detail);
      uruchomHarmonogram();
      await przejdz(true); // formularz Dziś mógł dostać wpis z innego urządzenia
      gotowe();
    });
    zainicjujLogowanie();
    await poPierwszymLogowaniu; // zastrzeżenie dopiero po pobraniu profilu z serwera
  }
  await sprawdzZastrzezenie();
}

start();
