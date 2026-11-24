// @ts-check
/**
 * Eksport i import danych (specyfikacja, sekcja 4.9).
 * Funkcje formatujące są czyste i testowane; pobieranie pliku dotyka DOM.
 */

export const FORMAT = 'dziennik-zdrowia';
export const WERSJA_FORMATU = 1;

/** Kolumny jak w schemacie PostgreSQL (sekcja 7), bez user_id. */
export const KOLUMNY = Object.freeze({
  daily_entries: ['id', 'entry_date', 'sleep_start', 'sleep_end', 'sleep_hours', 'sleep_quality', 'awakenings', 'mood', 'energy', 'stress', 'tags', 'note', 'created_at', 'updated_at'],
  symptom_episodes: ['id', 'kind', 'custom_name', 'started_at', 'ended_at', 'intensity', 'location', 'features', 'triggers', 'relief', 'note', 'created_at', 'updated_at'],
  medications: ['id', 'name', 'kind', 'dose_text', 'schedule', 'start_date', 'end_date', 'active', 'note', 'created_at', 'updated_at'],
  medication_intakes: ['id', 'medication_id', 'taken_at', 'scheduled_time', 'dose_text', 'reason', 'episode_id', 'created_at', 'updated_at'],
  lab_results: ['id', 'taken_on', 'test_name', 'value', 'unit', 'ref_low', 'ref_high', 'lab_name', 'document_id', 'note', 'created_at', 'updated_at'],
});

/** @typedef {keyof typeof KOLUMNY} Tabela */
export const TABELE_EKSPORTU = /** @type {Tabela[]} */ (Object.keys(KOLUMNY));

/**
 * @param {Record<string, any[]>} dane @param {Record<string, any>} meta @param {Date} [kiedy]
 */
export function zbudujEksport(dane, meta, kiedy = new Date()) {
  /** @type {Record<string, any[]>} */
  const tabele = {};
  for (const t of TABELE_EKSPORTU) tabele[t] = dane[t] ?? [];
  return { format: FORMAT, wersja: WERSJA_FORMATU, eksportowano: kiedy.toISOString(), dane: tabele, meta };
}

/**
 * Sprawdza plik importu. Zwraca dane albo czytelny błąd.
 * @param {unknown} obj
 * @returns {{ ok: true, dane: Record<string, any[]>, meta: Record<string, any> } | { ok: false, blad: string }}
 */
export function sprawdzImport(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, blad: 'Plik nie zawiera danych JSON.' };
  const o = /** @type {any} */ (obj);
  if (o.format !== FORMAT) return { ok: false, blad: 'To nie jest kopia z Dziennika zdrowia.' };
  if (typeof o.wersja !== 'number' || o.wersja > WERSJA_FORMATU) {
    return { ok: false, blad: 'Kopia pochodzi z nowszej wersji aplikacji. Zaktualizuj aplikację.' };
  }
  if (!o.dane || typeof o.dane !== 'object') return { ok: false, blad: 'W pliku brakuje sekcji z danymi.' };
  /** @type {Record<string, any[]>} */
  const dane = {};
  for (const t of TABELE_EKSPORTU) {
    const wiersze = o.dane[t] ?? [];
    if (!Array.isArray(wiersze)) return { ok: false, blad: `Tabela ${t} ma niepoprawny format.` };
    for (const w of wiersze) {
      if (!w || typeof w !== 'object' || typeof w.id !== 'string') {
        return { ok: false, blad: `W tabeli ${t} jest wiersz bez identyfikatora.` };
      }
    }
    dane[t] = wiersze;
  }
  return { ok: true, dane, meta: o.meta && typeof o.meta === 'object' ? o.meta : {} };
}

/** Pole CSV (separator „;”, przecinek dziesiętny — wygodne w polskim Excelu). @param {unknown} v */
export function poleCSV(v) {
  if (v == null) return '';
  let t;
  if (typeof v === 'number') t = String(v).replace('.', ',');
  else if (typeof v === 'boolean') t = v ? 'tak' : 'nie';
  else if (Array.isArray(v)) t = v.join(', ');
  else if (typeof v === 'object') t = JSON.stringify(v);
  else t = String(v);
  // Ochrona przed wstrzyknięciem formuł przy otwieraniu w arkuszu.
  if (typeof v === 'string' && /^[=+@\t\r]/.test(t)) t = `'${t}`;
  if (/[";\n\r]/.test(t) || /^\s|\s$/.test(t)) t = `"${t.replace(/"/g, '""')}"`;
  return t;
}

/** @param {Record<string, any>[]} wiersze @param {readonly string[]} kolumny */
export function doCSV(wiersze, kolumny) {
  const linie = [kolumny.join(';'), ...wiersze.map((w) => kolumny.map((k) => poleCSV(w[k])).join(';'))];
  return `\uFEFF${linie.join('\r\n')}\r\n`;
}

/** Pobranie pliku w przeglądarce. @param {string} nazwa @param {string} tresc @param {string} mime */
export function pobierzPlik(nazwa, tresc, mime) {
  const url = URL.createObjectURL(new Blob([tresc], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nazwa;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
