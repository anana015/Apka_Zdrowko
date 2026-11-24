// @ts-check
/**
 * Czerwone flagi (specyfikacja, sekcja 4.7). Czyste funkcje, bez DOM.
 *
 * Lista sprawdzona 24.11.2026 ze źródłami: NHS (headaches, back-pain, pelvic-pain, testicle-pain,
 * ectopic-pregnancy, cold-sores, genital-herpes, flu, common-cold, sore-throat, sepsis, fever-in-adults) i NICE CG150. Treść opracowana własnymi słowami i dostosowana do Polski (112, SOR).
 * Nie zastępuje porady lekarza; warto pokazać ją swojemu lekarzowi. Przegląd: co najmniej raz w roku.
 *
 * Poziomy:
 *   'pilne'  — 112 albo SOR (w Wielkiej Brytanii: „999 or A&E”),
 *   'lekarz' — skontaktuj się z lekarzem jeszcze dziś (POZ, teleporada, nocna i świąteczna opieka),
 *   'kryzys' — myśli samobójcze: numery wsparcia i 112.
 */

export const WERSJA_LISTY = '1.2.0 (24.11.2026)';
export const ZWERYFIKOWANO = true;

/** @typedef {'glowa'|'kregoslup'|'intymne'|'opryszczka'|'infekcja'|'ogolne'} Obszar */
/**
 * @typedef {{ id: string, etykieta: string, obszar: Obszar, typ: 'pilne'|'lekarz'|'kryzys', wEpizodzie: boolean, slowa: string[] }} Flaga
 */

