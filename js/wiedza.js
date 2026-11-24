// @ts-check
/**
 * Ekran „Wiedza” (#wiedza): najczęstsze przyczyny dolegliwości, co zwykle pomaga, kiedy iść do lekarza,
 * ściąga leków. Treść własnymi słowami na podstawie NHS, NICE i polskich ulotek (sprawdzone 24.11.2026).
 * Ton: podpowiedzi dla świadomego użytkownika, bez stawiania rozpoznań.
 * Listy objawów „nie czekaj” pochodzą z js/flagi.js (jedno źródło dla baneru i formularza).
 */
import { $, h } from './utils.js';
import { FLAGI, NUMERY, WERSJA_LISTY } from './flagi.js';
import { LEKI, RPL_URL, lek } from './apteczka.js';

export const tytul = 'Wiedza';

/** Temat wiedzy pasujący do rodzaju dolegliwości (link z formularza). */
export const TEMAT_RODZAJU = Object.freeze({ headache: 'glowa', migraine: 'glowa', back: 'kregoslup', pelvic: 'intymne', herpes: 'opryszczka' });

/**
 * @typedef {{ nazwa: string, cechy: string, pomaga: string[], leki?: string[], lekarz: string }} Mozliwosc
 * @typedef {{ id: 'glowa'|'kregoslup'|'intymne'|'opryszczka', tytul: string, wstep: string, mozliwe: Mozliwosc[], zrodla: { nazwa: string, url: string }[] }} Temat
 */

