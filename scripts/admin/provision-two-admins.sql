-- Run manually in the Supabase SQL editor after replacing both addresses.
-- This file is deliberately not a migration: account identities stay private.
begin;
lock table public.support_admins in exclusive mode;
do $$
declare
  first_email text := 'VOUS@example.com';
  second_email text := 'ASSOCIE@example.com';
  first_id uuid;
  second_id uuid;
begin
  select u.id into first_id from auth.users u join public.profiles p on p.id=u.id
    where lower(u.email)=lower(first_email) and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<now());
  select u.id into second_id from auth.users u join public.profiles p on p.id=u.id
    where lower(u.email)=lower(second_email) and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<now());
  if first_id is null or second_id is null or first_id=second_id then
    raise exception 'Deux comptes distincts, confirmés et actifs sont requis.';
  end if;
  if exists(select 1 from public.support_admins where user_id not in(first_id,second_id)) then
    raise exception 'Un autre administrateur existe déjà. Vérifiez les accès avant de continuer.';
  end if;
  insert into public.support_admins(user_id) values(first_id),(second_id) on conflict do nothing;
end;
$$;
commit;
