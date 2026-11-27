create table if not exists public.bombshift_cosmetic_catalog (
 item text primary key, name text not null, rarity text not null check(rarity in ('basic','common','rare','epic','legendary','mythic')), price integer not null check(price>0)
);
insert into public.bombshift_cosmetic_catalog(item,name,rarity,price) values ('hero-ourson','Ourson Pastel','basic',200),
('hero-panda','Panda Bonbon','basic',300),
('hero-lapin','Lapin Nuage','basic',400),
('hero-neon','Cyber Néon','common',600),
('hero-ice','Glacier','common',750),
('hero-fox','Renard Flamboyant','common',850),
('hero-astro','Astronaute Manga','rare',1100),
('hero-pilote','Pilote Galactique','rare',1300),
('hero-ninja','Ninja Écarlate','rare',1400),
('hero-samurai','Samouraï Néon','epic',2000),
('hero-mage','Mage des Étoiles','epic',2200),
('hero-celeste','Guerrier Céleste','epic',2500),
('hero-toxic','Ombre Toxique','epic',2100),
('hero-inferno','Roi Magma','legendary',3500),
('hero-gold','Or Suprême','legendary',4000),
('hero-shadow','Spectre Lunaire','legendary',3800),
('hero-dragon','Dragon Astral','mythic',6000),
('hero-phoenix','Phénix Impérial','mythic',6500),
('bomb-bonbon','Bombe Bonbon','basic',150),
('bomb-crystal','Bombe Cristal','basic',350),
('bomb-neon','Bombe Néon','common',650),
('bomb-lava','Bombe Lave','common',800),
('bomb-foudre','Bombe Foudre','rare',1200),
('bomb-moon','Bombe Lunaire','rare',1400),
('bomb-galaxy','Bombe Galaxie','epic',2000),
('bomb-toxic','Bombe Toxique','epic',2100),
('bomb-gold','Bombe Or Royal','legendary',3500),
('bomb-supernova','Bombe Supernova','mythic',5500) on conflict(item) do update set name=excluded.name,rarity=excluded.rarity,price=excluded.price;
create table if not exists public.bombshift_cosmetics (
 user_id uuid not null references public.profiles(id) on delete cascade, item text not null references public.bombshift_cosmetic_catalog(item),
 equipped boolean not null default false, purchased_at timestamptz not null default now(), primary key(user_id,item)
);
alter table public.bombshift_cosmetics drop constraint if exists bombshift_cosmetics_item_check;
create unique index if not exists bombshift_cosmetic_one_equipped_per_type on public.bombshift_cosmetics(user_id,(split_part(item,'-',1))) where equipped;
create table if not exists public.bombshift_chest_receipts (
 user_id uuid not null references public.profiles(id) on delete cascade, request_id uuid not null, item text not null references public.bombshift_cosmetic_catalog(item), created_at timestamptz not null default now(), primary key(user_id,request_id)
);
alter table public.bombshift_cosmetics enable row level security;
alter table public.bombshift_cosmetic_catalog enable row level security;
alter table public.bombshift_chest_receipts enable row level security;
revoke all on public.bombshift_cosmetics,public.bombshift_cosmetic_catalog,public.bombshift_chest_receipts from public,anon,authenticated;
grant select on public.bombshift_cosmetic_catalog to service_role;
grant select,insert,update on public.bombshift_cosmetics to service_role;
grant select,insert on public.bombshift_chest_receipts to service_role;
create or replace function public.bombshift_cosmetic_shop_v2(p_user uuid,p_action text,p_item text,p_price integer,p_request uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 v_price integer; v_balance bigint; v_held bigint; v_kind text; v_reward text; v_rarity text; v_roll double precision; v_total integer; v_odds jsonb;
begin
 if p_user is null then return jsonb_build_object('error','login_required'); end if;
 if p_action not in ('catalog','buy','equip','chest') or p_action is null then return jsonb_build_object('error','invalid_action'); end if;
 if p_action<>'catalog' then
  select balance_coins into v_balance from public.wallet_accounts where user_id=p_user for update;
  if not found then return jsonb_build_object('error','login_required'); end if;
  select coalesce(sum(price_coins),0) into v_held from public.role_reservations where user_id=p_user and status='pending' and not charged;
  if p_action='chest' then
   if p_request is null or p_price is distinct from 1500 then return jsonb_build_object('error','price_changed'); end if;
   select item into v_reward from public.bombshift_chest_receipts where user_id=p_user and request_id=p_request;
   if v_reward is null then
    if (select count(distinct c.rarity) from public.bombshift_cosmetic_catalog c where not exists(select 1 from public.bombshift_cosmetics o where o.user_id=p_user and o.item=c.item))<>6 then return jsonb_build_object('error','chest_unavailable'); end if;
    if v_balance-v_held<1500 then return jsonb_build_object('error','insufficient_balance'); end if;
    v_roll:=random(); v_rarity:=case when v_roll<0.15 then 'basic' when v_roll<0.40 then 'common' when v_roll<0.70 then 'rare' when v_roll<0.90 then 'epic' when v_roll<0.98 then 'legendary' else 'mythic' end;
    select c.item into v_reward from public.bombshift_cosmetic_catalog c where c.rarity=v_rarity and not exists(select 1 from public.bombshift_cosmetics o where o.user_id=p_user and o.item=c.item) order by random() limit 1;
    insert into public.bombshift_cosmetics(user_id,item) values(p_user,v_reward);
    insert into public.bombshift_chest_receipts(user_id,request_id,item) values(p_user,p_request,v_reward);
    insert into public.wallet_ledger(user_id,delta_coins,reason,reference) values(p_user,-1500,'purchase','bombshift-chest:'||p_user||':'||p_request);
   end if;
  else
   select price into v_price from public.bombshift_cosmetic_catalog where item=p_item;
   if p_item in ('hero-default','bomb-default') then v_price:=0; end if;
   if v_price is null then return jsonb_build_object('error','invalid_item'); end if;
   v_kind:=split_part(p_item,'-',1);
   if p_action='buy' then
    if v_price=0 or p_price is distinct from v_price then return jsonb_build_object('error','price_changed'); end if;
    if not exists(select 1 from public.bombshift_cosmetics where user_id=p_user and item=p_item) then
     if v_balance-v_held<v_price then return jsonb_build_object('error','insufficient_balance'); end if;
     insert into public.bombshift_cosmetics(user_id,item) values(p_user,p_item);
     insert into public.wallet_ledger(user_id,delta_coins,reason,reference) values(p_user,-v_price,'purchase','bombshift-cosmetic:'||p_user||':'||p_item);
    end if;
   elsif v_price<>0 and not exists(select 1 from public.bombshift_cosmetics where user_id=p_user and item=p_item) then return jsonb_build_object('error','not_owned');
   end if;
   update public.bombshift_cosmetics set equipped=false where user_id=p_user and split_part(item,'-',1)=v_kind and equipped;
   update public.bombshift_cosmetics set equipped=true where user_id=p_user and item=p_item;
  end if;
 end if;
 select count(distinct c.rarity) into v_total from public.bombshift_cosmetic_catalog c where not exists(select 1 from public.bombshift_cosmetics o where o.user_id=p_user and o.item=c.item);
 return jsonb_build_object('balance',coalesce((select balance_coins from public.wallet_accounts where user_id=p_user),0),
 'catalog',(select jsonb_agg(to_jsonb(c) order by c.price,c.item) from public.bombshift_cosmetic_catalog c),
 'owned',coalesce((select jsonb_agg(item order by item) from public.bombshift_cosmetics where user_id=p_user),'[]'::jsonb),
 'hero',coalesce((select item from public.bombshift_cosmetics where user_id=p_user and equipped and item like 'hero-%'),'hero-default'),
 'bomb',coalesce((select item from public.bombshift_cosmetics where user_id=p_user and equipped and item like 'bomb-%'),'bomb-default'),
 'chestAvailable',v_total=6,'reward',v_reward);
end; $$;
revoke execute on function public.bombshift_cosmetic_shop_v2(uuid,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.bombshift_cosmetic_shop_v2(uuid,text,text,integer,uuid) to service_role;