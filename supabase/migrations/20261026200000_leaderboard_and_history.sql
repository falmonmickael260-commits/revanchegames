-- Revanche Game — classement des joueurs et historique des parties.
--
-- Aucune nouvelle table : tout se lit depuis `game_results`,
-- `game_result_players` et les vues `game_stats` / `game_stats_totals`, qui
-- contiennent déjà les vraies parties déclarées par les jeux. Rien n'est
-- stocké en double, donc rien ne peut se désynchroniser — et aucun chiffre
-- n'est inventé.
--
-- Ces deux fonctions existent surtout pour éviter le N+1 : sans elles, le
-- navigateur ferait une requête de profil par joueur classé, et une requête
-- de participants par partie affichée.

-- ---------------------------------------------------------------------------
-- 1. Classement
-- ---------------------------------------------------------------------------

/**
 * Le classement des joueurs, global ou pour un jeu précis.
 *
 * Tri : victoires d'abord, puis taux de victoire, puis parties jouées. Classer
 * d'abord par taux ferait remonter en tête quelqu'un qui a gagné son unique
 * partie — ce serait exact mais trompeur. Le nombre de victoires récompense
 * ceux qui jouent vraiment, et le taux départage à égalité.
 *
 * Lisible sans être connecté : ces données sont déjà publiques
 * (`game_results_select_all`, `profiles_select_all`), et un classement qu'on
 * ne peut pas regarder avant de s'inscrire n'a pas d'intérêt.
 */
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
  win_rate numeric
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
    sc.win_rate
  from scores sc
  join public.profiles pr on pr.id = sc.user_id
  order by rank
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

/** La place d'un joueur au classement, même s'il est hors du haut de tableau. */
create or replace function public.leaderboard_rank(
  p_user_id uuid,
  p_game_slug text default null
)
returns table (rank bigint, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  with scores as (
    select s.user_id, s.wins::bigint as wins, s.win_rate, s.games_played::bigint as games_played
    from public.game_stats s
    where p_game_slug is not null and s.game_slug = p_game_slug
    union all
    select t.user_id, t.wins::bigint, t.win_rate, t.games_played::bigint
    from public.game_stats_totals t
    where p_game_slug is null
  ),
  ranked as (
    select
      user_id,
      row_number() over (order by wins desc, win_rate desc nulls last, games_played desc) as rank
    from scores
  )
  select r.rank, (select count(*) from ranked)
  from ranked r
  where r.user_id = p_user_id;
$$;

-- ---------------------------------------------------------------------------
-- 2. Historique des parties
-- ---------------------------------------------------------------------------

/**
 * Les dernières parties terminées, avec leurs participants.
 *
 * `p_user_id` renseigné : seulement les parties de ce joueur. Absent : le fil
 * de toute la plateforme.
 *
 * Les invités (`user_id` nul) apparaissent sous le pseudo qu'ils ont saisi
 * dans le jeu (`guest_label`) : ils ont bien joué la partie, les masquer
 * donnerait une liste de participants fausse.
 */
create or replace function public.recent_matches(
  p_user_id uuid default null,
  p_limit int default 20
)
returns table (
  id uuid,
  game_slug text,
  room_code text,
  finished_at timestamptz,
  players jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.game_slug,
    r.room_code,
    r.finished_at,
    (
      select jsonb_agg(
        jsonb_build_object(
          'userId', p.user_id,
          'label', coalesce(pr.username, p.guest_label, 'Invité'),
          'avatarUrl', pr.avatar_url,
          'outcome', p.outcome,
          'score', p.score,
          'position', p.position
        )
        order by p.position nulls last, p.outcome
      )
      from public.game_result_players p
      left join public.profiles pr on pr.id = p.user_id
      where p.result_id = r.id
    ) as players
  from public.game_results r
  where p_user_id is null
     or exists (
       select 1 from public.game_result_players p
       where p.result_id = r.id and p.user_id = p_user_id
     )
  order by r.finished_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- 3. Droits
--
-- Classement et historique sont consultables sans compte : les données sont
-- déjà publiques, et c'est précisément ce qu'on veut montrer à un visiteur.
-- ---------------------------------------------------------------------------

grant execute on function public.leaderboard(text, int) to anon, authenticated;
grant execute on function public.leaderboard_rank(uuid, text) to anon, authenticated;
grant execute on function public.recent_matches(uuid, int) to anon, authenticated;