/** @type {readonly Flaga[]} */
export const FLAGI = Object.freeze([
  // ---------- Ból głowy ----------
  { id: 'alarm_najsilniejszy', obszar: 'glowa', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Nagły, bardzo silny ból, „jak uderzenie pioruna”, najsilniejszy w życiu',
    slowa: ['najsilniejszy bol w zyciu', 'najgorszy bol w zyciu', 'najsilniejszy w zyciu', 'jak uderzenie piorunem', 'jak uderzenie pioruna', 'piorunujacy bol'] },
  { id: 'alarm_neurologiczne', obszar: 'glowa', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Drętwienie lub osłabienie części ciała albo twarzy, kłopot z mówieniem, chodzeniem lub równowagą',
    slowa: ['zaburzenia mowy', 'belkot', 'niewyrazna mowa', 'niedowlad', 'opadajacy kacik', 'opada kacik', 'opadniety kacik', 'dretwienie polowy', 'dretwieje polowa', 'dretwienie twarzy', 'nie moge mowic', 'trace rownowage'] },
  { id: 'alarm_widzenie_przytomnosc', obszar: 'glowa', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Drgawki, silna senność lub splątanie, utrata przytomności albo wzroku',
    slowa: ['utrata przytomnosci', 'stracilem przytomnosc', 'stracilam przytomnosc', 'zemdlal', 'drgaw', 'utrata wzroku', 'stracilem wzrok', 'stracilam wzrok', 'splatan'] },
  { id: 'alarm_goraczka_kark', obszar: 'glowa', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Wysoka gorączka ze sztywnym karkiem lub nadwrażliwością na światło, albo wysypka, która nie blednie pod naciskiem szklanki',
    slowa: ['sztywnosc karku', 'sztywny kark', 'nie moge zgiac szyi', 'wysypka nie blednie', 'wybroczyny'] },
  { id: 'alarm_uraz', obszar: 'glowa', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Uraz głowy w ostatnich 3 miesiącach (np. upadek, wypadek)',
    slowa: ['uraz glowy', 'uderzenie w glowe', 'uderzylem sie w glowe', 'uderzylam sie w glowe', 'upadek na glowe'] },
  { id: 'glowa_wzrok', obszar: 'glowa', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Problemy ze wzrokiem lub bolące, zaczerwienione oko',
    slowa: ['podwojne widzenie', 'mroczki', 'ból oka', 'bol oka', 'zamglone widzenie'] },
  { id: 'glowa_kaszel', obszar: 'glowa', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Ból wywołany lub nasilany kaszlem, kichaniem, schylaniem się albo wysiłkiem',
    slowa: ['przy kaszlu', 'przy kichaniu', 'przy schylaniu', 'przy wysilku'] },
  { id: 'glowa_wymioty', obszar: 'glowa', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Wymioty przy bólu głowy',
    slowa: ['wymiotowal', 'wymioty'] },
  { id: 'glowa_szczeka', obszar: 'glowa', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Ból szczęki przy jedzeniu albo tkliwa, bolesna skóra głowy',
    slowa: ['bol szczeki przy jedzeniu', 'tkliwa skora glowy', 'boli skora glowy'] },

  // ---------- Ból kręgosłupa ----------
  { id: 'kreg_nogi', obszar: 'kregoslup', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Ból, mrowienie, osłabienie lub drętwienie obu nóg',
    slowa: ['obie nogi', 'obu nog', 'obydwie nogi'] },
  { id: 'kreg_krocze', obszar: 'kregoslup', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Utrata czucia wokół narządów płciowych, odbytu lub między udami',
    slowa: ['bez czucia w kroczu', 'dretwienie krocza', 'dretwieje krocze', 'brak czucia w kroczu', 'dretwienie posladkow'] },
  { id: 'kreg_pecherz', obszar: 'kregoslup', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Nowe kłopoty z oddawaniem moczu lub stolca, w tym ich nietrzymanie',
    slowa: ['nie moge oddac moczu', 'nietrzymanie moczu', 'nietrzymanie stolca', 'zatrzymanie moczu', 'popuscil'] },
  { id: 'kreg_seks', obszar: 'kregoslup', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Zmiana czucia w okolicy intymnej podczas seksu, nagłe kłopoty z erekcją lub orgazmem',
    slowa: [] },
  { id: 'kreg_klatka', obszar: 'kregoslup', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Ból w klatce piersiowej',
    slowa: ['bol w klatce', 'bol klatki', 'kluje w klatce', 'ucisk w klatce'] },
  { id: 'kreg_wypadek', obszar: 'kregoslup', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Ból po poważnym wypadku lub upadku',
    slowa: ['wypadek samochodowy', 'po wypadku', 'upadek z wysokosci'] },
  { id: 'kreg_goraczka', obszar: 'kregoslup', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Gorączka, dreszcze albo ogólnie bardzo złe samopoczucie',
    slowa: [] },
  { id: 'kreg_nagly', obszar: 'kregoslup', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Silny ból, który zaczął się nagle albo szybko się nasila',
    slowa: [] },

  // ---------- Okolice intymne i podbrzusze ----------
  { id: 'intym_jadro', obszar: 'intymne', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Nagły, silny ból jądra (także gdy towarzyszą mu nudności, wymioty lub ból brzucha)',
    slowa: ['bol jadra', 'boli jadro', 'skret jadra'] },
  { id: 'intym_silny', obszar: 'intymne', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Silny lub narastający ból podbrzusza, bolesny przy ruchu albo dotyku',
    slowa: [] },
  { id: 'intym_omdlenie', obszar: 'intymne', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Omdlenie, silne zawroty głowy, uczucie bliskie utraty przytomności',
    slowa: ['zemdlalam', 'omdlenie', 'prawie zemdlalam', 'prawie zemdlalem'] },
  { id: 'intym_bark', obszar: 'intymne', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Ból w szczycie barku (tam, gdzie bark przechodzi w ramię)',
    slowa: ['bol barku', 'bol w barku', 'bol w szczycie barku'] },
  { id: 'intym_krwawienie', obszar: 'intymne', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Obfite krwawienie z pochwy',
    slowa: ['obfite krwawienie', 'silne krwawienie', 'krwotok'] },
  { id: 'intym_oddech', obszar: 'intymne', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Trudności z oddychaniem albo nagłe splątanie',
    slowa: ['nie moge oddychac', 'brakuje mi tchu', 'dusze sie', 'dusi mnie'] },
  { id: 'intym_mocz', obszar: 'intymne', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Ból lub pieczenie przy oddawaniu moczu, trudność z oddaniem moczu lub stolca, krew w moczu lub stolcu',
    slowa: ['krew w moczu', 'krew w stolcu', 'pieczenie przy sikaniu', 'pieczenie przy oddawaniu moczu'] },
  { id: 'intym_uplawy', obszar: 'intymne', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Nietypowe upławy, wydzielina albo krwawienie z pochwy',
    slowa: ['uplawy', 'nietypowa wydzielina'] },
  { id: 'intym_goraczka', obszar: 'intymne', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Wysoka gorączka lub dreszcze, wymioty albo biegunka',
    slowa: [] },
  { id: 'intym_ciaza', obszar: 'intymne', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Ciąża lub możliwa ciąża (np. spóźniony okres)',
    slowa: ['spozniony okres', 'moge byc w ciazy', 'jestem w ciazy', 'pozytywny test'] },

  // ---------- Opryszczka (NHS: cold-sores, genital-herpes) ----------
  { id: 'hsv_oko', obszar: 'opryszczka', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Zmiana blisko oka albo ból lub zaczerwienienie oka',
    slowa: ['opryszczka przy oku', 'opryszczka na powiece', 'opryszczka oka'] },
  { id: 'hsv_odpornosc', obszar: 'opryszczka', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Osłabiona odporność (np. chemioterapia, leki immunosupresyjne) albo ciąża',
    slowa: [] },
  { id: 'hsv_rozlegla', obszar: 'opryszczka', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Duże, bardzo bolesne lub szerzące się zmiany, wysoka gorączka',
    slowa: [] },
  { id: 'hsv_pierwszy_plciowe', obszar: 'opryszczka', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Pierwszy raz zmiany na narządach płciowych',
    slowa: [] },

  // ---------- Infekcja: przeziębienie, grypa, ból gardła (NHS: flu, common-cold, sore-throat, sepsis) ----------
  { id: 'inf_oddech', obszar: 'infekcja', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Duża trudność z oddychaniem: łapanie powietrza, duszenie się, nie da się powiedzieć całego zdania',
    slowa: ['nie moge zlapac tchu', 'nie moge mowic pelnymi zdaniami', 'lapie powietrze'] },
  { id: 'inf_klatka', obszar: 'infekcja', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Nagły ból w klatce piersiowej',
    slowa: [] },
  { id: 'inf_krew', obszar: 'infekcja', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Odkrztuszanie krwi',
    slowa: ['kaszle krwia', 'kaszel z krwia', 'krew w plwocinie', 'odkrztuszam krew', 'pluje krwia'] },
  { id: 'inf_przelykanie', obszar: 'infekcja', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Nie da się przełknąć (nawet śliny), ślinienie się albo świszczący, piskliwy dźwięk przy wdechu',
    slowa: ['nie moge przelknac', 'nie moge przelykac', 'nie przelkne sliny', 'slinie sie'] },
  { id: 'inf_sepsa', obszar: 'infekcja', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Splątanie, bełkotliwa mowa, bardzo szybki oddech albo sina, blada lub marmurkowa skóra, usta czy język',
    slowa: ['sine usta', 'marmurkowa skora', 'sinieje'] },
  { id: 'inf_wysypka', obszar: 'infekcja', typ: 'pilne', wEpizodzie: true,
    etykieta: 'Wysypka, która nie blednie pod naciskiem szklanki',
    slowa: [] },
  { id: 'inf_dusznosc', obszar: 'infekcja', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Duszność, zadyszka przy niewielkim wysiłku albo ból w klatce przy kaszlu',
    slowa: ['dusznosc', 'zadyszka'] },
  { id: 'inf_bardzo_zle', obszar: 'infekcja', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Bardzo złe samopoczucie albo bardzo wysoka gorączka, która nie spada po lekach',
    slowa: ['goraczka nie spada', 'nie spada goraczka'] },
  { id: 'inf_odwodnienie', obszar: 'infekcja', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Oznaki odwodnienia: mało moczu, ciemny mocz o silnym zapachu, nie da się pić',
    slowa: [] },
  { id: 'inf_ryzyko', obszar: 'infekcja', typ: 'lekarz', wEpizodzie: true,
    etykieta: 'Wiek 65+, ciąża lub niedawny poród, choroba przewlekła (np. cukrzyca, serca, płuc, nerek) albo osłabiona odporność',
    slowa: [] },
  // Wyliczane z czasu trwania (nie do zaznaczenia w formularzu).
  { id: 'inf_goraczka_3dni', obszar: 'infekcja', typ: 'lekarz', wEpizodzie: false,
    etykieta: 'Gorączka (38°C lub więcej) trwa dłużej niż 3 dni',
    slowa: [] },
  { id: 'inf_7dni', obszar: 'infekcja', typ: 'lekarz', wEpizodzie: false,
    etykieta: 'Objawy infekcji trwają ponad tydzień bez poprawy',
    slowa: [] },
  { id: 'inf_kaszel_3tyg', obszar: 'infekcja', typ: 'lekarz', wEpizodzie: false,
    etykieta: 'Kaszel trwa dłużej niż 3 tygodnie',
    slowa: [] },

  // ---------- Ogólne ----------
  { id: 'kryzys_samobojcze', obszar: 'ogolne', typ: 'kryzys', wEpizodzie: false,
    etykieta: 'Myśli samobójcze',
    slowa: ['samoboj', 'zabic sie', 'odebrac sobie zycie', 'nie chce zyc', 'nie chce juz zyc', 'skonczyc ze soba', 'chce umrzec'] },
]);

