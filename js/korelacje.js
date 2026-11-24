// @ts-check
/**
 * Algorytm zależności (specyfikacja, sekcja 10). Czyste funkcje, bez DOM i bazy.
 *
 * Zasady:
 *  - zmienne porządkowe/liczbowe: korelacja rang Spearmana (ρ),
 *  - wynik binarny (ból tak/nie): różnica odsetków dni z bólem między grupami,
 *  - p z testu permutacyjnego, 95% CI metodą bootstrap (percentylową),
 *  - korekta Benjaminiego-Hochberga na wielokrotne porównania,
 *  - pokazujemy tylko efekty powyżej progu (|ρ| ≥ 0,25 lub ≥ 15 pp) i q ≤ 0,10,
 *  - minimum 30 dni z wpisem i 5 epizodów bólu głowy,
 *  - zawsze n, okres i zdanie „to obserwacja, nie dowód przyczyny”.
 * Generator losowy jest deterministyczny (ziarno), więc wyniki są powtarzalne i testowalne.
 */
import { dodajDni, dzienEpizodu, czyBolGlowy, snuZWpisu } from './obliczenia.js';

export const PROGI = Object.freeze({
  minDni: 30,
  minEpizodow: 5,
  minGrupa: 5,
  roznica: 0.15,
  rho: 0.25,
  q: 0.10,
  permutacje: 2000,
  bootstrap: 1000,
  ziarno: 20261123,
});

export const ZDANIE_OSTRZEGAWCZE = 'To obserwacja z Twoich danych, nie dowód przyczyny.';

/** Generator pseudolosowy mulberry32. @param {number} ziarno */
export function mulberry32(ziarno) {
  let a = ziarno >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {any[]} tab @param {() => number} rng */
function tasuj(tab, rng) {
  for (let i = tab.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tab[i], tab[j]] = [tab[j], tab[i]];
  }
  return tab;
}

/** Rangi ze średnią dla remisów (1-based). @param {number[]} v */
export function rangi(v) {
  const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(v.length);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const srednia = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = srednia;
    i = j + 1;
  }
  return r;
}

/** @param {number[]} x @param {number[]} y */
export function pearson(x, y) {
  const n = x.length;
  if (n < 3) return NaN;
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += x[i]; sy += y[i]; }
  const mx = sx / n, my = sy / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    cov += dx * dy; vx += dx * dx; vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return NaN;
  return cov / Math.sqrt(vx * vy);
}

/** @param {number[]} x @param {number[]} y */
export const spearman = (x, y) => pearson(rangi(x), rangi(y));

/**
 * Korekta Benjaminiego-Hochberga. Zwraca q w kolejności wejścia.
 * @param {number[]} p
 */
export function benjaminiHochberg(p) {
  const m = p.length;
  const kolejnosc = p.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const q = new Array(m);
  let min = 1;
  for (let k = m - 1; k >= 0; k--) {
    const [v, i] = kolejnosc[k];
    min = Math.min(min, (v * m) / (k + 1));
    q[i] = Math.min(1, min);
  }
  return q;
}

