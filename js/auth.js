// @ts-check
/**
 * Logowanie: e-mail + hasło, potem obowiązkowy kod TOTP (pierwsze logowanie: dodanie aplikacji z kodami).
 * Wylogowanie po nieaktywności — limity sesji Supabase są tylko w planie Pro, więc pilnuje tego aplikacja.
 * Baza i tak nie odda danych bez poziomu aal2 (migracja 0003), ten moduł tylko prowadzi użytkownika.
 */
import { SUPABASE_URL, SUPABASE_KLUCZ_PUBLIKOWALNY } from './konfiguracja.js';
import { $, pokazBlad } from './utils.js';

/** Po tylu minutach bez dotknięcia aplikacji trzeba zalogować się ponownie. */
export const LIMIT_NIEAKTYWNOSCI_MIN = 30;
const KLUCZ_AKTYWNOSCI = 'dziennik:ostatniaAktywnosc';

/** @type {any} */
export let klient = null;
export const skonfigurowano = Boolean(SUPABASE_URL && SUPABASE_KLUCZ_PUBLIKOWALNY && /** @type {any} */ (globalThis).supabase);
/** Zdarzenia: 'zalogowano' (detail: użytkownik), 'wylogowano'. */
export const zdarzeniaAuth = new EventTarget();

/** @type {any} */ let uzytkownik = null;
/** @type {string|null} */ let faktorId = null;

export const biezacyUzytkownik = () => uzytkownik;

function utworzKlienta() {
  if (!klient && skonfigurowano) {
    klient = /** @type {any} */ (globalThis).supabase.createClient(SUPABASE_URL, SUPABASE_KLUCZ_PUBLIKOWALNY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'dziennik-auth' },
    });
  }
  return klient;
}

// ---------- Nieaktywność ----------
const czytajAktywnosc = () => { try { return Number(localStorage.getItem(KLUCZ_AKTYWNOSCI)) || 0; } catch { return 0; } };
let ostatniZapis = 0;
function zarejestrujAktywnosc() {
  const teraz = Date.now();
  if (teraz - ostatniZapis < 15000) return;
  ostatniZapis = teraz;
  try { localStorage.setItem(KLUCZ_AKTYWNOSCI, String(teraz)); } catch { /* tryb prywatny: tylko w pamięci */ }
}
const przekroczono = () => {
  const ost = czytajAktywnosc();
  return ost > 0 && Date.now() - ost > LIMIT_NIEAKTYWNOSCI_MIN * 60000;
};
function pilnujNieaktywnosci() {
  for (const z of ['pointerdown', 'keydown', 'scroll', 'touchstart']) window.addEventListener(z, zarejestrujAktywnosc, { passive: true });
  const sprawdz = () => { if (uzytkownik && przekroczono()) wyloguj(`Wylogowano po ${LIMIT_NIEAKTYWNOSCI_MIN} minutach bez aktywności.`); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sprawdz(); });
  setInterval(sprawdz, 60000);
}

// ---------- Ekran logowania ----------
const ekran = () => $('#logowanie');
function pokazEkran(powod = '') {
  document.body.classList.add('zablokowane');
  ekran().hidden = false;
  $('#log-powod').textContent = powod || 'Zaloguj się, aby zobaczyć swoje wpisy.';
  pokazBlad($('#log-blad'), '');
}
function pokazKrokHasla() {
  $('#log-form-haslo').hidden = false;
  $('#log-form-kod').hidden = true;
  /** @type {HTMLInputElement} */ ($('#log-haslo')).value = '';
  /** @type {HTMLInputElement} */ ($('#log-email')).focus();
}

function komunikatBledu(/** @type {any} */ e) {
  const t = String(e?.message ?? e ?? '');
  if (!navigator.onLine) return 'Brak internetu. Logowanie wymaga połączenia.';
  if (/failed to fetch|network/i.test(t)) return 'Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.';
  if (/invalid login credentials/i.test(t)) return 'Nieprawidłowy e-mail lub hasło.';
  if (/invalid totp|invalid code|code.*(expired|invalid)/i.test(t)) return 'Nieprawidłowy lub przeterminowany kod. Wpisz aktualny kod z aplikacji.';
  if (/rate limit|too many/i.test(t)) return 'Zbyt wiele prób. Odczekaj kilka minut.';
  return `Nie udało się: ${t}`;
}

