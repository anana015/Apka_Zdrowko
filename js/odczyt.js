// @ts-check
/**
 * Odczyt wyników badań z pliku — w całości na urządzeniu, bez wysyłania pliku do zewnętrznych usług.
 * PDF z warstwą tekstu: pdf.js. Zdjęcie lub skan: Tesseract.js (OCR, język polski).
 * Biblioteki (ok. 8 MB) ładują się dopiero przy pierwszym użyciu; Service Worker zapisuje je w osobnym cache.
 */

const KATALOG = new URL('./vendor/odczyt/', import.meta.url).href;
const MAKS_STRON = 4;
const MAKS_BOK = 2400; // px — większe zdjęcia zmniejszamy (szybciej, a dokładność się nie poprawia)
const MIN_TEKSTU_PDF = 40; // mniej znaków = PDF bez warstwy tekstu (skan), wtedy OCR

/** @typedef {(opis: string, postep?: number) => void} Postep */

/** @param {File} plik */
export function rodzajPliku(plik) {
  if (plik.type === 'application/pdf' || /\.pdf$/i.test(plik.name)) return 'pdf';
  if (/^image\/(jpeg|png|heic|heif|webp)$/.test(plik.type) || /\.(jpe?g|png|heic|heif|webp)$/i.test(plik.name)) return 'obraz';
  return null;
}

// ---------- PDF ----------

/** @type {Promise<any>|null} */ let pdfjs = null;
function zaladujPdfJs() {
  pdfjs ??= import(`${KATALOG}pdf.min.mjs`).then((m) => {
    m.GlobalWorkerOptions.workerSrc = `${KATALOG}pdf.worker.min.mjs`;
    return m;
  });
  return pdfjs;
}

/**
 * Składa elementy tekstu z PDF w wiersze (po współrzędnej y), od góry strony.
 * @param {any[]} elementy
 */
function wierszeZPdf(elementy) {
  /** @type {{ y: number, czesci: { x: number, s: string, w: number }[] }[]} */
  const wiersze = [];
  for (const e of elementy) {
    if (!e.str || !e.str.trim()) continue;
    const x = e.transform[4];
    const y = e.transform[5];
    const wysokosc = Math.abs(e.transform[3]) || 8;
    let w = wiersze.find((r) => Math.abs(r.y - y) < wysokosc * 0.5);
    if (!w) { w = { y, czesci: [] }; wiersze.push(w); }
    w.czesci.push({ x, s: e.str, w: e.width ?? 0 });
  }
  wiersze.sort((a, b) => b.y - a.y);
  return wiersze.map((w) => {
    w.czesci.sort((a, b) => a.x - b.x);
    let tekst = '';
    let koniec = -Infinity;
    for (const c of w.czesci) {
      tekst += tekst && c.x - koniec > 1 ? ` ${c.s}` : c.s;
      koniec = c.x + c.w;
    }
    return tekst.replace(/\s+/g, ' ').trim();
  });
}

/**
 * @param {File} plik @param {Postep} postep
 * @returns {Promise<{ tekst: string, podglad: string|null, ocr: boolean }>}
 */
async function odczytajPdf(plik, postep) {
  postep('Otwieram PDF…');
  const lib = await zaladujPdfJs();
  const dokument = await lib.getDocument({ data: new Uint8Array(await plik.arrayBuffer()), isEvalSupported: false }).promise;
  const strony = Math.min(dokument.numPages, MAKS_STRON);
  /** @type {string[]} */ const linie = [];
  for (let i = 1; i <= strony; i++) {
    const strona = await dokument.getPage(i);
    const tresc = await strona.getTextContent();
    linie.push(...wierszeZPdf(tresc.items));
  }
  const podglad = await renderujStrone(dokument, 1, 1.5).then((c) => c.toDataURL('image/jpeg', 0.85)).catch(() => null);
  if (linie.join('').length >= MIN_TEKSTU_PDF) return { tekst: linie.join('\n'), podglad, ocr: false };

  // Skan zapisany jako PDF: rozpoznajemy tekst z obrazu stron.
  /** @type {string[]} */ const teksty = [];
  for (let i = 1; i <= strony; i++) {
    postep(`Rozpoznaję tekst ze skanu (strona ${i} z ${strony})…`);
    const canvas = await renderujStrone(dokument, i, 2.5);
    teksty.push(await ocr(canvas, (p) => postep(`Rozpoznaję tekst ze skanu (strona ${i} z ${strony})…`, p)));
  }
  return { tekst: teksty.join('\n'), podglad, ocr: true };
}

