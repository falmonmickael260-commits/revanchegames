-- Corrige `get_friend_profile` : `sum()` sur une colonne bigint renvoie
-- `numeric` en PostgreSQL (pas `bigint`), ce que `game_stats_totals` hérite
-- silencieusement — la fonction déclarait pourtant `bigint` pour ces
-- colonnes, provoquant "structure of query does not match function result
-- type" à l'exécution. Cast explicite plutôt que de changer le type déclaré,
-- pour que l'API cliente (des nombres, pas des chaînes) ne change pas.

create or replace function public.get_friend_profile(p_user_id uuid)
returns table (
  username text,
  avatar_url text,
  player_tag text,
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
