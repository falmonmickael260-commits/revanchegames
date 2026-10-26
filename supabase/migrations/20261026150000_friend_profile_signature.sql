-- Revanche Game — la fiche d'un ami affiche aussi sa signature.
--
-- Reprend `get_friend_profile` à l'identique en ajoutant une colonne. La
-- signature est volontairement renvoyée **hors** du test `profile_visible` :
-- c'est une présentation que le joueur a écrite pour être lue, au même titre
-- que son pseudonyme, alors que `profile_visible` protège ses statistiques et
-- sa liste d'amis.

-- `create or replace` refuse de changer le type de retour d'une fonction
-- (« cannot change return type of existing function ») : ajouter une colonne
-- de sortie impose de la supprimer puis de la recréer — et donc de reposer
-- ses droits d'exécution, qu'un DROP emporte avec elle.
drop function if exists public.get_friend_profile(uuid);

create or replace function public.get_friend_profile(p_user_id uuid)
returns table (
  username text,
  avatar_url text,
  player_tag text,
  signature text,
  member_since timestamptz,
  profile_visible boolean,
  games_played bigint,
  wins bigint,
  losses bigint,
  draws bigint,
  win_rate numeric,
  per_game jsonb,
  friends jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_visible boolean;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = v_me then
    raise exception 'identifiant invalide' using errcode = '22023';
  end if;
  if not public.are_friends(v_me, p_user_id) then
    raise exception 'ce profil n''est visible qu''entre amis' using errcode = '42501';
  end if;

  select pr.profile_visible into v_visible from public.profiles pr where pr.id = p_user_id;

  return query
  select
    pr.username,
    pr.avatar_url,
    pr.player_tag,
    pr.signature,
    pr.created_at,
    coalesce(v_visible, true),
    case when v_visible then coalesce(t.games_played, 0)::bigint end,
    case when v_visible then coalesce(t.wins, 0)::bigint end,
    case when v_visible then coalesce(t.losses, 0)::bigint end,
    case when v_visible then coalesce(t.draws, 0)::bigint end,
    case when v_visible then t.win_rate end,
    case when v_visible then (
      select jsonb_agg(jsonb_build_object(
        'gameSlug', gs.game_slug,
        'gamesPlayed', gs.games_played,
        'wins', gs.wins,
        'losses', gs.losses,
        'winRate', gs.win_rate
      ))
      from public.game_stats gs
      where gs.user_id = p_user_id
    ) end,
    case when v_visible then (
      select jsonb_agg(jsonb_build_object('id', fp.id, 'username', fp.username, 'avatarUrl', fp.avatar_url))
      from public.friendships f2
      join public.profiles fp
        on fp.id = (case when f2.requester_id = p_user_id then f2.addressee_id else f2.requester_id end)
      where f2.status = 'accepted'
        and p_user_id in (f2.requester_id, f2.addressee_id)
    ) end
  from public.profiles pr
  left join public.game_stats_totals t on t.user_id = pr.id
  where pr.id = p_user_id;
end;
$$;

revoke all on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_profile(uuid) to authenticated;
