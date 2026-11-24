import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sprawdzKlucz, sprawdzUrl, zaktualizujCsp, plikKonfiguracji } from '../scripts/ustaw-supabase.mjs';

const jwt = (rola) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: rola })).toString('base64url')}.podpis`;

test('klucz sekretny i service_role są odrzucane', () => {
  assert.throws(() => sprawdzKlucz('sb_secret_test'), /SEKRETNY/);
  assert.throws(() => sprawdzKlucz(jwt('service_role')), /service_role/);
  assert.throws(() => sprawdzKlucz('cokolwiek'), /Nieznany format/);
});

test('klucz publikowalny przechodzi, stary anon z ostrzeżeniem', () => {
  assert.equal(sprawdzKlucz('sb_publishable_abc123').ostrzezenie, null);
  assert.match(sprawdzKlucz(jwt('anon')).ostrzezenie, /wycofuje/);
});

test('adres: tylko https i bez ścieżki', () => {
  assert.equal(sprawdzUrl('https://abcdefghijklmnopqrst.supabase.co/'), 'https://abcdefghijklmnopqrst.supabase.co');
  assert.throws(() => sprawdzUrl('http://abcdefghijklmnopqrst.supabase.co'), /https/);
  assert.throws(() => sprawdzUrl('https://abcdefghijklmnopqrst.supabase.co/rest/v1'), /bez ścieżki/);
});

test('CSP: dopisuje projekt do connect-src i img-src, bez duplikatów', () => {
  const csp = "default-src 'self'; script-src 'self'; img-src 'self' data: blob:; connect-src 'self'";
  const raz = zaktualizujCsp(csp, 'https://abcdefghijklmnopqrst.supabase.co');
  assert.equal(raz, "default-src 'self'; script-src 'self'; img-src 'self' data: blob: https://abcdefghijklmnopqrst.supabase.co; connect-src 'self' https://abcdefghijklmnopqrst.supabase.co");
  assert.equal(zaktualizujCsp(raz, 'https://abcdefghijklmnopqrst.supabase.co'), raz);
  assert.match(zaktualizujCsp(raz, 'https://zzzzzzzzzzzzzzzzzzzz.supabase.co'), /connect-src 'self' https:\/\/zzzz/);
  assert.doesNotMatch(zaktualizujCsp(raz, 'https://zzzzzzzzzzzzzzzzzzzz.supabase.co'), /abcdefgh/);
});

test('plik konfiguracji jest poprawnym modułem', async () => {
  const tresc = plikKonfiguracji('https://abcdefghijklmnopqrst.supabase.co', 'sb_publishable_x');
  const mod = await import(`data:text/javascript,${encodeURIComponent(tresc)}`);
  assert.equal(mod.SUPABASE_URL, 'https://abcdefghijklmnopqrst.supabase.co');
});
