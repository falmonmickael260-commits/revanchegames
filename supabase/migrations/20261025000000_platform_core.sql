-- Revanche Game — socle central (Phase 3)
-- Comptes, catalogue de jeux, résultats/statistiques, chat général,
-- matchmaking, et portefeuille de pièces (préparé, inactif).

-- ---------------------------------------------------------------------------
-- 1. Profils joueurs
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Crée automatiquement un profil quand un compte Supabase Auth est créé.
-- Le pseudonyme est fourni par l'app au moment de l'inscription
-- (raw_user_meta_data->>'username'), déjà vérifié unique côté application.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := coalesce(
    new.raw_user_meta_data ->> 'username',
    'joueur_' || substr(new.id::text, 1, 8)
  );

  insert into public.profiles (id, username, avatar_url)
  values (new.id, v_username, new.raw_user_meta_data ->> 'avatar_url')
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Catalogue des cinq jeux
-- ---------------------------------------------------------------------------
create table public.game_catalog (
  slug text primary key,
  display_name text not null,
  sort_order int not null default 0
);

insert into public.game_catalog (slug, display_name, sort_order) values
  ('kilomax', 'Kilomax', 1),
  ('president', 'Président', 2),
  ('quiz-master', 'Quiz Master', 3),
  ('la-meute', 'La Meute', 4),
  ('10000', '10000', 5);

alter table public.game_catalog enable row level security;
create policy "game_catalog_select_all" on public.game_catalog for select using (true);

-- ---------------------------------------------------------------------------
-- 3. Résultats de parties — source de vérité des statistiques
-- ---------------------------------------------------------------------------
create table public.game_results (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null references public.game_catalog (slug),
  room_code text,
  idempotency_key text not null unique,
  raw_payload jsonb,
  finished_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.game_result_players (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.game_results (id) on delete cascade,
  user_id uuid references public.profiles (id),
  guest_label text,
  outcome text not null check (outcome in ('win', 'loss', 'draw')),
  score numeric,
  position int,
  created_at timestamptz not null default now()
);

create index game_result_players_user_id_idx on public.game_result_players (user_id);
create index game_result_players_result_id_idx on public.game_result_players (result_id);
create index game_results_game_slug_idx on public.game_results (game_slug);

alter table public.game_results enable row level security;
alter table public.game_result_players enable row level security;

create policy "game_results_select_all" on public.game_results for select using (true);
create policy "game_result_players_select_all" on public.game_result_players for select using (true);
-- Pas de policy insert/update/delete pour anon/authenticated : seule la
-- fonction record_game_result (security definer, service_role) peut écrire.

-- Enregistre le résultat d'une partie terminée, une seule fois par
-- idempotency_key (clé choisie par chaque jeu — ex. "<game_slug>:<room_code>:<finished_at>").
-- Appelée par le serveur de chaque jeu avec la clé service_role (jamais côté navigateur).
create or replace function public.record_game_result(
  p_game_slug text,
  p_idempotency_key text,
  p_room_code text,
  p_raw_payload jsonb,
  p_players jsonb -- [{ "user_id": uuid|null, "guest_label": text|null, "outcome": "win"|"loss"|"draw", "score": number|null, "position": int|null }]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result_id uuid;
  v_player jsonb;
begin
  insert into public.game_results (game_slug, room_code, idempotency_key, raw_payload)
  values (p_game_slug, p_room_code, p_idempotency_key, p_raw_payload)
  on conflict (idempotency_key) do nothing
  returning id into v_result_id;

  if v_result_id is null then
    -- Déjà enregistré (retry/reconnexion) : no-op idempotent.
    select id into v_result_id from public.game_results where idempotency_key = p_idempotency_key;
    return v_result_id;
  end if;

  for v_player in select * from jsonb_array_elements(p_players)
  loop
    insert into public.game_result_players (result_id, user_id, guest_label, outcome, score, position)
    values (
      v_result_id,
      (v_player ->> 'user_id')::uuid,
      v_player ->> 'guest_label',
      v_player ->> 'outcome',
      (v_player ->> 'score')::numeric,
      (v_player ->> 'position')::int
    );
  end loop;

  return v_result_id;
end;
$$;

revoke all on function public.record_game_result from public, anon, authenticated;
grant execute on function public.record_game_result to service_role;

-- Statistiques agrégées par joueur et par jeu, calculées à la lecture
-- (jamais stockées en double : pas de risque de désynchronisation).
create view public.game_stats as
select
  p.user_id,
  r.game_slug,
  count(*) as games_played,
  count(*) filter (where p.outcome = 'win') as wins,
  count(*) filter (where p.outcome = 'loss') as losses,
  count(*) filter (where p.outcome = 'draw') as draws,
  round(100.0 * count(*) filter (where p.outcome = 'win') / count(*), 1) as win_rate
from public.game_result_players p
join public.game_results r on r.id = p.result_id
where p.user_id is not null
group by p.user_id, r.game_slug;

-- Totaux tous jeux confondus, pour la ligne "Total" du profil.
create view public.game_stats_totals as
select
  user_id,
  sum(games_played) as games_played,
  sum(wins) as wins,
  sum(losses) as losses,
  sum(draws) as draws,
  round(100.0 * sum(wins) / sum(games_played), 1) as win_rate
from public.game_stats
group by user_id;

-- ---------------------------------------------------------------------------
-- 4. Chat général
-- ---------------------------------------------------------------------------
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  looking_for_game text references public.game_catalog (slug),
  created_at timestamptz not null default now()
);

create index chat_messages_created_at_idx on public.chat_messages (created_at desc);

alter table public.chat_messages enable row level security;
create policy "chat_messages_select_all" on public.chat_messages for select using (true);
create policy "chat_messages_insert_own" on public.chat_messages
  for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 5. Matchmaking — partie rapide
-- ---------------------------------------------------------------------------
create table public.matchmaking_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_slug text not null references public.game_catalog (slug),
  status text not null default 'waiting' check (status in ('waiting', 'matched', 'cancelled')),
  matched_room_code text,
  joined_at timestamptz not null default now()
);

