-- 0004_rodzaje_dolegliwosci.sql — nowe rodzaje dolegliwości: ból kręgosłupa i ból w okolicy intymnej.
-- Uruchom w Supabase: SQL Editor → wklej całość → Run.
alter table public.symptom_episodes drop constraint if exists symptom_episodes_kind_check;
alter table public.symptom_episodes
  add constraint symptom_episodes_kind_check check (kind in ('headache', 'migraine', 'back', 'pelvic', 'other'));
