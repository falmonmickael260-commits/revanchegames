-- Genuine voice invitations reuse the private message realtime channel and RLS.
alter table public.direct_messages
  add column voice_room_id text,
  add column voice_room_sid text,
  add column voice_expires_at timestamptz,
  add constraint direct_messages_voice_complete check (
    (voice_room_id is null and voice_room_sid is null and voice_expires_at is null)
    or (voice_room_id is not null and voice_room_sid is not null and voice_expires_at is not null
        and voice_room_id ~ '^rg-social-[0-9a-f-]{36}$' and length(voice_room_sid) between 1 and 128)
  );

create function public.send_verified_voice_invitation(
  p_from uuid, p_to uuid, p_room_id text, p_room_sid text, p_title text
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_sender text;
begin
  if p_from=p_to or not public.are_friends(p_from,p_to) or public.is_blocked_between(p_from,p_to) then
    raise exception 'Invitation réservée aux amis.' using errcode='42501';
  end if;
  -- Serialize concurrent invitations from the same sender (including multiple tabs).
  perform pg_advisory_xact_lock(hashtextextended('voice-invite:'||p_from::text,0));
  if exists(select 1 from public.direct_messages where from_user_id=p_from and to_user_id=p_to
      and voice_room_sid=p_room_sid and created_at>now()-interval '30 seconds') then
    raise exception 'Invitation déjà envoyée. Réessaie dans 30 secondes.' using errcode='P0001';
  end if;
  if (select count(*) from public.direct_messages where from_user_id=p_from and voice_room_id is not null
      and created_at>now()-interval '1 minute') >= 20 then
    raise exception 'Trop d’invitations. Réessaie dans une minute.' using errcode='P0001';
  end if;
  select username into strict v_sender from public.profiles where id=p_from;
  insert into public.direct_messages(from_user_id,to_user_id,body,voice_room_id,voice_room_sid,voice_expires_at)
    values(p_from,p_to,left(v_sender||' t’invite à rejoindre le salon vocal « '||left(p_title,60)||' ».',1000),
      p_room_id,p_room_sid,now()+interval '15 minutes') returning id into v_id;
  return v_id;
end; $$;
-- Only the platform server may certify an existing LiveKit room and sender membership.
revoke all on function public.send_verified_voice_invitation(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.send_verified_voice_invitation(uuid,uuid,text,text,text) to service_role;
