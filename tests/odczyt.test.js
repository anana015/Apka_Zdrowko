import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rozpoznajWyniki, normalizujJednostke } from '../js/odczyt-parser.js';

test('odczyt: typowy wydruk laboratorium', () => {
  const { wyniki, data, laboratorium } = rozpoznajWyniki([
    'DIAGNOSTYKA S.A.', 'PESEL 80010112345', 'Data pobrania: 03.11.2026 08:15',
    'WBC 6,20 tys/µl 4,00 - 10,00', 'TSH 4,62 H µIU/ml 0,27 - 4,20',
    'Witamina D3 metabolit 25(OH) 24,0 ng/ml 30,0 - 50,0', 'Cholesterol całkowity 212 mg/dl < 190', 'Strona 1 z 2',
  ].join('\n'));
  assert.equal(data, '2026-11-03');
  assert.equal(laboratorium, 'Diagnostyka');
  assert.deepEqual(wyniki.map((w) => [w.nazwa, w.wartosc, w.jednostka, w.dol, w.gora]), [
    ['Leukocyty (WBC)', 6.2, 'tys/µl', 4, 10],
    ['TSH', 4.62, 'µIU/ml', 0.27, 4.2],
    ['Witamina D 25(OH)', 24, 'ng/ml', 30, 50],
    ['Cholesterol całkowity', 212, 'mg/dl', null, 190],
  ]);
});

test('odczyt: pomyłki OCR w jednostkach', () => {
  assert.equal(normalizujJednostke('gldl'), 'g/dl');
  assert.equal(normalizujJednostke('plU/ml'), 'µIU/ml');
  assert.equal(normalizujJednostke('pg/ml'), 'pg/ml');
  assert.equal(normalizujJednostke('xyz'), 'xyz');
});