export const FLAGA_NASILENIE_10 = Object.freeze({
  id: 'nasilenie_10', etykieta: 'Ból o nasileniu 10/10', obszar: /** @type {Obszar} */ ('ogolne'), typ: /** @type {const} */ ('pilne'),
});

/** Które obszary flag pokazać w formularzu dolegliwości danego rodzaju. */
export const OBSZARY_RODZAJU = Object.freeze({
  headache: ['glowa'], migraine: ['glowa'], back: ['kregoslup'], pelvic: ['intymne'], herpes: ['opryszczka'], infection: ['infekcja'], other: ['glowa', 'kregoslup', 'intymne'],
});

export const NAZWY_OBSZAROW = Object.freeze({ glowa: 'Ból głowy', kregoslup: 'Ból kręgosłupa', intymne: 'Okolice intymne i podbrzusze', opryszczka: 'Opryszczka', infekcja: 'Przeziębienie, grypa, ból gardła', ogolne: 'Ogólne' });

/** Próg gorączki u dorosłych wg NHS (fever-in-adults): 38°C lub więcej. */
export const PROG_GORACZKI = 38;
const DOBA = 24 * 3600000;

/**
 * Flagi wynikające z czasu trwania infekcji, która jeszcze trwa (NHS: common-cold — gorączka > 3 dni,
 * kaszel > 3 tygodnie; flu — brak poprawy po 7 dniach).
 * @param {import('./obliczenia.js').Epizod} e @param {Date} teraz
 */
