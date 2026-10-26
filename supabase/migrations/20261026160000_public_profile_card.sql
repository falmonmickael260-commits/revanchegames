-- Revanche Game — fiche rapide d'un joueur, depuis le chat général.
--
-- `get_friend_profile` exige déjà d'être ami, ce qui est volontaire : il
-- expose statistiques et liste d'amis. Mais pour ajouter quelqu'un croisé
-- dans le chat, il faut pouvoir le regarder *avant* d'être ami.
--
-- Cette fonction ne renvoie donc que ce qui est déjà public — pseudonyme,
-- avatar, identifiant, signature : exactement les colonnes que
-- `profiles_select_all` laisse lire à n'importe qui — plus l'état de la
-- relation, pour que l'interface propose la bonne action. Aucune
-- statistique, aucune liste d'amis, aucune donnée privée.

create or replace function public.get_public_profile(p_user_id uuid)
returns table (
  id uuid,
  username text,
  avatar_url text,
  player_tag text,
  signature text,
  relationship text,
  accepts_requests boolean,
  is_blocked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'identifiant invalide' using errcode = '22023';
  end if;

  return query
  select
    pr.id,
    pr.username,
    pr.avatar_url,
    pr.player_tag,
    pr.signature,
    coalesce(
      case
        when pr.id = v_me then 'self'
        when f.status = 'blocked' then 'blocked'
        when f.status = 'accepted' then 'friend'
        when f.status = 'pending' and f.requester_id = v_me then 'request_sent'
        when f.status = 'pending' then 'request_received'
      end,
      'none'
    ) as relationship,
    pr.allow_friend_requests as accepts_requests,
    coalesce(f.status = 'blocked', false) as is_blocked
  from public.profiles pr
  left join public.friendships f
    on least(f.requester_id, f.addressee_id) = least(pr.id, v_me)
   and greatest(f.requester_id, f.addressee_id) = greatest(pr.id, v_me)
  where pr.id = p_user_id;
end;
$$;

revoke all on function public.get_public_profile(uuid) from public, anon;
grant execute on function public.get_public_profile(uuid) to authenticated;
