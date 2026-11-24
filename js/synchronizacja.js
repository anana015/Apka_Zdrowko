// @ts-check
/**
 * Synchronizacja z Supabase (specyfikacja, sekcja 11).
 * 1. Wysyłka kolejki zmian (outbox) — identyfikatory z klienta, więc ponowienie nie tworzy duplikatów.
 * 2. Pobranie danych z serwera (zmiany i usunięcia z innych urządzeń).
 * Konflikty: wygrywa ostatni zapis (rekord czekający w kolejce na tym urządzeniu nadpisuje serwer).
 */
import * as db from './db.js';
import { klient, biezacyUzytkownik } from './auth.js';
import { KOLUMNY } from './eksport.js';
import { h, toast } from './utils.js';

/** Kolejność wysyłki zgodna z kluczami obcymi (najpierw leki i epizody, potem przyjęcia). */
const TABELE = /** @type {const} */ (['medications', 'symptom_episodes', 'daily_entries', 'medication_intakes', 'lab_results']);
const ROZMIAR_STRONY = 1000; // limit wierszy na zapytanie (max_rows w Data API)

/** @type {{ stan: 'nieaktywna'|'trwa'|'ok'|'blad'|'offline', czas?: string, blad?: string }} */
let stan = { stan: 'nieaktywna' };
export const zdarzeniaSync = new EventTarget();
export const stanSynchronizacji = () => stan;
/** @param {typeof stan} s */
function ustawStan(s) { stan = s; zdarzeniaSync.dispatchEvent(new Event('stan')); }

let trwa = false;
let ponownie = false;

/** Wybiera tylko kolumny istniejące w bazie; updated_at ustawia serwer. @param {string} tabela @param {Record<string, any>} r */
function doWyslania(tabela, r) {
  /** @type {Record<string, any>} */ const wynik = {};
  for (const k of /** @type {Record<string, readonly string[]>} */ (KOLUMNY)[tabela]) {
    if (k !== 'updated_at' && r[k] !== undefined) wynik[k] = r[k];
  }
  return wynik;
}

async function wyslij() {
  const kolejka = await db.kolejka();
  const nr = (/** @type {string} */ t) => TABELE.indexOf(/** @type {any} */ (t));
  const zapisy = kolejka.filter((w) => w.operacja === 'upsert' && nr(w.tabela) >= 0).sort((a, b) => nr(a.tabela) - nr(b.tabela));
  const usuniecia = kolejka.filter((w) => w.operacja === 'delete' && nr(w.tabela) >= 0).sort((a, b) => nr(b.tabela) - nr(a.tabela));

  for (const w of zapisy) {
    const lokalny = await db.pobierz(w.tabela, w.rekord_id);
    if (!lokalny) { await db.zatwierdzWyslanie(w.tabela, w.id, w.kiedy, null); continue; }
    const dane = doWyslania(w.tabela, lokalny);
    let { data, error } = await klient.from(w.tabela).upsert(dane, { onConflict: 'id' }).select().single();
    let staryId = null;
    if (error?.code === '23505' && w.tabela === 'daily_entries') {
      // Ten sam dzień wpisano na dwóch urządzeniach: aktualizujemy wpis z serwera danymi z tego urządzenia.
      const { data: istniejacy, error: e2 } = await klient.from('daily_entries').select('id').eq('entry_date', dane.entry_date).single();
      if (e2) throw e2;
      staryId = dane.id;
      ({ data, error } = await klient.from('daily_entries').upsert({ ...dane, id: istniejacy.id }, { onConflict: 'id' }).select().single());
    }
    if (error) throw error;
    await db.zatwierdzWyslanie(w.tabela, w.id, w.kiedy, data, staryId);
  }
  for (const w of usuniecia) {
    const { error } = await klient.from(w.tabela).delete().eq('id', w.rekord_id);
    if (error) throw error;
    await db.zatwierdzWyslanie(w.tabela, w.id, w.kiedy, null);
  }
}

/** @param {string} tabela */
async function pobierzWszystko(tabela) {
  /** @type {any[]} */ const wiersze = [];
  for (let od = 0; ; od += ROZMIAR_STRONY) {
    const { data, error } = await klient.from(tabela).select('*').order('id').range(od, od + ROZMIAR_STRONY - 1);
    if (error) throw error;
    wiersze.push(...data);
    if (data.length < ROZMIAR_STRONY) return wiersze;
  }
}

async function pobierz() {
  const oczekujace = new Set((await db.kolejka()).map((w) => `${w.tabela}:${w.rekord_id}`));
  for (const tabela of TABELE) {
    const serwer = await pobierzWszystko(tabela);
    const lokalne = await db.wszystkie(tabela);
    const lokalnePoId = new Map(lokalne.map((l) => [l.id, l]));
    const czeka = (/** @type {string} */ id) => oczekujace.has(`${tabela}:${id}`);
    const idSerwera = new Set(serwer.map((r) => r.id));
    const doZapisu = serwer.filter((r) => !czeka(r.id) && lokalnePoId.get(r.id)?.updated_at !== r.updated_at);
    const doUsuniecia = lokalne.filter((l) => !idSerwera.has(l.id) && !czeka(l.id)).map((l) => l.id);
    if (tabela === 'daily_entries') {
      // Unikalna data: wpis z innym id na ten sam dzień ustępuje wersji z serwera.
      for (const r of doZapisu) {
        for (const l of lokalne) if (l.entry_date === r.entry_date && l.id !== r.id && !czeka(l.id)) doUsuniecia.push(l.id);
      }
    }
    await db.zapiszZSerwera(tabela, doZapisu, [...new Set(doUsuniecia)]);
  }
}

