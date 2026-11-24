// @ts-check
/** Znaczniki dnia i czynniki epizodów: wspólna lista, dopisywana w locie. */
import * as db from './db.js';
import { DOMYSLNE_TAGI, NOWE_TAGI_0_9 } from './teksty.js';
import { normalizujTag } from './obliczenia.js';
import { h } from './utils.js';

/** @returns {Promise<string[]>} */
export async function pobierzTagi() {
  const zapisane = await db.meta('tagi', null);
  if (!zapisane) return [...DOMYSLNE_TAGI];
  if (await db.meta('tagi-0.9', null)) return zapisane;
  const uzupelnione = [...zapisane, ...NOWE_TAGI_0_9.filter((t) => !zapisane.includes(t))];
  await db.ustawMeta('tagi', uzupelnione);
  await db.ustawMeta('tagi-0.9', true);
  return uzupelnione;
}

/** @param {string} surowy @returns {Promise<string|null>} */
export async function dodajTag(surowy) {
  const t = normalizujTag(surowy);
  if (!t) return null;
  const lista = await pobierzTagi();
  if (!lista.includes(t)) await db.ustawMeta('tagi', [...lista, t]);
  return t;
}

/** @param {string} t */
export async function usunTag(t) {
  const lista = await pobierzTagi();
  await db.ustawMeta('tagi', lista.filter((x) => x !== t));
}

/**
 * Chipy-checkboxy. Pokazuje też zaznaczone znaczniki spoza listy (np. usunięte z ustawień).
 * @param {HTMLElement} kontener @param {string} nazwa @param {string[]} wszystkie @param {string[]} zaznaczone
 */
export function budujChipy(kontener, nazwa, wszystkie, zaznaczone = []) {
  const lista = [...new Set([...wszystkie, ...zaznaczone])];
  kontener.replaceChildren(...lista.map((t) => h('label', { class: 'chip' },
    h('input', { type: 'checkbox', name: nazwa, value: t, checked: zaznaczone.includes(t) }),
    h('span', { text: t }))));
}

/** @param {HTMLElement} kontener @param {string} nazwa */
export function zaznaczoneChipy(kontener, nazwa) {
  return [.../** @type {NodeListOf<HTMLInputElement>} */ (kontener.querySelectorAll(`input[name="${nazwa}"]:checked`))].map((i) => i.value);
}

/** Dodaje nowy chip zaznaczony od razu. @param {HTMLElement} kontener @param {string} nazwa @param {string} t */
export function dolaczChip(kontener, nazwa, t) {
  const istniejacy = /** @type {HTMLInputElement|null} */ (kontener.querySelector(`input[name="${nazwa}"][value="${CSS.escape(t)}"]`));
  if (istniejacy) { istniejacy.checked = true; return; }
  kontener.append(h('label', { class: 'chip' },
    h('input', { type: 'checkbox', name: nazwa, value: t, checked: true }),
    h('span', { text: t })));
}
