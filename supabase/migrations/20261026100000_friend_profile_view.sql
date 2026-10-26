-- Revanche Game — voir le profil d'un ami : ses statistiques et sa liste
-- d'amis, avec un réglage de confidentialité propre à cette fonctionnalité.
--
-- Les statistiques (`game_stats`/`game_stats_totals`) sont déjà lisibles par
-- n'importe quel compte connecté (`game_results_select_all` / `..._players`
-- dans 20261025000000_platform_core.sql) — ce n'est pas ce que ce réglage
-- change. `profile_visible` gouverne uniquement ce que montre la page dédiée
-- « profil d'un ami », qui elle-même n'est accessible qu'entre amis.

alter table public.profiles
  add column if not exists profile_visible boolean not null default true;

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
  -- Réservé aux amis : pas une page publique. Même vérification que pour
  -- les invitations et les messages privés.
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
    case when v_visible then coalesce(t.games_played, 0) end,
    case when v_visible then coalesce(t.wins, 0) end,
    case when v_visible then coalesce(t.losses, 0) end,
    case when v_visible then coalesce(t.draws, 0) end,
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
      -- La liste d'amis de la personne consultée, identité seulement (pas
      -- leurs propres statistiques) : « X et Y sont amis » est une
      -- information bien moins sensible que les parties de Y.
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

grant execute on function public.get_friend_profile(uuid) to authenticated;
