-- 0003_mfa_i_uprawnienia.sql — obowiązkowe MFA, uprawnienia domyślne, automatyczny profil
--
-- 1. Obowiązkowe MFA (specyfikacja, sekcja 8): każda tabela dostaje politykę RESTRYKCYJNĄ wymagającą
--    tokenu z poziomem aal2 (hasło + kod TOTP). Polityki restrykcyjne łączą się z pozostałymi przez AND,
--    więc samo hasło (aal1) nie daje dostępu do żadnego wiersza, nawet własnego.
-- 2. Nowe tabele w schemacie public nie są automatycznie dostępne przez Data API (wymagany jawny GRANT).
-- 3. Profil użytkownika powstaje automatycznie, gdy administrator zakłada konto.

-- ---------- 1. MFA ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','daily_entries','symptom_episodes','medications','documents','medication_intakes','lab_results'] loop
    execute format($p$create policy wymagane_mfa on public.%I
      as restrictive
      for all to authenticated
      using ((select auth.jwt() ->> 'aal') = 'aal2')
      with check ((select auth.jwt() ->> 'aal') = 'aal2')$p$, t);
  end loop;
end $$;

-- ---------- 2. Uprawnienia domyślne ----------
-- Obiekty tworzone przez rolę postgres (migracje) nie dostają automatycznie uprawnień dla ról Data API.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

-- Funkcje wyzwalaczy nie są przeznaczone do wywoływania przez API.
revoke execute on function public.ustaw_updated_at() from public, anon, authenticated;

-- ---------- 3. Automatyczny profil ----------
create or replace function public.utworz_profil() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

revoke execute on function public.utworz_profil() from public, anon, authenticated;

create trigger po_utworzeniu_uzytkownika
  after insert on auth.users
  for each row execute function public.utworz_profil();
