begin;
create table public.player_activity (
  user_id uuid primary key references public.profiles(id), last_seen_at timestamptz not null default now()
);
alter table public.player_activity enable row level security;
revoke all on public.player_activity from anon,authenticated;
grant all on public.player_activity to service_role;
create function public.platform_heartbeat() returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'connexion requise' using errcode='42501'; end if;
  insert into public.player_activity(user_id) values(auth.uid())
    on conflict(user_id) do update set last_seen_at=now()
    where player_activity.last_seen_at<now()-interval '30 seconds';
end $$;
revoke all on function public.platform_heartbeat() from public,anon;
grant execute on function public.platform_heartbeat() to authenticated;

create function public.admin_query(p_section text,p_search text default '',p_target uuid default null,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare permission text; sql text; result jsonb; profile jsonb;
begin
  permission:=case p_section
    when 'promos' then 'economy' when 'rev' then 'economy' when 'payments' then 'economy' when 'wallet' then 'economy' when 'gifts' then 'economy'
    when 'reports' then 'moderate' when 'report' then 'moderate'
    when 'sanctions' then 'moderate' when 'tickets' then 'support' when 'ticket' then 'support'
    when 'audit' then 'manage' when 'members' then 'members' else 'read' end;
  if not public.admin_allowed(permission) then raise exception 'administration non autorisée' using errcode='42501'; end if;
  if p_offset is null or p_offset<0 or p_offset>100000 or char_length(coalesce(p_search,''))>120 then raise exception 'page invalide'; end if;
  if p_section='session' then
    return (select jsonb_build_object('userId',user_id,'role',role,'canCredit',public.admin_allowed('credit')) from public.admin_members where user_id=auth.uid());
  elsif p_section='dashboard' then
    return jsonb_build_object(
      'players',(select count(*) from public.profiles),
      'registrations24h',(select count(*) from public.profiles where created_at>now()-interval '24 hours'),
      'activeLast2m',case when exists(select 1 from public.player_activity)
        then (select count(*) from public.player_activity where last_seen_at>now()-interval '2 minutes') end,
      'reports',case when public.admin_allowed('moderate') then (select count(*) from public.reports where status in ('open','reviewing')) end,
      'tickets',case when public.admin_allowed('support') then (select count(*) from public.support_tickets where status<>'resolved') end,
      'purchases24h',case when public.admin_allowed('economy') then (select count(*) from public.stripe_purchases where created_at>now()-interval '24 hours') end,
      'presenceNote','Activité enregistrée depuis l’installation ; estimation sur 2 minutes, pas un décompte exact des connexions.',
      'incidentsNote','Aucun collecteur central d’erreurs n’est encore raccordé.',
      'spectatorNote','Les moteurs des jeux doivent fournir un protocole spectateur sécurisé avant activation.');
  elsif p_section='player' then
    select jsonb_build_object('id',p.id,'username',p.username,'created_at',p.created_at,'last_seen_at',a.last_seen_at,
      'balance_coins',case when public.admin_allowed('economy') then coalesce(w.balance_coins,0) end)
      into profile from public.profiles p left join public.player_activity a on a.user_id=p.id
      left join public.wallet_accounts w on w.user_id=p.id where p.id=p_target;
    if profile is null then raise exception 'joueur introuvable'; end if;
    return jsonb_build_object('profile',profile,
      'results',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from (select gp.result_id,gp.outcome,gp.score,gp.position,g.game_slug,g.finished_at
        from public.game_result_players gp join public.game_results g on g.id=gp.result_id where gp.user_id=p_target order by g.finished_at desc limit 50 offset p_offset) r),
      'notes',(select coalesce(jsonb_agg(to_jsonb(n)),'[]') from (select * from public.admin_notes where target_type='player' and target_id=p_target order by created_at desc limit 50 offset p_offset) n),
      'sanctions',case when public.admin_allowed('moderate') then (select coalesce(jsonb_agg(to_jsonb(s)),'[]') from (select * from public.player_sanctions where user_id=p_target order by created_at desc limit 50 offset p_offset) s) end);
  elsif p_section='ticket' then
    return jsonb_build_object('ticket',(select to_jsonb(t) from public.support_tickets t where id=p_target),
      'messages',(select coalesce(jsonb_agg(to_jsonb(m)),'[]') from (select * from public.support_messages where ticket_id=p_target order by created_at,id limit 50 offset p_offset) m),
      'notes',(select coalesce(jsonb_agg(to_jsonb(n)),'[]') from (select * from public.admin_notes where target_type='ticket' and target_id=p_target order by created_at desc limit 50 offset p_offset) n),
      'assignment',(select to_jsonb(a) from public.admin_assignments a where target_type='ticket' and target_id=p_target));
  elsif p_section='report' then
    return jsonb_build_object('report',(select to_jsonb(r) from public.reports r where id=p_target),
      'evidence',(select to_jsonb(e) from public.report_evidence e where report_id=p_target),
      'notes',(select coalesce(jsonb_agg(to_jsonb(n)),'[]') from (select * from public.admin_notes where target_type='report' and target_id=p_target order by created_at desc limit 50 offset p_offset) n),
      'assignment',(select to_jsonb(a) from public.admin_assignments a where target_type='report' and target_id=p_target));
  end if;
  -- Only fixed SQL from this allowlist is executable. Search, identifiers and
  -- pagination remain bound parameters; no SQL identifiers come from clients.
  sql:=case p_section
    when 'promos' then 'select code,reward_coins,active,max_redemptions,redemptions_count,expires_at from public.promo_codes where ($1='''' or code ilike ''%''||$1||''%'') order by created_at desc,code'
    when 'rooms' then 'select id,game_slug,room_code,player_count,capacity,status,refreshed_at from public.room_registry where ($1='''' or game_slug=$1 or status=$1 or room_code=$1) order by refreshed_at desc nulls last,id'
    when 'players' then 'select p.id,p.username,p.created_at,a.last_seen_at from public.profiles p left join public.player_activity a on a.user_id=p.id where ($1='''' or p.username ilike ''%''||$1||''%'' or p.id::text=$1) order by p.created_at desc,p.id'
    when 'reports' then 'select id,reporter_id,target_user_id,kind,status,context,created_at from public.reports where ($1='''' or status=$1 or id::text=$1) and ($2 is null or target_user_id=$2) order by created_at desc,id'
    when 'tickets' then 'select id,user_id,category,subject,status,created_at from public.support_tickets where ($1='''' or status=$1 or subject ilike ''%''||$1||''%'') and ($2 is null or user_id=$2) order by updated_at desc,id'
    when 'sanctions' then 'select id,user_id,kind,reason,actor_id,expires_at,revoked_at,created_at from public.player_sanctions where ($2 is null or user_id=$2) and ($1='''' or kind=$1) order by created_at desc,id'
    when 'wallet' then 'select id,user_id,delta_coins,reason,reference,created_at from public.wallet_ledger where ($2 is null or user_id=$2) and ($1='''' or reason=$1 or reference=$1) order by created_at desc,id'
    when 'payments' then 'select id,user_id,pack_id,coins,amount,currency,livemode,state,entitled_coins,refunded_amount,created_at from public.stripe_purchases where ($2 is null or user_id=$2) and ($1='''' or state=$1 or id::text=$1 or payment_intent=$1) order by created_at desc,id'
    when 'gifts' then 'select id,sender_id,recipient_id,gift_id,quantity,total_price,total_rev,total_reward,created_at from public.gift_send_batches where ($2 is null or sender_id=$2 or recipient_id=$2) and ($1='''' or gift_id=$1) order by created_at desc,id'
    when 'rev' then 'select user_id,total_rev,updated_at from public.rev_accounts where ($2 is null or user_id=$2) and ($1='''' or user_id::text=$1) order by total_rev desc,user_id'
    when 'games' then 'select g.slug,g.display_name,coalesce(s.maintenance,false) maintenance,s.message from public.game_catalog g left join public.game_admin_settings s on s.game_slug=g.slug where ($1='''' or g.display_name ilike ''%''||$1||''%'') order by g.sort_order,g.slug'
    when 'results' then 'select g.id,g.game_slug,g.room_code,g.finished_at from public.game_results g where ($1='''' or g.game_slug=$1) order by g.finished_at desc,g.id'
    when 'members' then 'select m.user_id,p.username,m.role,m.can_credit,m.enabled,m.created_at from public.admin_members m join public.profiles p on p.id=m.user_id where ($1='''' or p.username ilike ''%''||$1||''%'') order by m.created_at,m.user_id'
    when 'audit' then 'select id,actor_id,action,target,reason,before_value,after_value,created_at from public.admin_audit where ($1='''' or action=$1 or target=$1 or actor_id::text=$1) order by created_at desc,id'
    when 'announcements' then 'select id,body,user_id,actor_id,expires_at,created_at from public.admin_announcements where ($1='''' or body ilike ''%''||$1||''%'') order by created_at desc,id'
    else null end;
  if sql is null then raise exception 'rubrique inconnue' using errcode='22023'; end if;
  execute 'select jsonb_build_object(''rows'',coalesce(jsonb_agg(to_jsonb(x)-''total''),''[]''),''total'',coalesce(max(total),0),''offset'',$3) from (select q.*,count(*) over() total from ('||sql||') q limit 50 offset $3) x'
    into result using coalesce(p_search,''),p_target,p_offset;
  return result;
end $$;
revoke all on function public.admin_query(text,text,uuid,integer) from public,anon;
grant execute on function public.admin_query(text,text,uuid,integer) to authenticated;
commit;