/** @param {number[]} xs @param {number} p 0–1 */
function percentyl(xs, p) {
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * p;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/**
 * Test Spearmana: ρ, p (permutacyjne, dwustronne), 95% CI (bootstrap).
 * @param {number[]} x @param {number[]} y @param {{ permutacje: number, bootstrap: number }} o @param {() => number} rng
 */
export function testSpearmana(x, y, o, rng) {
  const rx = rangi(x), ry = rangi(y);
  const rho = pearson(rx, ry);
  if (!Number.isFinite(rho)) return null;
  const n = x.length;
  // Permutacja: średnia i wariancja rang y się nie zmieniają, więc liczymy tylko kowariancję.
  const mx = rx.reduce((a, b) => a + b, 0) / n;
  const my = ry.reduce((a, b) => a + b, 0) / n;
  const cx = rx.map((v) => v - mx);
  const vx = cx.reduce((a, b) => a + b * b, 0);
  const vy = ry.reduce((a, b) => a + (b - my) ** 2, 0);
  const mianownik = Math.sqrt(vx * vy);
  const perm = ry.slice();
  let ekstremalne = 0;
  for (let k = 0; k < o.permutacje; k++) {
    tasuj(perm, rng);
    let cov = 0;
    for (let i = 0; i < n; i++) cov += cx[i] * (perm[i] - my);
    if (Math.abs(cov / mianownik) >= Math.abs(rho) - 1e-12) ekstremalne++;
  }
  const p = (ekstremalne + 1) / (o.permutacje + 1);
  /** @type {number[]} */ const bs = [];
  const bx = new Array(n), by = new Array(n);
  for (let b = 0; b < o.bootstrap; b++) {
    for (let i = 0; i < n; i++) {
      const j = Math.floor(rng() * n);
      bx[i] = x[j]; by[i] = y[j];
    }
    const r = spearman(bx, by);
    if (Number.isFinite(r)) bs.push(r);
  }
  const ci = bs.length > 10 ? [percentyl(bs, 0.025), percentyl(bs, 0.975)] : [NaN, NaN];
  return { efekt: rho, p, ci, n };
}

/**
 * Różnica odsetków (A − B) z p permutacyjnym i 95% CI bootstrap.
 * @param {boolean[]} a @param {boolean[]} b @param {{ permutacje: number, bootstrap: number }} o @param {() => number} rng
 */
export function testRoznicyOdsetkow(a, b, o, rng) {
  const odsetek = (/** @type {boolean[]} */ t) => t.filter(Boolean).length / t.length;
  const pa = odsetek(a), pb = odsetek(b);
  const roznica = pa - pb;
  const wszystkie = [...a, ...b];
  const sumaWsz = wszystkie.filter(Boolean).length;
  const na = a.length, nb = b.length;
  let ekstremalne = 0;
  const pula = wszystkie.slice();
  for (let k = 0; k < o.permutacje; k++) {
    tasuj(pula, rng);
    let sa = 0;
    for (let i = 0; i < na; i++) if (pula[i]) sa++;
    const d = sa / na - (sumaWsz - sa) / nb;
    if (Math.abs(d) >= Math.abs(roznica) - 1e-12) ekstremalne++;
  }
  const p = (ekstremalne + 1) / (o.permutacje + 1);
  /** @type {number[]} */ const bs = [];
  for (let k = 0; k < o.bootstrap; k++) {
    let sa = 0, sb = 0;
    for (let i = 0; i < na; i++) if (a[Math.floor(rng() * na)]) sa++;
    for (let i = 0; i < nb; i++) if (b[Math.floor(rng() * nb)]) sb++;
    bs.push(sa / na - sb / nb);
  }
  return { efekt: roznica, pa, pb, p, ci: [percentyl(bs, 0.025), percentyl(bs, 0.975)], n: na + nb, na, nb };
}

// ---------- Formatowanie zdań ----------
const proc = (/** @type {number} */ x) => `${Math.round(x * 100)}%`;
const pp = (/** @type {number} */ x) => `${Math.round(x * 100)}`.replace('-', '−');
const dwa = (/** @type {number} */ x) => x.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('-', '−');
const KIEDY = ['tego samego dnia', 'następnego dnia'];

/**
 * Główna funkcja: lista zależności do pokazania.
 * @param {{ wpisy: import('./obliczenia.js').Wpis[], epizody: import('./obliczenia.js').Epizod[], opcje?: Partial<typeof PROGI> }} p
 */
export function analizujZaleznosci({ wpisy, epizody, opcje = {} }) {
  const P = { ...PROGI, ...opcje };
  const rng = mulberry32(P.ziarno);

  const bole = epizody.filter(czyBolGlowy);
  /** @type {Map<string, number>} */
  const bolPoDacie = new Map();
  for (const e of bole) {
    const d = dzienEpizodu(e);
    bolPoDacie.set(d, Math.max(bolPoDacie.get(d) ?? 0, e.intensity ?? 0));
  }

  const dni = [...wpisy]
    .sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1))
    .map((w) => ({
      data: w.entry_date,
      sen: snuZWpisu(w),
      jakosc: w.sleep_quality ?? null,
      stres: w.stress ?? null,
      energia: w.energy ?? null,
      nastroj: w.mood ?? null,
      tagi: w.tags ?? [],
      bol: bolPoDacie.has(w.entry_date),
      bolMax: bolPoDacie.get(w.entry_date) ?? 0,
    }));
  const poDacie = new Map(dni.map((d) => [d.data, d]));
  const okres = dni.length ? { od: dni[0].data, do: dni[dni.length - 1].data } : null;
  const epizodyWOkresie = okres ? bole.filter((e) => { const d = dzienEpizodu(e); return d >= okres.od && d <= okres.do; }).length : 0;

  if (dni.length < P.minDni || epizodyWOkresie < P.minEpizodow) {
    return { status: /** @type {const} */ ('za_malo_danych'), dni: dni.length, epizody: epizodyWOkresie, progi: { minDni: P.minDni, minEpizodow: P.minEpizodow }, okres, wyniki: [], liczbaTestow: 0 };
  }

  /** @typedef {typeof dni[number]} Dzien */
  /** Pary (czynnik w dniu d, wynik w dniu d+opoznienie). @param {number} opoznienie */
  const pary = (opoznienie) => dni
    .map((d) => [d, opoznienie === 0 ? d : poDacie.get(dodajDni(d.data, opoznienie))])
    .filter((para) => para[1] != null);

  /** @type {any[]} */
  const testy = [];

  // --- 1. Czynniki dzielące dni na grupy → wystąpienie bólu głowy ---
  const tagi = [...new Set(dni.flatMap((d) => d.tagi))];
  /** @type {{ id: string, czynnik: (d: Dzien) => boolean|null, zdanie: (pa: string, pb: string, lag: number) => string }[]} */
  const podzialy = [
    {
      id: 'sen<6h',
      czynnik: (d) => (d.sen == null ? null : d.sen < 6),
      zdanie: (pa, pb, lag) => `Po nocach krótszych niż 6 h ból głowy wystąpił ${KIEDY[lag]} w ${pa} przypadków, a po dłuższych nocach w ${pb}`,
    },
    {
      id: 'jakosc<=2',
      czynnik: (d) => (d.jakosc == null ? null : d.jakosc <= 2),
      zdanie: (pa, pb, lag) => `Po nocach ze słabą jakością snu (1–2 z 5) ból głowy wystąpił ${KIEDY[lag]} w ${pa} przypadków, a po lepszych nocach w ${pb}`,
    },
    ...tagi.map((t) => ({
      id: `tag:${t}`,
      czynnik: (/** @type {Dzien} */ d) => d.tagi.includes(t),
      zdanie: (/** @type {string} */ pa, /** @type {string} */ pb, /** @type {number} */ lag) => lag === 0
        ? `W dni ze znacznikiem „${t}” ból głowy wystąpił w ${pa} przypadków, a w pozostałe dni w ${pb}`
        : `Dzień po dniu ze znacznikiem „${t}” ból głowy wystąpił w ${pa} przypadków, a w pozostałych przypadkach w ${pb}`,
    })),
  ];
  for (const lag of [0, 1]) {
    const lista = pary(lag);
    for (const pd of podzialy) {
      /** @type {boolean[]} */ const A = [];
      /** @type {boolean[]} */ const B = [];
      /** @type {string[]} */ const datyA = [];
      /** @type {string[]} */ const datyB = [];
      for (const [d, w] of lista) {
        const c = pd.czynnik(/** @type {Dzien} */ (d));
        if (c == null) continue;
        (c ? A : B).push(/** @type {Dzien} */ (w).bol);
        (c ? datyA : datyB).push(/** @type {Dzien} */ (d).data);
      }
      if (A.length < P.minGrupa || B.length < P.minGrupa) continue;
      const t = testRoznicyOdsetkow(A, B, P, rng);
      testy.push({ id: `${pd.id}|bol|${lag}`, typ: 'roznica', lag, ...t, A, B, datyA, datyB, budujZdanie: pd.zdanie });
    }
  }

  // --- 2. Korelacje rang ---
  /** @type {{ id: string, x: (d: Dzien) => number|null, y: (d: Dzien) => number|null, lagi: number[], czynnik: string, wynikWyzej: string, wynikNizej: string }[]} */
  const korelacje = [
    { id: 'stres~bol', x: (d) => d.stres, y: (d) => d.bolMax, lagi: [0, 1], czynnik: 'wyższy stres', wynikWyzej: 'silniejszy ból głowy', wynikNizej: 'słabszy ból głowy' },
    { id: 'energia~bol', x: (d) => d.energia, y: (d) => d.bolMax, lagi: [0, 1], czynnik: 'wyższa energia', wynikWyzej: 'silniejszy ból głowy', wynikNizej: 'słabszy ból głowy' },
    { id: 'stres~nastroj', x: (d) => d.stres, y: (d) => d.nastroj, lagi: [1], czynnik: 'wyższy stres', wynikWyzej: 'lepszy nastrój', wynikNizej: 'gorszy nastrój' },
    { id: 'energia~nastroj', x: (d) => d.energia, y: (d) => d.nastroj, lagi: [1], czynnik: 'wyższa energia', wynikWyzej: 'lepszy nastrój', wynikNizej: 'gorszy nastrój' },
    { id: 'sen~nastroj', x: (d) => d.sen, y: (d) => d.nastroj, lagi: [0], czynnik: 'dłuższy sen', wynikWyzej: 'lepszy nastrój', wynikNizej: 'gorszy nastrój' },
  ];
  for (const k of korelacje) {
    for (const lag of k.lagi) {
      /** @type {number[]} */ const xs = [];
      /** @type {number[]} */ const ys = [];
      /** @type {string[]} */ const daty = [];
      for (const [d, w] of pary(lag)) {
        const x = k.x(/** @type {Dzien} */ (d)), y = k.y(/** @type {Dzien} */ (w));
        if (x == null || y == null) continue;
        xs.push(x); ys.push(y); daty.push(/** @type {Dzien} */ (d).data);
      }
      if (xs.length < P.minDni) continue;
      const t = testSpearmana(xs, ys, P, rng);
      if (!t) continue;
      testy.push({ id: `${k.id}|${lag}`, typ: 'spearman', lag, ...t, xs, ys, daty, opis: k });
    }
  }

  // --- 3. Korekta na wielokrotne porównania ---
  const q = benjaminiHochberg(testy.map((t) => t.p));
  testy.forEach((t, i) => { t.q = q[i]; });

  const polowaDaty = dni[Math.floor(dni.length / 2)].data;
  const wyniki = testy
    .filter((t) => (t.typ === 'roznica' ? Math.abs(t.efekt) >= P.roznica : Math.abs(t.efekt) >= P.rho) && t.q <= P.q)
    .map((t) => {
      const powtarzalny = czyPowtarzalny(t, polowaDaty, P);
      let zdanie;
      if (t.typ === 'roznica') {
        zdanie = `${t.budujZdanie(proc(t.pa), proc(t.pb), t.lag)} (n = ${t.n} dni; różnica ${pp(t.efekt)} pp, 95% CI od ${pp(t.ci[0])} do ${pp(t.ci[1])} pp).`;
      } else {
        const wynik = t.efekt > 0 ? t.opis.wynikWyzej : t.opis.wynikNizej;
        zdanie = `Im ${t.opis.czynnik}, tym zwykle ${wynik} ${KIEDY[t.lag]} (ρ = ${dwa(t.efekt)}; 95% CI od ${dwa(t.ci[0])} do ${dwa(t.ci[1])}; n = ${t.n} dni).`;
      }
      return {
        id: t.id,
        typ: t.typ,
        opoznienie: t.lag,
        efekt: t.efekt,
        ci: t.ci,
        n: t.n,
        p: t.p,
        q: t.q,
        zdanie,
        ostrzezenie: ZDANIE_OSTRZEGAWCZE,
        powtarzalny,
        sugestia: powtarzalny ? 'Ten wzór widać w obu połowach okresu. Warto omówić go z lekarzem.' : null,
      };
    })
    .sort((a, b) => a.q - b.q || Math.abs(b.efekt) - Math.abs(a.efekt));

  return {
    status: /** @type {const} */ ('ok'),
    dni: dni.length,
    epizody: epizodyWOkresie,
    okres,
    liczbaTestow: testy.length,
    wyniki,
    progi: { minDni: P.minDni, minEpizodow: P.minEpizodow },
  };
}

