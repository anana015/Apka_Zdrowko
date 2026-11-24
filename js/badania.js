// @ts-check
/**
 * Wyniki badań (specyfikacja, sekcja 4.4). Wartości i zakresy referencyjne wpisuje użytkownik
 * z wyniku laboratorium. „Poza zakresem laboratorium” to wyłącznie porównanie liczb.
 * Przed zapisem: walidacja i podgląd (ryzyko błędnie wpisanej wartości).
 */
import * as db from './db.js';
import { $, h, toast, otworzDialog, pokazBlad, dwaDotkniecia } from './utils.js';
import { ymd, formatKrotki, formatPelny, liczbaPL, parsujLiczbe, pozaZakresem, walidujWynik } from './obliczenia.js';
import { wykresBadania } from './wykresy.js';
import { initDokumenty, renderDokumenty, listaDokumentow, nazwaDokumentu, otworzDokument, wyslijPlik, moznaWyslac } from './dokumenty.js';
import { odczytajTekst } from './odczyt.js';
import { rozpoznajWyniki } from './odczyt-parser.js';

export const tytul = 'Badania';

/** Zestawy ułatwiające wpisywanie: nazwy i typowe jednostki, bez wartości normatywnych. */
export const SZABLONY = Object.freeze([
  { id: 'jedno', nazwa: 'Pojedyncze badanie', parametry: [{ nazwa: '', jednostka: '' }] },
  { id: 'morfologia', nazwa: 'Morfologia', parametry: [
    { nazwa: 'Leukocyty (WBC)', jednostka: 'tys./µl' }, { nazwa: 'Erytrocyty (RBC)', jednostka: 'mln/µl' },
    { nazwa: 'Hemoglobina (HGB)', jednostka: 'g/dl' }, { nazwa: 'Hematokryt (HCT)', jednostka: '%' },
    { nazwa: 'MCV', jednostka: 'fl' }, { nazwa: 'Płytki krwi (PLT)', jednostka: 'tys./µl' },
  ] },
  { id: 'lipidogram', nazwa: 'Lipidogram', parametry: [
    { nazwa: 'Cholesterol całkowity', jednostka: 'mg/dl' }, { nazwa: 'Cholesterol HDL', jednostka: 'mg/dl' },
    { nazwa: 'Cholesterol LDL', jednostka: 'mg/dl' }, { nazwa: 'Triglicerydy', jednostka: 'mg/dl' },
  ] },
  { id: 'tsh', nazwa: 'TSH', parametry: [{ nazwa: 'TSH', jednostka: 'µIU/ml' }] },
  { id: 'witd', nazwa: 'Witamina D', parametry: [{ nazwa: 'Witamina D 25(OH)', jednostka: 'ng/ml' }] },
  { id: 'ferrytyna', nazwa: 'Ferrytyna', parametry: [{ nazwa: 'Ferrytyna', jednostka: 'ng/ml' }] },
]);

const OPIS_POZA = { ponizej: 'poniżej zakresu laboratorium', powyzej: 'powyżej zakresu laboratorium' };

/** @type {any|null} */ let edytowany = null;
let licznikWierszy = 0;
let etapPodgladu = false;
/** @type {any[]} */ let doZapisu = [];
let resetUsun = () => {};
/** Plik, z którego odczytano wyniki (do zapisania w Dokumentach). @type {File|null} */
let plikOdczytu = null;
let filtr = '';

const pole = (/** @type {string} */ id) => /** @type {HTMLInputElement} */ ($(id));

export function init() {
  initDokumenty();
  $('#badania-dodaj').addEventListener('click', () => otworzBadanie(null));
  $('#odczyt-plik').addEventListener('change', (e) => {
    const pole = /** @type {HTMLInputElement} */ (e.target);
    const plik = pole.files?.[0];
    pole.value = ''; // ten sam plik można wybrać ponownie
    if (plik) odczytajPlik(plik);
  });
  $('#badania-filtr').addEventListener('change', (e) => { filtr = /** @type {HTMLSelectElement} */ (e.target).value; render(); });
  const szablon = /** @type {HTMLSelectElement} */ ($('#bad-szablon'));
  szablon.replaceChildren(...SZABLONY.map((t) => h('option', { value: t.id, text: t.nazwa })));
  szablon.addEventListener('change', () => zbudujWiersze(szablon.value));
  $('#bad-dodaj-wiersz').addEventListener('click', () => dodajWiersz({ nazwa: '', jednostka: '' }));
  const form = /** @type {HTMLFormElement} */ ($('#form-badanie'));
  form.addEventListener('input', wyjdzZPodgladu);
  form.addEventListener('submit', (e) => { e.preventDefault(); etapPodgladu ? zapisz() : sprawdz(); });
  resetUsun = dwaDotkniecia(/** @type {HTMLButtonElement} */ ($('#bad-usun')), async () => {
    if (!edytowany) return;
    await db.usun('lab_results', edytowany.id);
    /** @type {HTMLDialogElement} */ ($('#dialog-badanie')).close();
    toast('Usunięto wynik.');
  }, 'Na pewno usunąć?');
}