/** @type {Temat[]} */
const TEMATY = [
  {
    id: 'glowa',
    tytul: 'Ból głowy',
    wstep: 'Zdecydowana większość bólów głowy to bóle napięciowe i migrena. Dziennik pomaga odróżnić jedne od drugich i wyłapać, co je wywołuje.',
    mozliwe: [
      {
        nazwa: 'Napięciowy ból głowy',
        cechy: 'Ucisk lub „obręcz” po obu stronach głowy, czasem z bólem karku. Trwa od pół godziny do kilku dni; da się normalnie funkcjonować. Sprzyjają mu stres, słaby sen i kofeina.',
        pomaga: [
          'Regularny sen, ruch, joga, masaż karku.',
          'Ciepły lub zimny okład na kark; niska, twarda poduszka.',
          'Mniej kofeiny i regularne posiłki oraz picie.',
        ],
        leki: ['paracetamol', 'ibuprofen', 'aspiryna'],
        lekarz: 'Gdy bóle są kilka razy w tygodniu, są silne albo leki i odpoczynek nie pomagają. Lekarz może zaproponować leczenie zapobiegawcze.',
      },
      {
        nazwa: 'Migrena',
        cechy: 'Często pulsujący ból po jednej stronie, umiarkowany lub silny, nasila się przy ruchu. Zwykle z nudnościami albo nadwrażliwością na światło i dźwięk; trwa od 4 do 72 godzin. U części osób poprzedza ją aura, np. migotanie przed oczami.',
        pomaga: [
          'Lek przeciwbólowy jak najwcześniej, na początku napadu.',
          'Ciemny, cichy pokój, sen, zimny okład na czoło, picie wody.',
          'Szukanie wyzwalaczy w dzienniku: sen, alkohol, pominięte posiłki, cykl, stres.',
        ],
        leki: ['ibuprofen', 'naproksen', 'aspiryna', 'paracetamol', 'sumatryptan'],
        lekarz: 'Gdy napady są częste albo zwykłe leki nie wystarczają: są leki na receptę na napad (tryptany) i leczenie zapobiegawcze.',
      },
      {
        nazwa: 'Klasterowy ból głowy',
        cechy: 'Bardzo silny ból zawsze po jednej stronie, wokół oka, przez 15 minut do 3 godzin, często o podobnej porze. Po tej samej stronie łzawi oko, zatyka się nos. Napady przychodzą seriami przez tygodnie.',
        pomaga: [
          'Zwykłe tabletki przeciwbólowe działają za wolno, by pomóc.',
          'Pomaga leczenie od lekarza (np. tlen, tryptan w zastrzyku lub w nosie).',
        ],
        lekarz: 'Warto pójść, jeśli to brzmi znajomo: potrzebne jest rozpoznanie i recepta.',
      },
      {
        nazwa: 'Ból z nadużywania leków',
        cechy: 'Codzienne lub prawie codzienne bóle u osoby, która często bierze leki na ból głowy: zwykłe przeciwbólowe w 15 lub więcej dni w miesiącu albo tryptany w 10 lub więcej dni.',
        pomaga: [
          'Odstawienie leków (najlepiej z planem od lekarza); po kilku tygodniach bóle zwykle słabną.',
          'Zakładka Leki pokazuje, w ile dni w miesiącu przyjmujesz leki doraźne.',
        ],
        lekarz: 'Gdy podejrzewasz u siebie ten mechanizm: lekarz pomoże przejść przez odstawienie i dobrać profilaktykę.',
      },
    ],
    zrodla: [
      { nazwa: 'NHS: Headaches', url: 'https://www.nhs.uk/conditions/headaches/' },
      { nazwa: 'NHS: Tension headaches', url: 'https://www.nhs.uk/conditions/tension-headaches/' },
      { nazwa: 'NHS: Migraine', url: 'https://www.nhs.uk/conditions/migraine/' },
      { nazwa: 'NICE CG150', url: 'https://www.nice.org.uk/guidance/cg150' },
    ],
  },
  {
    id: 'kregoslup',
    tytul: 'Ból kręgosłupa',
    wstep: 'Ból pleców jest bardzo częsty i zwykle mija sam w ciągu kilku tygodni. Najlepiej pomaga ruch, nie leżenie.',
    mozliwe: [
      {
        nazwa: 'Zwykły (niespecyficzny) ból pleców',
        cechy: 'Najczęściej w dole pleców, po przeciążeniu, dźwiganiu, długim siedzeniu; zmienia się z pozycją i ruchem. Mięśnie i więzadła, bez groźnej przyczyny.',
        pomaga: [
          'Codzienna aktywność i spacery; długie leżenie opóźnia powrót do formy.',
          'Ciepło przy sztywności, chłód przy świeżym urazie.',
          'Łagodne ćwiczenia i rozciąganie, pływanie, joga, pilates.',
          'Sam paracetamol zwykle niewiele daje; lepiej działa lek przeciwzapalny lub żel.',
        ],
        leki: ['ibuprofen', 'naproksen', 'diklofenak-zel'],
        lekarz: 'Gdy po kilku tygodniach nie ma poprawy albo ból mocno utrudnia życie. Lekarz może skierować na fizjoterapię.',
      },
      {
        nazwa: 'Rwa kulszowa',
        cechy: 'Ból promieniujący z pośladka w dół nogi, czasem do stopy, z mrowieniem lub drętwieniem. Zwykle po jednej stronie; często mija w 4–6 tygodni.',
        pomaga: [
          'Ruch i ćwiczenia rozciągające, ciepły okład.',
          'Unikanie długiego siedzenia; częste krótkie przerwy.',
          'Paracetamol raczej nie pomoże; lepiej lek przeciwzapalny.',
        ],
        leki: ['ibuprofen', 'naproksen'],
        lekarz: 'Gdy ból nie mija po kilku tygodniach, nasila się albo utrudnia codzienne czynności.',
      },
      {
        nazwa: 'Ból karku i szyi',
        cechy: 'Sztywność i ból karku, często po pracy przy ekranie, w złej pozycji lub po nocy na niewygodnej poduszce. Bywa połączony z napięciowym bólem głowy.',
        pomaga: [
          'Przerwy od ekranu, ekran na wysokości oczu, ruchy głową na boki.',
          'Ciepło i delikatny masaż.',
        ],
        leki: ['ibuprofen', 'diklofenak-zel', 'paracetamol'],
        lekarz: 'Gdy ból nie mija po kilku tygodniach albo drętwieją ręce.',
      },
    ],
    zrodla: [
      { nazwa: 'NHS: Back pain', url: 'https://www.nhs.uk/conditions/back-pain/' },
      { nazwa: 'NHS: Sciatica', url: 'https://www.nhs.uk/conditions/sciatica/' },
      { nazwa: 'NICE NG59', url: 'https://www.nice.org.uk/guidance/ng59' },
    ],
  },
  {
    id: 'intymne',
    tytul: 'Okolice intymne i podbrzusze',
    wstep: 'Najczęstsze przyczyny to zapalenie pęcherza, bóle miesiączkowe, drożdżyca i jelita. Objawy bywają podobne, więc gdy coś nie pasuje do opisu albo pojawia się pierwszy raz, warto to sprawdzić.',
    mozliwe: [
      {
        nazwa: 'Zapalenie pęcherza (infekcja dróg moczowych)',
        cechy: 'Pieczenie przy oddawaniu moczu, częste i nagłe parcie, mętny mocz, ból w dole brzucha, czasem krew w moczu.',
        pomaga: [
          'Dużo płynów, odpoczynek, paracetamol na ból.',
          'Mniej kawy, alkoholu i soków owocowych, które drażnią pęcherz.',
          'Saszetki i soki żurawinowe nie pomagają, gdy infekcja już trwa.',
        ],
        leki: ['paracetamol'],
        lekarz: 'Zwykle potrzebny jest antybiotyk, więc warto umówić się na wizytę lub teleporadę. Szybciej przy gorączce, dreszczach, bólu w boku pod żebrami, w ciąży, u mężczyzn, gdy po 48 godzinach leczenia nie ma poprawy albo to już kolejna infekcja w ciągu pół roku.',
      },
      {
        nazwa: 'Bolesne miesiączki',
        cechy: 'Skurcze lub tępy ból podbrzusza przed i w czasie okresu, czasem promieniujący do pleców i ud. Zwykle do 3 dni.',
        pomaga: [
          'Termofor lub ciepła kąpiel, masaż brzucha i pleców.',
          'Lekki ruch: spacer, joga, pływanie, rower.',
          'Lek przeciwzapalny najlepiej działa przyjęty od początku bólu.',
        ],
        leki: ['ibuprofen', 'naproksen', 'paracetamol', 'drotaweryna'],
        lekarz: 'Gdy miesiączki stają się bardziej bolesne, obfite lub nieregularne, ból utrudnia normalne życie, boli przy seksie lub wypróżnianiu, albo pojawiają się krwawienia między miesiączkami. Przyczyną bywa np. endometrioza.',
      },
      {
        nazwa: 'Drożdżyca (grzybica)',
        cechy: 'U kobiet białe, grudkowate upławy (zwykle bez zapachu), świąd i pieczenie sromu. U mężczyzn zaczerwienienie i pieczenie żołędzi. To nie choroba przenoszona drogą płciową, choć seks może ją wywołać.',
        pomaga: [
          'Mycie samą wodą z emolientem zamiast mydła, dokładne osuszanie.',
          'Bawełniana, luźna bielizna; bez płynów do higieny i irygacji.',
          'Zwykle ustępuje w 7–14 dni leczenia. Partner leczy się tylko, gdy ma objawy.',
        ],
        leki: ['klotrimazol', 'flukonazol'],
        lekarz: 'Gdy to pierwszy raz, w ciąży, przy cukrzycy lub osłabionej odporności, gdy wraca częściej niż 4 razy w roku albo leczenie nie pomogło.',
      },
      {
        nazwa: 'Opryszczka narządów płciowych',
        cechy: 'Bolesne pęcherzyki lub owrzodzenia, poprzedzone mrowieniem lub swędzeniem; przy pierwszym razie często z gorączką i bólem przy oddawaniu moczu.',
        pomaga: ['Szczegóły w temacie Opryszczka niżej.'],
        lekarz: 'Przy pierwszym epizodzie: leki przeciwwirusowe działają najlepiej, gdy zacznie się je w ciągu 5 dni.',
      },
      {
        nazwa: 'Jelita i zaparcia',
        cechy: 'Ból podbrzusza ze wzdęciami, rzadkie lub twarde stolce, ulga po wypróżnieniu.',
        pomaga: [
          'Więcej błonnika (warzywa, pełne ziarno, siemię), więcej wody, codzienny ruch.',
          'Stała pora na toaletę, bez pośpiechu.',
          'Przy bólach skurczowych może pomóc lek rozkurczowy.',
        ],
        leki: ['drotaweryna'],
        lekarz: 'Gdy zmiana rytmu wypróżnień utrzymuje się kilka tygodni, pojawia się krew w stolcu albo chudniesz bez powodu.',
      },
    ],
    zrodla: [
      { nazwa: 'NHS: Cystitis', url: 'https://www.nhs.uk/conditions/cystitis/' },
      { nazwa: 'NHS: Period pain', url: 'https://www.nhs.uk/conditions/period-pain/' },
      { nazwa: 'NHS: Thrush', url: 'https://www.nhs.uk/conditions/thrush-in-men-and-women/' },
      { nazwa: 'NHS: Pelvic pain', url: 'https://www.nhs.uk/conditions/pelvic-pain/' },
    ],
  },
  {
    id: 'opryszczka',
    tytul: 'Opryszczka',
    wstep: 'Opryszczkę wywołuje wirus opryszczki pospolitej (HSV). Po pierwszym zakażeniu zostaje w organizmie i co jakiś czas się uaktywnia. Nie da się go usunąć, ale da się skrócić i złagodzić nawroty.',
    mozliwe: [
      {
        nazwa: 'Opryszczka wargowa („zimno”)',
        cechy: 'Najpierw mrowienie, swędzenie lub pieczenie wargi, po 1–2 dniach pęcherzyki, które pękają i zasychają w strupek. Zwykle goi się do 10 dni. Zaraża od pojawienia się pęcherzyków aż do pełnego zagojenia.',
        pomaga: [
          'Krem z acyklowirem od pierwszego mrowienia; plastry na opryszczkę osłaniają zmianę.',
          'Paracetamol lub ibuprofen na ból, zimny okład, picie płynów.',
          'Nie dotykaj i nie zdrapuj, myj ręce; bez całowania, seksu oralnego i wspólnych ręczników do czasu zagojenia.',
          'Częste wyzwalacze: przeziębienie i gorączka, słońce, stres, zmęczenie, miesiączka. Pomadka z filtrem SPF pomaga latem i w górach.',
          'Zapisuj nawroty w dzienniku: łatwiej wtedy zobaczyć, co je wywołuje.',
        ],
        leki: ['acyklowir-krem', 'paracetamol', 'ibuprofen'],
        lekarz: 'Gdy zmiana nie goi się po 10 dniach, jest bardzo duża lub bolesna, pojawia się blisko oka, masz osłabioną odporność albo jesteś w ciąży. Przy częstych nawrotach lekarz może przepisać tabletki.',
      },
      {
        nazwa: 'Opryszczka narządów płciowych',
        cechy: 'Bolesne pęcherzyki lub owrzodzenia na narządach płciowych, pośladkach lub udach, czasem ból przy oddawaniu moczu. Pierwszy epizod bywa najcięższy (z gorączką, bólami mięśni); nawroty są zwykle łagodniejsze i krótsze. Może przenosić się też z opryszczki wargowej przez seks oralny.',
        pomaga: [
          'Przy pierwszym epizodzie: lekarz, najlepiej w ciągu 5 dni, bo wtedy tabletki przeciwwirusowe działają najlepiej.',
          'Obmywanie słoną wodą, wazelina na zmiany, luźne ubranie, paracetamol na ból.',
          'Jeśli piecze przy oddawaniu moczu, pomaga oddawanie moczu w wannie lub pod prysznicem.',
          'Bez seksu do zagojenia; prezerwatywa zmniejsza ryzyko zakażenia, ale nie usuwa go całkiem.',
          'Przy 6 lub więcej nawrotach w roku lekarz może zaproponować codzienną tabletkę zapobiegawczą.',
        ],
        leki: ['paracetamol'],
        lekarz: 'Przy pierwszym epizodzie, częstych nawrotach i zawsze w ciąży (powiedz lekarzowi lub położnej). Badanie w poradni dermatologii i wenerologii albo u ginekologa lub urologa.',
      },
    ],
    zrodla: [
      { nazwa: 'NHS: Cold sores', url: 'https://www.nhs.uk/conditions/cold-sores/' },
      { nazwa: 'NHS: Genital herpes', url: 'https://www.nhs.uk/conditions/genital-herpes/' },
      { nazwa: 'NHS: Aciclovir', url: 'https://www.nhs.uk/medicines/aciclovir/' },
    ],
  },
];

