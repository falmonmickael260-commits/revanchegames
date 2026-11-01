-- Room codes authorize manual guest joins. Publishing verified rooms must not
-- turn an otherwise private code into an anonymously enumerable directory.
create function public.can_view_game_room(p_game text,p_room text,p_instance text) returns boolean
language sql stable security definer set search_path=public as $$
  select auth.uid() is not null and (
    exists(select 1 from public.game_room_memberships m where m.user_id=auth.uid()
      and m.game_slug=p_game and m.room_code=p_room and m.instance_key=p_instance)
    or exists(select 1 from public.game_invitations i where i.game_slug=p_game
      and i.room_code=p_room and i.room_instance=p_instance and auth.uid() in (i.from_user_id,i.to_user_id)
      and (i.status='accepted' or (i.status='pending' and i.expires_at>now())))
  );
$$;
revoke all on function public.can_view_game_room(text,text,text) from public,anon;
grant execute on function public.can_view_game_room(text,text,text) to authenticated;
drop policy "room_registry_select_all" on public.room_registry;
create policy room_registry_involved on public.room_registry for select to authenticated
using(public.can_view_game_room(game_slug,room_code,instance_key));