export async function render() {
  renderDokumenty();
  const wyniki = await db.wszystkie('lab_results');
  const nazwy = [...new Set(wyniki.map((w) => w.test_name))].sort((a, b) => a.localeCompare(b, 'pl'));
  if (filtr && !nazwy.includes(filtr)) filtr = '';
  const select = /** @type {HTMLSelectElement} */ ($('#badania-filtr'));
  select.replaceChildren(h('option', { value: '', text: 'Wszystkie badania' }), ...nazwy.map((n) => h('option', { value: n, text: n, selected: n === filtr })));
  select.disabled = !nazwy.length;

  const szczegoly = $('#badania-szczegoly');
  const lista = $('#badania-lista');
  if (!wyniki.length) {
    szczegoly.replaceChildren();
    lista.replaceChildren(h('li', { class: 'pusty' }, 'Nie masz jeszcze wyników. Dodaj pierwszy, na przykład z ostatniej morfologii.'));
    return;
  }

  if (filtr) {
    const jednego = wyniki.filter((w) => w.test_name === filtr).sort((a, b) => (a.taken_on < b.taken_on ? -1 : 1));
    szczegoly.replaceChildren(h('section', { class: 'sekcja', 'aria-labelledby': 'badanie-szczegoly-tytul' },
      h('h2', { id: 'badanie-szczegoly-tytul', text: filtr }),
      h('div', { class: 'wykres' }, wykresBadania(jednego, $('#badania-filtr').clientWidth)),
      h('p', { class: 'drobny', text: 'Jasne pole: zakres podany przez laboratorium. Pusty punkt: wynik poza tym zakresem.' })));
    lista.replaceChildren(...[...jednego].reverse().map((w) => wierszWyniku(w, true)));
    return;
  }

  szczegoly.replaceChildren();
  lista.replaceChildren(...nazwy.map((n) => {
    const ost = wyniki.filter((w) => w.test_name === n).sort((a, b) => (a.taken_on < b.taken_on ? 1 : -1));
    const w = ost[0];
    const poza = pozaZakresem(w.value, w.ref_low, w.ref_high);
    return h('li', {},
      h('div', { class: 'lista__tresc' },
        h('p', { class: 'lista__tytul' }, n, ' ', poza === 'ponizej' || poza === 'powyzej' ? h('span', { class: 'znacznik znacznik--poza', text: OPIS_POZA[poza] }) : null),
        h('p', { class: 'lista__opis', text: `Ostatnio ${liczbaPL(w.value, 3)} ${w.unit ?? ''}, ${formatPelny(w.taken_on)}. Wyników: ${ost.length}.` })),
      h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Pokaż', 'aria-label': `Pokaż wyniki: ${n}`, on: { click: () => { filtr = n; render(); } } }));
  }));
}

/** @param {any} w @param {boolean} edycja */
function wierszWyniku(w, edycja) {
  const poza = pozaZakresem(w.value, w.ref_low, w.ref_high);
  const zakres = w.ref_low != null || w.ref_high != null ? `zakres lab. ${liczbaPL(w.ref_low, 3)}–${liczbaPL(w.ref_high, 3)}` : 'bez zakresu';
  return h('li', {},
    h('div', { class: 'lista__tresc' },
      h('p', { class: 'lista__tytul' }, `${liczbaPL(w.value, 3)} ${w.unit ?? ''}`, ' ',
        poza === 'ponizej' || poza === 'powyzej' ? h('span', { class: 'znacznik znacznik--poza', text: OPIS_POZA[poza] }) : null),
      h('p', { class: 'lista__opis', text: [formatPelny(w.taken_on), zakres, w.lab_name].filter(Boolean).join(', ') })),
    w.document_id ? h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Dokument', 'aria-label': `Otwórz dokument wyniku z ${formatKrotki(w.taken_on)}`, on: { click: () => otworzDokument(w.document_id) } }) : null,
    edycja ? h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly', text: 'Edytuj', 'aria-label': `Edytuj wynik z ${formatKrotki(w.taken_on)}`, on: { click: () => otworzBadanie(w.id) } }) : null);
}

/** @param {string} id */
async function zbudujWiersze(id) {
  const szablon = SZABLONY.find((t) => t.id === id) ?? SZABLONY[0];
  $('#bad-wiersze').replaceChildren();
  for (const p of szablon.parametry) await dodajWiersz(p);
  wyjdzZPodgladu();
}

/**
 * @param {{ nazwa: string, jednostka: string, wartosc?: any, dol?: any, gora?: any, uwaga?: string|null }} p
 */
async function dodajWiersz(p) {
  const nr = ++licznikWierszy;
  const id = (/** @type {string} */ n) => `bad-w${nr}-${n}`;
  const wyniki = await db.wszystkie('lab_results');
  const poprz = wyniki.filter((w) => p.nazwa && w.test_name === p.nazwa).sort((a, b) => (a.taken_on < b.taken_on ? 1 : -1))[0];
  const poleW = (/** @type {string} */ n, /** @type {string} */ etykieta, /** @type {Record<string, any>} */ attr, klasa = '') => h('div', { class: `pole ${klasa}` },
    h('label', { for: id(n), text: etykieta }), h('input', { id: id(n), 'data-pole': n, ...attr }));
  const wiersz = h('div', { class: 'wiersz-badania', 'data-wiersz': String(nr) },
    poleW('nazwa', 'Badanie', { type: 'text', value: p.nazwa, maxlength: 80, list: 'lista-badan', autocomplete: 'off' }, 'wiersz-badania__nazwa'),
    poleW('wartosc', 'Wynik', { type: 'text', inputmode: 'decimal', value: p.wartosc ?? '', autocomplete: 'off' }),
    poleW('jednostka', 'Jednostka', { type: 'text', value: p.jednostka ?? poprz?.unit ?? '', maxlength: 20 }),
    poleW('dol', 'Zakres od', { type: 'text', inputmode: 'decimal', value: p.dol ?? '', placeholder: poprz?.ref_low != null ? `poprz. ${liczbaPL(poprz.ref_low, 3)}` : '' }),
    poleW('gora', 'Zakres do', { type: 'text', inputmode: 'decimal', value: p.gora ?? '', placeholder: poprz?.ref_high != null ? `poprz. ${liczbaPL(poprz.ref_high, 3)}` : '' }),
    p.uwaga ? h('p', { class: 'wiersz-badania__uwaga' }, h('strong', { text: 'Sprawdź: ' }), p.uwaga) : null,
    edytowany ? null : h('button', { type: 'button', class: 'btn btn-drugorzedny btn-maly wiersz-badania__usun', text: 'Usuń parametr', on: { click: () => { wiersz.remove(); wyjdzZPodgladu(); } } }));
  if (p.uwaga) wiersz.classList.add('wiersz-badania--sprawdz');
  $('#bad-wiersze').append(wiersz);
}

/**
 * @typedef {{ plik: File, tekst: string, podglad: string|null, ocr: boolean, wynik: ReturnType<typeof rozpoznajWyniki> }} Odczyt
 * @param {string|null} id @param {Odczyt|null} [odczyt] wyniki odczytane z pliku do sprawdzenia
 */
export async function otworzBadanie(id, odczyt = null) {
  const w = id ? await db.pobierz('lab_results', id) : null;
  edytowany = w;
  plikOdczytu = odczyt?.plik ?? null;
  pokazOdczyt(odczyt);
  resetUsun();
  const form = /** @type {HTMLFormElement} */ ($('#form-badanie'));
  form.reset();
  pokazBlad($('#bad-blad'), '');
  const wszystkie = await db.wszystkie('lab_results');
  let lista = document.getElementById('lista-badan');
  if (!lista) { lista = h('datalist', { id: 'lista-badan' }); form.append(lista); }
  const nazwy = [...new Set([...wszystkie.map((x) => x.test_name), ...SZABLONY.flatMap((t) => t.parametry.map((p) => p.nazwa)).filter(Boolean)])];
  lista.replaceChildren(...nazwy.map((n) => h('option', { value: n })));

  $('#bad-tytul').textContent = w ? `Wynik: ${w.test_name}` : 'Nowy wynik badania';
  $('#bad-szablon-pole').hidden = Boolean(w || odczyt);
  $('#bad-dodaj-wiersz').hidden = Boolean(w);
  $('#bad-usun').hidden = !w;
  pole('#bad-data').value = w?.taken_on ?? (odczyt?.wynik.data && odczyt.wynik.data <= ymd() ? odczyt.wynik.data : ymd());
  pole('#bad-lab').value = w?.lab_name ?? odczyt?.wynik.laboratorium ?? (wszystkie.sort((a, b) => (a.taken_on < b.taken_on ? 1 : -1))[0]?.lab_name ?? '');
  await wypelnijDokumenty(w?.document_id ?? null);
  $('#bad-wiersze').replaceChildren();
  if (w) {
    await dodajWiersz({ nazwa: w.test_name, jednostka: w.unit ?? '', wartosc: liczbaPL(w.value, 6), dol: w.ref_low != null ? liczbaPL(w.ref_low, 6) : '', gora: w.ref_high != null ? liczbaPL(w.ref_high, 6) : '' });
  } else if (odczyt) {
    for (const r of odczyt.wynik.wyniki) {
      const uwagi = [
        r.znana ? null : 'nazwa z dokumentu, aplikacja jej nie zna',
        r.znana && r.nazwaZDokumentu !== r.nazwa ? `w dokumencie „${r.nazwaZDokumentu}”` : null,
        r.dol == null && r.gora == null ? 'brak zakresu' : null,
        r.jednostka ? null : 'brak jednostki',
      ].filter(Boolean);
      const tylkoInformacja = uwagi.length === 1 && uwagi[0]?.startsWith('w dokumencie');
      await dodajWiersz({
        nazwa: r.nazwa, jednostka: r.jednostka ?? '', wartosc: liczbaPL(r.wartosc, 6),
        dol: r.dol != null ? liczbaPL(r.dol, 6) : '', gora: r.gora != null ? liczbaPL(r.gora, 6) : '',
        uwaga: uwagi.length && !tylkoInformacja ? `${uwagi.join(', ')}.` : null,
      });
    }
    if (!odczyt.wynik.wyniki.length) await zbudujWiersze('jedno');
  } else {
    /** @type {HTMLSelectElement} */ ($('#bad-szablon')).value = 'jedno';
    await zbudujWiersze('jedno');
  }
  wyjdzZPodgladu();
  otworzDialog(/** @type {HTMLDialogElement} */ ($('#dialog-badanie')));
}

/**
 * Pole wyboru dokumentu. Bez internetu lista jest niedostępna: pole jest wyłączone,
 * a zapis zostawia dotychczasowe przypięcie.
 * @param {string|null} biezacy
 */
async function wypelnijDokumenty(biezacy) {
  const select = /** @type {HTMLSelectElement} */ ($('#bad-dokument'));
  const dokumenty = await listaDokumentow();
  if (!dokumenty) {
    select.replaceChildren(h('option', { value: biezacy ?? '', text: biezacy ? 'Przypięty dokument (lista wymaga internetu)' : 'Lista dokumentów wymaga internetu i logowania' }));
    select.disabled = true;
    return;
  }
  select.disabled = false;
  select.replaceChildren(
    h('option', { value: '', text: 'Bez dokumentu' }),
    ...dokumenty.map((d) => h('option', { value: d.id, text: nazwaDokumentu(d), selected: d.id === biezacy })),
  );
  if (biezacy && !dokumenty.some((d) => d.id === biezacy)) select.value = ''; // plik usunięto
}

/** Wybrany dokument; gdy lista jest niedostępna — dotychczasowy. */
function wybranyDokument() {
  const select = /** @type {HTMLSelectElement} */ ($('#bad-dokument'));
  if (select.disabled) return edytowany?.document_id ?? null;
  return select.value || null;
}

/** Ramka z informacją o odczycie, podglądem dokumentu i odczytanym tekstem. @param {Odczyt|null} odczyt */
function pokazOdczyt(odczyt) {
  $('#bad-odczyt').hidden = !odczyt;
  if (!odczyt) return;
  const n = odczyt.wynik.wyniki.length;
  $('#bad-odczyt-tytul').textContent = n
    ? `Odczytano ${n} ${n === 1 ? 'wynik' : n < 5 ? 'wyniki' : 'wyników'} z pliku „${odczyt.plik.name}”${odczyt.ocr ? ' (rozpoznawanie tekstu ze zdjęcia, możliwe pomyłki)' : ''}.`
    : `Nie udało się rozpoznać wyników w pliku „${odczyt.plik.name}”. Przepisz je ręcznie; odczytany tekst jest niżej.`;
  const obraz = /** @type {HTMLImageElement} */ ($('#bad-odczyt-obraz'));
  $('#bad-odczyt-podglad').hidden = !odczyt.podglad;
  obraz.src = odczyt.podglad ?? '';
  /** @type {HTMLDetailsElement} */ ($('#bad-odczyt-podglad')).open = Boolean(odczyt.podglad) && window.matchMedia('(min-width: 640px)').matches;
  $('#bad-odczyt-tekst').textContent = odczyt.tekst.trim() || '(brak tekstu)';
  const dolacz = /** @type {HTMLInputElement} */ ($('#bad-odczyt-dolacz'));
  $('#bad-odczyt-dolacz-pole').hidden = !moznaWyslac();
  dolacz.checked = moznaWyslac();
}

/** Odczyt pliku → formularz wyniku do sprawdzenia. @param {File} plik */
async function odczytajPlik(plik) {
  const pudelko = $('#odczyt-postep');
  const opis = $('#odczyt-opis');
  const pasek = /** @type {HTMLProgressElement} */ ($('#odczyt-pasek'));
  const etykieta = /** @type {HTMLElement} */ (document.querySelector('label[for="odczyt-plik"]'));
  pudelko.hidden = false;
  etykieta.setAttribute('aria-disabled', 'true');
  etykieta.style.pointerEvents = 'none';
  /** @type {import("./odczyt.js").Postep} */
  const postep = (tekst, p) => {
    opis.textContent = tekst;
    if (p == null) pasek.removeAttribute('value'); else pasek.value = p;
  };
  try {
    const { tekst, podglad, ocr } = await odczytajTekst(plik, postep);
    postep('Szukam wyników w tekście…');
    const zapisane = await db.wszystkie('lab_results');
    const istniejace = [...new Set(zapisane.map((w) => w.test_name))];
    const jednostki = [...new Set(zapisane.map((w) => w.unit).filter(Boolean))];
    const wynik = rozpoznajWyniki(tekst, istniejace, jednostki);
    pudelko.hidden = true;
    await otworzBadanie(null, { plik, tekst, podglad, ocr, wynik });
  } catch (e) {
    console.warn('Odczyt pliku:', e);
    const msg = /** @type {any} */ (e)?.message ?? String(e);
    postep(/fetch|network|Failed to load|import/i.test(msg)
      ? 'Nie udało się pobrać modułu odczytu. Za pierwszym razem potrzebny jest internet.'
      : `Nie udało się odczytać pliku: ${msg}`, 0);
  } finally {
    etykieta.removeAttribute('aria-disabled');
    etykieta.style.pointerEvents = '';
  }
}

function wyjdzZPodgladu() {
  etapPodgladu = false;
  doZapisu = [];
  $('#bad-podglad').hidden = true;
  $('#bad-zapisz').textContent = 'Sprawdź';
}

async function sprawdz() {
  const blad = $('#bad-blad');
  const data = pole('#bad-data').value;
  if (!data) { pokazBlad(blad, 'Podaj datę pobrania.'); pole('#bad-data').focus(); return; }
  if (data > ymd()) { pokazBlad(blad, 'Data pobrania nie może być w przyszłości.'); pole('#bad-data').focus(); return; }
  const lab = pole('#bad-lab').value.trim() || null;
  const dokument = wybranyDokument();
  const poprzednie = (await db.wszystkie('lab_results')).filter((x) => x.id !== edytowany?.id);
  /** @type {string[]} */ const bledy = [];
  /** @type {string[]} */ const ostrzezenia = [];
  /** @type {any[]} */ const rekordy = [];
  for (const wiersz of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#bad-wiersze [data-wiersz]'))) {
    const v = (/** @type {string} */ n) => /** @type {HTMLInputElement} */ (wiersz.querySelector(`[data-pole="${n}"]`)).value.trim();
    if (!v('nazwa') && !v('wartosc')) continue;
    const r = {
      ...(edytowany ?? {}),
      taken_on: data, lab_name: lab, document_id: dokument,
      test_name: v('nazwa'), value: parsujLiczbe(v('wartosc')), unit: v('jednostka') || null,
      ref_low: parsujLiczbe(v('dol')), ref_high: parsujLiczbe(v('gora')),
    };
    if (v('wartosc') && r.value == null) bledy.push(`${r.test_name || 'Badanie'}: „${v('wartosc')}” nie jest liczbą.`);
    if ((v('dol') && r.ref_low == null) || (v('gora') && r.ref_high == null)) bledy.push(`${r.test_name}: zakres musi być liczbą.`);
    const wal = walidujWynik(r, poprzednie);
    bledy.push(...wal.bledy.filter((b) => !bledy.includes(b)));
    ostrzezenia.push(...wal.ostrzezenia);
    rekordy.push(r);
  }
  if (!rekordy.length) bledy.push('Wpisz co najmniej jeden wynik.');
  if (bledy.length) { pokazBlad(blad, bledy.join(' ')); return; }
  pokazBlad(blad, '');

  doZapisu = rekordy;
  etapPodgladu = true;
  const podglad = $('#bad-podglad');
  podglad.replaceChildren(
    h('p', { class: 'lista__tytul', text: `Sprawdź przed zapisem (${formatPelny(data)}${lab ? `, ${lab}` : ''}):` }),
    h('ul', {}, rekordy.map((r) => {
      const poza = pozaZakresem(r.value, r.ref_low, r.ref_high);
      const zakres = r.ref_low != null || r.ref_high != null ? ` (zakres laboratorium ${liczbaPL(r.ref_low, 3)}–${liczbaPL(r.ref_high, 3)})` : ' (bez zakresu)';
      return h('li', { text: `${r.test_name}: ${liczbaPL(r.value, 3)} ${r.unit ?? ''}${zakres}${poza === 'ponizej' || poza === 'powyzej' ? `, ${OPIS_POZA[poza]}` : ''}` });
    })),
    ...(ostrzezenia.length ? [h('ul', {}, ostrzezenia.map((o) => h('li', { class: 'ostrzezenie', text: o })))] : []),
    dokument ? h('p', { class: 'drobny', text: `Dokument: ${/** @type {HTMLSelectElement} */ ($('#bad-dokument')).selectedOptions[0]?.text ?? 'przypięty'}` }) : null,
  );
  podglad.hidden = false;
  $('#bad-zapisz').textContent = 'Zapisz';
  $('#bad-zapisz').focus();
}

async function zapisz() {
  const przycisk = /** @type {HTMLButtonElement} */ ($('#bad-zapisz'));
  if (plikOdczytu && /** @type {HTMLInputElement} */ ($('#bad-odczyt-dolacz')).checked && moznaWyslac() && !doZapisu.some((r) => r.document_id)) {
    przycisk.disabled = true;
    przycisk.textContent = 'Wysyłam plik…';
    try {
      const nazwy = [...new Set(doZapisu.map((r) => r.test_name))];
      const idDokumentu = await wyslijPlik(plikOdczytu, {
        kind: 'lab', doc_date: doZapisu[0]?.taken_on ?? null,
        note: `${nazwy.slice(0, 3).join(', ')}${nazwy.length > 3 ? ` i ${nazwy.length - 3} innych` : ''}`.slice(0, 200),
      });
      doZapisu = doZapisu.map((r) => ({ ...r, document_id: idDokumentu }));
    } catch (e) {
      toast(`Wyniki zapisuję bez pliku: ${/** @type {any} */ (e)?.message ?? e}`);
    } finally {
      przycisk.disabled = false;
    }
  }
  for (const r of doZapisu) await db.zapisz('lab_results', { document_id: null, note: null, ...r });
  plikOdczytu = null;
  const n = doZapisu.length;
  wyjdzZPodgladu();
  /** @type {HTMLDialogElement} */ ($('#dialog-badanie')).close();
  toast(n === 1 ? 'Zapisano wynik.' : `Zapisano wyniki: ${n}.`);
}
