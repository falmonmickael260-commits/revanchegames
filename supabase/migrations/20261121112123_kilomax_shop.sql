create table public.kilomax_vehicle_ownership (
  user_id uuid not null references public.profiles(id) on delete cascade,
  vehicle text not null check (vehicle in ('concept-gt', 'gt-circuit', 'pickup-classic', 'moto-amethyste', 'chenille')),
  primary key (user_id, vehicle)
);

create table public.kilomax_chest_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_key text not null,
  player_id text not null,
  reward text not null check (reward in ('purple', 'repair')),
  unique (user_id, match_key, player_id)
);

alter table public.kilomax_vehicle_ownership enable row level security;
alter table public.kilomax_chest_receipts enable row level security;
revoke all on public.kilomax_vehicle_ownership, public.kilomax_chest_receipts from public, anon, authenticated;
grant select, insert on public.kilomax_vehicle_ownership, public.kilomax_chest_receipts to service_role;

create function public.kilomax_shop(
  p_user uuid, p_action text, p_item text, p_match text, p_player text, p_expected_price integer
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_balance bigint;
  v_price integer;
  v_receipt public.kilomax_chest_receipts;
begin
  if p_user is null then return jsonb_build_object('error', 'login_required'); end if;
  if p_action = 'vehicle' then
    if p_item is null or p_item not in ('concept-gt', 'gt-circuit', 'pickup-classic', 'moto-amethyste', 'chenille') then
      return jsonb_build_object('error', 'invalid_item');
    end if;
    v_price := 500;
  elsif p_action = 'chest' then
    if p_item is null or p_item not in ('purple', 'repair') or
        coalesce(p_match, '') !~ '^[A-Za-z0-9_:-]{1,96}$' or
        coalesce(p_player, '') !~ '^[A-Za-z0-9_-]{1,96}$' then
      return jsonb_build_object('error', 'invalid_item');
    end if;
    v_price := 300;
  elsif p_action is distinct from 'catalog' then
    return jsonb_build_object('error', 'invalid_item');
  end if;

  if v_price is not null then
    if p_expected_price is distinct from v_price then return jsonb_build_object('error', 'price_changed'); end if;
    select balance_coins into v_balance from public.wallet_accounts where user_id = p_user for update;
    if p_action = 'vehicle' and not exists (
      select 1 from public.kilomax_vehicle_ownership where user_id = p_user and vehicle = p_item
    ) then
      if coalesce(v_balance, 0) < v_price then return jsonb_build_object('error', 'insufficient_balance'); end if;
      insert into public.kilomax_vehicle_ownership (user_id, vehicle) values (p_user, p_item);
      insert into public.wallet_ledger (user_id, delta_coins, reason, reference)
      values (p_user, -v_price, 'purchase', 'kilomax-vehicle:' || p_user || ':' || p_item);
    end if;
    if p_action = 'chest' then
      select * into v_receipt from public.kilomax_chest_receipts
      where user_id = p_user and match_key = p_match and player_id = p_player;
      if not found then
        if coalesce(v_balance, 0) < v_price then return jsonb_build_object('error', 'insufficient_balance'); end if;
        insert into public.kilomax_chest_receipts (user_id, match_key, player_id, reward)
        values (p_user, p_match, p_player, p_item) returning * into v_receipt;
        insert into public.wallet_ledger (user_id, delta_coins, reason, reference)
        values (p_user, -v_price, 'purchase', 'kilomax-chest:' || v_receipt.id);
      end if;
    end if;
  elsif p_match is not null and p_player is not null then
    select * into v_receipt from public.kilomax_chest_receipts
    where user_id = p_user and match_key = p_match and player_id = p_player;
  end if;

  return jsonb_build_object(
    'balance', coalesce((select balance_coins from public.wallet_accounts where user_id = p_user), 0),
    'owned', coalesce((select jsonb_agg(vehicle order by vehicle) from public.kilomax_vehicle_ownership where user_id = p_user), '[]'::jsonb),
    'receipt', case when v_receipt.id is not null then jsonb_build_object(
      'id', v_receipt.id, 'match', v_receipt.match_key, 'player', v_receipt.player_id, 'reward', v_receipt.reward
    ) end
  );
end;
$$;
revoke execute on function public.kilomax_shop(uuid, text, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.kilomax_shop(uuid, text, text, text, text, integer) to service_role;
