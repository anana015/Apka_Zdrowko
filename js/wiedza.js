// @ts-check
/**
 * Ekran „Kiedy szukać pomocy” (#wiedza): informacje ogólne o bólu głowy, kręgosłupa i okolic intymnych.
 * Treść opracowana własnymi słowami na podstawie NHS i NICE (sprawdzone 24.11.2026). Aplikacja nie stawia
 * rozpoznań: opisy typów bólu służą do rozmowy z lekarzem, nie do samodzielnej diagnozy.
 * Listy objawów alarmowych pochodzą z js/flagi.js (jedno źródło prawdy dla baneru i formularza).
 */
import { $, h } from './utils.js';
import { FLAGI, NUMERY, WERSJA_LISTY } from './flagi.js';

export const tytul = 'Kiedy szukać pomocy';

/** @typedef {{ tytul: string, punkty: string[] }} Akapit */
/** @type {{ id: 'glowa'|'kregoslup'|'intymne', tytul: string, wstep: string, sekcje: Akapit[], zrodla: { nazwa: string, url: string }[] }[]} */
const TEMATY = [
  {
    id: 'glowa',
    tytul: 'Ból głowy',
    wstep: 'Większość bólów głowy nie jest groźna. Najczęstsze są bóle napięciowe i migrena. Rzadko ból głowy jest objawem innej choroby i wtedy zwykle towarzyszą mu objawy alarmowe wymienione niżej.',
    sekcje: [
      { tytul: 'Częste rodzaje (do rozmowy z lekarzem, nie do samodzielnej diagnozy)', punkty: [
        'Napięciowy: uciskający, „jak obręcz”, zwykle po obu stronach, łagodny lub umiarkowany, nie nasila się przy zwykłym ruchu.',
        'Migrena: często pulsujący, umiarkowany lub silny, nasila się przy wysiłku, z nudnościami lub nadwrażliwością na światło i dźwięk; trwa zwykle od 4 do 72 godzin. U części osób poprzedza ją aura, np. migotanie przed oczami.',
        'Klasterowy: bardzo silny, zawsze po jednej stronie, wokół oka, trwa od kwadransa do około 3 godzin, z łzawieniem lub zaczerwienieniem oka i zatkanym nosem po tej samej stronie.',
        'Ból z nadużywania leków przeciwbólowych: częste przyjmowanie leków na ból głowy może samo podtrzymywać bóle. Jeśli bierzesz je w wiele dni w miesiącu, porozmawiaj o tym z lekarzem.',
      ] },
      { tytul: 'Co często sprzyja bólom głowy', punkty: [
        'Przeziębienie lub grypa, stres, alkohol, zła postawa, wada wzroku.',
        'Pomijanie posiłków, za mało płynów, zmiany hormonalne (okres, menopauza).',
      ] },
      { tytul: 'Umów wizytę u lekarza, gdy', punkty: [
        'bóle głowy powtarzają się regularnie,',
        'domowe sposoby nie pomagają albo ból się nasila,',
        'zmienił się dotychczasowy charakter Twoich bólów głowy.',
      ] },
    ],
    zrodla: [
      { nazwa: 'NHS: Headaches', url: 'https://www.nhs.uk/conditions/headaches/' },
      { nazwa: 'NICE CG150: Headaches in over 12s', url: 'https://www.nice.org.uk/guidance/cg150' },
    ],
  },
  {
    id: 'kregoslup',
    tytul: 'Ból kręgosłupa',
    wstep: 'Ból pleców jest bardzo częsty i zwykle mija sam w ciągu kilku tygodni. Groźne przyczyny są rzadkie, ale część objawów wymaga natychmiastowej pomocy, bo opóźnienie może spowodować trwałe uszkodzenie nerwów.',
    sekcje: [
      { tytul: 'Co zwykle pomaga', punkty: [
        'Pozostanie w ruchu i zwykłe codzienne czynności; długie leżenie w łóżku nie jest zalecane.',
        'Ciepło przy sztywności, chłód przy bólu i obrzęku (owinięte w ręcznik).',
        'Łagodne ćwiczenia i rozciąganie, przerwane, jeśli ból się nasila; spacer, pływanie, joga, pilates.',
        'W sprawie leków przeciwbólowych zapytaj farmaceutę lub lekarza.',
      ] },
      { tytul: 'Umów wizytę u lekarza, gdy', punkty: [
        'ból nie mija po kilku tygodniach albo utrudnia codzienne czynności,',
        'chudniesz bez starania się,',
        'na plecach pojawił się guzek lub obrzęk albo zmienił się kształt pleców,',
        'ból nie słabnie w spoczynku lub jest gorszy w nocy,',
        'ból nasila się przy kichaniu, kaszlu lub oddawaniu stolca,',
        'boli między łopatkami, a nie w dole pleców.',
      ] },
    ],
    zrodla: [
      { nazwa: 'NHS: Back pain', url: 'https://www.nhs.uk/conditions/back-pain/' },
      { nazwa: 'NICE NG59: Low back pain and sciatica', url: 'https://www.nice.org.uk/guidance/ng59' },
    ],
  },
  {
    id: 'intymne',
    tytul: 'Ból w okolicach intymnych i podbrzusza',
    wstep: 'Taki ból ma wiele możliwych przyczyn, m.in. zaparcia, infekcje dróg moczowych, infekcje przenoszone drogą płciową, a u kobiet także dolegliwości związane z cyklem. Nie stawiaj sobie rozpoznania samodzielnie: objawy różnych przyczyn są do siebie podobne. Wstyd nie powinien opóźniać wizyty, lekarze widzą takie problemy codziennie.',
    sekcje: [
      { tytul: 'Ważne', punkty: [
        'Nagły, silny ból jądra może oznaczać skręt jądra. To stan nagły: liczą się godziny. Nie czekaj, aż minie; ustąpienie bólu nie oznacza, że problem zniknął.',
        'Ból podbrzusza, krwawienie lub plamienie i ból w szczycie barku u osoby, która może być w ciąży, mogą oznaczać ciążę pozamaciczną. Skontaktuj się z lekarzem od razu, nawet przy ujemnym teście.',
      ] },
      { tytul: 'Umów wizytę u lekarza, gdy', punkty: [
        'ból wraca albo nie mija,',
        'masz nawracające wzdęcia, szybko odczuwasz pełność albo brakuje Ci apetytu,',
        'chudniesz bez starania się,',
        'masz zaparcia lub biegunkę, które nie mijają.',
      ] },
    ],
    zrodla: [
      { nazwa: 'NHS: Pelvic pain', url: 'https://www.nhs.uk/conditions/pelvic-pain/' },
      { nazwa: 'NHS: Testicle pain', url: 'https://www.nhs.uk/conditions/testicle-pain/' },
      { nazwa: 'NHS: Ectopic pregnancy', url: 'https://www.nhs.uk/conditions/ectopic-pregnancy/' },
    ],
  },
];