/** Drugi krok: weryfikacja kodu albo dodanie pierwszego czynnika TOTP. */
async function krokKodu() {
  const { data: aal, error } = await klient.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  if (aal.currentLevel === 'aal2') return zakoncz();

  const { data: f, error: e2 } = await klient.auth.mfa.listFactors();
  if (e2) throw e2;
  const totp = (f.all ?? f.totp ?? []).filter((x) => x.factor_type === 'totp');
  const zweryfikowany = totp.find((x) => x.status === 'verified');
  $('#log-form-haslo').hidden = true;
  $('#log-form-kod').hidden = false;

  if (zweryfikowany) {
    faktorId = zweryfikowany.id;
    $('#log-rejestracja').hidden = true;
    $('#log-kod-opis').textContent = 'Wpisz 6-cyfrowy kod z aplikacji z kodami.';
  } else {
    // Pierwsze logowanie: usuń niedokończone próby i dodaj nowy czynnik.
    for (const x of totp) await klient.auth.mfa.unenroll({ factorId: x.id });
    const { data, error: e3 } = await klient.auth.mfa.enroll({
      factorType: 'totp', friendlyName: `Dziennik ${new Date().toISOString().slice(0, 16)}`, issuer: 'Dziennik zdrowia',
    });
    if (e3) throw e3;
    faktorId = data.id;
    /** @type {HTMLImageElement} */ ($('#log-qr')).src = data.totp.qr_code;
    $('#log-sekret').textContent = data.totp.secret;
    /** @type {HTMLAnchorElement} */ ($('#log-otpauth')).href = data.totp.uri;
    $('#log-rejestracja').hidden = false;
    $('#log-kod-opis').textContent = 'Pierwsze logowanie: dodaj Dziennik do aplikacji z kodami. Od teraz przy każdym logowaniu podasz kod z tej aplikacji.';
  }
  /** @type {HTMLInputElement} */ ($('#log-kod')).value = '';
  /** @type {HTMLInputElement} */ ($('#log-kod')).focus();
}

async function zakoncz() {
  const { data } = await klient.auth.getSession();
  uzytkownik = data.session?.user ?? null;
  if (!uzytkownik) return pokazKrokHasla();
  ostatniZapis = 0;
  zarejestrujAktywnosc();
  ekran().hidden = true;
  document.body.classList.remove('zablokowane');
  zdarzeniaAuth.dispatchEvent(new CustomEvent('zalogowano', { detail: uzytkownik }));
}

function podlaczFormularze() {
  $('#log-form-haslo').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = /** @type {HTMLInputElement} */ ($('#log-email')).value.trim();
    const haslo = /** @type {HTMLInputElement} */ ($('#log-haslo')).value;
    if (!email || !haslo) { pokazBlad($('#log-blad'), 'Podaj e-mail i hasło.'); return; }
    pokazBlad($('#log-blad'), '');
    try {
      const { error } = await klient.auth.signInWithPassword({ email, password: haslo });
      if (error) throw error;
      await krokKodu();
    } catch (err) { pokazBlad($('#log-blad'), komunikatBledu(err)); }
  });
  $('#log-form-kod').addEventListener('submit', async (e) => {
    e.preventDefault();
    const kod = /** @type {HTMLInputElement} */ ($('#log-kod')).value.replace(/\s/g, '');
    if (!/^\d{6}$/.test(kod)) { pokazBlad($('#log-blad'), 'Kod ma 6 cyfr.'); return; }
    pokazBlad($('#log-blad'), '');
    try {
      const { error } = await klient.auth.mfa.challengeAndVerify({ factorId: faktorId, code: kod });
      if (error) throw error;
      await zakoncz();
    } catch (err) { pokazBlad($('#log-blad'), komunikatBledu(err)); }
  });
  $('#log-anuluj').addEventListener('click', async () => {
    await klient.auth.signOut({ scope: 'local' }).catch(() => {});
    pokazBlad($('#log-blad'), '');
    pokazKrokHasla();
  });
}

/** Wylogowanie (ręczne albo po nieaktywności). Dane lokalne zostają, ale są zasłonięte ekranem logowania. */
export async function wyloguj(powod = '') {
  uzytkownik = null;
  try { localStorage.removeItem(KLUCZ_AKTYWNOSCI); } catch { /* brak */ }
  await klient?.auth.signOut({ scope: 'local' }).catch(() => {});
  zdarzeniaAuth.dispatchEvent(new Event('wylogowano'));
  pokazEkran(powod);
  pokazKrokHasla();
}

/**
 * Start: przywraca sesję albo pokazuje ekran logowania. Zwraca obietnicę rozwiązywaną po pełnym zalogowaniu (aal2).
 * @returns {Promise<any>}
 */
export async function zainicjujLogowanie() {
  utworzKlienta();
  podlaczFormularze();
  pilnujNieaktywnosci();
  const zalogowany = new Promise((resolve) => zdarzeniaAuth.addEventListener('zalogowano', (e) => resolve(/** @type {CustomEvent} */ (e).detail), { once: true }));

  if (przekroczono()) await klient.auth.signOut({ scope: 'local' }).catch(() => {});
  const { data } = await klient.auth.getSession();
  if (data.session) {
    pokazEkran();
    try { await krokKodu(); } catch (err) { pokazKrokHasla(); pokazBlad($('#log-blad'), komunikatBledu(err)); }
  } else {
    pokazEkran(przekroczono() ? `Wylogowano po ${LIMIT_NIEAKTYWNOSCI_MIN} minutach bez aktywności.` : '');
    pokazKrokHasla();
  }
  return zalogowany;
}
