// Generuje precache-manifest.js: listę plików powłoki aplikacji i hash ich zawartości.
// Użycie: node scripts/generuj-precache.mjs          (zapis)
//         node scripts/generuj-precache.mjs --check  (CI: błąd, jeśli plik jest nieaktualny)
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const KORZEN = fileURLToPath(new URL('..', import.meta.url));
const PLIK_WYJSCIOWY = 'precache-manifest.js';

const POJEDYNCZE = ['index.html', 'manifest.webmanifest'];
const KATALOGI = ['css', 'js', 'fonts', 'icons'];
const ROZSZERZENIA = /\.(html|css|js|mjs|woff2|png|svg|webmanifest)$/;
/** Moduł odczytu wyników (ok. 8 MB) nie trafia do precache: ładuje się przy pierwszym użyciu (sw.js, cache „odczyt-…”). */
const POMIJANE = /^js\/vendor\/odczyt\//;

function przejdz(katalog) {
  if (!existsSync(katalog)) return [];
  return readdirSync(katalog).flatMap((nazwa) => {
    const sciezka = join(katalog, nazwa);
    return statSync(sciezka).isDirectory() ? przejdz(sciezka) : [sciezka];
  });
}

/** @param {string} korzen */
export function zbierzPliki(korzen = KORZEN) {
  const pliki = [
    ...POJEDYNCZE.map((p) => join(korzen, p)),
    ...KATALOGI.flatMap((k) => przejdz(join(korzen, k))),
  ].filter((p) => ROZSZERZENIA.test(p));
  return pliki
    .map((p) => relative(korzen, p).split(sep).join('/'))
    .filter((p) => !POMIJANE.test(p))
    .sort();
}

/** @param {string} korzen */
export function zbudujManifest(korzen = KORZEN) {
  const pliki = zbierzPliki(korzen);
  const hash = createHash('sha256');
  for (const p of pliki) {
    hash.update(p);
    hash.update(readFileSync(join(korzen, p)));
  }
  const wersja = hash.digest('hex').slice(0, 12);
  const lista = ['./', ...pliki.map((p) => `./${p}`)];
  return `// Plik generowany przez scripts/generuj-precache.mjs — nie edytuj ręcznie.\n` +
    `self.PRECACHE = ${JSON.stringify({ wersja, pliki: lista }, null, 2)};\n`;
}

const czyUruchomionyBezposrednio = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (czyUruchomionyBezposrednio) {
  const tresc = zbudujManifest();
  const cel = join(KORZEN, PLIK_WYJSCIOWY);
  if (process.argv.includes('--check')) {
    const obecny = existsSync(cel) ? readFileSync(cel, 'utf8') : '';
    if (obecny !== tresc) {
      console.error('precache-manifest.js jest nieaktualny. Uruchom: npm run precache');
      process.exit(1);
    }
    console.log('precache-manifest.js jest aktualny.');
  } else {
    writeFileSync(cel, tresc);
    console.log(`Zapisano ${PLIK_WYJSCIOWY}`);
  }
}
