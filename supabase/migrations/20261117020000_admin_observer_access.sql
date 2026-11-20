begin;
create function public.admin_observer_room(p_room uuid,p_access uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.admin_allowed('moderate') then raise exception 'permission refusée' using errcode='42501'; end if;
  if not exists(select 1 from public.admin_audit where id=p_access and actor_id=auth.uid() and action='spectate'
    and target=p_room::text and created_at>now()-interval '30 minutes') then raise exception 'accès spectateur expiré' using errcode='42501'; end if;
  select jsonb_build_object('game',game_slug,'room',room_code,'instance',instance_key) into result
    from public.room_registry where id=p_room;
  return result;
end $$;
revoke all on function public.admin_observer_room(uuid,uuid) from public,anon;
grant execute on function public.admin_observer_room(uuid,uuid) to authenticated;
commit;
