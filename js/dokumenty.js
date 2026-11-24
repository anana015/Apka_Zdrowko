// @ts-check
/**
 * Dokumenty (specyfikacja, sekcje 4.4 i 8): prywatny bucket „dokumenty”, ścieżka {user_id}/{uuid}.{rozszerzenie},
 * otwieranie wyłącznie przez krótkotrwały signed URL (60 s). Pliki wymagają internetu i nie są trzymane offline.
 */
import { $, h, toast, dwaDotkniecia, uuid } from './utils.js';
import { ymd, formatPelny } from './obliczenia.js';
import { klient, biezacyUzytkownik, skonfigurowano } from './auth.js';

const BUCKET = 'dokumenty';
const LIMIT_B = 10 * 1024 * 1024;
const TYPY = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic' };
const RODZAJ = { lab: 'Wynik badania', visit: 'Wizyta, wypis', other: 'Inny' };

/** iPhone czasem nie podaje typu pliku HEIC — rozpoznajemy go po rozszerzeniu. @param {File} f */
function typPliku(f) {
  if (f.type && f.type in TYPY) return f.type;
  if (/\.heic$/i.test(f.name)) return 'image/heic';
  return f.type || '';
}

const dostepne = () => skonfigurowano && klient && biezacyUzytkownik();

export function initDokumenty() {
  /** @type {HTMLInputElement} */ ($('#dok-data')).value = ymd();
  $('#form-dokument').addEventListener('submit', async (e) => {
    e.preventDefault();
    await wyslij();
  });
}

async function wyslij() {
  const stan = $('#dok-stan');
  const pole = /** @type {HTMLInputElement} */ ($('#dok-plik'));
  const plik = pole.files?.[0];
  if (!dostepne()) { stan.textContent = 'Zaloguj się, aby wysyłać pliki.'; return; }
  if (!navigator.onLine) { stan.textContent = 'Brak internetu. Wyślij plik, gdy wróci połączenie.'; return; }
  if (!plik) { stan.textContent = 'Wybierz plik.'; pole.focus(); return; }
  const mime = typPliku(plik);
  if (!(mime in TYPY)) { stan.textContent = 'Dozwolone są tylko pliki PDF, JPG, PNG i HEIC.'; return; }
  if (plik.size > LIMIT_B) { stan.textContent = `Plik ma ${(plik.size / 1048576).toFixed(1).replace('.', ',')} MB, a limit to 10 MB.`; return; }

  const przycisk = /** @type {HTMLButtonElement} */ ($('#dok-wyslij'));
  przycisk.disabled = true;
  stan.textContent = 'Wysyłam…';
  const id = uuid();
  const sciezka = `${biezacyUzytkownik().id}/${id}.${TYPY[/** @type {keyof typeof TYPY} */ (mime)]}`;
  try {
    const { error: e1 } = await klient.storage.from(BUCKET).upload(sciezka, plik, { contentType: mime, upsert: false });
    if (e1) throw e1;
    const { error: e2 } = await klient.from('documents').insert({
      id, storage_path: sciezka, file_name: plik.name.slice(0, 200), mime, size_bytes: plik.size,
      kind: /** @type {HTMLSelectElement} */ ($('#dok-rodzaj')).value,
      doc_date: /** @type {HTMLInputElement} */ ($('#dok-data')).value || null,
      note: /** @type {HTMLInputElement} */ ($('#dok-notatka')).value.trim() || null,
    });
    if (e2) {
      await klient.storage.from(BUCKET).remove([sciezka]); // bez wpisu w tabeli plik byłby osierocony
      throw e2;
    }
    pole.value = '';
    /** @type {HTMLInputElement} */ ($('#dok-notatka')).value = '';
    stan.textContent = '';
    toast('Wysłano plik.');
    await renderDokumenty();
  } catch (e) {
    stan.textContent = `Nie udało się wysłać: ${/** @type {any} */ (e)?.message ?? e}`;
  } finally {
    przycisk.disabled = false;
  }
}

/** Otwiera plik przez link ważny 60 sekund. Okno otwieramy od razu, żeby iPhone go nie zablokował. @param {any} d */
async function otworz(d) {
  const okno = window.open('', '_blank');
  const { data, error } = await klient.storage.from(BUCKET).createSignedUrl(d.storage_path, 60);
  if (error || !data?.signedUrl) {
    okno?.close();
    toast(`Nie udało się otworzyć pliku: ${error?.message ?? 'brak linku'}`);
    return;
  }
  if (okno) okno.location.href = data.signedUrl;
  else location.href = data.signedUrl;
}

/** @param {any} d */
async function usun(d) {
  const { error: e1 } = await klient.storage.from(BUCKET).remove([d.storage_path]);
  if (e1) { toast(`Nie udało się usunąć pliku: ${e1.message}`); return; }
  const { error: e2 } = await klient.from('documents').delete().eq('id', d.id);
  if (e2) { toast(`Nie udało się usunąć wpisu: ${e2.message}`); return; }
  toast('Usunięto plik.');
  await renderDokumenty();
}

export async function renderDokumenty() {
  const lista = $('#dok-lista');
  const formularz = $('#form-dokument');
  if (!dostepne()) {
    formularz.hidden = true;
    lista.replaceChildren(h('li', { class: 'pusty' }, 'Dokumenty są dostępne po zalogowaniu.'));
    return;
  }
  formularz.hidden = false;
  if (!navigator.onLine) {
    lista.replaceChildren(h('li', { class: 'pusty' }, 'Lista dokumentów wymaga internetu.'));
    return;
  }
  const { data, error } = await klient.from('documents').select('*').order('doc_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
  if (error) {
    lista.replaceChildren(h('li', { class: 'pusty' }, `Nie udało się wczytać dokumentów: ${error.message}`));
    return;
  }
  if (!data.length) {
    lista.replaceChildren(h('li', { class: 'pusty' }, 'Nie masz jeszcze dokumentów.'));
    return;
  }
  lista.replaceChildren(...data.map((d) => {
    const przyciskUsun = /** @type {HTMLButtonElement} */ (h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Usuń', 'aria-label': `Usuń plik ${d.file_name}` }));
    dwaDotkniecia(przyciskUsun, () => usun(d), 'Na pewno?');
    return h('li', {},
      h('div', { class: 'lista__tresc' },
        h('p', { class: 'lista__tytul', text: d.note || d.file_name }),
        h('p', { class: 'lista__opis', text: [RODZAJ[/** @type {keyof typeof RODZAJ} */ (d.kind)], d.doc_date ? formatPelny(d.doc_date) : null, `${Math.max(1, Math.round(d.size_bytes / 1024))} KB`].filter(Boolean).join(', ') })),
      h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Otwórz', 'aria-label': `Otwórz plik ${d.file_name}`, on: { click: () => otworz(d) } }),
      przyciskUsun);
  }));
}

/** Usuwa wszystkie pliki użytkownika z magazynu (przy „Usuń moje dane z serwera”). */
export async function usunWszystkiePliki() {
  const u = biezacyUzytkownik();
  if (!u) return;
  for (;;) {
    const { data, error } = await klient.storage.from(BUCKET).list(u.id, { limit: 100 });
    if (error) throw error;
    if (!data.length) return;
    const { error: e2 } = await klient.storage.from(BUCKET).remove(data.map((/** @type {any} */ f) => `${u.id}/${f.name}`));
    if (e2) throw e2;
    if (data.length < 100) return;
  }
}
