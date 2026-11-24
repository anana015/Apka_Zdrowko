import './setup-tz.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangi, spearman, pearson, benjaminiHochberg, analizujZaleznosci, ZDANIE_OSTRZEGAWCZE } from '../js/korelacje.js';
import { generujDaneDemo } from '../js/demo.js';

test('rangi ze średnią dla remisów', () => {
  assert.deepEqual(rangi([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
});

test('Spearman: zależność monotoniczna = 1, odwrotna = −1', () => {
  assert.equal(spearman([1, 2, 3, 4, 5], [2, 4, 8, 16, 32]), 1);
  assert.equal(spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), -1);
});

test('Pearson zwraca NaN dla stałej zmiennej', () => {
  assert.ok(Number.isNaN(pearson([1, 1, 1, 1], [1, 2, 3, 4])));
});

test('Benjamini-Hochberg (wartości referencyjne)', () => {
  const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.005]);
  const zaokr = q.map((x) => Math.round(x * 10000) / 10000);
  assert.deepEqual(zaokr, [0.02, 0.04, 0.04, 0.02]);
});

test('za mało danych: poniżej 30 dni', () => {
  const d = generujDaneDemo({ dni: 20, koniec: '2026-11-20' });
  const w = analizujZaleznosci({ wpisy: d.daily_entries, epizody: d.symptom_episodes });
  assert.equal(w.status, 'za_malo_danych');
  assert.equal(w.wyniki.length, 0);
});

test('za mało danych: poniżej 5 epizodów', () => {
  const d = generujDaneDemo({ dni: 60, koniec: '2026-11-20' });
  const w = analizujZaleznosci({ wpisy: d.daily_entries, epizody: d.symptom_episodes.slice(0, 4) });
  assert.equal(w.status, 'za_malo_danych');
});

test('dane ze znaną zależnością: wykrywa krótki sen → ból tego samego dnia', () => {
  const d = generujDaneDemo({ dni: 120, koniec: '2026-11-20', ziarno: 11, zaleznosc: true });
  const w = analizujZaleznosci({ wpisy: d.daily_entries, epizody: d.symptom_episodes });
  assert.equal(w.status, 'ok');
  const sen = w.wyniki.find((r) => r.id === 'sen<6h|bol|0');
  assert.ok(sen, `brak wyniku sen<6h; wyniki: ${w.wyniki.map((r) => r.id).join(', ')}`);
  assert.ok(sen.efekt >= 0.15);
  assert.ok(sen.ci[0] > 0, 'dolna granica CI powinna być dodatnia');
  assert.match(sen.zdanie, /n = \d+ dni/);
  assert.equal(sen.ostrzezenie, ZDANIE_OSTRZEGAWCZE);
});

test('dane bez zależności: nie pokazuje żadnej zależności', () => {
  for (const ziarno of [1, 2, 3]) {
    const d = generujDaneDemo({ dni: 120, koniec: '2026-11-20', ziarno, zaleznosc: false });
    const w = analizujZaleznosci({ wpisy: d.daily_entries, epizody: d.symptom_episodes });
    assert.equal(w.status, 'ok');
    assert.equal(w.wyniki.length, 0, `ziarno ${ziarno}: ${w.wyniki.map((r) => r.zdanie).join(' | ')}`);
  }
});

test('wynik jest deterministyczny (to samo ziarno)', () => {
  const d = generujDaneDemo({ dni: 90, koniec: '2026-11-20', ziarno: 5 });
  const a = analizujZaleznosci({ wpisy: d.daily_entries, epizody: d.symptom_episodes });
  const b = analizujZaleznosci({ wpisy: d.daily_entries, epizody: d.symptom_episodes });
  assert.deepEqual(a.wyniki.map((r) => r.zdanie), b.wyniki.map((r) => r.zdanie));
});
