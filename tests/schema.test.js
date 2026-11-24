// Test schematu i RLS na PGlite (PostgreSQL w procesie Node), jak w Garaz_apka.
// Uruchamia migracje na pustej bazie z atrapą schematu auth z Supabase.
// Migracje dotyczące Storage (schemat storage istnieje tylko w Supabase) są pomijane.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* brak zależności: test pominięty */ }
const pomin = PGlite ? false : 'brak @electric-sql/pglite (npm install)';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const KATALOG_MIGRACJI = new URL('../supabase/migrations/', import.meta.url);
const MIGRACJE = readdirSync(KATALOG_MIGRACJI).filter((f) => /^\d+_.*\.sql$/.test(f) && !f.includes('storage')).sort();

/** Atrapa elementów Supabase: auth.users, auth.jwt()/auth.uid() z claims jak w PostgREST, role Data API. */
const ATRAPA_SUPABASE = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.jwt() returns jsonb language sql stable
    as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid(), auth.jwt() to anon, authenticated;
`;

async function przygotuj() {
  const db = new PGlite();
  await db.exec(ATRAPA_SUPABASE);
  for (const plik of MIGRACJE) await db.exec(readFileSync(new URL(plik, KATALOG_MIGRACJI), 'utf8'));
  await db.exec(`insert into auth.users values ('${A}'), ('${B}')`);
  /**
   * Wykonuje zapytanie jako użytkownik: rola authenticated + JWT z sub i poziomem uwierzytelnienia.
   * uid = null → rola anon. aal domyślnie 'aal2' (po weryfikacji kodu TOTP).
   */
  const jako = async (uid, sql, params = [], aal = 'aal2') => {
    const claims = uid ? JSON.stringify({ sub: uid, role: 'authenticated', aal }) : '{}';
    await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claims', '${claims}', false);`);
    try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
  };
  return { db, jako };
}

test('RLS: użytkownik widzi i zmienia tylko własne wiersze', { skip: pomin }, async () => {
  const { jako } = await przygotuj();
  await jako(A, `insert into daily_entries (entry_date, mood) values ('2026-11-20', 4)`);
  assert.equal((await jako(A, 'select * from daily_entries')).rows.length, 1);
  assert.equal((await jako(B, 'select * from daily_entries')).rows.length, 0);
  const upd = await jako(B, `update daily_entries set mood = 1`);
  assert.equal(upd.affectedRows, 0);
  await assert.rejects(jako(B, `insert into daily_entries (user_id, entry_date) values ('${A}', '2026-11-21')`), /row-level security/);
});

test('RLS: rola anon nie ma dostępu', { skip: pomin }, async () => {
  const { jako } = await przygotuj();
  await assert.rejects(jako(null, 'select * from daily_entries'), /permission denied/);
  await assert.rejects(jako(null, 'select * from lab_results'), /permission denied/);
});

test('CHECK: zakresy skal i kolejność dat', { skip: pomin }, async () => {
  const { jako } = await przygotuj();
  await assert.rejects(jako(A, `insert into daily_entries (entry_date, mood) values ('2026-11-20', 6)`), /check/);
  await assert.rejects(jako(A, `insert into symptom_episodes (kind, started_at, intensity) values ('headache', now(), 11)`), /check/);
  await assert.rejects(jako(A, `insert into symptom_episodes (kind, started_at, ended_at) values ('headache', now(), now() - interval '1 hour')`), /check/);
  await assert.rejects(jako(A, `insert into lab_results (taken_on, test_name, value, ref_low, ref_high) values ('2026-11-01', 'TSH', 2, 5, 1)`), /check/);
  await assert.rejects(jako(A, `insert into daily_entries (entry_date) values ('2026-11-20'), ('2026-11-20')`), /unique|duplicate/);
});

test('Klucze obce: nie można powiązać przyjęcia z cudzym lekiem', { skip: pomin }, async () => {
  const { jako } = await przygotuj();
  const lek = (await jako(A, `insert into medications (name, kind) values ('Lek A', 'medication') returning id`)).rows[0].id;
  await assert.rejects(jako(B, `insert into medication_intakes (medication_id, taken_at) values ($1, now())`, [lek]), /foreign key/);
  await jako(A, `insert into medication_intakes (medication_id, taken_at) values ($1, now())`, [lek]);
});

