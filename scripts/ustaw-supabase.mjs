// Ustawia adres projektu Supabase i klucz publikowalny w trzech miejscach naraz:
//   js/konfiguracja.js, CSP w index.html (meta) i CSP w _headers (nagłówek HTTP).
// Odrzuca klucz sekretny i klucz service_role, żeby nie trafiły do kodu przeglądarki.
// Użycie: npm run ustaw-supabase -- --url https://<ref>.supabase.co --klucz sb_publishable_...
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const KORZEN = fileURLToPath(new URL('..', import.meta.url));

/** @param {string} url */
export function sprawdzUrl(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error(`To nie jest poprawny adres: ${url}`); }
  if (u.protocol !== 'https:') throw new Error('Adres projektu musi zaczynać się od https://');
  if (u.pathname !== '/' || u.search || u.hash) throw new Error('Podaj sam adres projektu, bez ścieżki, np. https://abcdefghijklmnopqrst.supabase.co');
  return u.origin;
}

/** @param {string} klucz */
export function sprawdzKlucz(klucz) {
  const k = klucz.trim();
  if (k.startsWith('sb_secret_')) throw new Error('To klucz SEKRETNY (sb_secret_…). Nie może trafić do aplikacji. Użyj klucza publikowalnego (sb_publishable_…).');
  if (k.startsWith('sb_publishable_')) return { klucz: k, ostrzezenie: null };
  if (/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(k)) {
    const rola = JSON.parse(Buffer.from(k.split('.')[1], 'base64url').toString('utf8')).role;
    if (rola !== 'anon') throw new Error(`To klucz z rolą „${rola}” (omija RLS). Nie może trafić do aplikacji.`);
    return { klucz: k, ostrzezenie: 'To starszy klucz anon. Supabase wycofuje go do końca 2026 r. Lepiej użyj klucza publikowalnego (sb_publishable_…).' };
  }
  throw new Error('Nieznany format klucza. Oczekiwany klucz publikowalny: sb_publishable_…');
}

/** @param {string} url @param {string} klucz */
export function plikKonfiguracji(url, klucz) {
  return `// @ts-check
/**
 * Połączenie z Supabase. Plik generuje skrypt: npm run ustaw-supabase -- --url <adres> --klucz <sb_publishable_…>
 * Klucz publikowalny jest jawny z założenia (trafia do przeglądarki); dane chronią RLS i obowiązkowe MFA.
 * Nigdy nie wpisuj tu klucza sekretnego (sb_secret_…) ani hasła do bazy.
 * Puste wartości = aplikacja działa tylko lokalnie (stan szkicu 0.1).
 */
export const SUPABASE_URL = ${JSON.stringify(url)};
export const SUPABASE_KLUCZ_PUBLIKOWALNY = ${JSON.stringify(klucz)};
`;
}

/**
 * Ustawia adres Supabase w dyrektywach connect-src i img-src (signed URL do plików). Idempotentne.
 * @param {string} csp @param {string} url
 */
export function zaktualizujCsp(csp, url) {
  return csp.replace(/(connect-src|img-src)([^;]*)/g, (_, dyrektywa, zrodla) => {
    const lista = zrodla.trim().split(/\s+/).filter((z) => z && !/^https:\/\/[^\s]*supabase\.co$/.test(z));
    return `${dyrektywa} ${[...lista, url].join(' ')}`;
  });
}

function main() {
  const arg = (nazwa) => { const i = process.argv.indexOf(nazwa); return i > 0 ? process.argv[i + 1] : undefined; };
  const url = arg('--url');
  const klucz = arg('--klucz');
  if (!url || !klucz) {
    console.error('Użycie: npm run ustaw-supabase -- --url https://<ref>.supabase.co --klucz sb_publishable_...');
    process.exit(1);
  }
  try {
    const origin = sprawdzUrl(url);
    const { klucz: k, ostrzezenie } = sprawdzKlucz(klucz);
    if (!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(origin)) console.warn(`Uwaga: ${origin} nie wygląda na adres projektu Supabase (https://<20 liter>.supabase.co).`);
    writeFileSync(join(KORZEN, 'js/konfiguracja.js'), plikKonfiguracji(origin, k));
    for (const plik of ['index.html', '_headers']) {
      const sciezka = join(KORZEN, plik);
      const tresc = readFileSync(sciezka, 'utf8');
      const nowa = tresc.replace(/(Content-Security-Policy"? ?(?:content=")?:? ?)([^"\n]+)/, (_, przed, csp) => przed + zaktualizujCsp(csp, origin));
      writeFileSync(sciezka, nowa);
    }
    if (ostrzezenie) console.warn(ostrzezenie);
    console.log(`Ustawiono ${origin} w js/konfiguracja.js, index.html i _headers.\nTeraz uruchom: npm run precache`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
