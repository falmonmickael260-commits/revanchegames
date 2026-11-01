-- Stripe orders are owned by the authenticated player, but written ONLY by service_role.
create table public.stripe_purchases (
  id uuid primary key,
  user_id uuid not null references public.profiles(id),
  pack_id text not null check (pack_id in ('coins_1000','coins_2000')),
  coins bigint not null,
  amount integer not null,
  currency text not null default 'eur' check (currency = 'eur'),
  livemode boolean not null,
  session_id text unique,
  payment_intent text unique,
  state text not null default 'pending' check (state in ('pending','paid','expired','failed','partially_refunded','refunded','disputed')),
  refunded_amount integer not null default 0 check (refunded_amount >= 0 and refunded_amount <= amount),
  entitled_coins bigint not null default 0 check (entitled_coins >= 0 and entitled_coins <= coins),
  receipt_url text,
  payment_method text,
  lease_token uuid,
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((pack_id='coins_1000' and coins=1000 and amount=119) or (pack_id='coins_2000' and coins=2000 and amount=200))
);
create index stripe_purchases_user_date on public.stripe_purchases(user_id, created_at desc);

-- Refunds must succeed even if coins were spent or reserved in a game.
-- Recover only available coins; track the remainder, offset against future Stripe grants.
-- Existing game wallets/reservations/triggers are not modified.
create table public.stripe_wallet_debts (
  user_id uuid primary key references public.profiles(id),
  coins bigint not null default 0 check (coins >= 0)
);
create table public.stripe_events (
  id text primary key,
  purchase_id uuid not null references public.stripe_purchases(id),
  event_type text not null,
  session_id text not null,
  payment_intent text,
  status text not null,
  refunded_amount integer not null,
  entitled_coins bigint not null,
  wallet_delta bigint not null,
  debt_delta bigint not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_purchases enable row level security;
alter table public.stripe_wallet_debts enable row level security;
alter table public.stripe_events enable row level security;
revoke all on public.stripe_purchases, public.stripe_wallet_debts, public.stripe_events from anon, authenticated;
grant select on public.stripe_purchases, public.stripe_wallet_debts to authenticated;
grant all on public.stripe_purchases, public.stripe_wallet_debts, public.stripe_events to service_role;
create policy stripe_purchases_own on public.stripe_purchases for select to authenticated using (user_id=auth.uid());
create policy stripe_wallet_debts_own on public.stripe_wallet_debts for select to authenticated using (user_id=auth.uid());

create function public.begin_stripe_purchase(p_id uuid, p_user uuid, p_pack text, p_live boolean)
returns public.stripe_purchases language plpgsql security definer set search_path=public as $$
declare r public.stripe_purchases; v_count integer;
begin
  -- Durable, per-player rate limit, including concurrent requests on multiple instances.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 7351));
  select * into r from public.stripe_purchases where id=p_id;
  if found then
    if r.user_id<>p_user or r.pack_id<>p_pack or r.livemode<>p_live then raise exception 'achat incompatible'; end if;
    if r.created_at < now()-interval '23 hours' then raise exception 'achat expiré'; end if;
    return r;
  end if;
  select count(*) into v_count from public.stripe_purchases where user_id=p_user and created_at>now()-interval '10 minutes';
  if v_count>=5 then raise exception 'trop de tentatives' using errcode='54000'; end if;
  if p_pack not in ('coins_1000','coins_2000') or p_pack is null then raise exception 'pack invalide'; end if;
  insert into public.stripe_purchases(id,user_id,pack_id,coins,amount,livemode)
    values(p_id,p_user,p_pack,case p_pack when 'coins_1000' then 1000 else 2000 end,
      case p_pack when 'coins_1000' then 119 else 200 end,p_live) returning * into r;
  return r;
end; $$;