/** @param {string} obszar @param {'pilne'|'lekarz'} typ */
const objawy = (obszar, typ) => FLAGI.filter((f) => f.obszar === obszar && f.typ === typ).map((f) => f.etykieta);

const zrodlaAkapit = (/** @type {{ nazwa: string, url: string }[]} */ zrodla) => h('p', { class: 'drobny' }, 'Źródła: ',
  ...zrodla.flatMap((z, i) => [i ? ', ' : '', h('a', { href: z.url, target: '_blank', rel: 'noopener noreferrer', text: z.nazwa })]));

/** @param {Mozliwosc} m */
function mozliwosc(m) {
  const leki = (m.leki ?? []).map(lek).filter(Boolean);
  return h('details', { class: 'wiedza-mozliwe' },
    h('summary', { text: m.nazwa }),
    h('p', { text: m.cechy }),
    h('h4', { text: 'Co może pomóc' }),
    h('ul', { class: 'punkty' }, m.pomaga.map((p) => h('li', { text: p }))),
    leki.length ? h('p', { class: 'wiedza-leki' }, 'Leki: ',
      ...leki.flatMap((l, i) => [i ? ', ' : '', h('a', { href: `#wiedza?temat=lek-${l?.id}`, text: l?.nazwa.toLowerCase() })])) : '',
    h('p', { class: 'wiedza-lekarz' }, h('strong', { text: 'Do lekarza: ' }), m.lekarz));
}

