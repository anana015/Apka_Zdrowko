// Test schematu i RLS na PGlite (PostgreSQL w procesie Node), jak w Garaz_apka.
// Uruchamia migracje na pustej bazie z atrapą schematu auth z Supabase.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

let PGlite = null;
try { ({ PGlite } = await import('@electric-sql/pglite')); } catch { /* brak zależności: test pominięty */ }
const pomin = PGlite ? false : 'brak @electric-sql/pglite (npm install)';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const ATRAPA_SUPABASE = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

async function przygotuj() {
  const db = new PGlite();
  await db.exec(ATRAPA_SUPABASE);
  await db.exec(readFileSync(new URL('../supabase/migrations/0001_schemat.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into auth.users values ('${A}'), ('${B}')`);
  /** Wykonuje zapytanie jako zalogowany użytkownik (rola authenticated + JWT sub). */
  const jako = async (uid, sql, params = []) => {
    await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false);`);
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