/**
 * „Powtarzający się wzorzec”: ten sam kierunek i co najmniej połowa progu w obu połowach okresu.
 * @param {any} t @param {string} polowaDaty @param {typeof PROGI} P
 */
function czyPowtarzalny(t, polowaDaty, P) {
  if (t.typ === 'roznica') {
    const czesc = (/** @type {(d: string) => boolean} */ f) => {
      const a = t.A.filter((/** @type {boolean} */ _, /** @type {number} */ i) => f(t.datyA[i]));
      const b = t.B.filter((/** @type {boolean} */ _, /** @type {number} */ i) => f(t.datyB[i]));
      if (a.length < 3 || b.length < 3) return null;
      return a.filter(Boolean).length / a.length - b.filter(Boolean).length / b.length;
    };
    const r1 = czesc((d) => d < polowaDaty), r2 = czesc((d) => d >= polowaDaty);
    if (r1 == null || r2 == null) return false;
    return Math.sign(r1) === Math.sign(t.efekt) && Math.sign(r2) === Math.sign(t.efekt)
      && Math.abs(r1) >= P.roznica / 2 && Math.abs(r2) >= P.roznica / 2;
  }
  const czesc = (/** @type {(d: string) => boolean} */ f) => {
    const idx = t.daty.map((/** @type {string} */ d, /** @type {number} */ i) => (f(d) ? i : -1)).filter((/** @type {number} */ i) => i >= 0);
    if (idx.length < 10) return NaN;
    return spearman(idx.map((/** @type {number} */ i) => t.xs[i]), idx.map((/** @type {number} */ i) => t.ys[i]));
  };
  const r1 = czesc((d) => d < polowaDaty), r2 = czesc((d) => d >= polowaDaty);
  if (!Number.isFinite(r1) || !Number.isFinite(r2)) return false;
  return Math.sign(r1) === Math.sign(t.efekt) && Math.sign(r2) === Math.sign(t.efekt)
    && Math.abs(r1) >= P.rho / 2 && Math.abs(r2) >= P.rho / 2;
}
