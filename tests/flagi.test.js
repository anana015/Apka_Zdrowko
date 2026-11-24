import './setup-tz.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sprawdzTekst, sprawdzEpizod, aktywneFlagi, normalizuj, ZWERYFIKOWANO } from '../js/flagi.js';

test('normalizacja usuwa polskie znaki', () => {
  assert.equal(normalizuj('Sztywność KARKU, łóżko!'), 'sztywnosc karku lozko');
});

test('słowa kluczowe z polskimi znakami i odmianą', () => {
  assert.deepEqual(sprawdzTekst('Wieczorem pojawiła się sztywność karku i gorączka'), ['alarm_goraczka_kark']);
  assert.deepEqual(sprawdzTekst('miałam drgawki'), ['alarm_widzenie_przytomnosc']);
  assert.deepEqual(sprawdzTekst('Nie chcę już żyć'), ['kryzys_samobojcze']);
  assert.deepEqual(sprawdzTekst('Zwykły dzień, kawa i spacer'), []);
});

test('epizod: zaznaczony objaw alarmowy i nasilenie 10/10', () => {
  const ids = sprawdzEpizod({ kind: 'headache', started_at: new Date().toISOString(), intensity: 10, features: ['alarm_uraz', 'nudnosci'] });
  assert.deepEqual(ids.sort(), ['alarm_uraz', 'nasilenie_10']);
});

test('baner tylko dla zdarzeń z ostatnich 48 h', () => {
  const teraz = new Date(2026, 10, 23, 12);
  const stary = { kind: 'headache', started_at: new Date(2026, 10, 18, 12).toISOString(), intensity: 10, features: [] };
  const nowy = { kind: 'headache', started_at: new Date(2026, 10, 23, 9).toISOString(), intensity: 3, features: ['alarm_neurologiczne'] };
  assert.equal(aktywneFlagi({ wpisy: [], epizody: [stary], teraz }).flagi.length, 0);
  const a = aktywneFlagi({ wpisy: [{ entry_date: '2026-11-22', note: 'myśli samobójcze' }], epizody: [nowy], teraz });
  assert.equal(a.pilne, true);
  assert.equal(a.kryzys, true);
});

test('lista flag jest sprawdzona ze źródłami', () => {
  assert.equal(ZWERYFIKOWANO, true);
});
