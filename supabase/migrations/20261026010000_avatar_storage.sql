-- Revanche Game — avatars (photo de profil)
-- Le bucket "avatars" lui-même est créé hors migration (API Storage, pas de
-- DDL SQL pour les buckets) ; cette migration ne pose que les règles d'accès.
-- Chemin attendu pour chaque fichier : avatars/<user_id>/<fichier>.

create policy "avatars_read_all" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_write_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