/** @param {Temat} t */
function nieCzekaj(t) {
  const pilne = objawy(t.id, 'pilne');
  const lekarz = objawy(t.id, 'lekarz');
  if (!pilne.length && !lekarz.length) return '';
  return h('details', { class: 'wiedza-nie-czekaj' },
    h('summary', { text: 'Kiedy nie czekać' }),
    pilne.length ? h('div', {}, h('h4', { text: 'Od razu 112 lub SOR' }), h('ul', {}, pilne.map((o) => h('li', { text: o })))) : '',
    lekarz.length ? h('div', {}, h('h4', { text: 'Lekarz jeszcze dziś' }), h('ul', {}, lekarz.map((o) => h('li', { text: o })))) : '',
    h('p', { class: 'drobny', text: 'W dzień: przychodnia POZ, także teleporada. Wieczorem, w nocy i w święta: nocna i świąteczna opieka zdrowotna.' }));
}

/** @param {import('./apteczka.js').Lek} l */
const kartaLeku = (l) => h('details', { class: 'wiedza-mozliwe', id: `wiedza-lek-${l.id}` },
  h('summary', {}, l.nazwa, l.recepta ? h('span', { class: 'odznaka', text: 'na receptę' }) : ''),
  h('p', { class: 'drobny', text: l.przyklady }),
  h('p', {}, h('strong', { text: 'Na co: ' }), l.naCo),
  h('p', {}, h('strong', { text: 'Typowa dawka u dorosłych: ' }), l.dawka),
  h('ul', { class: 'punkty' }, l.uwagi.map((u) => h('li', { text: u }))),
  h('p', { class: 'drobny' }, 'Źródło: ', h('a', { href: l.zrodlo.url, target: '_blank', rel: 'noopener noreferrer', text: l.zrodlo.nazwa })));

