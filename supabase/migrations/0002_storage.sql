-- 0002_storage.sql — prywatny bucket na dokumenty (specyfikacja, sekcja 8)
-- Ścieżka: {user_id}/{uuid}.{rozszerzenie}. Dostęp tylko do własnego folderu; pliki wyłącznie przez krótkie signed URL.
-- Uruchamiane tylko w Supabase (schemat storage nie istnieje w PGlite), więc test schematu je pomija.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dokumenty', 'dokumenty', false, 10485760, array['application/pdf','image/jpeg','image/png','image/heic'])
on conflict (id) do nothing;

create policy dokumenty_odczyt on storage.objects
  for select to authenticated
  using (bucket_id = 'dokumenty' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy dokumenty_zapis on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dokumenty' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy dokumenty_usuwanie on storage.objects
  for delete to authenticated
  using (bucket_id = 'dokumenty' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Wymuszenie MFA także dla plików: polityka restrykcyjna łączy się warunkiem AND z powyższymi.
create policy dokumenty_wymagane_mfa on storage.objects
  as restrictive
  for all to authenticated
  using (bucket_id <> 'dokumenty' or (select auth.jwt() ->> 'aal') = 'aal2')
  with check (bucket_id <> 'dokumenty' or (select auth.jwt() ->> 'aal') = 'aal2');
