// @ts-check
/**
 * Lokalna baza (IndexedDB). Nazwy tabel i pól jak w schemacie PostgreSQL (sekcja 7),
 * żeby synchronizacja z Supabase była prostym przepisaniem rekordów.
 * Każdy zapis trafia też do kolejki „outbox” (jeden wpis na rekord), którą w etapie 0
 * odczyta moduł synchronizacji. Identyfikatory to UUID z klienta, więc ponowienie nie tworzy duplikatów.
 */
import { uuid } from './utils.js';

const NAZWA_BAZY = 'dziennik-zdrowia';
const WERSJA_BAZY = 1;

export const TABELE = /** @type {const} */ (['daily_entries', 'symptom_episodes', 'medications', 'medication_intakes', 'lab_results', 'documents']);
/** @typedef {typeof TABELE[number]} Tabela */

/** Zdarzenie „zmiana” po każdym zapisie lub usunięciu. */
export const zdarzenia = new EventTarget();

/** @type {Promise<IDBDatabase>|null} */
let polaczenie = null;

export function otworz() {
  polaczenie ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(NAZWA_BAZY, WERSJA_BAZY);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('daily_entries', { keyPath: 'id' }).createIndex('entry_date', 'entry_date', { unique: true });
      db.createObjectStore('symptom_episodes', { keyPath: 'id' }).createIndex('started_at', 'started_at');
      db.createObjectStore('medications', { keyPath: 'id' });
      const mi = db.createObjectStore('medication_intakes', { keyPath: 'id' });
      mi.createIndex('taken_at', 'taken_at');
      mi.createIndex('medication_id', 'medication_id');
      mi.createIndex('episode_id', 'episode_id');
      db.createObjectStore('lab_results', { keyPath: 'id' }).createIndex('test_name', 'test_name');
      db.createObjectStore('documents', { keyPath: 'id' });
      db.createObjectStore('meta', { keyPath: 'klucz' });
      db.createObjectStore('outbox', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Baza jest otwarta w innej karcie w starszej wersji. Zamknij inne karty aplikacji.'));
  });
  return polaczenie;
}

/**
 * @template T
 * @param {string[]} magazyny @param {IDBTransactionMode} tryb
 * @param {(tx: IDBTransaction) => T} fn
 * @returns {Promise<T>}
 */
async function transakcja(magazyny, tryb, fn) {
  const db = await otworz();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(magazyny, tryb);
    /** @type {T} */ let wynik;
    try { wynik = fn(tx); } catch (e) { tx.abort(); reject(e); return; }
    tx.oncomplete = () => resolve(wynik);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transakcja przerwana'));
  });
}

/** @param {IDBRequest} req @returns {Promise<any>} */
const obietnica = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

/** @param {Tabela} tabela @returns {Promise<any[]>} */
export async function wszystkie(tabela) {
  const db = await otworz();
  return obietnica(db.transaction(tabela).objectStore(tabela).getAll());
}

/** @param {Tabela} tabela @param {string} id */
export async function pobierz(tabela, id) {
  const db = await otworz();
  return obietnica(db.transaction(tabela).objectStore(tabela).get(id));
}

/** Wpis dzienny dla daty (unikalny). @param {string} data */
export async function wpisZDnia(data) {
  const db = await otworz();
  return obietnica(db.transaction('daily_entries').objectStore('daily_entries').index('entry_date').get(data));
}

/** @param {IDBTransaction} tx @param {string} tabela @param {string} id @param {'upsert'|'delete'} operacja @param {string} kiedy */
function doKolejki(tx, tabela, id, operacja, kiedy) {
  tx.objectStore('outbox').put({ id: `${tabela}:${id}`, tabela, rekord_id: id, operacja, kiedy });
}

/** @param {string} tabela */
function powiadom(tabela) {
  zdarzenia.dispatchEvent(new CustomEvent('zmiana', { detail: { tabela } }));
}

/**
 * Zapis (wstawienie lub aktualizacja). Uzupełnia id, created_at, updated_at.
 * @param {Tabela} tabela @param {Record<string, any>} rekord
 * @returns {Promise<Record<string, any>>}
 */
export async function zapisz(tabela, rekord) {
  const teraz = new Date().toISOString();
  const r = { ...rekord, id: rekord.id ?? uuid(), created_at: rekord.created_at ?? teraz, updated_at: teraz };
  await transakcja([tabela, 'outbox'], 'readwrite', (tx) => {
    tx.objectStore(tabela).put(r);
    doKolejki(tx, tabela, r.id, 'upsert', teraz);
  });
  powiadom(tabela);
  return r;
}

/**
 * Usunięcie z odwzorowaniem reguł kluczy obcych ze schematu:
 * lek → kasuje jego przyjęcia (on delete cascade), epizod → odpina przyjęcia (on delete set null).
 * @param {Tabela} tabela @param {string} id
 */
export async function usun(tabela, id) {
  const teraz = new Date().toISOString();
  const powiazane = tabela === 'medications' || tabela === 'symptom_episodes'
    ? (await wszystkie('medication_intakes')).filter((p) => (tabela === 'medications' ? p.medication_id : p.episode_id) === id)
    : [];
  await transakcja([tabela, 'medication_intakes', 'outbox'], 'readwrite', (tx) => {
    tx.objectStore(tabela).delete(id);
    doKolejki(tx, tabela, id, 'delete', teraz);
    for (const p of powiazane) {
      if (tabela === 'medications') {
        tx.objectStore('medication_intakes').delete(p.id);
        doKolejki(tx, 'medication_intakes', p.id, 'delete', teraz);
      } else {
        tx.objectStore('medication_intakes').put({ ...p, episode_id: null, updated_at: teraz });
        doKolejki(tx, 'medication_intakes', p.id, 'upsert', teraz);
      }
    }
  });
  powiadom(tabela);
}

