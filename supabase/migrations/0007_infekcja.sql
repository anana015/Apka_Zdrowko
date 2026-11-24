-- 0007: nowy rodzaj dolegliwości „infekcja” (przeziębienie, grypa, ból gardła) i najwyższa temperatura epizodu.
-- Uruchom w Supabase: SQL Editor → wklej całość → Run, PRZED wgraniem wersji 0.9.0 aplikacji.
alter table public.symptom_episodes drop constraint if exists symptom_episodes_kind_check;
alter table public.symptom_episodes
  add constraint symptom_episodes_kind_check check (kind in ('headache', 'migraine', 'back', 'pelvic', 'herpes', 'infection', 'other'));

alter table public.symptom_episodes add column if not exists temperature numeric(3,1);
alter table public.symptom_episodes drop constraint if exists symptom_episodes_temperature_check;
alter table public.symptom_episodes
  add constraint symptom_episodes_temperature_check check (temperature is null or temperature between 34 and 43);

comment on column public.symptom_episodes.temperature is 'Najwyższa zmierzona temperatura w czasie epizodu (°C).';
