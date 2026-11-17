-- Additive administration of the existing platform. No duplicate player accounts.
begin;
create table public.admin_members (
  user_id uuid primary key references public.profiles(id),
  role text not null check(role in ('owner','admin','moderator','support')),
  can_credit boolean not null default false,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
-- Existing support operators retain support access, subject to MFA. Financial
-- authority and ownership are never inferred from the old binary membership.
insert into public.admin_members(user_id,role)
  select user_id,'support' from public.support_admins;
create function public.sync_legacy_support_admin() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='DELETE' then delete from public.support_admins where user_id=old.user_id;return old;end if;
  if new.enabled and new.role in ('owner','admin','support') then
    insert into public.support_admins(user_id) values(new.user_id) on conflict do nothing;
  else delete from public.support_admins where user_id=new.user_id;end if;
  return new;
end $$;
revoke all on function public.sync_legacy_support_admin() from public,anon,authenticated;
create trigger admin_sync_support after insert or update or delete on public.admin_members
  for each row execute function public.sync_legacy_support_admin();
create table public.admin_audit (
  id uuid primary key, actor_id uuid not null references public.profiles(id),
  action text not null, target text not null, reason text not null,
  before_value jsonb, after_value jsonb, created_at timestamptz not null default now()
);
create table public.admin_operations (
  id uuid primary key, actor_id uuid not null, action text not null,
  payload jsonb not null, result jsonb not null, created_at timestamptz not null default now()
);
create table public.admin_notes (
  id uuid primary key default gen_random_uuid(), actor_id uuid not null references public.profiles(id),
  target_type text not null check(target_type in ('player','report','ticket')),
  target_id uuid not null, body text not null check(char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index admin_notes_target on public.admin_notes(target_type,target_id,created_at);
create table public.player_sanctions (
  id uuid primary key, user_id uuid not null references public.profiles(id),
  kind text not null check(kind in ('warning','mute','suspend','ban')),
  reason text not null check(char_length(reason) between 3 and 1000),
  actor_id uuid not null references public.profiles(id), expires_at timestamptz,
  revoked_at timestamptz, revoked_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check(kind not in ('mute','suspend') or expires_at is not null),
  check(kind <> 'ban' or expires_at is null)
);
create index sanctions_active_user on public.player_sanctions(user_id,kind) where revoked_at is null;
create table public.game_admin_settings (
  game_slug text primary key references public.game_catalog(slug),
  maintenance boolean not null default false, message text not null default '',
  updated_at timestamptz not null default now()
);
create table public.admin_announcements (
  id uuid primary key, body text not null check(char_length(body) between 3 and 2000),
  user_id uuid references public.profiles(id), actor_id uuid not null references public.profiles(id),
  expires_at timestamptz, created_at timestamptz not null default now()
);
create table public.admin_assignments (
  target_type text not null check(target_type in ('report','ticket')),
  target_id uuid not null, assignee uuid references public.admin_members(user_id),
  primary key(target_type,target_id)
);
-- Evidence is separated from reports: adding private fields to reports would leak
-- them through the existing reporter SELECT policy.
create table public.report_evidence (
  report_id uuid primary key references public.reports(id),
  message_id uuid, snapshot jsonb, attachment_path text,
  created_at timestamptz not null default now()
);

create function public.admin_allowed(p_permission text) returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce((select
    case p_permission
      when 'read' then true
      when 'moderate' then m.role in ('owner','admin','moderator')
      when 'support' then m.role in ('owner','admin','support')
      when 'economy' then m.role in ('owner','admin')
      when 'credit' then m.role='owner' or (m.role='admin' and m.can_credit)
      when 'manage' then m.role in ('owner','admin')
      when 'members' then m.role='owner'
      else false end
    from public.admin_members m join auth.users u on u.id=m.user_id
    where m.user_id=auth.uid() and m.enabled and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false)
      and auth.jwt()->>'aal'='aal2'),false);
$$;
revoke all on function public.admin_allowed(text) from public,anon;
grant execute on function public.admin_allowed(text) to authenticated;

-- Existing support entry points also require the current role and MFA.
-- Provision the first owner before activating this migration in production.
create or replace function public.is_support_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select public.admin_allowed('support');
$$;

do $$ declare n text; begin
  foreach n in array array['admin_members','admin_audit','admin_operations','admin_notes',
    'player_sanctions','game_admin_settings','admin_announcements','admin_assignments','report_evidence'] loop
    execute format('alter table public.%I enable row level security',n);
    execute format('revoke all on public.%I from anon,authenticated',n);
    execute format('grant select on public.%I to authenticated',n);
    execute format('grant all on public.%I to service_role',n);
  end loop;
end $$;
create policy admin_members_read on public.admin_members for select to authenticated using(public.admin_allowed('members') or user_id=auth.uid());
create policy admin_audit_read on public.admin_audit for select to authenticated using(public.admin_allowed('manage'));
create policy admin_notes_read on public.admin_notes for select to authenticated using(
  public.admin_allowed(case target_type when 'report' then 'moderate' when 'ticket' then 'support' else 'read' end));
create policy sanctions_read on public.player_sanctions for select to authenticated using(user_id=auth.uid() or public.admin_allowed('moderate'));
grant select on public.game_admin_settings to anon;
create policy game_settings_read on public.game_admin_settings for select to anon,authenticated using(true);
create policy announcement_read on public.admin_announcements for select to authenticated using(
  (user_id is null or user_id=auth.uid() or public.admin_allowed('manage')) and (expires_at is null or expires_at>now()));
create policy evidence_admin_read on public.report_evidence for select to authenticated using(public.admin_allowed('moderate'));
create policy assignment_admin_read on public.admin_assignments for select to authenticated using(public.admin_allowed(case target_type when 'report' then 'moderate' else 'support' end));

create function public.player_restricted(p_user uuid,p_chat boolean default false) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.player_sanctions where user_id=p_user and revoked_at is null
    and (expires_at is null or expires_at>now()) and (kind in ('suspend','ban') or (p_chat and kind='mute')));
$$;
revoke all on function public.player_restricted(uuid,boolean) from public,anon;
grant execute on function public.player_restricted(uuid,boolean) to authenticated,service_role;
-- Triggers also cover SECURITY DEFINER chat RPCs, which bypass RLS.
create function public.enforce_chat_sanction() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is not null and public.player_restricted(auth.uid(),true) then
    raise exception 'utilisation du tchat restreinte' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.enforce_chat_sanction() from public,anon,authenticated;
do $$ declare n text; begin
  foreach n in array array['chat_messages','direct_messages','friend_group_messages'] loop
    if to_regclass('public.'||n) is not null then
      execute format('create trigger admin_chat_sanction before insert on public.%I for each row execute function public.enforce_chat_sanction()',n);
    end if;
  end loop;
end $$;
create function public.my_platform_access() returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('restricted',public.player_restricted(auth.uid(),false),
    'chatRestricted',public.player_restricted(auth.uid(),true));
$$;
revoke all on function public.my_platform_access() from public,anon;
grant execute on function public.my_platform_access() to authenticated;
-- Restrictive policies intersect with every existing permissive insert policy.
create policy admin_chat_sanctions on public.chat_messages as restrictive for insert to authenticated
  with check(not public.player_restricted(auth.uid(),true));
do $$ declare n text; begin
  foreach n in array array['direct_messages','friend_group_messages'] loop
    if to_regclass('public.'||n) is not null then
      execute format('create policy admin_chat_sanctions on public.%I as restrictive for insert to authenticated with check(not public.player_restricted(auth.uid(),true))',n);
    end if;
  end loop;
end $$;

create function public.admin_execute(p_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); previous public.admin_operations; target uuid;
  before_data jsonb; result jsonb; reason text:=btrim(p_payload->>'reason'); permission text;
  delta bigint; balance bigint; r public.admin_members; v_target_type text;
begin
  permission:=case p_action when 'wallet' then 'credit' when 'sanction' then 'moderate'
    when 'revoke' then 'moderate' when 'report' then 'moderate' when 'ticket' then 'support'
    when 'reconcile' then 'credit' when 'spectate' then 'moderate' when 'promo' then 'economy' when 'game' then 'manage' when 'announce' then 'manage' when 'member' then 'members'
    when 'note' then case p_payload->>'type' when 'report' then 'moderate' when 'ticket' then 'support' else 'read' end
    when 'assign' then case p_payload->>'type' when 'report' then 'moderate' else 'support' end else 'unknown' end;
  if not public.admin_allowed(permission) then raise exception 'administration non autorisée' using errcode='42501'; end if;
  if p_id is null or p_payload is null or reason is null or char_length(reason) not between 3 and 1000 then
    raise exception 'motif obligatoire (3 à 1000 caractères)' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,1711));
  select * into previous from public.admin_operations where id=p_id;
  if found then
    if previous.actor_id<>me or previous.action<>p_action or previous.payload<>p_payload then
      raise exception 'identifiant déjà utilisé pour une autre opération' using errcode='22023'; end if;
    return previous.result;
  end if;
  target:=nullif(p_payload->>'target','')::uuid;
  if p_action='wallet' then
    delta:=(p_payload->>'delta')::bigint;
    if target is null or delta is null or delta=0 or abs(delta)>1000000 then raise exception 'ajustement invalide'; end if;
    insert into public.wallet_accounts(user_id) values(target) on conflict do nothing;
    select balance_coins into balance from public.wallet_accounts where user_id=target for update;
    before_data:=jsonb_build_object('balance',balance);
    if balance+delta<0 then raise exception 'solde insuffisant'; end if;
    -- Existing ledger trigger is the only writer of balances. Reservations and
    -- REV rules remain owned by their current systems.
    insert into public.wallet_ledger(user_id,delta_coins,reason,reference)
      values(target,delta,'adjustment','admin:'||p_id::text);
    select jsonb_build_object('balance',balance_coins,'delta',delta) into result from public.wallet_accounts where user_id=target;
  elsif p_action='sanction' then
    if target is null or target=me or exists(select 1 from public.admin_members where user_id=target and enabled) then
      raise exception 'cible protégée'; end if;
    if p_payload->>'kind' in ('mute','suspend') and ((p_payload->>'expires')::timestamptz<=now() or nullif(p_payload->>'expires','') is null) then
      raise exception 'expiration future obligatoire'; end if;
    insert into public.player_sanctions(id,user_id,kind,reason,actor_id,expires_at)
      values(p_id,target,p_payload->>'kind',reason,me,nullif(p_payload->>'expires','')::timestamptz)
      returning to_jsonb(player_sanctions.*) into result;
  elsif p_action='revoke' then
    select to_jsonb(s.*) into before_data from public.player_sanctions s where id=target for update;
    if before_data is null then raise exception 'sanction introuvable'; end if;
    update public.player_sanctions set revoked_at=coalesce(revoked_at,now()),revoked_by=coalesce(revoked_by,me)
      where id=target returning to_jsonb(player_sanctions.*) into result;
  elsif p_action='reconcile' then
    select jsonb_build_object('id',id,'state',state,'entitled_coins',entitled_coins) into before_data
      from public.stripe_purchases where id=target;
    if before_data is null then raise exception 'achat introuvable'; end if;
    result:=jsonb_build_object('purchase',target,'verification','pending');
  elsif p_action='spectate' then
    if not exists(select 1 from public.room_registry where id=target) then raise exception 'salon introuvable'; end if;
    result:=jsonb_build_object('room',target,'access',p_id,'mode','public_observer');
  elsif p_action='note' then
    v_target_type:=p_payload->>'type';
    if not ((v_target_type='player' and exists(select 1 from public.profiles where id=target)) or
      (v_target_type='report' and exists(select 1 from public.reports where id=target)) or
      (v_target_type='ticket' and exists(select 1 from public.support_tickets where id=target))) then raise exception 'cible introuvable'; end if;
    insert into public.admin_notes(actor_id,target_type,target_id,body) values(me,v_target_type,target,p_payload->>'body')
      returning to_jsonb(admin_notes.*) into result;
  elsif p_action='report' then
    select jsonb_build_object('status',status) into before_data from public.reports where id=target for update;
    if before_data is null then raise exception 'signalement introuvable'; end if;
    update public.reports set status=p_payload->>'status',resolved_at=case when p_payload->>'status' in ('resolved','dismissed') then now() else null end
      where id=target returning jsonb_build_object('id',id,'status',status) into result;
  elsif p_action='ticket' then
    select jsonb_build_object('status',status) into before_data from public.support_tickets where id=target for update;
    if before_data is null then raise exception 'ticket introuvable'; end if;
    perform public.reply_support_ticket(target,coalesce(p_payload->>'body',''),nullif(p_payload->>'status',''));
    result:=jsonb_build_object('id',target,'replied',true);
  elsif p_action='game' then
    select to_jsonb(s.*) into before_data from public.game_admin_settings s where game_slug=p_payload->>'slug' for update;
    if p_payload->>'maintenance' not in ('true','false') or char_length(coalesce(p_payload->>'message',''))>1000 then raise exception 'paramètres invalides'; end if;
    insert into public.game_admin_settings(game_slug,maintenance,message)
      values(p_payload->>'slug',(p_payload->>'maintenance')::boolean,coalesce(p_payload->>'message',''))
      on conflict(game_slug) do update set maintenance=excluded.maintenance,message=excluded.message,updated_at=now()
      returning to_jsonb(game_admin_settings.*) into result;
  elsif p_action='announce' then
    insert into public.admin_announcements(id,body,user_id,actor_id,expires_at)
      values(p_id,p_payload->>'body',target,me,nullif(p_payload->>'expires','')::timestamptz)
      returning to_jsonb(admin_announcements.*) into result;
  elsif p_action='promo' then
    if p_payload->>'code' !~ '^[A-Z0-9_-]{3,60}$' or (p_payload->>'coins')::bigint not between 1 and 1000000
      or (p_payload->>'limit')::integer<1 then raise exception 'code invalide'; end if;
    select to_jsonb(p.*) into before_data from public.promo_codes p where code=p_payload->>'code' for update;
    insert into public.promo_codes(code,reward_coins,active,max_redemptions,expires_at)
      values(p_payload->>'code',(p_payload->>'coins')::bigint,(p_payload->>'active')::boolean,
        (p_payload->>'limit')::integer,nullif(p_payload->>'expires','')::timestamptz)
      on conflict(code) do update set reward_coins=excluded.reward_coins,active=excluded.active,
        max_redemptions=excluded.max_redemptions,expires_at=excluded.expires_at
      returning to_jsonb(promo_codes.*) into result;
  elsif p_action='member' then
    -- Serialize all membership changes, including changes to different owners.
    perform pg_advisory_xact_lock(17111711);
    select * into r from public.admin_members where user_id=target for update;
    before_data:=case when found then to_jsonb(r) end;
    if r.role='owner' and r.enabled and (p_payload->>'role'<>'owner' or p_payload->>'enabled'='false')
      and (select count(*) from public.admin_members where role='owner' and enabled)<=1 then raise exception 'dernier propriétaire protégé'; end if;
    insert into public.admin_members(user_id,role,can_credit,enabled)
      values(target,p_payload->>'role',coalesce((p_payload->>'canCredit')::boolean,false),coalesce((p_payload->>'enabled')::boolean,true))
      on conflict(user_id) do update set role=excluded.role,can_credit=excluded.can_credit,enabled=excluded.enabled
      returning to_jsonb(admin_members.*) into result;
  elsif p_action='assign' then
    v_target_type:=p_payload->>'type';
    if not ((v_target_type='ticket' and exists(select 1 from public.support_tickets where id=target)) or
      (v_target_type='report' and exists(select 1 from public.reports where id=target))) then raise exception 'cible introuvable'; end if;
    if nullif(p_payload->>'assignee','') is not null and not exists(select 1 from public.admin_members where user_id=(p_payload->>'assignee')::uuid and enabled
      and role in ('owner','admin',case v_target_type when 'report' then 'moderator' else 'support' end)) then raise exception 'responsable non autorisé'; end if;
    select to_jsonb(a.*) into before_data from public.admin_assignments a where a.target_type=v_target_type and a.target_id=target for update;
    insert into public.admin_assignments(target_type,target_id,assignee) values(v_target_type,target,nullif(p_payload->>'assignee','')::uuid)
      on conflict on constraint admin_assignments_pkey do update set assignee=excluded.assignee
      returning to_jsonb(admin_assignments.*) into result;
  end if;
  insert into public.admin_audit(id,actor_id,action,target,reason,before_value,after_value)
    values(p_id,me,p_action,coalesce(target::text,p_payload->>'slug',p_payload->>'code','global'),reason,before_data,result);
  insert into public.admin_operations(id,actor_id,action,payload,result) values(p_id,me,p_action,p_payload,result);
  return result;