/** Wszystkie dane potrzebne widokom. */
export async function wczytajWszystko() {
  const [wpisy, epizody, leki, przyjecia, wyniki] = await Promise.all([
    wszystkie('daily_entries'), wszystkie('symptom_episodes'), wszystkie('medications'),
    wszystkie('medication_intakes'), wszystkie('lab_results'),
  ]);
  return { wpisy, epizody, leki, przyjecia, wyniki };
}

/** @param {string} klucz @param {any} [domyslna] */
export async function meta(klucz, domyslna = null) {
  const db = await otworz();
  const r = await obietnica(db.transaction('meta').objectStore('meta').get(klucz));
  return r ? r.wartosc : domyslna;
}

/** @param {string} klucz @param {any} wartosc */
export async function ustawMeta(klucz, wartosc) {
  await transakcja(['meta'], 'readwrite', (tx) => { tx.objectStore('meta').put({ klucz, wartosc }); });
  powiadom('meta');
}

/** Liczba zmian czekających na synchronizację. */
export async function liczbaOczekujacych() {
  const db = await otworz();
  return obietnica(db.transaction('outbox').objectStore('outbox').count());
}

/**
 * Zastępuje wszystkie dane (import kopii, dane przykładowe). Meta (profil, zgoda) zostaje,
 * chyba że podano nowe wartości.
 * @param {Record<string, any[]>} dane @param {Record<string, any>} [nowaMeta]
 */
export async function zastapWszystko(dane, nowaMeta = {}) {
  const teraz = new Date().toISOString();
  await transakcja([...TABELE, 'outbox', 'meta'], 'readwrite', (tx) => {
    for (const t of TABELE) {
      tx.objectStore(t).clear();
      for (const r of dane[t] ?? []) {
        tx.objectStore(t).put({ ...r, created_at: r.created_at ?? teraz, updated_at: r.updated_at ?? teraz });
        doKolejki(tx, t, r.id, 'upsert', teraz);
      }
    }
    for (const [klucz, wartosc] of Object.entries(nowaMeta)) tx.objectStore('meta').put({ klucz, wartosc });
  });
  powiadom('*');
}

/** Usuwa wszystkie dane z urządzenia, łącznie z profilem i zgodą. */
export async function wyczyscWszystko() {
  await transakcja([...TABELE, 'outbox', 'meta'], 'readwrite', (tx) => {
    for (const t of [...TABELE, 'outbox', 'meta']) tx.objectStore(t).clear();
  });
  powiadom('*');
}

// ---------- Synchronizacja (używane przez js/synchronizacja.js) ----------

/** Wpisy kolejki zmian czekających na wysłanie. @returns {Promise<{id: string, tabela: Tabela, rekord_id: string, operacja: 'upsert'|'delete', kiedy: string}[]>} */
export async function kolejka() {
  const db = await otworz();
  return obietnica(db.transaction('outbox').objectStore('outbox').getAll());
}

/** @param {string} id */
export async function usunZKolejki(id) {
  await transakcja(['outbox'], 'readwrite', (tx) => { tx.objectStore('outbox').delete(id); });
}

export async function wyczyscKolejke() {
  await transakcja(['outbox'], 'readwrite', (tx) => { tx.objectStore('outbox').clear(); });
  powiadom('outbox');
}

/**
 * Zapis rekordów pobranych z serwera — bez dopisywania do kolejki (to już są dane serwera).
 * @param {Tabela} tabela @param {Record<string, any>[]} rekordy @param {string[]} [doUsuniecia]
 */
export async function zapiszZSerwera(tabela, rekordy, doUsuniecia = []) {
  if (!rekordy.length && !doUsuniecia.length) return;
  await transakcja([tabela], 'readwrite', (tx) => {
    const s = tx.objectStore(tabela);
    for (const id of doUsuniecia) s.delete(id);
    for (const r of rekordy) {
      const { user_id, ...bezUzytkownika } = r;
      s.put(bezUzytkownika);
    }
  });
  powiadom(tabela);
}

/**
 * Po udanym wysłaniu: usuwa wpis z kolejki i zapisuje wersję z serwera — ale tylko jeśli w międzyczasie
 * nikt nie zmienił rekordu ponownie (wtedy zostaje w kolejce i pójdzie w następnej synchronizacji).
 * @param {Tabela} tabela @param {string} idKolejki @param {string} kiedy @param {Record<string, any>|null} rekord @param {string|null} [staryId]
 */
export async function zatwierdzWyslanie(tabela, idKolejki, kiedy, rekord, staryId = null) {
  await transakcja([tabela, 'outbox'], 'readwrite', (tx) => {
    const req = tx.objectStore('outbox').get(idKolejki);
    req.onsuccess = () => {
      if (req.result && req.result.kiedy !== kiedy) return;
      tx.objectStore('outbox').delete(idKolejki);
      if (staryId) tx.objectStore(tabela).delete(staryId);
      if (rekord) {
        const { user_id, ...r } = rekord;
        tx.objectStore(tabela).put(r);
      }
    };
  });
}