/** @param {any} dokument @param {number} nr @param {number} skala */
async function renderujStrone(dokument, nr, skala) {
  const strona = await dokument.getPage(nr);
  const widok = strona.getViewport({ scale: skala });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(widok.width);
  canvas.height = Math.ceil(widok.height);
  await strona.render({ canvasContext: /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')), viewport: widok, canvas }).promise;
  return canvas;
}

// ---------- Zdjęcia (OCR) ----------

/** @param {File} plik @returns {Promise<HTMLCanvasElement>} */
async function obrazNaCanvas(plik) {
  /** @type {CanvasImageSource & { width: number, height: number }} */ let zrodlo;
  try {
    zrodlo = await createImageBitmap(plik);
  } catch {
    // Starszy Safari: createImageBitmap nie zna HEIC, ale <img> tak.
    zrodlo = await new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(plik);
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('NIE_OBRAZ')); };
      img.src = url;
    });
  }
  const skala = Math.min(1, MAKS_BOK / Math.max(zrodlo.width, zrodlo.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(zrodlo.width * skala);
  canvas.height = Math.round(zrodlo.height * skala);
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { willReadFrequently: true }));
  ctx.drawImage(zrodlo, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Odcienie szarości i rozciągnięcie kontrastu — pomaga przy zdjęciach kartki w słabym świetle. @param {HTMLCanvasElement} canvas */
function przygotujDoOcr(canvas) {
  const kopia = document.createElement('canvas');
  kopia.width = canvas.width;
  kopia.height = canvas.height;
  const ctx = /** @type {CanvasRenderingContext2D} */ (kopia.getContext('2d', { willReadFrequently: true }));
  ctx.drawImage(canvas, 0, 0);
  const obraz = ctx.getImageData(0, 0, kopia.width, kopia.height);
  const d = obraz.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const s = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = s;
    if (s < min) min = s;
    if (s > max) max = s;
  }
  const zakres = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) * 255) / zakres;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(obraz, 0, 0);
  return kopia;
}

/** @type {Promise<any>|null} */ let pracownik = null;
/** @type {(p: number) => void} */ let biezacyPostep = () => {};

async function utworzPracownika() {
  const { default: Tesseract } = await import(`${KATALOG}tesseract.esm.min.js`);
  const opcje = (/** @type {string} */ rdzen) => ({
    workerPath: `${KATALOG}worker.min.js`,
    corePath: `${KATALOG}${rdzen}`,
    langPath: KATALOG.replace(/\/$/, ""), // Tesseract sam dokleja „/pol.traineddata.gz”
    gzip: true,
    workerBlobURL: false,
    logger: (/** @type {any} */ m) => { if (m.status === 'recognizing text') biezacyPostep(m.progress); },
  });
  let w;
  try {
    w = await Tesseract.createWorker('pol', 1, opcje('tesseract-core-simd-lstm.wasm.js'));
  } catch {
    w = await Tesseract.createWorker('pol', 1, opcje('tesseract-core-lstm.wasm.js')); // urządzenie bez SIMD
  }
  await w.setParameters({ preserve_interword_spaces: '1' });
  return w;
}

/** @param {HTMLCanvasElement} canvas @param {(p: number) => void} [naPostep] */
async function ocr(canvas, naPostep) {
  pracownik ??= utworzPracownika().catch((e) => { pracownik = null; throw e; });
  const w = await pracownik;
  biezacyPostep = naPostep ?? (() => {});
  const { data } = await w.recognize(przygotujDoOcr(canvas));
  return /** @type {string} */ (data.text);
}

/**
 * @param {File} plik @param {Postep} postep
 * @returns {Promise<{ tekst: string, podglad: string|null, ocr: boolean }>}
 */
async function odczytajObraz(plik, postep) {
  postep('Przygotowuję zdjęcie…');
  let canvas;
  try {
    canvas = await obrazNaCanvas(plik);
  } catch {
    throw new Error('Ta przeglądarka nie potrafi otworzyć tego zdjęcia. Na iPhonie spróbuj w Safari albo zapisz zdjęcie jako JPG.');
  }
  postep('Wczytuję rozpoznawanie tekstu (za pierwszym razem ok. 7 MB)…');
  const tekst = await ocr(canvas, (p) => postep('Rozpoznaję tekst ze zdjęcia…', p));
  return { tekst, podglad: canvas.toDataURL('image/jpeg', 0.8), ocr: true };
}

/**
 * Odczytuje tekst z pliku z wynikami.
 * @param {File} plik @param {Postep} postep
 */
export async function odczytajTekst(plik, postep) {
  const rodzaj = rodzajPliku(plik);
  if (rodzaj === 'pdf') return odczytajPdf(plik, postep);
  if (rodzaj === 'obraz') return odczytajObraz(plik, postep);
  throw new Error('Obsługiwane są pliki PDF, JPG, PNG i HEIC.');
}
