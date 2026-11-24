import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poleCSV, doCSV, zbudujEksport, sprawdzImport, KOLUMNY } from '../js/eksport.js';

test('pola CSV: cudzysłowy, średniki, liczby, tablice, formuły', () => {
  assert.equal(poleCSV('a;b'), '"a;b"');
  assert.equal(poleCSV('powiedział "tak"'), '"powiedział ""tak"""');
  assert.equal(poleCSV(7.5), '7,5');
  assert.equal(poleCSV(['kawa', 'alkohol']), 'kawa, alkohol');
  assert.equal(poleCSV('=SUMA(A1)'), "'=SUMA(A1)");
  assert.equal(poleCSV(null), '');
  assert.equal(poleCSV(true), 'tak');
});

test('doCSV: BOM, nagłówek, wiersze', () => {
  const csv = doCSV([{ id: '1', entry_date: '2026-11-01', mood: 4 }], ['id', 'entry_date', 'mood']);
  assert.ok(csv.startsWith('﻿id;entry_date;mood\r\n1;2026-11-01;4'));
});

test('pełny cykl: eksport → JSON → import', () => {
  const dane = { daily_entries: [{ id: 'a', entry_date: '2026-11-01', tags: ['x'] }], lab_results: [{ id: 'b', test_name: 'TSH', value: 2.1 }] };
  const e = zbudujEksport(dane, { tagi: ['x'] }, new Date('2026-11-23T10:00:00Z'));
  const w = sprawdzImport(JSON.parse(JSON.stringify(e)));
  assert.equal(w.ok, true);
  assert.deepEqual(w.dane.daily_entries, dane.daily_entries);
  assert.deepEqual(w.dane.medications, []);
  assert.deepEqual(w.meta.tagi, ['x']);
});

test('import odrzuca obcy plik i wiersze bez id', () => {
  assert.equal(sprawdzImport({ foo: 1 }).ok, false);
  assert.equal(sprawdzImport({ format: 'dziennik-zdrowia', wersja: 1, dane: { daily_entries: [{ entry_date: 'x' }] } }).ok, false);
  assert.equal(sprawdzImport({ format: 'dziennik-zdrowia', wersja: 99, dane: {} }).ok, false);
});

test('kolumny eksportu pokrywają wszystkie tabele', () => {
  assert.deepEqual(Object.keys(KOLUMNY).sort(), ['daily_entries', 'lab_results', 'medication_intakes', 'medications', 'symptom_episodes']);
});
