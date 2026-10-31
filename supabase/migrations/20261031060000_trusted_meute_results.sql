-- Même une ancienne copie publique de /api/report-result ne peut plus
-- produire de résultat La Meute via l'ancienne RPC. Le serveur du jeu utilise
-- une RPC dédiée, non appelable par anon/authenticated.
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
  if p_game_slug = 'la-meute' then
    raise exception 'Les résultats La Meute exigent le serveur de confiance.' using errcode = '42501';
  end if;
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


create or replace function public.record_la_meute_result(
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
  values ('la-meute', p_room_code, p_idempotency_key, p_raw_payload)
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

revoke all on function public.record_la_meute_result from public, anon, authenticated;
grant execute on function public.record_la_meute_result to service_role;