test('Usunięcie epizodu odpina przyjęcie (set null), usunięcie leku kasuje przyjęcia', { skip: pomin }, async () => {
  const { jako } = await przygotuj();
  const lek = (await jako(A, `insert into medications (name, kind) values ('Lek', 'medication') returning id`)).rows[0].id;
  const ep = (await jako(A, `insert into symptom_episodes (kind, started_at) values ('headache', now()) returning id`)).rows[0].id;
  await jako(A, `insert into medication_intakes (medication_id, taken_at, episode_id) values ($1, now(), $2)`, [lek, ep]);
  await jako(A, `delete from symptom_episodes where id = $1`, [ep]);
  const po = (await jako(A, 'select episode_id, user_id from medication_intakes')).rows[0];
  assert.equal(po.episode_id, null);
  assert.equal(po.user_id, A);
  await jako(A, `delete from medications where id = $1`, [lek]);
  assert.equal((await jako(A, 'select * from medication_intakes')).rows.length, 0);
});

test('updated_at zmienia się przy aktualizacji', { skip: pomin }, async () => {
  const { db, jako } = await przygotuj();
  const r = (await jako(A, `insert into daily_entries (entry_date, mood, updated_at) values ('2026-11-20', 3, now() - interval '1 day') returning id, updated_at`)).rows[0];
  await jako(A, `update daily_entries set mood = 4 where id = $1`, [r.id]);
  const po = (await db.query('select updated_at from daily_entries where id = $1', [r.id])).rows[0];
  assert.ok(new Date(po.updated_at) > new Date(r.updated_at));
});

test('MFA: samo hasło (aal1) nie daje dostępu nawet do własnych danych', { skip: pomin }, async () => {
  const { jako } = await przygotuj();
  await jako(A, `insert into daily_entries (entry_date, mood) values ('2026-11-20', 4)`);
  assert.equal((await jako(A, 'select * from daily_entries', [], 'aal1')).rows.length, 0);
  await assert.rejects(jako(A, `insert into daily_entries (entry_date) values ('2026-11-21')`, [], 'aal1'), /row-level security/);
  assert.equal((await jako(A, 'select * from daily_entries', [], 'aal2')).rows.length, 1);
});

test('Każda tabela w public ma RLS i restrykcyjną politykę wymagającą MFA', { skip: pomin }, async () => {
  const { db } = await przygotuj();
  const tabele = (await db.query(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'`)).rows;
  assert.ok(tabele.length >= 7);
  for (const t of tabele) {
    assert.equal(t.relrowsecurity, true, `${t.relname}: RLS wyłączone`);
    const mfa = (await db.query(`select 1 from pg_policies where schemaname = 'public' and tablename = $1
      and permissive = 'RESTRICTIVE' and qual like '%aal2%'`, [t.relname])).rows;
    assert.equal(mfa.length, 1, `${t.relname}: brak restrykcyjnej polityki MFA`);
  }
});

test('Nowa tabela nie jest automatycznie dostępna dla ról Data API', { skip: pomin }, async () => {
  const { db } = await przygotuj();
  await db.exec('create table public.nowa_tabela (id int)');
  const r = (await db.query(`select has_table_privilege('authenticated', 'public.nowa_tabela', 'select') as auth,
    has_table_privilege('anon', 'public.nowa_tabela', 'select') as anon`)).rows[0];
  assert.equal(r.auth, false);
  assert.equal(r.anon, false);
});

test('Profil powstaje automatycznie po utworzeniu konta', { skip: pomin }, async () => {
  const { db, jako } = await przygotuj();
  assert.equal((await db.query('select count(*)::int as n from profiles')).rows[0].n, 2);
  const p = (await jako(A, 'select id, timezone from profiles')).rows;
  assert.deepEqual(p, [{ id: A, timezone: 'Europe/Warsaw' }]);
});