-- Un seul ticket "waiting" actif par joueur (empêche les doubles inscriptions
-- et les clics répétés sur "Partie rapide").
create unique index matchmaking_queue_one_active_per_user
  on public.matchmaking_queue (user_id)
  where status = 'waiting';

alter table public.matchmaking_queue enable row level security;
create policy "matchmaking_queue_select_own" on public.matchmaking_queue
  for select using (auth.uid() = user_id);
create policy "matchmaking_queue_insert_own" on public.matchmaking_queue
  for insert with check (auth.uid() = user_id);
create policy "matchmaking_queue_delete_own" on public.matchmaking_queue
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. Registre des salons — pour affichage central (chat, "rejoindre une partie")
--    Chaque jeu reste seul maître de ses salons ; ce registre n'est qu'un miroir
--    pour l'affichage, pas une source d'autorité sur qui est dans la partie.
-- ---------------------------------------------------------------------------
create table public.room_registry (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null references public.game_catalog (slug),
  room_code text not null,
  created_by uuid references public.profiles (id),
  capacity int,
  player_count int not null default 1,
  status text not null default 'open' check (status in ('open', 'full', 'started', 'closed')),
  created_at timestamptz not null default now(),
  unique (game_slug, room_code)
);

alter table public.room_registry enable row level security;
create policy "room_registry_select_all" on public.room_registry for select using (true);
-- Écritures réservées au service_role (chaque jeu met à jour son propre salon).

-- ---------------------------------------------------------------------------
-- 7. Portefeuille de pièces — préparé, inactif (Phase 8 : boutique "Bientôt disponible")
-- ---------------------------------------------------------------------------
create table public.wallet_accounts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance_coins bigint not null default 0 check (balance_coins >= 0),
  updated_at timestamptz not null default now()
);

create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta_coins bigint not null,
  reason text not null check (reason in ('purchase', 'reward', 'refund', 'adjustment')),
  reference text unique,
  created_at timestamptz not null default now()
);

-- Le solde est toujours dérivé de l'historique (jamais écrit directement) :
-- une seule écriture possible, le solde se recalcule tout seul et de façon atomique.
create or replace function public.apply_wallet_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallet_accounts (user_id, balance_coins, updated_at)
  values (new.user_id, new.delta_coins, now())
  on conflict (user_id) do update
    set balance_coins = public.wallet_accounts.balance_coins + new.delta_coins,
        updated_at = now();
  return new;
end;
$$;

create trigger trg_wallet_ledger_apply
  after insert on public.wallet_ledger
  for each row execute function public.apply_wallet_ledger();

alter table public.wallet_accounts enable row level security;
alter table public.wallet_ledger enable row level security;

create policy "wallet_accounts_select_own" on public.wallet_accounts
  for select using (auth.uid() = user_id);
create policy "wallet_ledger_select_own" on public.wallet_ledger
  for select using (auth.uid() = user_id);
-- Pas de policy insert/update pour anon/authenticated : seul service_role
-- (futur webhook de paiement validé serveur) pourra créditer des pièces.
