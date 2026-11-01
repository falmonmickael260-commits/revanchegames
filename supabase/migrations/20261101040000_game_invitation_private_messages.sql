-- An invitation and its private message are committed atomically, including
-- invitations sent to groups. User-written text cannot create a join action.
alter table public.direct_messages add column invitation_id uuid
  references public.game_invitations(id) on delete cascade;
create unique index direct_messages_invitation_unique on public.direct_messages(invitation_id)
  where invitation_id is not null;

create function public.message_game_invitation() returns trigger
language plpgsql security definer set search_path=public as $$
declare sender text; game_name text;
begin
  select username into strict sender from public.profiles where id=new.from_user_id;
  select display_name into strict game_name from public.game_catalog where slug=new.game_slug;
  insert into public.direct_messages(from_user_id,to_user_id,body,invitation_id)
  values(new.from_user_id,new.to_user_id,
    left(sender||case when new.room_code is null then ' t’invite à jouer à ' else ' t’invite à rejoindre sa partie de ' end||game_name||'.',1000),new.id);
  return new;
end; $$;
revoke all on function public.message_game_invitation() from public,anon,authenticated;
create trigger game_invitation_private_message after insert on public.game_invitations
for each row execute function public.message_game_invitation();