export function init() {
  $('#wiedza-tresc').replaceChildren(
    h('p', { text: 'Najczęstsze przyczyny dolegliwości i to, co zwykle pomaga. To podpowiedzi, nie rozpoznanie: jeśli objawy nie pasują do opisu albo nie mijają, porozmawiaj z lekarzem lub farmaceutą.' }),
    h('nav', { class: 'wiedza-spis', 'aria-label': 'Tematy' },
      [...TEMATY.map((t) => ({ id: t.id, tytul: t.tytul })), { id: 'leki', tytul: 'Leki' }]
        .map((t) => h('a', { class: 'btn btn-drugorzedny btn-maly', href: `#wiedza?temat=${t.id}`, text: t.tytul }))),
    ...TEMATY.map((t) => h('section', { class: 'sekcja wiedza-temat', id: `wiedza-${t.id}`, 'aria-labelledby': `wiedza-${t.id}-tytul` },
      h('h2', { id: `wiedza-${t.id}-tytul`, text: t.tytul }),
      h('p', { text: t.wstep }),
      h('h3', { text: 'Co to może być' }),
      ...t.mozliwe.map(mozliwosc),
      nieCzekaj(t),
      zrodlaAkapit(t.zrodla))),
    h('section', { class: 'sekcja wiedza-temat', id: 'wiedza-leki', 'aria-labelledby': 'wiedza-leki-tytul' },
      h('h2', { id: 'wiedza-leki-tytul', text: 'Popularne leki' }),
      h('p', { text: 'Skrót najważniejszych informacji z ulotek. Dawki dotyczą dorosłych i mogą różnić się między preparatami, więc decyduje ulotka Twojego opakowania. Leków przeciwzapalnych (ibuprofen, naproksen, aspiryna, diklofenak w tabletkach) nie łącz ze sobą.' }),
      ...LEKI.map(kartaLeku),
      h('p', {}, 'Pełne ulotki wszystkich leków dopuszczonych w Polsce: ',
        h('a', { href: RPL_URL, target: '_blank', rel: 'noopener noreferrer', text: 'Rejestr Produktów Leczniczych' }), '.')),
    h('section', { class: 'sekcja', 'aria-labelledby': 'wiedza-notuj-tytul' },
      h('h2', { id: 'wiedza-notuj-tytul', text: 'Co zapisywać przed wizytą' }),
      h('ul', { class: 'punkty' },
        h('li', { text: 'Kiedy dolegliwość się zaczyna, ile trwa, gdzie i jak silnie (0–10).' }),
        h('li', { text: 'Objawy towarzyszące i co mogło ją wywołać.' }),
        h('li', { text: 'Jakie leki bierzesz i czy pomogły.' }),
        h('li', { text: 'Raport dla lekarza z zakładki Wykresy zbiera to w jednym miejscu.' }))),
    h('p', { class: 'drobny', text: `Gdy jest bardzo ciężko psychicznie: ${NUMERY.centrumWsparcia.numer} (całą dobę) lub ${NUMERY.telefonZaufania.numer}. W zagrożeniu życia: 112. Wersja listy objawów: ${WERSJA_LISTY}.` }),
  );
}

/** @param {URLSearchParams} parametry */
export function render(parametry) {
  const temat = parametry.get('temat');
  if (!temat) return;
  requestAnimationFrame(() => {
    const el = document.getElementById(`wiedza-${temat}`);
    if (el instanceof HTMLDetailsElement) el.open = true;
    el?.scrollIntoView({ block: 'start' });
  });
}
