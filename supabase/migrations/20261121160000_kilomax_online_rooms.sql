create schema kilomax_online;
revoke all on schema kilomax_online from public, anon, authenticated;

-- Kilomax: 20260928090000_online_rooms.sql
-- EN ROUTE — online multiplayer rooms.
--
-- The game state lives in `rooms.state` (JSON produced by the TypeScript engine).
-- Tables are not exposed to the API at all: every read and write goes through the
-- security-definer functions below, which check a per-player secret so nobody can
-- act for someone else, and only the player whose turn it is (or the host, to skip
-- an absent player) can commit a new state.

create table kilomax_online.rooms (
  code text primary key check (code ~ '^ENR-[A-Z0-9]{4}$'),
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  host_id text not null,
  settings jsonb not null,
  players jsonb not null default '[]'::jsonb,
  state jsonb,
  events jsonb not null default '[]'::jsonb,
  last_actor text,
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table kilomax_online.room_members (
  code text not null references kilomax_online.rooms (code) on delete cascade,
  player_id text not null,
  secret uuid not null default gen_random_uuid(),
  last_seen timestamptz not null default now(),
  primary key (code, player_id)
);

create index rooms_updated_at_idx on kilomax_online.rooms (updated_at);

alter table kilomax_online.rooms enable row level security;
alter table kilomax_online.room_members enable row level security;
revoke all on kilomax_online.rooms, kilomax_online.room_members from public, anon, authenticated;

-- ---------------------------------------------------------------- helpers

create function kilomax_online.assert_member(p_code text, p_player_id text, p_secret uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update kilomax_online.room_members
     set last_seen = now()
   where code = p_code and player_id = p_player_id and secret = p_secret;
  if not found then
    raise exception 'Accès refusé à cette partie' using errcode = '42501';
  end if;
end;
$$;

create function kilomax_online.clean_name(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_name, ''));
begin
  if char_length(v) < 1 or char_length(v) > 16 then
    raise exception 'Nom invalide (1 à 16 caractères)' using errcode = '22023';
  end if;
  return v;
end;
$$;

create function kilomax_online.check_player_id(p_player_id text)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_player_id is null or char_length(p_player_id) not between 8 and 64 then
    raise exception 'Identifiant de joueur invalide' using errcode = '22023';
  end if;
end;
$$;

create function kilomax_online.new_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := 'ENR-';
    for i in 1..4 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from kilomax_online.rooms where code = candidate);
  end loop;
  return candidate;
end;
$$;

-- Sorted player ids of a players array (room lobby list or game state).
create function kilomax_online.player_ids(p_players jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(p ->> 'id' order by p ->> 'id'), '{}')
  from jsonb_array_elements(coalesce(p_players, '[]'::jsonb)) as p;
$$;