function flagiCzasuTrwania(e, teraz) {
  if (e.kind !== 'infection' || e.ended_at) return [];
  const doby = (teraz.getTime() - new Date(e.started_at).getTime()) / DOBA;
  const objawy = e.features ?? [];
  const goraczka = objawy.includes('goraczka') || (e.temperature != null && e.temperature >= PROG_GORACZKI);
  return [
    goraczka && doby > 3 ? 'inf_goraczka_3dni' : null,
    doby > 7 ? 'inf_7dni' : null,
    objawy.includes('kaszel') && doby > 21 ? 'inf_kaszel_3tyg' : null,
  ].filter((x) => x != null);
}

/** Numery pomocy (sprawdzone na gov.pl, 23.11.2026). */
export const NUMERY = Object.freeze({
  alarmowy: { numer: '112', opis: 'Numer alarmowy' },
  centrumWsparcia: { numer: '800 70 2222', opis: 'Centrum Wsparcia dla osób dorosłych w kryzysie psychicznym, bezpłatnie, całą dobę' },
  telefonZaufania: { numer: '116 123', opis: 'Telefon zaufania dla dorosłych w kryzysie emocjonalnym, bezpłatnie' },
  dzieciMlodziez: { numer: '116 111', opis: 'Telefon zaufania dla dzieci i młodzieży, bezpłatnie, całą dobę' },
});

