create table public.loto_rounds (
  id uuid primary key,
  host_uid uuid not null references public.profiles(id) on delete cascade,
  price integer not null check (price in (50, 100, 500, 1000)),
  status text not null default 'open' check (status in ('open', 'running', 'settled', 'cancelled')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  retained_coins bigint not null default 0 check (retained_coins >= 0)
);

create table public.loto_orders (
  id uuid primary key,
  round_id uuid not null references public.loto_rounds(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  refunded boolean not null default false
);

create index loto_orders_round_player_idx on public.loto_orders(round_id, user_id);
create index loto_rounds_expiry_idx on public.loto_rounds(expires_at) where status in ('open', 'running');
alter table public.loto_rounds enable row level security;
alter table public.loto_orders enable row level security;

create function public.loto_expire_round(p_round uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  round_row public.loto_rounds%rowtype;
  order_row public.loto_orders%rowtype;
begin
  select * into round_row from public.loto_rounds where id = p_round for update;
  if not found or round_row.expires_at > now() or round_row.status not in ('open', 'running') then
    return;
  end if;
  for order_row in
    select * from public.loto_orders where round_id = p_round and not refunded order by user_id, id
  loop
    insert into public.wallet_ledger(user_id, delta_coins, reason, reference)
    values (order_row.user_id, order_row.quantity::bigint * round_row.price, 'refund', 'loto:refund:' || order_row.id)
    on conflict (reference) do nothing;
  end loop;
  update public.loto_orders set refunded = true where round_id = p_round and not refunded;
  update public.loto_rounds set status = 'cancelled' where id = p_round;
end;
$$;

create function public.loto_wallet(
  p_action text, p_round uuid, p_uid uuid, p_price integer,
  p_quantity integer, p_request uuid, p_winners uuid[]
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  round_row public.loto_rounds%rowtype;
  order_row public.loto_orders%rowtype;
  participant record;
  total bigint;
  tickets bigint;
  refund_pool bigint := 0;
  per_ticket bigint;
  refund_remainder bigint;
  refund bigint;
  payout bigint;
  quine bigint;
  full_card bigint;
  winner uuid;
  stage integer;
  result_balance bigint;
  balances jsonb;
begin
  if p_action <> 'balance' then
    perform pg_advisory_xact_lock(786244, 1);
  end if;
  if p_action = 'sweep' then
    for participant in
      select id from public.loto_rounds
      where status in ('open', 'running') and expires_at <= now()
      order by expires_at limit 25
    loop
      perform public.loto_expire_round(participant.id);
    end loop;
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'balance' then
    select balance_coins into result_balance from public.wallet_accounts where user_id = p_uid;
    return jsonb_build_object('ok', true, 'balance', coalesce(result_balance, 0));
  end if;

  if p_action = 'create' then
    insert into public.loto_rounds(id, host_uid, price)
    values (p_round, p_uid, p_price) on conflict (id) do nothing;
  end if;

  select * into round_row from public.loto_rounds where id = p_round for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Salon indisponible.');
  end if;
  if p_action <> 'cancel' and round_row.status in ('open', 'running') and round_row.expires_at <= now() then
    perform public.loto_expire_round(p_round);
    return jsonb_build_object('ok', false, 'error', 'La partie a expiré. Les cartons ont été remboursés.');
  end if;

  if p_action = 'cancel' then
    if round_row.status in ('open', 'running') then
      update public.loto_rounds set expires_at = now() where id = p_round;
      perform public.loto_expire_round(p_round);
    end if;
    select jsonb_object_agg(a.user_id, a.balance_coins) into balances
    from public.wallet_accounts a where a.user_id in (select user_id from public.loto_orders where round_id = p_round);
    return jsonb_build_object('ok', round_row.status <> 'settled', 'balances', balances);
  end if;

  if p_action in ('buy', 'create') then
    if round_row.status <> 'open' or p_quantity is null or p_quantity < 1 or p_request is null then
      return jsonb_build_object('ok', false, 'error', 'Les achats sont fermés.');
    end if;
    if p_action = 'create' and (p_uid <> round_row.host_uid or p_price <> round_row.price) then
      raise exception 'Création incompatible';
    end if;
    select * into order_row from public.loto_orders where id = p_request;
    if found then
      if order_row.round_id <> p_round or order_row.user_id <> p_uid or order_row.quantity <> p_quantity or order_row.refunded then
        raise exception 'Commande incompatible';
      end if;
    else
      select balance_coins into result_balance from public.wallet_accounts where user_id = p_uid for update;
      total := p_quantity::bigint * round_row.price;
      if coalesce(result_balance, 0) < total then
        if p_action = 'create' and not exists (select 1 from public.loto_orders where round_id = p_round) then
          delete from public.loto_rounds where id = p_round;
        end if;
        return jsonb_build_object('ok', false, 'error', 'Solde insuffisant.');
      end if;
      insert into public.loto_orders(id, round_id, user_id, quantity) values (p_request, p_round, p_uid, p_quantity);
      insert into public.wallet_ledger(user_id, delta_coins, reason, reference)
      values (p_uid, -total, 'purchase', 'loto:buy:' || p_request);
    end if;
  elsif p_action = 'leave' then
    if round_row.status <> 'open' then
      return jsonb_build_object('ok', false, 'error', 'Le tirage a déjà commencé.');
    end if;
    for order_row in
      select * from public.loto_orders where round_id = p_round and user_id = p_uid and not refunded order by id
    loop
      insert into public.wallet_ledger(user_id, delta_coins, reason, reference)
      values (p_uid, order_row.quantity::bigint * round_row.price, 'refund', 'loto:refund:' || order_row.id)
      on conflict (reference) do nothing;
    end loop;
    update public.loto_orders set refunded = true where round_id = p_round and user_id = p_uid and not refunded;
  elsif p_action = 'start' then
    if round_row.status = 'running' then
      return jsonb_build_object('ok', true);
    end if;
    if round_row.status <> 'open' or (select count(distinct user_id) from public.loto_orders where round_id = p_round and not refunded) < 2 then
      return jsonb_build_object('ok', false, 'error', 'Il faut au moins deux joueurs.');
    end if;
    update public.loto_rounds set status = 'running', expires_at = now() + interval '20 minutes' where id = p_round;
  elsif p_action = 'settle' then
    if round_row.status = 'settled' then
      select jsonb_object_agg(a.user_id, a.balance_coins) into balances
      from public.wallet_accounts a where a.user_id in
        (select user_id from public.loto_orders where round_id = p_round and not refunded);
      return jsonb_build_object('ok', true, 'balances', balances);
    end if;
    if round_row.status <> 'running' or coalesce(array_length(p_winners, 1), 0) <> 3 then
      return jsonb_build_object('ok', false, 'error', 'Règlement du loto invalide.');
    end if;

    select sum(quantity::bigint) into tickets from public.loto_orders where round_id = p_round and not refunded;
    total := tickets * round_row.price;
    quine := total * 15 / 100;
    full_card := total / 2;
    for stage in 1..3 loop
      winner := p_winners[stage];
      payout := case when stage = 3 then full_card else quine end;
      if winner is null then
        refund_pool := refund_pool + payout;
      elsif not exists (select 1 from public.loto_orders where round_id = p_round and user_id = winner and not refunded) then
        raise exception 'Gagnant sans carton';
      end if;
    end loop;
    per_ticket := refund_pool / tickets;
    refund_remainder := refund_pool % tickets;

    for participant in
      select user_id, sum(quantity::bigint) as count from public.loto_orders
      where round_id = p_round and not refunded group by user_id order by user_id
    loop
      for stage in 1..3 loop
        if p_winners[stage] = participant.user_id then
          payout := case when stage = 3 then full_card else quine end;
          insert into public.wallet_ledger(user_id, delta_coins, reason, reference)
          values (participant.user_id, payout, 'reward', 'loto:prize:' || p_round || ':' || stage);
        end if;
      end loop;
      refund := per_ticket * participant.count + least(refund_remainder, participant.count);
      refund_remainder := greatest(0, refund_remainder - participant.count);
      if refund > 0 then
        insert into public.wallet_ledger(user_id, delta_coins, reason, reference)
        values (participant.user_id, refund, 'refund', 'loto:unclaimed:' || p_round || ':' || participant.user_id);
      end if;
    end loop;
    update public.loto_rounds set status = 'settled', retained_coins = total - quine * 2 - full_card where id = p_round;
    select jsonb_object_agg(a.user_id, a.balance_coins) into balances
    from public.wallet_accounts a where a.user_id in
      (select user_id from public.loto_orders where round_id = p_round and not refunded);
    return jsonb_build_object('ok', true, 'balances', balances);
  else
    return jsonb_build_object('ok', false, 'error', 'Opération inconnue.');
  end if;

  select balance_coins into result_balance from public.wallet_accounts where user_id = p_uid;
  return jsonb_build_object('ok', true, 'balance', coalesce(result_balance, 0));
end;
$$;

revoke execute on function public.loto_expire_round(uuid) from public, anon, authenticated;
revoke execute on function public.loto_wallet(text, uuid, uuid, integer, integer, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.loto_wallet(text, uuid, uuid, integer, integer, uuid, uuid[]) to service_role;

insert into public.game_catalog(slug, display_name, sort_order) values ('loto', 'Loto Revanche', 21) on conflict (slug) do nothing;
