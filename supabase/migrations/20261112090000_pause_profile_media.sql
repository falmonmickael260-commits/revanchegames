-- Retire les photos et couvertures actuelles sans modifier les avatars emoji.
update public.profiles
set avatar_url = null
where avatar_url ~* '^https?://';

update public.profiles set banner_url = null where banner_url is not null;

-- Empêche également les écritures directes depuis un ancien client.
-- Pour reprendre : retirer ce trigger puis réactiver PROFILE_MEDIA_ENABLED.
create function public.pause_profile_media()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.avatar_url ~* '^https?://' or new.banner_url is not null then
    raise exception 'Les photos de profil et les bannières sont temporairement désactivées.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger pause_profile_media
before insert or update of avatar_url, banner_url on public.profiles
for each row execute function public.pause_profile_media();