/** Małe litery, bez polskich znaków, pojedyncze spacje. @param {string} t */
export function normalizuj(t) {
  return t
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Identyfikatory flag wykrytych w tekście (słowa kluczowe). @param {string|null|undefined} tekst */
export function sprawdzTekst(tekst) {
  if (!tekst) return [];
  const t = ` ${normalizuj(tekst)} `;
  return FLAGI.filter((f) => f.slowa.some((s) => t.includes(normalizuj(s)))).map((f) => f.id);
}

/** @param {import('./obliczenia.js').Epizod} e @param {Date} [teraz] */
export function sprawdzEpizod(e, teraz = new Date()) {
  const ids = new Set(sprawdzTekst(e.note));
  for (const f of e.features ?? []) if (FLAGI.some((fl) => fl.id === f)) ids.add(f);
  // 10/10 przy infekcji oznacza „bardzo źle się czuję”, nie najsilniejszy ból — to obejmuje flaga inf_bardzo_zle.
  if (e.intensity === 10 && e.kind !== 'infection') ids.add(FLAGA_NASILENIE_10.id);
  for (const id of flagiCzasuTrwania(e, teraz)) ids.add(id);
  return [...ids];
}

/** @param {import('./obliczenia.js').Wpis} w */
export const sprawdzWpis = (w) => sprawdzTekst(w.note);

/**
 * Flagi aktywne w oknie czasowym (domyślnie 48 h) — do baneru.
 * @param {{ wpisy: import('./obliczenia.js').Wpis[], epizody: import('./obliczenia.js').Epizod[], teraz?: Date, oknoGodzin?: number }} p
 */
export function aktywneFlagi({ wpisy, epizody, teraz = new Date(), oknoGodzin = 48 }) {
  const granica = teraz.getTime() - oknoGodzin * 3600000;
  const ids = new Set();
  const granicaTrwajacych = teraz.getTime() - 45 * DOBA; // zapomniane, niezamknięte epizody sprzed 1,5 miesiąca pomijamy
  for (const e of epizody) {
    const t = new Date(e.started_at).getTime();
    const wOknie = t >= granica && t <= teraz.getTime() + 3600000;
    // Infekcja trwa dniami, więc trwająca liczy się także po 48 h (inne niezamknięte epizody to zwykle zapomniany „koniec”).
    const trwa = e.kind === 'infection' && !e.ended_at && t >= granicaTrwajacych && t <= teraz.getTime();
    if (wOknie || trwa) sprawdzEpizod(e, teraz).forEach((id) => ids.add(id));
  }
  for (const w of wpisy) {
    const [y, m, d] = w.entry_date.split('-').map(Number);
    const koniecDnia = new Date(y, m - 1, d, 23, 59, 59).getTime();
    if (koniecDnia >= granica && new Date(y, m - 1, d).getTime() <= teraz.getTime()) {
      sprawdzWpis(w).forEach((id) => ids.add(id));
    }
  }
  const wszystkie = [...FLAGI, FLAGA_NASILENIE_10];
  const lista = wszystkie.filter((f) => ids.has(f.id));
  return {
    flagi: lista,
    pilne: lista.some((f) => f.typ === 'pilne'),
    lekarz: lista.some((f) => f.typ === 'lekarz'),
    kryzys: lista.some((f) => f.typ === 'kryzys'),
  };
}