/** Profil: imię, strefa czasowa i data potwierdzenia zastrzeżenia (specyfikacja, sekcja 14). */
async function synchronizujProfil() {
  const u = biezacyUzytkownik();
  if (!u) return;
  const { data: serwer, error } = await klient.from('profiles').select('*').maybeSingle();
  if (error) throw error;
  const lokalny = (await db.meta('profil', {})) ?? {};
  const polaczony = {
    display_name: lokalny.display_name ?? serwer?.display_name ?? null,
    timezone: lokalny.timezone ?? serwer?.timezone ?? 'Europe/Warsaw',
    disclaimer_accepted_at: lokalny.disclaimer_accepted_at ?? serwer?.disclaimer_accepted_at ?? null,
  };
  const rozne = (/** @type {any} */ a) => !a || Object.entries(polaczony).some(([k, v]) => (a[k] ?? null) !== v);
  if (rozne(serwer)) {
    const { error: e2 } = await klient.from('profiles').upsert({ id: u.id, ...polaczony }, { onConflict: 'id' });
    if (e2) throw e2;
  }
  if (rozne(lokalny)) await db.ustawMeta('profil', { ...lokalny, ...polaczony });
}

/** Pełna synchronizacja. Bezpieczna przy wielokrotnym wywołaniu. */
export async function synchronizuj() {
  if (!klient || !biezacyUzytkownik()) return;
  if (!navigator.onLine) { ustawStan({ stan: 'offline' }); return; }
  if (trwa) { ponownie = true; return; }
  trwa = true;
  ustawStan({ ...stan, stan: 'trwa' });
  try {
    await wyslij();
    await pobierz();
    await synchronizujProfil();
    ustawStan({ stan: 'ok', czas: new Date().toISOString() });
  } catch (e) {
    console.warn('Synchronizacja:', e);
    ustawStan({ stan: 'blad', blad: /** @type {any} */ (e)?.message ?? String(e) });
  } finally {
    trwa = false;
    if (ponownie) { ponownie = false; setTimeout(synchronizuj, 500); }
  }
}

/** Pyta, co zrobić z danymi zapisanymi na urządzeniu przed zalogowaniem. @param {number} ile */
function zapytajODaneLokalne(ile) {
  return new Promise((resolve) => {
    const dialog = /** @type {HTMLDialogElement} */ (h('dialog', { class: 'dialog', 'aria-labelledby': 'dl-tytul' },
      h('div', { class: 'dialog__tresc' },
        h('h2', { id: 'dl-tytul', text: 'Dane zapisane na tym urządzeniu' }),
        h('p', { text: `Na tym urządzeniu jest ${ile} zapisanych zmian sprzed zalogowania (np. dane przykładowe). Co z nimi zrobić?` }),
        h('div', { class: 'dialog__stopka' },
          h('button', { type: 'button', class: 'btn btn-niebezpieczny', text: 'Usuń z urządzenia', on: { click: () => { dialog.close(); resolve('usun'); } } }),
          h('button', { type: 'button', class: 'btn btn-glowny', text: 'Wyślij na moje konto', on: { click: () => { dialog.close(); resolve('wyslij'); } } })))));
    dialog.addEventListener('cancel', (e) => e.preventDefault());
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  });
}

/**
 * Po zalogowaniu: przypisuje dane urządzenia do konta, uruchamia synchronizację i harmonogram.
 * @param {any} uzytkownik
 */
export async function startSynchronizacji(uzytkownik) {
  const wlasciciel = await db.meta('wlasciciel', null);
  if (wlasciciel && wlasciciel !== uzytkownik.id) {
    // Inna osoba na tym urządzeniu: dane poprzedniego konta nie mogą trafić do nowego.
    await db.zastapWszystko({}, { tagi: null, profil: {} });
    await db.wyczyscKolejke();
  } else if (!wlasciciel) {
    const ile = await db.liczbaOczekujacych();
    if (ile > 0 && (await zapytajODaneLokalne(ile)) === 'usun') {
      await db.zastapWszystko({});
      await db.wyczyscKolejke();
    }
  }
  await db.ustawMeta('wlasciciel', uzytkownik.id);
  await synchronizuj();
  if (stan.stan === 'ok') toast('Dane zsynchronizowane.');
}

let harmonogram = false;
/** Automatyczna synchronizacja: po zmianach, po powrocie sieci i co 5 minut, gdy aplikacja jest otwarta. */
export function uruchomHarmonogram() {
  if (harmonogram) return;
  harmonogram = true;
  /** @type {ReturnType<typeof setTimeout>|undefined} */ let zegar;
  db.zdarzenia.addEventListener('zmiana', async () => {
    if ((await db.liczbaOczekujacych()) === 0) return;
    clearTimeout(zegar);
    zegar = setTimeout(synchronizuj, 2000);
  });
  window.addEventListener('online', () => synchronizuj());
  window.addEventListener('offline', () => ustawStan({ stan: 'offline' }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') synchronizuj(); });
  setInterval(() => { if (document.visibilityState === 'visible') synchronizuj(); }, 5 * 60000);
}

/**
 * Usuwa wszystkie dane użytkownika z serwera (prawo do usunięcia, sekcja 4.9). Samo konto usuwa administrator.
 */
export async function usunDaneZSerwera() {
  const u = biezacyUzytkownik();
  if (!u) throw new Error('Najpierw się zaloguj.');
  for (const t of [...TABELE].reverse()) {
    const { error } = await klient.from(t).delete().eq('user_id', u.id);
    if (error) throw error;
  }
  await db.zastapWszystko({});
  await db.wyczyscKolejke();
}
