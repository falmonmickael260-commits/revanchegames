-- Verified Tabou identity / invitations: callable only by the trusted RG backend.
grant select,insert,update,delete on public.taboo_players,public.taboo_rooms,public.taboo_cards to service_role;
create or replace function public.taboo_platform_bind_member(p_code text,p_token text,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_room public.taboo_rooms%rowtype; v_player public.taboo_players%rowtype; v_count integer;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Session invalide.'; end if;
  if p_user_id is null or not exists(select 1 from public.profiles where id=p_user_id)
  then raise exception 'Profil introuvable.'; end if;
  select * into v_room from public.taboo_rooms where code=upper(trim(p_code));
  if v_room.id is null then raise exception 'Salon introuvable.'; end if;
  select * into v_player from public.taboo_players
    where room_id=v_room.id and token_hash=encode(sha256(decode(p_token,'hex')),'hex') for update;
  if v_player.id is null then raise exception 'Rejoins le salon avant d inviter un ami.'; end if;
  if v_player.platform_user_id is not null and v_player.platform_user_id<>p_user_id
  then raise exception 'Cette session appartient a un autre compte.'; end if;
  if exists(select 1 from public.taboo_players where room_id=v_room.id
     and platform_user_id=p_user_id and id<>v_player.id)
  then raise exception 'Ce compte participe deja avec une autre session.'; end if;
  update public.taboo_players set platform_user_id=p_user_id
    where id=v_player.id;
  select count(*) into v_count from public.taboo_players where room_id=v_room.id;
  return jsonb_build_object('code',v_room.code,'instance',v_room.id::text,
    'capacity',8,'count',v_count,
    'status',case when v_room.status='lobby' then 'open'
                  when v_room.status='playing' then 'started' else 'closed' end);
end $$;
revoke all on function public.taboo_platform_bind_member(text,text,uuid) from public,anon,authenticated;
grant execute on function public.taboo_platform_bind_member(text,text,uuid) to service_role;

create or replace function public.taboo_platform_admit(
  p_code text, p_instance uuid, p_inviter_id uuid, p_inviter_token text,
  p_user_id uuid, p_name text, p_token text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_room public.taboo_rooms%rowtype; v_team text; v_count_a integer; v_count_b integer; v_new uuid;
begin
  if p_inviter_token is null or p_inviter_token !~ '^[a-f0-9]{64}$'
    or p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Jeton de salon invalide.';
  end if;
  if p_user_id is null or p_user_id=p_inviter_id
    or not exists(select 1 from public.profiles where id=p_user_id)
    or not exists(select 1 from public.profiles where id=p_inviter_id)
    then raise exception 'Utilisateur invalide.';
  end if;
  select * into v_room from public.taboo_rooms
    where code=upper(trim(p_code)) and id=p_instance for update;
  if v_room.id is null or v_room.status<>'lobby' then
    raise exception 'Ce salon ne permet plus de rejoindre.';
  end if;
  if not exists(select 1 from public.taboo_players
      where room_id=v_room.id and platform_user_id=p_inviter_id
        and token_hash=encode(sha256(decode(p_inviter_token,'hex')),'hex'))
    then raise exception 'Createur de l invitation non verifie.';
  end if;
  if exists(select 1 from public.taboo_players where room_id=v_room.id and platform_user_id=p_user_id)
    then raise exception 'Ce compte participe deja au salon.';
  end if;
  select count(*) filter(where team='A'),count(*) filter(where team='B')
    into v_count_a,v_count_b from public.taboo_players where room_id=v_room.id;
  if v_count_a>=4 and v_count_b>=4 then raise exception 'Le salon est complet.'; end if;
  v_team:=case when v_count_a>=4 then 'B' when v_count_b>=4 then 'A'
               when v_count_a<=v_count_b then 'A' else 'B' end;
  insert into public.taboo_players(room_id,token_hash,name,team,platform_user_id)
    values(v_room.id,encode(sha256(decode(p_token,'hex')),'hex'),
      left(trim(coalesce(p_name,'')),24),v_team,p_user_id)
    returning id into v_new;
  return jsonb_build_object('code',v_room.code,'token',p_token,'playerId',v_new);
end $$;
revoke all on function public.taboo_platform_admit(text,uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.taboo_platform_admit(text,uuid,uuid,text,uuid,text,text) to service_role;