revoke execute on function kilomax_online.assert_member(text, text, uuid) from public, anon, authenticated;
revoke execute on function kilomax_online.clean_name(text) from public, anon, authenticated;
revoke execute on function kilomax_online.check_player_id(text) from public, anon, authenticated;
revoke execute on function kilomax_online.new_code() from public, anon, authenticated;
revoke execute on function kilomax_online.player_ids(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------- lobby

create function public.kilomax_create_room(p_player_id text, p_name text, p_ambiance text, p_target integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := kilomax_online.clean_name(p_name);
  v_code text;
  v_secret uuid;
begin
  perform kilomax_online.check_player_id(p_player_id);
  if p_ambiance not in ('jour', 'crepuscule', 'nuit') then
    raise exception 'Ambiance invalide' using errcode = '22023';
  end if;
  if p_target not in (400, 700, 1000) then
    raise exception 'Distance invalide' using errcode = '22023';
  end if;

  -- Housekeeping: forget rooms nobody touched for a few days.
  delete from kilomax_online.rooms where updated_at < now() - interval '3 days';

  v_code := kilomax_online.new_code();
  insert into kilomax_online.rooms (code, host_id, settings, players)
  values (
    v_code,
    p_player_id,
    jsonb_build_object('ambiance', p_ambiance, 'target', p_target),
    jsonb_build_array(jsonb_build_object('id', p_player_id, 'name', v_name, 'color', 'crimson', 'ready', false))
  );
  insert into kilomax_online.room_members (code, player_id) values (v_code, p_player_id)
  returning secret into v_secret;

  return jsonb_build_object('code', v_code, 'secret', v_secret);
end;
$$;

create function public.kilomax_join_room(p_code text, p_player_id text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := kilomax_online.clean_name(p_name);
  v_room kilomax_online.rooms%rowtype;
  v_color text;
  v_secret uuid;
begin
  perform kilomax_online.check_player_id(p_player_id);
  select * into v_room from kilomax_online.rooms where code = upper(btrim(p_code)) for update;
  if not found then
    raise exception 'Partie introuvable' using errcode = 'P0002';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'La partie a déjà commencé' using errcode = '55000';
  end if;
  if exists (select 1 from kilomax_online.room_members where code = v_room.code and player_id = p_player_id) then
    raise exception 'Vous êtes déjà dans cette partie' using errcode = '23505';
  end if;
  if jsonb_array_length(v_room.players) >= 4 then
    raise exception 'Partie complète (4 joueurs maximum)' using errcode = '55000';
  end if;

  select c into v_color
    from unnest(array['crimson', 'azure', 'amber', 'emerald']) with ordinality as t(c, ord)
   where not exists (select 1 from jsonb_array_elements(v_room.players) as p where p ->> 'color' = t.c)
   order by ord
   limit 1;

  update kilomax_online.rooms
     set players = players || jsonb_build_array(
           jsonb_build_object('id', p_player_id, 'name', v_name, 'color', v_color, 'ready', false)),
         updated_at = now()
   where code = v_room.code;
  insert into kilomax_online.room_members (code, player_id) values (v_room.code, p_player_id)
  returning secret into v_secret;

  return jsonb_build_object('code', v_room.code, 'secret', v_secret);
end;
$$;

create function public.kilomax_set_ready(p_code text, p_player_id text, p_secret uuid, p_ready boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform kilomax_online.assert_member(p_code, p_player_id, p_secret);
  update kilomax_online.rooms
     set players = (
           select jsonb_agg(
                    case when p ->> 'id' = p_player_id then jsonb_set(p, '{ready}', to_jsonb(p_ready)) else p end
                    order by ord)
             from jsonb_array_elements(players) with ordinality as t(p, ord)),
         updated_at = now()
   where code = p_code and status = 'lobby';
end;
$$;

-- Leaving only removes you from a lobby; once the game started you can always come back.
create function public.kilomax_leave_room(p_code text, p_player_id text, p_secret uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room kilomax_online.rooms%rowtype;
  v_remaining jsonb;
begin
  perform kilomax_online.assert_member(p_code, p_player_id, p_secret);
  select * into v_room from kilomax_online.rooms where code = p_code for update;
  if v_room.status <> 'lobby' then
    return;
  end if;

  select coalesce(jsonb_agg(p order by ord), '[]'::jsonb) into v_remaining
    from jsonb_array_elements(v_room.players) with ordinality as t(p, ord)
   where p ->> 'id' <> p_player_id;

  if jsonb_array_length(v_remaining) = 0 then
    delete from kilomax_online.rooms where code = p_code;
    return;
  end if;

  delete from kilomax_online.room_members where code = p_code and player_id = p_player_id;
  update kilomax_online.rooms
     set players = v_remaining,
         host_id = case when host_id = p_player_id then v_remaining -> 0 ->> 'id' else host_id end,
         updated_at = now()
   where code = p_code;
end;
$$;

-- ---------------------------------------------------------------- game

-- The host deals: the initial state is built client-side by the shared engine.
-- Also used for "Rejouer" once a game is finished.
create function public.kilomax_start_game(p_code text, p_player_id text, p_secret uuid, p_state jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room kilomax_online.rooms%rowtype;
begin
  perform kilomax_online.assert_member(p_code, p_player_id, p_secret);
  select * into v_room from kilomax_online.rooms where code = p_code for update;
  if v_room.host_id <> p_player_id then
    raise exception 'Seul l''hôte peut lancer la partie' using errcode = '42501';
  end if;
  if v_room.status = 'playing' then
    raise exception 'La partie est déjà en cours' using errcode = '55000';
  end if;
  if jsonb_array_length(v_room.players) < 2 then
    raise exception 'Il faut au moins 2 joueurs' using errcode = '55000';
  end if;
  if v_room.status = 'lobby' and exists (
       select 1 from jsonb_array_elements(v_room.players) as p where not coalesce((p ->> 'ready')::boolean, false)) then
    raise exception 'Tous les joueurs doivent être prêts' using errcode = '55000';
  end if;
  if kilomax_online.player_ids(p_state -> 'players') <> kilomax_online.player_ids(v_room.players) then
    raise exception 'État de départ invalide' using errcode = '22023';
  end if;
  if pg_column_size(p_state) > 262144 then
    raise exception 'État trop volumineux' using errcode = '54000';
  end if;

  update kilomax_online.rooms
     set status = 'playing',
         state = p_state,
         events = '[]'::jsonb,
         last_actor = p_player_id,
         version = version + 1,
         updated_at = now()
   where code = p_code;
  return v_room.version + 1;
end;
$$;

-- Optimistic concurrency: the write only lands if nobody committed since
-- `p_expected_version`; otherwise the caller resyncs.
create function public.kilomax_commit_state(
  p_code text,
  p_player_id text,
  p_secret uuid,
  p_expected_version integer,
  p_state jsonb,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room kilomax_online.rooms%rowtype;
  v_current text;
begin
  perform kilomax_online.assert_member(p_code, p_player_id, p_secret);
  select * into v_room from kilomax_online.rooms where code = p_code for update;
  if v_room.status <> 'playing' or v_room.version <> p_expected_version then
    return jsonb_build_object('ok', false, 'version', v_room.version);
  end if;

  v_current := v_room.state -> 'players' -> ((v_room.state ->> 'currentPlayerIndex')::int) ->> 'id';
  if p_player_id <> v_current and p_player_id <> v_room.host_id then
    raise exception 'Ce n''est pas votre tour' using errcode = '42501';
  end if;
  if kilomax_online.player_ids(p_state -> 'players') <> kilomax_online.player_ids(v_room.state -> 'players') then
    raise exception 'État invalide' using errcode = '22023';
  end if;
  if pg_column_size(p_state) > 262144 or jsonb_array_length(coalesce(p_events, '[]'::jsonb)) > 30 then
    raise exception 'État trop volumineux' using errcode = '54000';
  end if;

  update kilomax_online.rooms
     set state = p_state,
         events = coalesce(p_events, '[]'::jsonb),
         last_actor = p_player_id,
         version = version + 1,
         status = case when p_state ->> 'phase' = 'gameover' then 'finished' else 'playing' end,
         updated_at = now()
   where code = p_code;
  return jsonb_build_object('ok', true, 'version', v_room.version + 1);
end;
$$;

-- Polled by every client: heartbeat + lobby/presence info, and the game state
-- only when it changed since `p_known_version`.
create function public.kilomax_room_sync(p_code text, p_player_id text, p_secret uuid, p_known_version integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room kilomax_online.rooms%rowtype;
  v_changed boolean;
begin
  perform kilomax_online.assert_member(p_code, p_player_id, p_secret);
  select * into v_room from kilomax_online.rooms where code = p_code;
  v_changed := v_room.version is distinct from p_known_version;
  return jsonb_build_object(
    'code', v_room.code,
    'status', v_room.status,
    'hostId', v_room.host_id,
    'settings', v_room.settings,
    'players', v_room.players,
    'online', (
      select coalesce(jsonb_agg(m.player_id), '[]'::jsonb)
        from kilomax_online.room_members as m
       where m.code = p_code and m.last_seen > now() - interval '15 seconds'),
    'version', v_room.version,
    'lastActor', v_room.last_actor,
    'state', case when v_changed then v_room.state end,
    'events', case when v_changed then v_room.events end
  );
end;
$$;

-- Public preview of a room for someone opening an invite link.
create function public.kilomax_room_info(p_code text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
           'code', r.code,
           'status', r.status,
           'settings', r.settings,
           'players', (
             select coalesce(jsonb_agg(jsonb_build_object('name', p ->> 'name', 'color', p ->> 'color') order by ord), '[]'::jsonb)
               from jsonb_array_elements(r.players) with ordinality as t(p, ord)))
    from kilomax_online.rooms as r
   where r.code = upper(btrim(p_code));
$$;

revoke execute on function public.kilomax_create_room(text, text, text, integer) from public;
grant execute on function public.kilomax_create_room(text, text, text, integer) to anon, authenticated;
revoke execute on function public.kilomax_join_room(text, text, text) from public;
grant execute on function public.kilomax_join_room(text, text, text) to anon, authenticated;
revoke execute on function public.kilomax_set_ready(text, text, uuid, boolean) from public;
grant execute on function public.kilomax_set_ready(text, text, uuid, boolean) to anon, authenticated;
revoke execute on function public.kilomax_leave_room(text, text, uuid) from public;
grant execute on function public.kilomax_leave_room(text, text, uuid) to anon, authenticated;
revoke execute on function public.kilomax_start_game(text, text, uuid, jsonb) from public;
grant execute on function public.kilomax_start_game(text, text, uuid, jsonb) to anon, authenticated;
revoke execute on function public.kilomax_commit_state(text, text, uuid, integer, jsonb, jsonb) from public;
grant execute on function public.kilomax_commit_state(text, text, uuid, integer, jsonb, jsonb) to anon, authenticated;
revoke execute on function public.kilomax_room_sync(text, text, uuid, integer) from public;
grant execute on function public.kilomax_room_sync(text, text, uuid, integer) to anon, authenticated;
revoke execute on function public.kilomax_room_info(text) from public;
grant execute on function public.kilomax_room_info(text) to anon, authenticated;

-- Kilomax: 20261001090000_six_players_1500km.sql
-- KILOMAX — jusqu'à 6 pilotes et nouvelle course de 1500 km.
--
-- Refait create_room et join_room (create or replace : les droits d'exécution
-- accordés par la migration précédente sont conservés) :
--   * distances autorisées : 700, 1000 et 1500 km (la course de 400 km disparaît) ;
--   * 6 joueurs maximum par partie ;
--   * 2 nouvelles couleurs de pilote : violet et rose.

-- ---------------------------------------------------------------- création

create or replace function public.kilomax_create_room(p_player_id text, p_name text, p_ambiance text, p_target integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := kilomax_online.clean_name(p_name);
  v_code text;
  v_secret uuid;
begin
  perform kilomax_online.check_player_id(p_player_id);
  if p_ambiance not in ('jour', 'crepuscule', 'nuit') then
    raise exception 'Ambiance invalide' using errcode = '22023';
  end if;
  -- Distances proposées : Courte 700, Standard 1000, Longue 1500.
  if p_target not in (700, 1000, 1500) then
    raise exception 'Distance invalide' using errcode = '22023';
  end if;

  -- Ménage : on oublie les parties que personne n'a touchées depuis quelques jours.
  delete from kilomax_online.rooms where updated_at < now() - interval '3 days';

  v_code := kilomax_online.new_code();
  insert into kilomax_online.rooms (code, host_id, settings, players)
  values (
    v_code,
    p_player_id,
    jsonb_build_object('ambiance', p_ambiance, 'target', p_target),
    jsonb_build_array(jsonb_build_object('id', p_player_id, 'name', v_name, 'color', 'crimson', 'ready', false))
  );
  insert into kilomax_online.room_members (code, player_id) values (v_code, p_player_id)
  returning secret into v_secret;

  return jsonb_build_object('code', v_code, 'secret', v_secret);
end;
$$;

-- ---------------------------------------------------------------- arrivée d'un pilote

create or replace function public.kilomax_join_room(p_code text, p_player_id text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := kilomax_online.clean_name(p_name);
  v_room kilomax_online.rooms%rowtype;
  v_color text;
  v_secret uuid;
begin
  perform kilomax_online.check_player_id(p_player_id);
  select * into v_room from kilomax_online.rooms where code = upper(btrim(p_code)) for update;
  if not found then
    raise exception 'Partie introuvable' using errcode = 'P0002';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'La partie a déjà commencé' using errcode = '55000';
  end if;
  if exists (select 1 from kilomax_online.room_members where code = v_room.code and player_id = p_player_id) then
    raise exception 'Vous êtes déjà dans cette partie' using errcode = '23505';
  end if;
  -- 6 pilotes au maximum (une couleur chacun).
  if jsonb_array_length(v_room.players) >= 6 then
    raise exception 'Partie complète (6 joueurs maximum)' using errcode = '55000';
  end if;

  -- Première couleur encore libre, dans l'ordre d'arrivée habituel.
  select c into v_color
    from unnest(array['crimson', 'azure', 'amber', 'emerald', 'violet', 'rose']) with ordinality as t(c, ord)
   where not exists (select 1 from jsonb_array_elements(v_room.players) as p where p ->> 'color' = t.c)
   order by ord
   limit 1;

  update kilomax_online.rooms
     set players = players || jsonb_build_array(
           jsonb_build_object('id', p_player_id, 'name', v_name, 'color', v_color, 'ready', false)),
         updated_at = now()
   where code = v_room.code;
  insert into kilomax_online.room_members (code, player_id) values (v_room.code, p_player_id)
  returning secret into v_secret;

  return jsonb_build_object('code', v_room.code, 'secret', v_secret);
end;
$$;

-- Kilomax: 20261005090000_room_car.sql
-- Each pilot picks their car in the lobby. Stored with the player in rooms.players
-- (key "car"); the host reads it when dealing the game. Additive: nothing else changes.

create function public.kilomax_set_car(p_code text, p_player_id text, p_secret uuid, p_car text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform kilomax_online.assert_member(p_code, p_player_id, p_secret);
  if p_car is null or p_car !~ '^[a-z][a-z-]{1,23}$' then
    raise exception 'invalid car' using errcode = '22023';
  end if;
  update kilomax_online.rooms
     set players = (
           select jsonb_agg(
                    case when p ->> 'id' = p_player_id then jsonb_set(p, '{car}', to_jsonb(p_car)) else p end
                    order by ord)
             from jsonb_array_elements(players) with ordinality as t(p, ord)),
         updated_at = now()
   where code = p_code and status = 'lobby';
end;
$$;

revoke execute on function public.kilomax_set_car(text, text, uuid, text) from public;
revoke execute on function public.kilomax_set_car(text, text, uuid, text) from public;
grant execute on function public.kilomax_set_car(text, text, uuid, text) to anon, authenticated;

-- Kilomax: 20261014090000_absent_host_skip.sql
-- An online game must not freeze when the driver whose turn it is has left
-- AND the host (who normally passes that turn) is away too. In that case any
-- pilot still at the table may commit — in practice, pass the absent driver's
-- turn. "Away" uses the same 15-second window as the presence list.
-- Same signature as before: `create or replace` keeps the grants.

create or replace function public.kilomax_commit_state(
  p_code text,
  p_player_id text,
  p_secret uuid,
  p_expected_version integer,
  p_state jsonb,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room kilomax_online.rooms%rowtype;
  v_current text;
begin
  perform kilomax_online.assert_member(p_code, p_player_id, p_secret);
  select * into v_room from kilomax_online.rooms where code = p_code for update;
  if v_room.status <> 'playing' or v_room.version <> p_expected_version then
    return jsonb_build_object('ok', false, 'version', v_room.version);
  end if;

  v_current := v_room.state -> 'players' -> ((v_room.state ->> 'currentPlayerIndex')::int) ->> 'id';
  if p_player_id <> v_current and p_player_id <> v_room.host_id then
    -- someone else's turn: only allowed when both that driver and the host are gone
    if exists (
      select 1
        from kilomax_online.room_members as m
       where m.code = p_code
         and m.player_id in (v_current, v_room.host_id)
         and m.last_seen > now() - interval '15 seconds'
    ) then
      raise exception 'Ce n''est pas votre tour' using errcode = '42501';
    end if;
  end if;
  if kilomax_online.player_ids(p_state -> 'players') <> kilomax_online.player_ids(v_room.state -> 'players') then
    raise exception 'État invalide' using errcode = '22023';
  end if;
  if pg_column_size(p_state) > 262144 or jsonb_array_length(coalesce(p_events, '[]'::jsonb)) > 30 then
    raise exception 'État trop volumineux' using errcode = '54000';
  end if;

  update kilomax_online.rooms
     set state = p_state,
         events = coalesce(p_events, '[]'::jsonb),
         last_actor = p_player_id,
         version = version + 1,
         status = case when p_state ->> 'phase' = 'gameover' then 'finished' else 'playing' end,
         updated_at = now()
   where code = p_code;
  return jsonb_build_object('ok', true, 'version', v_room.version + 1);
end;
$$;

-- Kilomax: 20261121112711_premium_garage.sql
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema kilomax_commerce;
revoke all on schema kilomax_commerce from public, anon, authenticated;
create table kilomax_commerce.signing_key (
  singleton boolean primary key default true check (singleton),
  secret text not null check (length(secret) >= 32)
);
revoke all on kilomax_commerce.signing_key from public, anon, authenticated;

create function kilomax_commerce.premium_car(p_car text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_car in ('concept-gt', 'gt-circuit', 'pickup-classic', 'moto-amethyste', 'chenille'), false)
$$;

create function kilomax_commerce.valid_signature(p_message text, p_signature text)
returns boolean language sql stable set search_path = '' as $$
  select coalesce((
    select encode(extensions.hmac(convert_to(p_message, 'UTF8'), convert_to(secret, 'UTF8'), 'sha256'), 'hex') = p_signature
    from kilomax_commerce.signing_key
  ), false)
$$;

create or replace function public.kilomax_set_car(p_code text, p_player_id text, p_secret uuid, p_car text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform kilomax_online.assert_member(p_code, p_player_id, p_secret);
  if p_car is null or p_car !~ '^[a-z][a-z-]{1,23}$' or kilomax_commerce.premium_car(p_car) then
    raise exception 'Ce véhicule demande une autorisation d’achat.' using errcode = '22023';
  end if;
  update kilomax_online.rooms set players = (
    select jsonb_agg(case when p ->> 'id' = p_player_id then jsonb_set(p, '{car}', to_jsonb(p_car)) else p end order by ord)
    from jsonb_array_elements(players) with ordinality as t(p, ord)
  ), updated_at = now() where code = p_code and status = 'lobby';
end;
$$;

create function public.kilomax_set_premium_car(
  p_code text, p_player_id text, p_secret uuid, p_car text, p_expires bigint, p_signature text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_now bigint := floor(extract(epoch from now()))::bigint;
begin
  perform kilomax_online.assert_member(p_code, p_player_id, p_secret);
  if not kilomax_commerce.premium_car(p_car) or p_expires is null or p_expires < v_now or p_expires > v_now + 120 or
      not kilomax_commerce.valid_signature(
        'kilomax-car-v1.' || p_code || '.' || p_player_id || '.' || p_secret || '.' || p_car || '.' || p_expires,
        p_signature
      ) then
    raise exception 'Véhicule premium indisponible pour cette place.' using errcode = '22023';
  end if;
  update kilomax_online.rooms set players = (
    select jsonb_agg(case when p ->> 'id' = p_player_id then jsonb_set(p, '{car}', to_jsonb(p_car)) else p end order by ord)
    from jsonb_array_elements(players) with ordinality as t(p, ord)
  ), updated_at = now() where code = p_code and status = 'lobby';
end;
$$;
revoke execute on function public.kilomax_set_premium_car(text, text, uuid, text, bigint, text) from public;
revoke execute on function public.kilomax_set_premium_car(text, text, uuid, text, bigint, text) from public;
grant execute on function public.kilomax_set_premium_car(text, text, uuid, text, bigint, text) to anon, authenticated;

create function kilomax_commerce.check_race_commerce()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_car jsonb;
  v_receipt jsonb;
  v_old_receipts jsonb := '[]'::jsonb;
  v_receipts jsonb := coalesce(new.state -> 'usedChestReceipts', '[]'::jsonb);
  v_match text := (new.state ->> 'id') || ':' || (new.state ->> 'startedAt');
  v_previous_driver text;
begin
  for v_car in select value from jsonb_array_elements(coalesce(new.state -> 'players', '[]'::jsonb)) loop
    if kilomax_commerce.premium_car(v_car ->> 'car') and not exists (
      select 1 from jsonb_array_elements(new.players) as lobby(driver)
      where driver ->> 'id' = v_car ->> 'id' and driver ->> 'car' = v_car ->> 'car'
    ) then raise exception 'Véhicule non autorisé dans cette course.' using errcode = '22023';
    end if;
  end loop;
  if old.status = 'playing' then
    v_old_receipts := coalesce(old.state -> 'usedChestReceipts', '[]'::jsonb);
    v_previous_driver := old.state -> 'players' -> ((old.state ->> 'currentPlayerIndex')::integer) ->> 'id';
  end if;
  if not (v_receipts @> v_old_receipts) then
    raise exception 'Reçu de coffre manquant.' using errcode = '22023';
  end if;
  for v_receipt in select value from jsonb_array_elements(v_receipts) loop
    if v_old_receipts @> jsonb_build_array(v_receipt) then continue; end if;
    if old.status <> 'playing' or old.state ->> 'phase' <> 'action' or new.last_actor is distinct from v_previous_driver or
       v_receipt ->> 'player' is distinct from v_previous_driver or
       not kilomax_commerce.valid_signature(
         'kilomax-chest-v1.' || (v_receipt ->> 'id') || '.' || v_match || '.' ||
         (v_receipt ->> 'player') || '.' || (v_receipt ->> 'reward'), v_receipt ->> 'proof'
       ) or exists (select 1 from jsonb_array_elements(v_old_receipts) prior where prior ->> 'player' = v_previous_driver) then
      raise exception 'Reçu de coffre invalide.' using errcode = '22023';
    end if;
  end loop;
  return new;
end;
$$;

create trigger kilomax_race_commerce before update of state on kilomax_online.rooms
for each row execute function kilomax_commerce.check_race_commerce();
