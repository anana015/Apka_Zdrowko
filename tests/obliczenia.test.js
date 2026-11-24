import './setup-tz.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  zbudujCzasySnu, godzinySnu, formatGodziny, dodajDni, roznicaDni, zakresDni,
  pozaZakresem, walidujWynik, podsumowanieOkresu, seriaDzienna, dawkiNaDzien,
  poprzedniWpis, parsujLiczbe, opisHarmonogramu,
} from '../js/obliczenia.js';

const sen = (data, a, b) => { const c = zbudujCzasySnu(data, a, b); return godzinySnu(c.sleep_start, c.sleep_end); };

test('sen przez północ', () => {
  assert.equal(sen('2026-11-20', '23:30', '07:00'), 7.5);
});

test('zaśnięcie po północy tego samego dnia', () => {
  assert.equal(sen('2026-11-20', '01:15', '08:00'), 6.8); // 6 h 45 min → 6,75 → 6,8
});

test('zmiana czasu na letni (29.03.2026) skraca noc o godzinę', () => {
  assert.equal(sen('2026-03-29', '23:00', '07:00'), 7);
});

test('zmiana czasu na zimowy (25.10.2026) wydłuża noc o godzinę', () => {
  assert.equal(sen('2026-10-25', '23:00', '07:00'), 9);
});

test('ta sama godzina zaśnięcia i pobudki = 24 h', () => {
  assert.equal(sen('2026-11-20', '07:00', '07:00'), 24);
});

test('formatGodziny', () => {
  assert.equal(formatGodziny(7.5), '7 h 30 min');
  assert.equal(formatGodziny(8), '8 h');
  assert.equal(formatGodziny(null), '–');
});

test('operacje na datach odporne na zmianę czasu', () => {
  assert.equal(dodajDni('2026-03-28', 1), '2026-03-29');
  assert.equal(dodajDni('2026-03-29', 1), '2026-03-30');
  assert.equal(roznicaDni('2026-03-01', '2026-04-01'), 31);
  assert.equal(zakresDni('2026-10-24', '2026-10-26').length, 3);
});

test('parsujLiczbe przyjmuje przecinek', () => {
  assert.equal(parsujLiczbe('4,25'), 4.25);
  assert.equal(parsujLiczbe(' 12 '), 12);
  assert.equal(parsujLiczbe(''), null);
  assert.equal(parsujLiczbe('abc'), null);
});

test('pozaZakresem to czyste porównanie liczb', () => {
  assert.equal(pozaZakresem(5, 1, 4), 'powyzej');
  assert.equal(pozaZakresem(0.5, 1, 4), 'ponizej');
  assert.equal(pozaZakresem(4, 1, 4), 'w_zakresie');
  assert.equal(pozaZakresem(4, null, null), null);
  assert.equal(pozaZakresem(4, null, 3), 'powyzej');
});

test('walidacja wyniku: zakres odwrócony i zmiana jednostki', () => {
  const { bledy, ostrzezenia } = walidujWynik(
    { test_name: 'Witamina D', value: 30, unit: 'nmol/l', ref_low: 100, ref_high: 30 },
    [{ test_name: 'witamina d', unit: 'ng/ml', taken_on: '2026-01-01' }],
  );
  assert.equal(bledy.length, 1);
  assert.equal(ostrzezenia.length, 1);
});

test('podsumowanie okresu', () => {
  const wpisy = [
    { entry_date: '2026-11-01', sleep_hours: 6, mood: 3 },
    { entry_date: '2026-11-02', sleep_hours: 8, mood: 5 },
    { entry_date: '2026-10-01', sleep_hours: 2, mood: 1 },
  ];
  const epizody = [
    { kind: 'headache', started_at: new Date(2026, 10, 1, 10).toISOString(), intensity: 4 },
    { kind: 'migraine', started_at: new Date(2026, 10, 1, 18).toISOString(), intensity: 8 },
    { kind: 'other', started_at: new Date(2026, 10, 2, 9).toISOString(), intensity: 2 },
  ];
  const leki = [{ id: 'l1', name: 'X', kind: 'medication', schedule: { type: 'as_needed' } }];
  const przyjecia = [{ medication_id: 'l1', taken_at: new Date(2026, 10, 1, 11).toISOString() }];
  const p = podsumowanieOkresu({ wpisy, epizody, przyjecia, leki, od: '2026-11-01', do_: '2026-11-07' });
  assert.equal(p.liczbaDni, 7);
  assert.equal(p.dniZWpisem, 2);
  assert.equal(p.sredniSen, 7);
  assert.equal(p.dniZBolem, 1);
  assert.equal(p.liczbaEpizodow, 2);
  assert.equal(p.srednieNasilenie, 6);
  assert.equal(p.lekiDorazne, 1);
});

test('seriaDzienna wypełnia brakujące dni', () => {
  const s = seriaDzienna({ wpisy: [{ entry_date: '2026-11-02', sleep_hours: 7, mood: 4 }], epizody: [], od: '2026-11-01', do_: '2026-11-03' });
  assert.equal(s.length, 3);
  assert.equal(s[0].sen, null);
  assert.equal(s[1].nastroj, 4);
});

test('dawki na dzień respektują daty i aktywność', () => {
  const leki = [
    { id: 'a', name: 'A', kind: 'supplement', schedule: { type: 'daily', times: ['20:00', '08:00'] }, active: true },
    { id: 'b', name: 'B', kind: 'medication', schedule: { type: 'daily', times: ['09:00'] }, active: true, end_date: '2026-11-01' },
    { id: 'c', name: 'C', kind: 'medication', schedule: { type: 'as_needed' }, active: true },
    { id: 'd', name: 'D', kind: 'medication', schedule: { type: 'daily', times: ['07:00'] }, active: false },
  ];
  const d = dawkiNaDzien(leki, '2026-11-05');
  assert.deepEqual(d.map((x) => `${x.godzina} ${x.lek.name}`), ['08:00 A', '20:00 A']);
  assert.equal(opisHarmonogramu(leki[0].schedule), 'codziennie: 08:00, 20:00');
});

test('poprzedniWpis wybiera najbliższy wcześniejszy dzień', () => {
  const w = poprzedniWpis([{ entry_date: '2026-11-01' }, { entry_date: '2026-11-03' }, { entry_date: '2026-11-05' }], '2026-11-05');
  assert.equal(w.entry_date, '2026-11-03');
});
