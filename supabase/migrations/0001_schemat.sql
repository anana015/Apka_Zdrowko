-- 0001_schemat.sql — schemat danych i RLS (specyfikacja, sekcje 7 i 8)
-- Zmiany względem specyfikacji v0.1 (opisane w docs/CHANGELOG.md):
--   * updated_at we wszystkich tabelach + wyzwalacz (sekcja 11 wymaga updated_at do rozstrzygania konfliktów),
--   * medication_intakes.scheduled_time — która stała dawka została odhaczona (np. 08:00 vs 20:00),
--   * złożone klucze obce (id, user_id), aby nie dało się powiązać rekordu z cudzym lekiem/epizodem/plikiem,
--   * dodatkowe CHECK: kolejność dat, zakres referencyjny, typy plików.

-- ---------- Funkcja pomocnicza ----------
create or replace function public.ustaw_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- Tabele ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  timezone text not null default 'Europe/Warsaw',
  disclaimer_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  entry_date date not null,
  sleep_start timestamptz,
  sleep_end timestamptz,
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 24),
  sleep_quality smallint check (sleep_quality between 1 and 5),
  awakenings smallint check (awakenings >= 0),
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  stress smallint check (stress between 1 and 5),
  tags text[] not null default '{}',
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date),
  check (sleep_start is null or sleep_end is null or sleep_end > sleep_start)
);

create table public.symptom_episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('headache','migraine','other')),
  custom_name text,
  started_at timestamptz not null,
  ended_at timestamptz,
  intensity smallint check (intensity between 0 and 10),
  location text,
  features text[] not null default '{}',
  triggers text[] not null default '{}',
  relief text check (relief in ('none','partial','full')),
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (ended_at is null or ended_at >= started_at),
  check (kind <> 'other' or custom_name is not null)
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  kind text not null check (kind in ('medication','supplement')),
  dose_text text,
  schedule jsonb,            -- {"type":"daily","times":["08:00"]} lub {"type":"as_needed"}
  start_date date,
  end_date date,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime text not null check (mime in ('application/pdf','image/jpeg','image/png','image/heic')),
  size_bytes integer not null check (size_bytes <= 10485760),
  kind text not null check (kind in ('lab','visit','other')),
  doc_date date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.medication_intakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  medication_id uuid not null,
  taken_at timestamptz not null,
  scheduled_time text check (scheduled_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  dose_text text,
  reason text,
  episode_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (medication_id, user_id) references public.medications (id, user_id) on delete cascade,
  -- PostgreSQL 15+: przy usunięciu epizodu zeruje tylko episode_id, user_id zostaje.
  foreign key (episode_id, user_id) references public.symptom_episodes (id, user_id) on delete set null (episode_id)
);

create table public.lab_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  taken_on date not null,
  test_name text not null,
  value numeric not null,
  unit text,
  ref_low numeric,            -- z wyniku laboratorium, wpisane przez użytkownika
  ref_high numeric,
  lab_name text,
  document_id uuid,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ref_low is null or ref_high is null or ref_low <= ref_high),
  foreign key (document_id, user_id) references public.documents (id, user_id) on delete set null (document_id)
);

create index on public.daily_entries (user_id, entry_date desc);
create index on public.symptom_episodes (user_id, started_at desc);
create index on public.medication_intakes (user_id, taken_at desc);
create index on public.lab_results (user_id, test_name, taken_on desc);

-- ---------- updated_at ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','daily_entries','symptom_episodes','medications','documents','medication_intakes','lab_results'] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.ustaw_updated_at()', t || '_updated_at', t);
  end loop;
end $$;

-- ---------- Row Level Security ----------
alter table public.profiles enable row level security;
create policy wlasny_profil on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['daily_entries','symptom_episodes','medications','documents','medication_intakes','lab_results'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format($p$create policy wlasne_wiersze on public.%I
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()))$p$, t);
  end loop;
end $$;

-- Rola anon nie dostaje żadnych uprawnień do danych.
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
