-- Native credentials are encrypted by the platform and never readable by clients.
alter table public.room_registry add column instance_key text;
alter table public.room_registry add column refreshed_at timestamptz;
alter table public.game_invitations add column room_instance text;

create table public.game_room_memberships (
  user_id uuid not null references public.profiles(id),
  game_slug text not null references public.game_catalog(slug),
  room_code text not null,
  instance_key text not null,
  sealed_session text not null,
  verified_at timestamptz not null default now(),
  primary key(user_id,game_slug,room_code)
);
create table public.game_admissions (
  invitation_id uuid primary key references public.game_invitations(id),
  user_id uuid not null references public.profiles(id),
  lease_token uuid,
  lease_until timestamptz,
  sealed_session text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.game_room_memberships enable row level security;
alter table public.game_admissions enable row level security;
revoke all on public.game_room_memberships,public.game_admissions from public,anon,authenticated;
grant all on public.game_room_memberships,public.game_admissions to service_role;

-- Covers direct and group invitations, including calls that bypass the UI.
create function public.check_direct_invitation_room() returns trigger
language plpgsql security definer set search_path=public as $$
declare r public.room_registry;
begin
  if new.room_code is null then return new; end if;
  select * into r from public.room_registry where game_slug=new.game_slug and room_code=new.room_code;
  if r.id is null or r.instance_key is null or r.refreshed_at < now()-interval '90 seconds' then
    raise exception 'salon introuvable ou non vérifié' using errcode='55000';
  end if;
  if r.status <> 'open' or r.player_count>=r.capacity then
    raise exception 'ce salon est complet ou ne permet plus de rejoindre' using errcode='55000';
  end if;
  if not exists(select 1 from public.game_room_memberships m where m.user_id=new.from_user_id
    and m.game_slug=new.game_slug and m.room_code=new.room_code and m.instance_key=r.instance_key
    and m.verified_at>now()-interval '90 seconds') then
    raise exception 'votre présence dans le salon doit être vérifiée' using errcode='42501';
  end if;
  new.room_instance:=r.instance_key;
  return new;
end; $$;
revoke all on function public.check_direct_invitation_room() from public,anon,authenticated;
create trigger direct_invitation_room before insert on public.game_invitations
for each row execute function public.check_direct_invitation_room();

create function public.claim_game_admission(p_invitation uuid,p_lease uuid) returns public.game_admissions
language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); i public.game_invitations; a public.game_admissions;
begin
  if me is null then raise exception 'authentification requise' using errcode='42501'; end if;
  select * into i from public.game_invitations where id=p_invitation for update;
  if i.id is null or i.to_user_id<>me then raise exception 'invitation introuvable' using errcode='42501'; end if;
  if i.room_code is null or i.room_instance is null then raise exception 'salon non vérifié' using errcode='55000'; end if;
  if public.is_blocked_between(i.from_user_id,me) or not public.are_friends(i.from_user_id,me) then
    raise exception 'relation amicale indisponible' using errcode='42501';
  end if;
  select * into a from public.game_admissions where invitation_id=i.id;
  if a.completed_at is not null and i.status='accepted' then return a; end if;
  if i.status<>'pending' or i.expires_at<=now() then raise exception 'invitation expirée ou déjà traitée' using errcode='55000'; end if;
  if a.lease_until>clock_timestamp() then raise exception 'connexion déjà en cours, réessayez' using errcode='55000'; end if;
  insert into public.game_admissions(invitation_id,user_id,lease_token,lease_until)
  values(i.id,me,p_lease,clock_timestamp()+interval '30 seconds')
  on conflict(invitation_id) do update set lease_token=excluded.lease_token,lease_until=excluded.lease_until
  returning * into a;
  return a;
end; $$;
revoke all on function public.claim_game_admission(uuid,uuid) from public,anon;
grant execute on function public.claim_game_admission(uuid,uuid) to authenticated;

create function public.complete_game_admission(p_invitation uuid,p_lease uuid,p_session text) returns void
language plpgsql security definer set search_path=public as $$
declare i public.game_invitations;
begin
  select * into strict i from public.game_invitations where id=p_invitation for update;
  if i.status<>'pending' then raise exception 'invitation déjà traitée' using errcode='55000'; end if;
  update public.game_admissions set sealed_session=p_session,completed_at=now(),lease_token=null,lease_until=null
  where invitation_id=i.id and lease_token=p_lease and completed_at is null;
  if not found then raise exception 'tentative remplacée' using errcode='55000'; end if;
  update public.game_invitations set status='accepted',responded_at=now() where id=i.id;
  insert into public.notifications(user_id,kind,actor_id,game_slug,invitation_id)
  values(i.from_user_id,'invitation_accepted',i.to_user_id,i.game_slug,i.id);
end; $$;
revoke all on function public.complete_game_admission(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.complete_game_admission(uuid,uuid,text) to service_role;

-- The historical RPC cannot bypass server admission for new direct invitations.
alter function public.respond_to_game_invitation(uuid,boolean) rename to respond_to_game_invitation_legacy;
revoke all on function public.respond_to_game_invitation_legacy(uuid,boolean) from public,anon,authenticated;
create function public.respond_to_game_invitation(p_invitation_id uuid,p_accept boolean)
returns table(status text,game_slug text,room_code text)
language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.game_invitations i where i.id=p_invitation_id for update;
  if not p_accept and exists(select 1 from public.game_admissions a where a.invitation_id=p_invitation_id and a.lease_until>clock_timestamp()) then
    raise exception 'connexion en cours, réessayez' using errcode='55000';
  end if;
  if p_accept and exists(select 1 from public.game_invitations i where i.id=p_invitation_id and i.room_instance is not null) then
    raise exception 'utilisez la connexion sécurisée au salon' using errcode='42501';
  end if;
  return query select * from public.respond_to_game_invitation_legacy(p_invitation_id,p_accept);
end; $$;
revoke all on function public.respond_to_game_invitation(uuid,boolean) from public,anon;
grant execute on function public.respond_to_game_invitation(uuid,boolean) to authenticated;
