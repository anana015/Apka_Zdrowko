-- 0005: nowy rodzaj dolegliwości „opryszczka” (herpes).
-- Uruchom w Supabase: SQL Editor, przed wgraniem wersji 0.6.0 aplikacji.
alter table public.symptom_episodes drop constraint if exists symptom_episodes_kind_check;
alter table public.symptom_episodes
  add constraint symptom_episodes_kind_check check (kind in ('headache', 'migraine', 'back', 'pelvic', 'herpes', 'other'));
