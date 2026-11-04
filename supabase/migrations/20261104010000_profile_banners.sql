alter table public.profiles add column if not exists banner_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-banners', 'profile-banners', true, 5242880, array['image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "profile_banners_public_read" on storage.objects
  for select using (bucket_id = 'profile-banners');

-- La page du profil d'un ami ne lit la couverture qu'après la même
-- vérification d'amitié que celle des statistiques du profil.
create function public.get_friend_banner(p_user_id uuid)
returns text
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null or p_user_id is null or not public.are_friends(auth.uid(), p_user_id) then
    raise exception 'profil inaccessible' using errcode = '42501';
  end if;
  return (select banner_url from public.profiles where id = p_user_id);
end;
$$;
revoke all on function public.get_friend_banner(uuid) from public, anon;
grant execute on function public.get_friend_banner(uuid) to authenticated;
