// @ts-check
/**
 * Ściąga popularnych leków (dorośli). Treść własnymi słowami na podstawie ulotek i ChPL zarejestrowanych
 * w Polsce oraz stron NHS; sprawdzone 24.11.2026. To skrót, nie zamiennik ulotki: dawki różnią się
 * między preparatami, więc zawsze obowiązuje ulotka konkretnego opakowania.
 */

/** Publiczna wyszukiwarka Rejestru Produktów Leczniczych (ulotki i ChPL). */
export const RPL_URL = 'https://rejestrymedyczne.ezdrowie.gov.pl/rpl/search/public';

/**
 * @typedef {{
 *   id: string, nazwa: string, przyklady: string, recepta: boolean,
 *   naCo: string, dawka: string, uwagi: string[], zrodlo: { nazwa: string, url: string }
 * }} Lek
 */

/** @type {readonly Lek[]} */
export const LEKI = Object.freeze([
  {
    id: 'paracetamol', nazwa: 'Paracetamol', przyklady: 'np. Apap, Panadol, Paracetamol', recepta: false,
    naCo: 'Ból głowy, ból pleców, bóle miesiączkowe, gorączka. Pierwszy wybór w ciąży.',
    dawka: '500–1000 mg (1–2 tabletki 500 mg), co najmniej 4 godziny przerwy, maksymalnie 4 g na dobę (8 tabletek 500 mg).',
    uwagi: [
      'Sprawdzaj skład innych leków (np. na przeziębienie), bo często też zawierają paracetamol.',
      'Mniejsza dawka przy chorobach wątroby, regularnym piciu alkoholu lub masie ciała poniżej 50 kg — zapytaj farmaceutę.',
    ],
    zrodlo: { nazwa: 'NHS: Paracetamol for adults', url: 'https://www.nhs.uk/medicines/paracetamol-for-adults/' },
  },
  {
    id: 'ibuprofen', nazwa: 'Ibuprofen', przyklady: 'np. Ibuprom, Nurofen, Ibum', recepta: false,
    naCo: 'Ból głowy i migrena, ból pleców i mięśni, bóle miesiączkowe, stan zapalny.',
    dawka: '200–400 mg do 3 razy na dobę, co najmniej 4–6 godzin przerwy; bez porady lekarza maksymalnie 1200 mg na dobę. Najlepiej z jedzeniem.',
    uwagi: [
      'Unikaj przy chorobie wrzodowej, astmie nasilanej przez leki przeciwbólowe, chorobach nerek i serca oraz w ostatnich miesiącach ciąży.',
      'Nie łącz z innymi NLPZ (naproksen, aspiryna w dawce przeciwbólowej, ketoprofen).',
    ],
    zrodlo: { nazwa: 'NHS: Ibuprofen for adults', url: 'https://www.nhs.uk/medicines/ibuprofen-for-adults/' },
  },
  {
    id: 'naproksen', nazwa: 'Naproksen', przyklady: 'np. Aleve, Nalgesin Mini, Apo-Napro Fast', recepta: false,
    naCo: 'Ból działający dłużej: bóle miesiączkowe, pleców, mięśni, głowy.',
    dawka: '220 mg co 8–12 godzin; można zacząć od 440 mg. Maksymalnie 660 mg (3 tabletki) na dobę. Bez lekarza do 10 dni przy bólu.',
    uwagi: [
      'Te same przeciwwskazania co ibuprofen (to też NLPZ); nie łącz ich ze sobą.',
      'Nie w ostatnich 3 miesiącach ciąży.',
    ],
    zrodlo: { nazwa: 'Ulotka Aleve 220 mg (mp.pl)', url: 'https://www.mp.pl/pacjent/leki/lek/84381,Aleve-tabletki-powlekane' },
  },
  {
    id: 'aspiryna', nazwa: 'Kwas acetylosalicylowy', przyklady: 'np. Aspirin, Polopiryna', recepta: false,
    naCo: 'Ból głowy (w tym napięciowy), ból mięśni, gorączka.',
    dawka: 'Zwykle 300–1000 mg na dawkę, co najmniej 4 godziny przerwy, maksymalnie 4 dawki na dobę. Z jedzeniem lub po nim.',
    uwagi: [
      'Nie dla osób poniżej 16 lat (ryzyko zespołu Reye’a).',
      'Unikaj przy chorobie wrzodowej, astmie, zaburzeniach krzepnięcia, w ciąży i podczas karmienia piersią.',
    ],
    zrodlo: { nazwa: 'NHS: Aspirin for pain relief', url: 'https://www.nhs.uk/medicines/aspirin-for-pain-relief/' },
  },
  {
    id: 'metamizol', nazwa: 'Metamizol', przyklady: 'np. Pyralgina', recepta: false,
    naCo: 'Silniejszy ból (także kolkowy) i wysoka gorączka, gdy inne leki nie pomagają.',
    dawka: '500–1000 mg na dawkę, co 6–8 godzin, maksymalnie 4 razy na dobę.',
    uwagi: [
      'Rzadko może spowodować agranulocytozę (gwałtowny spadek białych krwinek). Gorączka, ból gardła lub owrzodzenia w jamie ustnej w trakcie albo krótko po leczeniu: przerwij lek i skontaktuj się z lekarzem.',
      'Nie w ciąży i podczas karmienia piersią; nie przy astmie wywoływanej lekami przeciwbólowymi.',
    ],
    zrodlo: { nazwa: 'Ulotka Pyralgina 500 mg (Polpharma)', url: 'https://polpharma.pl/wp-content/uploads/2025/04/263246_.pdf' },
  },
  {
    id: 'drotaweryna', nazwa: 'Drotaweryna', przyklady: 'np. No-Spa, No-Spa Max', recepta: false,
    naCo: 'Bóle skurczowe: miesiączkowe, kolka jelitowa, nerkowa lub żółciowa.',
    dawka: '120–240 mg na dobę w 2–3 dawkach (np. 40–80 mg 2–3 razy dziennie).',
    uwagi: [
      'Może powodować zawroty głowy; wtedy nie prowadź samochodu.',
      'W ciąży i podczas karmienia piersią tylko po rozmowie z lekarzem.',
      'Brak poprawy po 10 dniach: porozmawiaj z lekarzem.',
    ],
    zrodlo: { nazwa: 'ChPL No-Spa 40 mg (Sanofi)', url: 'https://www.sanofi.com/assets/countries/poland/docs/products/leki-bez-recepty/No-Spa-tabletki-40-mg_ChPL_04.2024.pdf' },
  },
  {
    id: 'diklofenak-zel', nazwa: 'Diklofenak w żelu', przyklady: 'np. Voltaren Max, Olfen Max, DicloMAX', recepta: false,
    naCo: 'Miejscowy ból pleców, mięśni, stawów, stłuczenia.',
    dawka: 'Żel 2%: wcierać 2 razy na dobę (rano i wieczorem); żel 1%: 3–4 razy na dobę.',
    uwagi: [
      'Nie na uszkodzoną skórę, nie pod szczelny opatrunek. Po nałożeniu umyj ręce.',
      'Brak poprawy po 7 dniach: porozmawiaj z lekarzem.',
    ],
    zrodlo: { nazwa: 'Ulotka Voltaren MAX (mp.pl)', url: 'https://www.mp.pl/pacjent/leki/lek/91340,Voltaren-MAX-zel' },
  },
  {
    id: 'sumatryptan', nazwa: 'Sumatryptan (tryptany)', przyklady: 'np. Sumamigren, ApoMigra, Imigran', recepta: true,
    naCo: 'Napad migreny, gdy zwykłe leki przeciwbólowe nie wystarczają. Nie działa zapobiegawczo.',
    dawka: 'Zwykle 50 mg (u części osób 100 mg) na początku napadu. Gdy ból wróci, kolejna dawka nie wcześniej niż po 2 godzinach; maksymalnie 300 mg na dobę.',
    uwagi: [
      'Jeśli pierwsza dawka nie pomogła, druga podczas tego samego napadu zwykle nie pomoże.',
      'Nie przy chorobie wieńcowej, po udarze lub przy nieleczonym nadciśnieniu. Ostrożnie z lekami przeciwdepresyjnymi (SSRI, SNRI) i dziurawcem.',
      'Tryptany przyjmowane w 10 lub więcej dni w miesiącu mogą podtrzymywać bóle głowy.',
    ],
    zrodlo: { nazwa: 'Ulotka Sumamigren (gdziepolek.pl)', url: 'https://www.gdziepolek.pl/produkty/75422/sumamigren-tabletki-powlekane' },
  },
  {
    id: 'acyklowir-krem', nazwa: 'Acyklowir w kremie', przyklady: 'np. Zovirax, Heviran, Virolex', recepta: false,
    naCo: 'Opryszczka wargowa.',
    dawka: 'Cienka warstwa 5 razy dziennie co około 4 godziny (bez nocy), przez 4 dni; można do 10 dni. Zacznij przy pierwszym mrowieniu.',
    uwagi: [
      'Myj ręce przed i po nałożeniu, nie dziel się tubką.',
      'Nie do oczu, ust i nosa od środka ani do pochwy. Opryszczka narządów płciowych wymaga zwykle leku doustnego od lekarza.',
      'Brak gojenia po 10 dniach: porozmawiaj z lekarzem.',
    ],
    zrodlo: { nazwa: 'NHS: Aciclovir', url: 'https://www.nhs.uk/medicines/aciclovir/' },
  },
  {
    id: 'klotrimazol', nazwa: 'Klotrimazol dopochwowo', przyklady: 'np. Clotrimazolum, Canesten', recepta: false,
    naCo: 'Drożdżyca (grzybica) pochwy u osób, które miały ją już rozpoznaną i znają objawy.',
    dawka: 'Według opakowania: zwykle tabletka dopochwowa wieczorem przez 1–6 dni (zależnie od mocy) i krem na srom.',
    uwagi: [
      'Kremy i globulki mogą uszkadzać prezerwatywy i krążki: antykoncepcja może zawieść w trakcie leczenia.',
      'Nie częściej niż 2 razy w ciągu 6 miesięcy bez porady farmaceuty lub lekarza.',
    ],
    zrodlo: { nazwa: 'NHS: Thrush', url: 'https://www.nhs.uk/conditions/thrush-in-men-and-women/' },
  },
  {
    id: 'flukonazol', nazwa: 'Flukonazol 150 mg', przyklady: 'np. Flucofast, Fluconazole', recepta: true,
    naCo: 'Drożdżyca pochwy lub żołędzi.',
    dawka: 'Jednorazowo 150 mg.',
    uwagi: [
      'Wchodzi w interakcje z wieloma lekami (m.in. przeciwzakrzepowymi i statynami) — powiedz lekarzowi, co przyjmujesz.',
      'Nie w ciąży.',
    ],
    zrodlo: { nazwa: 'Ulotka Fluconazole Polfarmex (mp.pl)', url: 'https://www.mp.pl/pacjent/leki/lek/63068,Fluconazole-Polfarmex-150-mg-tabletki' },
  },
]);

/** @param {string} id */
export const lek = (id) => LEKI.find((l) => l.id === id);