/** @param {'glowa'|'kregoslup'|'intymne'} obszar @param {'pilne'|'lekarz'} typ */
const objawy = (obszar, typ) => FLAGI.filter((f) => f.obszar === obszar && f.typ === typ).map((f) => f.etykieta);

export function init() {
  const tresc = $('#wiedza-tresc');
  tresc.replaceChildren(
    h('p', { text: 'Informacje ogólne do rozmowy z lekarzem. Aplikacja nie stawia rozpoznań i nie zastępuje porady lekarskiej. Jeśli coś Cię niepokoi, skontaktuj się z lekarzem, nawet gdy Twoich objawów nie ma na liście.' }),
    h('nav', { class: 'wiedza-spis', 'aria-label': 'Tematy' },
      TEMATY.map((t) => h('a', { class: 'btn btn-drugorzedny btn-maly', href: `#wiedza?temat=${t.id}`, text: t.tytul }))),
    ...TEMATY.map((t) => h('section', { class: 'sekcja wiedza-temat', id: `wiedza-${t.id}`, 'aria-labelledby': `wiedza-${t.id}-tytul` },
      h('h2', { id: `wiedza-${t.id}-tytul`, text: t.tytul }),
      h('p', { text: t.wstep }),
      h('div', { class: 'wiedza-pilne' },
        h('h3', { text: 'Dzwoń pod 112 albo jedź na SOR, jeśli występuje:' }),
        h('ul', {}, objawy(t.id, 'pilne').map((o) => h('li', { text: o }))),
        h('p', { class: 'drobny', text: 'Nie prowadź samochodu samodzielnie. Poproś kogoś o podwiezienie albo wezwij karetkę. Zabierz listę przyjmowanych leków (jest w zakładce Leki).' })),
      h('div', { class: 'wiedza-lekarz' },
        h('h3', { text: 'Skontaktuj się z lekarzem jeszcze dziś, jeśli występuje:' }),
        h('ul', {}, objawy(t.id, 'lekarz').map((o) => h('li', { text: o }))),
        h('p', { class: 'drobny', text: 'W dzień: przychodnia POZ (także teleporada). Wieczorem, w nocy i w święta: nocna i świąteczna opieka zdrowotna.' })),
      ...t.sekcje.map((s) => h('div', {}, h('h3', { text: s.tytul }), h('ul', { class: 'punkty' }, s.punkty.map((p) => h('li', { text: p }))))),
      h('p', { class: 'drobny' }, 'Źródła: ', ...t.zrodla.flatMap((z, i) => [i ? ', ' : '', h('a', { href: z.url, target: '_blank', rel: 'noopener noreferrer', text: z.nazwa })])))),
    h('section', { class: 'sekcja', 'aria-labelledby': 'wiedza-kryzys-tytul' },
      h('h2', { id: 'wiedza-kryzys-tytul', text: 'Gdy jest bardzo ciężko' }),
      h('p', { text: `Jeśli masz myśli o odebraniu sobie życia, porozmawiaj z kimś teraz: ${NUMERY.centrumWsparcia.numer} (${NUMERY.centrumWsparcia.opis}), ${NUMERY.telefonZaufania.numer} (${NUMERY.telefonZaufania.opis}). W zagrożeniu życia dzwoń pod 112.` })),
    h('section', { class: 'sekcja', 'aria-labelledby': 'wiedza-notuj-tytul' },
      h('h2', { id: 'wiedza-notuj-tytul', text: 'Co zapisywać przed wizytą' }),
      h('ul', { class: 'punkty' },
        h('li', { text: 'Kiedy ból się zaczyna i ile trwa, gdzie boli, jak silnie (0–10).' }),
        h('li', { text: 'Objawy towarzyszące i co mogło go wywołać (znaczniki dnia, czynniki).' }),
        h('li', { text: 'Jakie leki przyjmujesz i czy pomogły (ulga po 2 godzinach).' }),
        h('li', { text: 'Raport dla lekarza z zakładki Wykresy zbiera to w jednym miejscu.' }))),
    h('p', { class: 'drobny', text: `Wersja listy objawów alarmowych: ${WERSJA_LISTY}. Przegląd co najmniej raz w roku.` }),
  );
}

/** @param {URLSearchParams} parametry */
export function render(parametry) {
  const temat = parametry.get('temat');
  if (temat) requestAnimationFrame(() => document.getElementById(`wiedza-${temat}`)?.scrollIntoView({ block: 'start' }));
}
