// @ts-check
/**
 * Generator danych syntetycznych (wymyślonych). Służy do podglądu aplikacji
 * i do testów algorytmu zależności: wariant ze znaną zależnością i bez żadnej.
 * Nigdy nie używaj prawdziwych danych zdrowotnych w testach.
 */
import { mulberry32 } from './korelacje.js';
import { dodajDni, ymd, zbudujCzasySnu, czasNaDate } from './obliczenia.js';

/** @param {() => number} rng */
function normalny(rng) {
  const u = Math.max(rng(), 1e-9), v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const ogranicz = (/** @type {number} */ x, /** @type {number} */ lo, /** @type {number} */ hi) => Math.min(hi, Math.max(lo, x));
const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
/** @param {number} h godziny dziesiętne → HH:MM (mod 24) */
const naHHMM = (h) => { const m = Math.round((((h % 24) + 24) % 24) * 60); return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`; };

let licznik = 0;
const id = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `demo-${Date.now()}-${licznik++}`);

/**
 * @param {{ dni?: number, koniec?: string, ziarno?: number, zaleznosc?: boolean }} [o]
 *   koniec — ostatni dzień z wpisem (domyślnie wczoraj), zaleznosc — czy wbudować znane zależności
 */
export function generujDaneDemo({ dni = 90, koniec = dodajDni(ymd(), -1), ziarno = 7, zaleznosc = true } = {}) {
  const rng = mulberry32(ziarno);
  const teraz = new Date().toISOString();
  /** @type {any[]} */ const daily_entries = [];
  /** @type {any[]} */ const symptom_episodes = [];
  /** @type {any[]} */ const medication_intakes = [];

  const witD = { id: id(), name: 'Witamina D3', kind: 'supplement', dose_text: '2000 j.m.', schedule: { type: 'daily', times: ['08:00'] }, start_date: dodajDni(koniec, -dni), end_date: null, active: true, note: null, created_at: teraz, updated_at: teraz };
  const magnez = { id: id(), name: 'Magnez', kind: 'supplement', dose_text: '1 tabletka', schedule: { type: 'daily', times: ['21:00'] }, start_date: dodajDni(koniec, -40), end_date: null, active: true, note: null, created_at: teraz, updated_at: teraz };
  const przeciwbolowy = { id: id(), name: 'Lek przeciwbólowy', kind: 'medication', dose_text: 'wg ulotki', schedule: { type: 'as_needed' }, start_date: null, end_date: null, active: true, note: 'Przykładowy wpis', created_at: teraz, updated_at: teraz };

  for (let i = dni - 1; i >= 0; i--) {
    const data = dodajDni(koniec, -i);
    const tagi = [];
    if (rng() < 0.12) tagi.push('alkohol');
    if (rng() < 0.3) tagi.push('kawa po 16:00');
    if (rng() < 0.25) tagi.push('intensywny trening');
    if (rng() < 0.05) tagi.push('podróż');

    const stres = ogranicz(Math.round(2.8 + normalny(rng) * 1.1), 1, 5);
    let sen = 7 + normalny(rng) * 1.1;
    if (zaleznosc && tagi.includes('alkohol')) sen -= 0.6;
    sen = Math.round(ogranicz(sen, 4, 9.5) * 4) / 4;
    const pobudka = 6.75 + rng() * 1.25;
    const czasy = zbudujCzasySnu(data, naHHMM(pobudka - sen), naHHMM(pobudka));

    const jakosc = zaleznosc ? ogranicz(Math.round(1 + (sen - 4) * 0.75 + normalny(rng) * 0.7), 1, 5) : ogranicz(Math.round(3 + normalny(rng)), 1, 5);
    const energia = zaleznosc ? ogranicz(Math.round(sen - 3.8 + normalny(rng) * 0.8), 1, 5) : ogranicz(Math.round(3 + normalny(rng)), 1, 5);
    const nastroj = zaleznosc
      ? ogranicz(Math.round(3 + (energia - 3) * 0.5 - (stres - 3) * 0.45 + normalny(rng) * 0.6), 1, 5)
      : ogranicz(Math.round(3 + normalny(rng)), 1, 5);

    daily_entries.push({
      id: id(), entry_date: data, ...czasy, sleep_hours: null,
      sleep_quality: jakosc, awakenings: Math.max(0, Math.round(normalny(rng) * 0.9 + 1)),
      mood: nastroj, energy: energia, stress: stres, tags: tagi, note: null, created_at: teraz, updated_at: teraz,
    });

    let pBolu = 0.2;
    if (zaleznosc) {
      pBolu = sen < 6 ? 0.5 : 0.12;
      const wczoraj = daily_entries[daily_entries.length - 2];
      if (wczoraj?.tags.includes('alkohol')) pBolu += 0.3;
    }
    if (rng() < pBolu) {
      const start = czasNaDate(data, naHHMM(9 + rng() * 9));
      const czasTrwania = 2 + rng() * 6;
      const nasilenie = zaleznosc ? ogranicz(Math.round(3 + stres * 0.7 + normalny(rng)), 1, 9) : ogranicz(Math.round(5 + normalny(rng) * 1.5), 1, 9);
      const objawy = [];
      if (rng() < 0.3) objawy.push('nudnosci');
      if (rng() < 0.4) objawy.push('swiatlo');
      if (rng() < 0.2) objawy.push('dzwiek');
      const ep = {
        id: id(), kind: rng() < 0.2 ? 'migraine' : 'headache', custom_name: null,
        started_at: start.toISOString(), ended_at: new Date(start.getTime() + czasTrwania * 3600000).toISOString(),
        intensity: nasilenie, location: rng() < 0.5 ? 'Skronie' : 'Czoło', features: objawy,
        triggers: tagi.filter((t) => t !== 'podróż'), relief: null, note: null, created_at: teraz, updated_at: teraz,
      };
      if (rng() < 0.6) {
        ep.relief = rng() < 0.6 ? 'partial' : 'full';
        medication_intakes.push({
          id: id(), medication_id: przeciwbolowy.id, taken_at: new Date(start.getTime() + 1800000).toISOString(),
          dose_text: null, reason: 'ból głowy', episode_id: ep.id, scheduled_time: null, created_at: teraz, updated_at: teraz,
        });
      }
      symptom_episodes.push(ep);
    }

    if (rng() < 0.9) {
      medication_intakes.push({ id: id(), medication_id: witD.id, taken_at: czasNaDate(data, '08:05').toISOString(), dose_text: witD.dose_text, reason: null, episode_id: null, scheduled_time: '08:00', created_at: teraz, updated_at: teraz });
    }
    if (data >= magnez.start_date && rng() < 0.8) {
      medication_intakes.push({ id: id(), medication_id: magnez.id, taken_at: czasNaDate(data, '21:10').toISOString(), dose_text: magnez.dose_text, reason: null, episode_id: null, scheduled_time: '21:00', created_at: teraz, updated_at: teraz });
    }
  }

  const wynik = (/** @type {string} */ dzien, /** @type {string} */ nazwa, /** @type {number} */ v, /** @type {string} */ j, /** @type {number|null} */ lo, /** @type {number|null} */ hi) => ({
    id: id(), taken_on: dzien, test_name: nazwa, value: v, unit: j, ref_low: lo, ref_high: hi, lab_name: 'Laboratorium przykładowe', document_id: null, note: null, created_at: teraz, updated_at: teraz,
  });
  const lab_results = [
    wynik(dodajDni(koniec, -360), 'TSH', 2.1, 'µIU/ml', 0.27, 4.2),
    wynik(dodajDni(koniec, -180), 'TSH', 3.4, 'µIU/ml', 0.27, 4.2),
    wynik(dodajDni(koniec, -20), 'TSH', 4.6, 'µIU/ml', 0.27, 4.2),
    wynik(dodajDni(koniec, -180), 'Ferrytyna', 28, 'ng/ml', 15, 150),
    wynik(dodajDni(koniec, -20), 'Ferrytyna', 41, 'ng/ml', 15, 150),
    wynik(dodajDni(koniec, -20), 'Witamina D 25(OH)', 24, 'ng/ml', 30, 100),
  ];

  return {
    daily_entries,
    symptom_episodes,
    medications: [witD, magnez, przeciwbolowy],
    medication_intakes,
    lab_results,
    tagi: ['kawa po 16:00', 'alkohol', 'intensywny trening', 'podróż', 'okres', 'choroba'],
  };
}
