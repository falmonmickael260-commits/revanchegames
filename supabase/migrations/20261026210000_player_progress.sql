-- Revanche Game — expérience et niveau du joueur.
--
-- ## Dérivé, pas stocké
--
-- L'XP n'est enregistrée nulle part : elle est **recalculée** à partir de
-- `game_stats_totals`, c'est-à-dire des parties réellement déclarées par les
-- jeux. Trois conséquences voulues :
--
--  • impossible de désynchroniser un compteur d'XP de l'historique réel ;
--  • impossible de s'attribuer de l'XP : il faudrait falsifier une partie,
--    et seule la clé de service peut écrire dans `game_results` ;
--  • une partie effacée retire l'XP correspondante, sans traitement à écrire.
--
-- Le prix : changer le barème change rétroactivement le niveau de tout le
-- monde. C'est assumé — mieux vaut un chiffre toujours vrai qu'un compteur
-- figé qui ne correspond plus à rien.
--
-- ## Barème
--
--   10 XP par partie jouée  (être là compte)
--  +15 XP par victoire
--   +5 XP par match nul
--
-- Une défaite rapporte donc 10 XP : jouer et perdre fait progresser, plus
-- lentement. Rien ne descend jamais.
--
-- ## Courbe de niveaux
--
-- Chaque niveau coûte 100 XP de plus que le précédent :
--   niveau 2 à 100 XP, niveau 3 à 300, niveau 4 à 600, niveau 5 à 1000…
-- Soit, pour atteindre le niveau L : 50 × L × (L−1).
-- L'inverse donne : L = ⌊(1 + √(1 + XP/12.5)) / 2⌋.

create or replace function public.player_progress(p_user_id uuid)
returns table (
  xp bigint,
  level int,
  /** XP déjà acquise à l'intérieur du niveau courant. */
  xp_into_level bigint,
  /** XP totale que demande ce niveau pour passer au suivant. */
  xp_for_level bigint,
  games_played bigint,
  wins bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with totals as (
    select
      coalesce(t.games_played, 0)::bigint as games_played,
      coalesce(t.wins, 0)::bigint as wins,
      coalesce(t.draws, 0)::bigint as draws
    from (select 1) one
    left join public.game_stats_totals t on t.user_id = p_user_id
  ),
  earned as (
    select
      games_played,
      wins,
      (games_played * 10 + wins * 15 + draws * 5)::bigint as xp
    from totals
  ),
  levelled as (
    select
      xp,
      games_played,
      wins,
      -- ⌊(1 + √(1 + XP/12.5)) / 2⌋, plancher à 1.
      greatest(1, floor((1 + sqrt(1 + xp / 12.5)) / 2)::int) as level
    from earned
  )
  select
    l.xp,
    l.level,
    -- Seuil d'entrée du niveau courant : 50 × L × (L−1).
    l.xp - (50 * l.level * (l.level - 1))::bigint as xp_into_level,
    -- Coût de ce niveau : 100 × L.
    (100 * l.level)::bigint as xp_for_level,
    l.games_played,
    l.wins
  from levelled l;
$$;

-- Publiquement lisible, comme le classement : le niveau s'affiche à côté du
-- pseudonyme, y compris pour un visiteur non connecté.
grant execute on function public.player_progress(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Le classement porte aussi le niveau
--
-- `create or replace` refuse de changer le type de retour : il faut supprimer
-- puis recréer, et reposer les droits qu'un DROP emporte.
-- ---------------------------------------------------------------------------

drop function if exists public.leaderboard(text, int);

create or replace function public.leaderboard(
  p_game_slug text default null,
  p_limit int default 50
)
returns table (
  rank bigint,
  user_id uuid,
  username text,
  avatar_url text,
  games_played bigint,
  wins bigint,
  losses bigint,
  draws bigint,
  win_rate numeric,
  level int
)
language sql
stable
security definer
set search_path = public
as $$
  with scores as (
    select
      s.user_id,
      s.games_played::bigint as games_played,
      s.wins::bigint as wins,
      s.losses::bigint as losses,
      s.draws::bigint as draws,
      s.win_rate
    from public.game_stats s
    where p_game_slug is not null and s.game_slug = p_game_slug

    union all

    select
      t.user_id,
      t.games_played::bigint,
      t.wins::bigint,
      t.losses::bigint,
      t.draws::bigint,
      t.win_rate
    from public.game_stats_totals t
    where p_game_slug is null
  )
  select
    row_number() over (
      order by sc.wins desc, sc.win_rate desc nulls last, sc.games_played desc
    ) as rank,
    sc.user_id,
    pr.username,
    pr.avatar_url,
    sc.games_played,
    sc.wins,
    sc.losses,
    sc.draws,
    sc.win_rate,
    -- Le niveau reste **global**, même sur un classement par jeu : c'est le
    -- niveau du joueur sur la plateforme, pas sur un titre en particulier.
    (select p.level from public.player_progress(sc.user_id) p) as level
  from scores sc
  join public.profiles pr on pr.id = sc.user_id
  order by rank
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

grant execute on function public.leaderboard(text, int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- La fiche d'un ami porte aussi son niveau
-- ---------------------------------------------------------------------------

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
  level int,
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
    -- Le niveau s'affiche même profil masqué : c'est une vitrine, pas une
    -- statistique détaillée — au même titre que le pseudonyme.
    (select pp.level from public.player_progress(p_user_id) pp),
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
