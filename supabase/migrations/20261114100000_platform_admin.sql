-- Reuse the trusted membership already used by assistance and gifts.
create table public.platform_admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  target_id uuid not null,
  action text not null check(action in ('suspend','restore','reviewing','resolved','dismissed')),
  reason text not null check(char_length(reason) between 5 and 500),
  created_at timestamptz not null default now()
);
alter table public.platform_admin_audit enable row level security;
revoke all on public.platform_admin_audit from public,anon,authenticated;
grant select,insert on public.platform_admin_audit to service_role;

-- The action and its audit entry commit together. Only the server may call it.
create function public.platform_admin_action(p_actor uuid,p_target uuid,p_action text,p_reason text)
returns void language plpgsql security definer set search_path=public,auth as $$
begin
  -- Serialize moderation actions and membership provisioning using this table.
  lock table public.support_admins in share mode;
  if not exists(select 1 from public.support_admins where user_id=p_actor) then
    raise exception 'administrateur requis' using errcode='42501';
  end if;
  if char_length(btrim(p_reason)) not between 5 and 500 then raise exception 'motif invalide'; end if;
  if p_action in ('suspend','restore') then
    if p_target=p_actor or exists(select 1 from public.support_admins where user_id=p_target) then
      raise exception 'compte administrateur protégé' using errcode='42501';
    end if;
    update auth.users set banned_until=case when p_action='suspend' then now()+interval '100 years' else null end,
      updated_at=now() where id=p_target;
    if not found then raise exception 'compte introuvable' using errcode='P0002'; end if;
    if p_action='suspend' then
      delete from auth.sessions where user_id=p_target;
    end if;
  elsif p_action in ('reviewing','resolved','dismissed') then
    update public.reports set status=p_action,
      resolved_at=case when p_action in ('resolved','dismissed') then now() else null end
      where id=p_target;
    if not found then raise exception 'signalement introuvable' using errcode='P0002'; end if;
  else raise exception 'action invalide'; end if;
  insert into public.platform_admin_audit(actor_id,target_id,action,reason) values(p_actor,p_target,p_action,btrim(p_reason));
end;
$$;
revoke all on function public.platform_admin_action(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.platform_admin_action(uuid,uuid,text,text) to service_role;
