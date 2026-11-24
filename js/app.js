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
import { startSynchronizacji, uruchomHarmonogram, synchronizuj } from './synchronizacja.js';

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
const KLUCZ_UKRYTYCH = 'dziennik:ukryteFlagi';
const czytajUkryte = () => { try { return localStorage.getItem(KLUCZ_UKRYTYCH) ?? ''; } catch { return ''; } };
const zapiszUkryte = (/** @type {string} */ k) => { try { localStorage.setItem(KLUCZ_UKRYTYCH, k); } catch { /* tryb prywatny */ } };

/**
 * Podpowiedź na górze ekranu, gdy wpisy z ostatnich 48 h zawierają objawy do skonsultowania.
 * Ton spokojny: informacja, gdzie szukać pomocy, bez straszenia. Można ją ukryć do czasu,
 * aż zmieni się zestaw wykrytych objawów.
 */
async function odswiezFlagi() {
  const { wpisy, epizody } = await db.wczytajWszystko();
  const wynik = aktywneFlagi({ wpisy, epizody });
  const klucz = wynik.flagi.map((f) => f.id).join(',');
  if (klucz === ostatnieFlagi) return;
  ostatnieFlagi = klucz;
  const baner = $('#baner-flag');
  if (!wynik.flagi.length || klucz === czytajUkryte()) { baner.hidden = true; baner.replaceChildren(); return; }

  const tel = (/** @type {{numer: string}} */ n, /** @type {string} */ etykieta, drugorzedny = false) => h('a', {
    class: `btn btn-maly ${drugorzedny ? 'btn-drugorzedny' : ''}`, href: `tel:${n.numer.replace(/\s/g, '')}`,
  }, ikona('tel'), etykieta);

  const tylkoLekarz = !wynik.pilne && !wynik.kryzys;
  const tresc = h('div', { class: `baner-flag__tresc${tylkoLekarz ? ' baner-flag__tresc--lekarz' : ''}`, role: wynik.pilne ? 'alert' : 'status' });
  if (wynik.pilne) {
    tresc.append(
      h('p', { class: 'baner-flag__tytul' }, ikona('alarm'), h('span', { text: 'Te objawy warto pilnie sprawdzić' })),
      h('p', { text: 'Jeśli występują teraz albo się nasilają: 112 lub SOR.' }),
    );
  } else if (tylkoLekarz) {
    tresc.append(
      h('p', { class: 'baner-flag__tytul' }, ikona('alarm'), h('span', { text: 'Warto skonsultować to z lekarzem' })),
      h('p', { text: 'Najlepiej w najbliższym czasie: POZ lub teleporada, a wieczorem i w święta nocna i świąteczna opieka.' }),
    );
  }
  if (wynik.kryzys) {
    tresc.append(
      h('p', { class: 'baner-flag__tytul' }, ikona('alarm'), h('span', { text: 'Jeśli jest Ci bardzo ciężko, porozmawiaj z kimś' })),
      h('p', { text: 'Rozmowa jest bezpłatna i możesz zadzwonić także wtedy, gdy nie wiesz, co powiedzieć.' }),
    );
  }
  const ukryj = h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Ukryj' });
  ukryj.addEventListener('click', () => { zapiszUkryte(klucz); baner.hidden = true; });
  tresc.append(
    h('ul', {}, wynik.flagi.map((f) => h('li', { text: f.etykieta }))),
    h('div', { class: 'przyciski' },
      wynik.pilne ? tel(NUMERY.alarmowy, 'Zadzwoń pod 112') : null,
      wynik.kryzys ? tel(NUMERY.centrumWsparcia, `Centrum Wsparcia ${NUMERY.centrumWsparcia.numer}`, true) : null,
      wynik.kryzys ? tel(NUMERY.telefonZaufania, `Telefon zaufania ${NUMERY.telefonZaufania.numer}`, true) : null,
      h('a', { class: 'btn btn-drugorzedny btn-maly', href: '#wiedza', text: 'Co to może być' }),
      ukryj,
    ),
    h('p', { class: 'drobny', text: 'Na podstawie Twoich wpisów z ostatnich 48 godzin.' }),
  );
  baner.replaceChildren(tresc);
  baner.hidden = false;
}

/** @param {string} motyw */
export function zastosujMotyw(motyw) {
  document.documentElement.dataset.motyw = motyw;
}

/** Zastrzeżenie medyczne i zgoda na przechowywanie danych (sekcje 2 i 14). Wraca, dopóki brakuje którejś. */
async function sprawdzZastrzezenie() {
  const profil = (await db.meta('profil', {})) ?? {};
  if (profil.disclaimer_accepted_at && profil.privacy_accepted_at) return;
  const dialog = /** @type {HTMLDialogElement} */ ($('#dialog-zastrzezenie'));
  const zgody = [/** @type {HTMLInputElement} */ ($('#dz-zgoda')), /** @type {HTMLInputElement} */ ($('#dz-zgoda-dane'))];
  const przycisk = /** @type {HTMLButtonElement} */ ($('#dz-akceptuj'));
  // Kto potwierdził zastrzeżenie przed 0.7.0, widzi je już zaznaczone i dopowiada tylko zgodę na dane.
  zgody[0].checked = Boolean(profil.disclaimer_accepted_at);
  const odswiez = () => { przycisk.disabled = !zgody.every((z) => z.checked); };
  odswiez();
  dialog.addEventListener('cancel', (e) => e.preventDefault()); // Esc nie zamyka — wymagane potwierdzenie
  for (const z of zgody) z.addEventListener('change', odswiez);
  $('#form-zastrzezenie').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!zgody.every((z) => z.checked)) return;
    const aktualny = (await db.meta('profil', {})) ?? {};
    const teraz = new Date().toISOString();
    await db.ustawMeta('profil', {
      ...aktualny,
      disclaimer_accepted_at: aktualny.disclaimer_accepted_at ?? teraz,
      privacy_accepted_at: aktualny.privacy_accepted_at ?? teraz,
    });
    dialog.close();
    if (skonfigurowano) synchronizuj(); // zgoda trafia do profilu na serwerze od razu
    /** @type {HTMLElement} */ ($('#ekran-dzis h1')).focus();
  });
  dialog.showModal();
}

/**
 * GitHub Pages nie pozwala ustawić nagłówka frame-ancestors (a w meta CSP jest ignorowany),
 * więc osadzenie aplikacji w ramce cudzej strony (clickjacking) blokujemy w skrypcie.
 */
function osadzonaWRamce() {
  try { return window.top !== window.self; } catch { return true; }
}

async function start() {
  if (osadzonaWRamce()) {
    document.body.replaceChildren(h('p', { class: 'pusty', text: 'Ze względów bezpieczeństwa Dziennik zdrowia działa tylko otwarty bezpośrednio, nie w ramce innej strony.' }));
    return;
  }
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
