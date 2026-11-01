-- Admin membership is provisioned out of band by a trusted database operator.
-- Neither profile metadata nor a client-provided role can grant this permission.
create table public.support_admins (
  user_id uuid primary key references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.support_admins enable row level security;
revoke all on public.support_admins from anon,authenticated;
grant select on public.support_admins to authenticated;
grant all on public.support_admins to service_role;
create policy support_admin_membership_own on public.support_admins for select to authenticated using(user_id=auth.uid());

create function public.is_support_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.support_admins where user_id=auth.uid());
$$;
revoke all on function public.is_support_admin() from public,anon;
grant execute on function public.is_support_admin() to authenticated,service_role;

create table public.support_tickets (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  category text not null check(category in ('missing_coins','payment_error','double_charge','refund','unrecognized_purchase','game_issue','account_issue','player_report','other')),
  subject text not null check(char_length(subject) between 3 and 150),
  description text not null check(char_length(description) between 20 and 5000),
  transaction_reference text check(char_length(transaction_reference)<=160),
  attachment_path text,
  status text not null default 'received' check(status in ('received','in_progress','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_owner_date on public.support_tickets(user_id,created_at desc);
create index support_tickets_status_date on public.support_tickets(status,updated_at desc);
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id),
  author_id uuid not null references public.profiles(id),
  from_admin boolean not null,
  body text not null check(char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index support_messages_ticket_date on public.support_messages(ticket_id,created_at);
create table public.support_ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id),
  actor_id uuid not null references public.profiles(id),
  status text not null check(status in ('received','in_progress','resolved')),
  created_at timestamptz not null default now()
);
create table public.support_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  ticket_id uuid not null references public.support_tickets(id),
  kind text not null check(kind in ('received','reply','status')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index support_notifications_unread on public.support_notifications(user_id) where read_at is null;

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_ticket_events enable row level security;
alter table public.support_notifications enable row level security;
revoke all on public.support_tickets,public.support_messages,public.support_ticket_events,public.support_notifications from anon,authenticated;
grant select on public.support_tickets,public.support_messages,public.support_ticket_events,public.support_notifications to authenticated;
grant all on public.support_tickets,public.support_messages,public.support_ticket_events,public.support_notifications to service_role;
create policy support_tickets_private on public.support_tickets for select to authenticated using(user_id=auth.uid() or public.is_support_admin());
create policy support_messages_private on public.support_messages for select to authenticated using(exists(
  select 1 from public.support_tickets t where t.id=ticket_id and (t.user_id=auth.uid() or public.is_support_admin())
));
create policy support_events_private on public.support_ticket_events for select to authenticated using(exists(
  select 1 from public.support_tickets t where t.id=ticket_id and (t.user_id=auth.uid() or public.is_support_admin())
));
create policy support_notifications_own on public.support_notifications for select to authenticated using(user_id=auth.uid());

create function public.create_support_ticket(
  p_id uuid,p_category text,p_subject text,p_description text,p_reference text,p_attachment boolean
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_me uuid:=auth.uid(); r public.support_tickets;
begin
  if v_me is null or not exists(select 1 from auth.users where id=v_me and email_confirmed_at is not null and not is_anonymous) then
    raise exception 'authentification confirmée requise' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_me::text,7352));
  select * into r from public.support_tickets where id=p_id;
  if found then
    if r.user_id<>v_me then raise exception 'identifiant indisponible' using errcode='42501'; end if;
    return r.id;
  end if;
  if (select count(*) from public.support_tickets where user_id=v_me and created_at>now()-interval '1 hour')>=5 then
    raise exception 'trop de demandes' using errcode='54000';
  end if;
  insert into public.support_tickets(id,user_id,category,subject,description,transaction_reference,attachment_path)
    values(p_id,v_me,p_category,btrim(p_subject),btrim(p_description),nullif(btrim(p_reference),''),
      case when p_attachment then v_me::text||'/'||p_id::text||'.webp' else null end);
  insert into public.support_ticket_events(ticket_id,actor_id,status) values(p_id,v_me,'received');
  insert into public.support_notifications(user_id,ticket_id,kind) values(v_me,p_id,'received');
  insert into public.support_notifications(user_id,ticket_id,kind)
    select user_id,p_id,'received' from public.support_admins where user_id<>v_me;
  return p_id;
end; $$;

create function public.reply_support_ticket(p_id uuid,p_message text,p_status text default null)
returns void language plpgsql security definer set search_path=public as $$
declare v_me uuid:=auth.uid(); v_admin boolean:=public.is_support_admin(); r public.support_tickets; v_status text;
begin
  if v_me is null then raise exception 'authentification requise' using errcode='42501'; end if;
  -- Same order of locking as ticket creation; prevents concurrent rate-limit bypass.
  perform pg_advisory_xact_lock(hashtextextended(v_me::text,7352));
  select * into r from public.support_tickets where id=p_id for update;
  if not found or (r.user_id<>v_me and not v_admin) then raise exception 'demande introuvable' using errcode='42501'; end if;
  if p_status is not null and not v_admin then raise exception 'administrateur requis' using errcode='42501'; end if;
  if (select count(*) from public.support_messages where author_id=v_me and created_at>now()-interval '1 hour')>=30 then
    raise exception 'trop de réponses' using errcode='54000';
  end if;
  if char_length(btrim(coalesce(p_message,'')))=0 and p_status is null then raise exception 'réponse vide'; end if;
  if char_length(btrim(coalesce(p_message,'')))>0 then
    insert into public.support_messages(ticket_id,author_id,from_admin,body) values(p_id,v_me,v_admin,btrim(p_message));
    insert into public.support_notifications(user_id,ticket_id,kind)
      select r.user_id,p_id,'reply' where v_admin and r.user_id<>v_me;
    if not v_admin then
      insert into public.support_notifications(user_id,ticket_id,kind) select user_id,p_id,'reply' from public.support_admins where user_id<>v_me;
    end if;
  end if;
  v_status:=coalesce(p_status,case when not v_admin and r.status='resolved' then 'received' else r.status end);
  if v_status<>r.status then
    insert into public.support_ticket_events(ticket_id,actor_id,status) values(p_id,v_me,v_status);
    insert into public.support_notifications(user_id,ticket_id,kind) values(r.user_id,p_id,'status');
  end if;
  update public.support_tickets set status=v_status,updated_at=now() where id=p_id;
end; $$;

create function public.read_support_notifications() returns void
language sql security definer set search_path=public as $$
  update public.support_notifications set read_at=now() where user_id=auth.uid() and read_at is null;
$$;
revoke all on function public.create_support_ticket(uuid,text,text,text,text,boolean) from public,anon;
revoke all on function public.reply_support_ticket(uuid,text,text) from public,anon;
revoke all on function public.read_support_notifications() from public,anon;
grant execute on function public.create_support_ticket(uuid,text,text,text,text,boolean) to authenticated;
grant execute on function public.reply_support_ticket(uuid,text,text) to authenticated;
grant execute on function public.read_support_notifications() to authenticated;

-- Private screenshots: server-mediated upload/download only; no browser storage policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('support-attachments','support-attachments',false,5242880,array['image/webp'])
  on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/webp'];
