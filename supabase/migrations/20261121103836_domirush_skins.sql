create table public.domirush_skin_catalog (
  id text primary key,
  price_coins integer check (price_coins > 0)
);

insert into public.domirush_skin_catalog (id) values
  ('obsidian'), ('jade'), ('glacier'), ('ruby'), ('nebula');

create table public.domirush_skin_ownership (
  user_id uuid not null references public.profiles(id) on delete cascade,
  skin_id text not null references public.domirush_skin_catalog(id),
  primary key (user_id, skin_id)
);

create table public.domirush_skin_selection (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  skin_id text not null,
  foreign key (user_id, skin_id) references public.domirush_skin_ownership(user_id, skin_id) on delete cascade
);

alter table public.domirush_skin_catalog enable row level security;
alter table public.domirush_skin_ownership enable row level security;
alter table public.domirush_skin_selection enable row level security;
revoke all on public.domirush_skin_catalog, public.domirush_skin_ownership, public.domirush_skin_selection from public, anon, authenticated;
grant select on public.domirush_skin_catalog to service_role;
grant select, insert on public.domirush_skin_ownership to service_role;
grant select, insert, update, delete on public.domirush_skin_selection to service_role;

create function public.domirush_shop(p_action text, p_user uuid, p_skin text, p_expected_price integer)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  price integer;
  balance bigint;
begin
  if p_action is null or p_action not in ('catalog', 'buy', 'equip') then
    return jsonb_build_object('error', 'invalid_action');
  end if;

  if p_action <> 'catalog' and p_user is null then
    return jsonb_build_object('error', 'login_required');
  end if;

  if p_action = 'buy' then
    select price_coins into price from public.domirush_skin_catalog where id = p_skin;
    if not found or price is null then
      return jsonb_build_object('error', 'price_pending');
    end if;

    if p_expected_price is distinct from price then
      return jsonb_build_object('error', 'price_changed');
    end if;

    select balance_coins into balance from public.wallet_accounts where user_id = p_user for update;
    if not exists (select 1 from public.domirush_skin_ownership where user_id = p_user and skin_id = p_skin) then
      if coalesce(balance, 0) < price then
        return jsonb_build_object('error', 'insufficient_balance');
      end if;
      insert into public.domirush_skin_ownership (user_id, skin_id) values (p_user, p_skin);
      insert into public.wallet_ledger (user_id, delta_coins, reason, reference)
      values (p_user, -price, 'purchase', 'domirush-skin:' || p_user || ':' || p_skin);
    end if;
  end if;

  if p_action = 'equip' then
    if p_skin = 'classic' then
      delete from public.domirush_skin_selection where user_id = p_user;
    elsif exists (select 1 from public.domirush_skin_ownership where user_id = p_user and skin_id = p_skin) then
      insert into public.domirush_skin_selection (user_id, skin_id) values (p_user, p_skin)
      on conflict (user_id) do update set skin_id = excluded.skin_id;
    else
      return jsonb_build_object('error', 'not_owned');
    end if;
  end if;

  return jsonb_build_object(
    'balance', case when p_user is not null then coalesce((select balance_coins from public.wallet_accounts where user_id = p_user), 0) end,
    'equipped', coalesce((select skin_id from public.domirush_skin_selection where user_id = p_user), 'classic'),
    'owned', coalesce((select jsonb_agg(skin_id order by skin_id) from public.domirush_skin_ownership where user_id = p_user), '[]'::jsonb),
    'prices', (select jsonb_object_agg(id, price_coins) from public.domirush_skin_catalog)
  );
end;
$$;

revoke execute on function public.domirush_shop(text, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.domirush_shop(text, uuid, text, integer) to service_role;