end $$;
revoke all on function public.admin_execute(uuid,text,jsonb) from public,anon;
grant execute on function public.admin_execute(uuid,text,jsonb) to authenticated;

-- Immutable server snapshot of an existing general-chat message. No caller
-- supplied message content or author is accepted as evidence.
create function public.submit_evidenced_report(p_id uuid,p_kind text,p_target uuid,p_context text,p_details text,p_message uuid default null,p_attachment boolean default false)
returns uuid language plpgsql security definer set search_path=public as $$
declare me uuid:=auth.uid(); msg public.chat_messages; snap jsonb; existing public.reports;
begin
  if me is null or not exists(select 1 from auth.users where id=me and email_confirmed_at is not null and not is_anonymous) then
    raise exception 'compte confirmé requis' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(me::text,1712));
  select * into existing from public.reports where id=p_id;
  if found then
    if existing.reporter_id<>me then raise exception 'identifiant indisponible' using errcode='42501'; end if;
    if existing.kind<>p_kind or existing.target_user_id is distinct from p_target or existing.details is distinct from p_details
      or existing.context is distinct from left(p_context,200)
      or not exists(select 1 from public.report_evidence where report_id=p_id and message_id is not distinct from p_message
        and (attachment_path is not null)=p_attachment) then raise exception 'identifiant déjà utilisé'; end if;
    return p_id;
  end if;
  if (select count(*) from public.reports where reporter_id=me and created_at>now()-interval '1 hour')>=10 then raise exception 'trop de signalements' using errcode='54000'; end if;
  if p_message is not null then
    select * into msg from public.chat_messages where id=p_message;
    if not found or p_kind<>'message' or msg.user_id<>p_target then raise exception 'message introuvable'; end if;
    select jsonb_build_object('message',to_jsonb(msg),'channel','general','context',coalesce(jsonb_agg(to_jsonb(c) order by c.created_at),'[]'::jsonb)) into snap
      from (select id,user_id,body,created_at from public.chat_messages
        where created_at<=msg.created_at and created_at>=msg.created_at-interval '5 minutes'
        order by created_at desc limit 10) c;
  end if;
  if p_kind='message' and p_message is null then raise exception 'message obligatoire'; end if;
  insert into public.reports(id,reporter_id,target_user_id,kind,context,details)
    values(p_id,me,p_target,p_kind,left(p_context,200),p_details);
  insert into public.report_evidence(report_id,message_id,snapshot,attachment_path)
    values(p_id,p_message,snap,case when p_attachment then me::text||'/'||p_id::text||'.webp' end);
  return p_id;
end $$;
revoke all on function public.submit_evidenced_report(uuid,text,uuid,text,text,uuid,boolean) from public,anon;
grant execute on function public.submit_evidenced_report(uuid,text,uuid,text,text,uuid,boolean) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('report-evidence','report-evidence',false,5242880,array['image/webp']);
-- Only the application server uploads normalized screenshots. Download also
-- works in the separate admin app using its user session, without a service key.
create policy report_evidence_download on storage.objects for select to authenticated using(
  bucket_id='report-evidence' and public.admin_allowed('moderate') and exists(
    select 1 from public.report_evidence where attachment_path=name));
create policy support_admin_download on storage.objects for select to authenticated using(
  bucket_id='support-attachments' and public.admin_allowed('support') and exists(
    select 1 from public.support_tickets where attachment_path=name));
commit;
