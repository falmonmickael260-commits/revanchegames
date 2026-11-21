-- A brief mobile app switch can suspend polling. Use the same grace period
-- for the room presence indicator and the disconnected-driver turn guard.

create or replace function public.kilomax_room_sync(p_code text, p_player_id text, p_secret uuid, p_known_version integer)
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
       where m.code = p_code and m.last_seen > now() - interval '60 seconds'),
    'version', v_room.version,
    'lastActor', v_room.last_actor,
    'state', case when v_changed then v_room.state end,
    'events', case when v_changed then v_room.events end
  );
end;
$$;

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
         and m.last_seen > now() - interval '60 seconds'
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
