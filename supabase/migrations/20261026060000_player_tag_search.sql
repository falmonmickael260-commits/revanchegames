-- Revanche Game — recherche de joueur par identifiant fixe, en plus du
-- pseudonyme.
--
-- L'identifiant affiché au profil ("RG-XXXXXXXX") n'est pas une nouvelle
-- colonne : c'est `profiles.id` mis en forme (voir src/lib/player-tag.ts).
-- Cette fonction accepte donc indifféremment un pseudonyme ou cet
-- identifiant (avec ou sans le préfixe "rg-") — utile précisément parce que
-- le pseudonyme, lui, change.

create or replace function public.search_players(p_query text, p_limit int default 10)
returns table (
  id uuid,
  username text,
  avatar_url text,
  relationship text,
  accepts_requests boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_needle text := lower(trim(coalesce(p_query, '')));
  -- Le préfixe "rg-" est décoratif à l'affichage ; on l'accepte en entrée
  -- mais la comparaison se fait sur l'identifiant brut, sans tirets.
  v_tag_needle text := regexp_replace(v_needle, '^rg-', '');
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  -- Deux caractères minimum : évite de renvoyer tout l'annuaire sur une lettre.
  if char_length(v_needle) < 2 then
    return;
  end if;

  return query
  select
    pr.id,
    pr.username,
    pr.avatar_url,
    coalesce(
      case
        when f.status = 'accepted' then 'friend'
        when f.status = 'pending' and f.requester_id = v_me then 'request_sent'
        when f.status = 'pending' then 'request_received'
      end,
      'none'
    ) as relationship,
    pr.allow_friend_requests as accepts_requests
  from public.profiles pr
  left join public.friendships f
    on least(f.requester_id, f.addressee_id) = least(pr.id, v_me)
   and greatest(f.requester_id, f.addressee_id) = greatest(pr.id, v_me)
  where pr.id <> v_me
    and (
      lower(pr.username) like v_needle || '%'
      or lower(replace(pr.id::text, '-', '')) like v_tag_needle || '%'
    )
    -- Un blocage rend le joueur invisible dans la recherche, dans les deux sens.
    and coalesce(f.status, '') <> 'blocked'
  order by pr.username
  limit least(greatest(coalesce(p_limit, 10), 1), 25);
end;
$$;
