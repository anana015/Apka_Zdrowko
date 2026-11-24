// @ts-check
/**
 * Pomocnicze funkcje DOM. Tekst zawsze trafia do textContent — nigdy innerHTML (ochrona przed XSS).
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** @param {Element} el @param {Record<string, any>|null|undefined} atrybuty */
function ustawAtrybuty(el, atrybuty) {
  for (const [k, v] of Object.entries(atrybuty ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'on') {
      for (const [zdarzenie, fn] of Object.entries(v)) el.addEventListener(zdarzenie, fn);
    } else if (k === 'dataset') {
      Object.assign(/** @type {HTMLElement} */ (el).dataset, v);
    } else if (k === 'text') {
      el.textContent = String(v);
    } else if (k === 'value' || k === 'checked' || k === 'selected') {
      /** @type {any} */ (el)[k] = v;
    } else {
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
}

/** @param {Node} el @param {any[]} dzieci */
function dolacz(el, dzieci) {
  for (const d of dzieci.flat(Infinity)) {
    if (d === null || d === undefined || d === false) continue;
    el.appendChild(d instanceof Node ? d : document.createTextNode(String(d)));
  }
}

/**
 * Tworzy element HTML.
 * @param {string} tag @param {Record<string, any>} [atrybuty] @param {...any} dzieci
 * @returns {HTMLElement}
 */
export function h(tag, atrybuty = {}, ...dzieci) {
  const el = document.createElement(tag);
  ustawAtrybuty(el, atrybuty);
  dolacz(el, dzieci);
  return el;
}

/**
 * Tworzy element SVG.
 * @param {string} tag @param {Record<string, any>} [atrybuty] @param {...any} dzieci
 * @returns {SVGElement}
 */
export function s(tag, atrybuty = {}, ...dzieci) {
  const el = /** @type {SVGElement} */ (document.createElementNS(SVG_NS, tag));
  ustawAtrybuty(el, atrybuty);
  dolacz(el, dzieci);
  return el;
}

/** Ikona ze sprite'a w index.html. @param {string} nazwa */
export const ikona = (nazwa) => s('svg', { class: 'ikona', 'aria-hidden': 'true', focusable: 'false' }, s('use', { href: `#i-${nazwa}` }));

/**
 * @template {Element} [T=HTMLElement]
 * @param {string} sel @param {ParentNode} [kontekst] @returns {T}
 */
export function $(sel, kontekst = document) {
  const el = kontekst.querySelector(sel);
  if (!el) throw new Error(`Brak elementu: ${sel}`);
  return /** @type {T} */ (el);
}

/** @param {string} sel @param {ParentNode} [kontekst] @returns {HTMLElement[]} */
export const $$ = (sel, kontekst = document) => /** @type {HTMLElement[]} */ ([...kontekst.querySelectorAll(sel)]);

export function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Krótki komunikat na dole ekranu, z opcjonalną akcją.
 * @param {string} tekst @param {{ akcja?: string, poKliknieciu?: () => void, czas?: number }} [o]
 */
export function toast(tekst, { akcja, poKliknieciu, czas = 5000 } = {}) {
  const kontener = $('#toasty');
  const el = h('div', { class: 'toast' }, h('p', { text: tekst }));
  if (akcja && poKliknieciu) {
    el.append(h('button', {
      type: 'button', class: 'btn btn-maly', text: akcja,
      on: { click: () => { el.remove(); poKliknieciu(); } },
    }));
  }
  // Jeden komunikat naraz: nowy zastępuje poprzedni, żeby nie zasłaniały formularza i paska zapisu.
  kontener.replaceChildren(el);
  setTimeout(() => el.remove(), akcja ? czas * 1.6 : czas);
}

/**
 * Przycisk wymagający drugiego dotknięcia (zamiast okien confirm(), które blokują aplikację).
 * @param {HTMLButtonElement} przycisk @param {() => void|Promise<void>} akcja @param {string} [pytanie]
 */
export function dwaDotkniecia(przycisk, akcja, pytanie = 'Dotknij ponownie, aby potwierdzić') {
  const pierwotny = przycisk.textContent ?? '';
  /** @type {ReturnType<typeof setTimeout>|undefined} */ let zegar;
  const reset = () => { przycisk.textContent = pierwotny; delete przycisk.dataset.potwierdz; };
  przycisk.addEventListener('click', async () => {
    if (przycisk.dataset.potwierdz === '1') {
      clearTimeout(zegar);
      reset();
      await akcja();
      return;
    }
    przycisk.dataset.potwierdz = '1';
    przycisk.textContent = pytanie;
    zegar = setTimeout(reset, 4000);
  });
  return reset;
}

/**
 * Otwiera <dialog> jako modal, obsługuje przyciski [data-zamknij].
 * @param {HTMLDialogElement} dialog
 */
export function otworzDialog(dialog) {
  if (!dialog.dataset.zainicjowany) {
    dialog.dataset.zainicjowany = '1';
    dialog.addEventListener('click', (e) => {
      const cel = /** @type {HTMLElement} */ (e.target);
      if (cel.closest('[data-zamknij]')) dialog.close();
    });
  }
  dialog.showModal();
  const pierwsze = /** @type {HTMLElement|null} */ (dialog.querySelector('input:not([type=hidden]):not([disabled]), select, textarea'));
  pierwsze?.focus({ preventScroll: true });
}

/** @param {HTMLElement} el @param {string} tekst */
export function pokazBlad(el, tekst) {
  el.textContent = tekst;
  el.hidden = !tekst;
}

/** Odczyt zaznaczonego radia. @param {HTMLFormElement|HTMLElement} kontener @param {string} nazwa */
export function wartoscRadia(kontener, nazwa) {
  const el = /** @type {HTMLInputElement|null} */ (kontener.querySelector(`input[name="${nazwa}"]:checked`));
  return el ? el.value : null;
}

/** @param {HTMLFormElement|HTMLElement} kontener @param {string} nazwa @param {string|number|null|undefined} wartosc */
export function ustawRadio(kontener, nazwa, wartosc) {
  for (const el of /** @type {NodeListOf<HTMLInputElement>} */ (kontener.querySelectorAll(`input[name="${nazwa}"]`))) {
    el.checked = wartosc != null && el.value === String(wartosc);
  }
}
