create table public.bombshift_cosmetics (
 user_id uuid not null references public.profiles(id) on delete cascade,
 item text not null check (item in ('hero-neon','hero-ice','hero-inferno','hero-shadow','hero-gold','hero-toxic','bomb-crystal','bomb-lava','bomb-galaxy','bomb-gold')),
 equipped boolean not null default false,
 purchased_at timestamptz not null default now(),
 primary key (user_id,item)
);
alter table public.bombshift_cosmetics enable row level security;
revoke all on public.bombshift_cosmetics from public,anon,authenticated;
grant select,insert,update on public.bombshift_cosmetics to service_role;
create unique index bombshift_cosmetic_one_equipped_per_type on public.bombshift_cosmetics(user_id,(split_part(item,'-',1))) where equipped;
create function public.bombshift_cosmetic_shop(p_user uuid,p_action text,p_item text,p_price integer)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 v_price integer; v_balance bigint; v_held bigint; v_kind text;
begin
 if p_user is null then return jsonb_build_object('error','login_required'); end if;
 if p_action not in ('catalog','buy','equip') or p_action is null then return jsonb_build_object('error','invalid_action'); end if;
 if p_action <> 'catalog' then
  v_price := case p_item
   when 'hero-neon' then 200 when 'hero-ice' then 250 when 'hero-inferno' then 300 when 'hero-shadow' then 400 when 'hero-gold' then 600 when 'hero-toxic' then 350
   when 'bomb-crystal' then 150 when 'bomb-lava' then 200 when 'bomb-galaxy' then 350 when 'bomb-gold' then 450
   when 'hero-default' then 0 when 'bomb-default' then 0 else null end;
  if v_price is null then return jsonb_build_object('error','invalid_item'); end if;
  v_kind := split_part(p_item,'-',1);
  select balance_coins into v_balance from public.wallet_accounts where user_id=p_user for update;
  if not found then return jsonb_build_object('error','login_required'); end if;
  if p_action='buy' then
   if v_price=0 or p_price is distinct from v_price then return jsonb_build_object('error','price_changed'); end if;
   if not exists(select 1 from public.bombshift_cosmetics where user_id=p_user and item=p_item) then
    select coalesce(sum(price_coins),0) into v_held from public.role_reservations where user_id=p_user and status='pending' and not charged;
    if v_balance-v_held<v_price then return jsonb_build_object('error','insufficient_balance'); end if;
    insert into public.bombshift_cosmetics(user_id,item) values(p_user,p_item);
    insert into public.wallet_ledger(user_id,delta_coins,reason,reference) values(p_user,-v_price,'purchase','bombshift-cosmetic:'||p_user||':'||p_item);
   end if;
  elsif v_price<>0 and not exists(select 1 from public.bombshift_cosmetics where user_id=p_user and item=p_item) then
   return jsonb_build_object('error','not_owned');
  end if;
  update public.bombshift_cosmetics set equipped=false where user_id=p_user and split_part(item,'-',1)=v_kind and equipped;
  update public.bombshift_cosmetics set equipped=true where user_id=p_user and item=p_item;
 end if;
 return jsonb_build_object('balance',coalesce((select balance_coins from public.wallet_accounts where user_id=p_user),0),
 'owned',coalesce((select jsonb_agg(item order by item) from public.bombshift_cosmetics where user_id=p_user),'[]'::jsonb),
 'hero',coalesce((select item from public.bombshift_cosmetics where user_id=p_user and equipped and item like 'hero-%'),'hero-default'),
 'bomb',coalesce((select item from public.bombshift_cosmetics where user_id=p_user and equipped and item like 'bomb-%'),'bomb-default'));
end; $$;
revoke execute on function public.bombshift_cosmetic_shop(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.bombshift_cosmetic_shop(uuid,text,text,integer) to service_role;