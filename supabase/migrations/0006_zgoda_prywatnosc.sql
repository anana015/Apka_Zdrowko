-- 0006: zgoda na przechowywanie danych o zdrowiu (specyfikacja, sekcja 14: „wyraźna zgoda zapisana w profiles”).
-- Uruchom w Supabase: SQL Editor, przed wgraniem wersji 0.7.0 aplikacji.
alter table public.profiles add column if not exists privacy_accepted_at timestamptz;

comment on column public.profiles.disclaimer_accepted_at is 'Kiedy użytkownik potwierdził zastrzeżenie medyczne.';
comment on column public.profiles.privacy_accepted_at is 'Kiedy użytkownik zgodził się na przechowywanie swoich danych o zdrowiu na koncie (Supabase, UE).';