-- Fenced lease covers both the Stripe reads and the DB transaction. This prevents
-- older snapshots arriving after a newer refund/dispute update on another instance.
create function public.lock_stripe_purchase(p_id uuid, p_token uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.stripe_purchases set lease_token=p_token, lease_until=clock_timestamp()+interval '2 minutes'
    where id=p_id and (lease_until is null or lease_until<clock_timestamp());
  return found;
end; $$;

create function public.apply_stripe_purchase(
  p_id uuid, p_token uuid, p_event text, p_type text, p_session text,
  p_intent text, p_state text, p_refunded integer, p_entitled bigint, p_receipt text, p_method text default null
) returns void language plpgsql security definer set search_path=public as $$
declare r public.stripe_purchases; v_delta bigint; v_balance bigint; v_held bigint;
  v_debt bigint; v_previous_debt bigint; v_move bigint; v_offset bigint;
begin
  select * into strict r from public.stripe_purchases where id=p_id for update;
  if p_token is null or r.lease_token is distinct from p_token or r.lease_until is null or r.lease_until<clock_timestamp() then raise exception 'verrou expiré'; end if;
  if exists(select 1 from public.stripe_events where id=p_event) then
    update public.stripe_purchases set lease_token=null,lease_until=null where id=p_id;
    return;
  end if;
  if (r.session_id is not null and r.session_id<>p_session) or
     (r.payment_intent is not null and r.payment_intent is distinct from p_intent) then raise exception 'identité paiement incompatible'; end if;
  if p_refunded is null or p_refunded<0 or p_refunded>r.amount or p_entitled is null or p_entitled<0 or p_entitled>r.coins then
    raise exception 'montant invalide';
  end if;
  v_delta:=p_entitled-r.entitled_coins;
  insert into public.wallet_accounts(user_id) values(r.user_id) on conflict do nothing;
  select balance_coins into v_balance from public.wallet_accounts where user_id=r.user_id for update;
  insert into public.stripe_wallet_debts(user_id) values(r.user_id) on conflict do nothing;
  select coins into v_debt from public.stripe_wallet_debts where user_id=r.user_id for update;
  v_previous_debt:=v_debt;
  if v_delta>=0 then
    v_offset:=least(v_delta,v_debt);
    v_move:=v_delta-v_offset;
    v_debt:=v_debt-v_offset;
  else
    select coalesce(sum(price_coins),0) into v_held from public.role_reservations
      where user_id=r.user_id and status='pending' and not charged;
    v_move:=-least(-v_delta,greatest(v_balance-v_held,0));
    v_debt:=v_debt+(-v_delta+v_move);
  end if;
  if v_move<>0 then
    insert into public.wallet_ledger(user_id,delta_coins,reason,reference)
      values(r.user_id,v_move,'adjustment','stripe:'||p_event);
  end if;
  update public.stripe_wallet_debts set coins=v_debt where user_id=r.user_id;
  update public.stripe_purchases set session_id=p_session,payment_intent=p_intent,state=p_state,
    refunded_amount=p_refunded,entitled_coins=p_entitled,receipt_url=p_receipt,payment_method=p_method,
    updated_at=now(),lease_token=null,lease_until=null where id=p_id;
  insert into public.stripe_events(id,purchase_id,event_type,session_id,payment_intent,status,refunded_amount,entitled_coins,wallet_delta,debt_delta)
    values(p_event,p_id,p_type,p_session,p_intent,p_state,p_refunded,p_entitled,v_move,v_debt-v_previous_debt);
end; $$;

revoke all on function public.begin_stripe_purchase(uuid,uuid,text,boolean) from public,anon,authenticated;
revoke all on function public.lock_stripe_purchase(uuid,uuid) from public,anon,authenticated;
revoke all on function public.apply_stripe_purchase(uuid,uuid,text,text,text,text,text,integer,bigint,text,text) from public,anon,authenticated;
grant execute on function public.begin_stripe_purchase(uuid,uuid,text,boolean) to service_role;
grant execute on function public.lock_stripe_purchase(uuid,uuid) to service_role;
grant execute on function public.apply_stripe_purchase(uuid,uuid,text,text,text,text,text,integer,bigint,text,text) to service_role;
