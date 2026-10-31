-- Les demandes bloquent le montant disponible, mais le débit intervient
-- uniquement après attribution. Les anciennes demandes déjà débitées gardent
-- leur comportement de remboursement pendant le déploiement.
alter table public.role_reservations add column charged boolean not null default false;
update public.role_reservations set charged = true;

-- Tombstones : une annulation reçue avant une réservation réseau tardive
-- empêche cette dernière de recréer un montant bloqué.
create table public.cancelled_role_requests (
  id uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.cancelled_role_requests enable row level security;

drop function public.reserve_role(text, text, uuid, text, bigint);
create or replace function public.reserve_role(
  p_game_slug text, p_room_code text, p_user_id uuid,
  p_role_key text, p_price_coins bigint,
  p_reservation_id uuid default gen_random_uuid(),
  p_selection_ends_at timestamptz default (now() + interval '10 seconds')
)
returns table (reservation_id uuid, new_balance bigint)
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_balance bigint;
  v_held bigint;
  v_price bigint;
  v_existing public.role_reservations;
begin
  v_price := case p_role_key
    when 'villager' then 50 when 'werewolf' then 100
    when 'witch' then 150 when 'seer' then 150
    when 'black_wolf' then 200 when 'white_wolf' then 100
    when 'hunter' then 100 else null end;
  if p_game_slug is distinct from 'la-meute' or p_user_id is null
    or nullif(trim(p_room_code), '') is null or v_price is null
    or p_price_coins is distinct from v_price then
    raise exception 'rôle ou prix invalide' using errcode = '22023';
  end if;

  if p_reservation_id is null or p_selection_ends_at is null then
    raise exception 'paramètres invalides' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_reservation_id::text, 0));
  if exists (select 1 from public.cancelled_role_requests where id = p_reservation_id) then
    raise exception 'sélection terminée' using errcode = '55000';
  end if;
  select balance_coins into v_balance from public.wallet_accounts
    where user_id = p_user_id for update;
  select * into v_existing from public.role_reservations where id = p_reservation_id;
  if found then
    if v_existing.user_id <> p_user_id or v_existing.game_slug <> p_game_slug
      or v_existing.room_code <> p_room_code or v_existing.role_key <> p_role_key
      or v_existing.price_coins <> v_price or v_existing.status <> 'pending' then
      raise exception 'demande incompatible' using errcode = '22023';
    end if;
    return query select v_existing.id, v_balance;
    return;
  end if;
  if p_selection_ends_at <= clock_timestamp() or p_selection_ends_at > clock_timestamp() + interval '15 seconds' then
    raise exception 'sélection terminée' using errcode = '55000';
  end if;
  select coalesce(sum(price_coins), 0) into v_held from public.role_reservations
    where user_id = p_user_id and status = 'pending' and not charged;
  if coalesce(v_balance, 0) - v_held < v_price then
    raise exception 'solde insuffisant' using errcode = '55000';
  end if;
  begin
    insert into public.role_reservations (id, game_slug, room_code, user_id, role_key, price_coins)
    values (p_reservation_id, p_game_slug, p_room_code, p_user_id, p_role_key, v_price)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'une préférence de rôle est déjà réservée pour cette partie';
  end;
  return query select v_id, v_balance;
end;
$$;

-- Tous les autres achats respectent les montants réservés. Le solde affiché
-- reste inchangé tant qu'aucune attribution n'a été confirmée.
create or replace function public.apply_wallet_ledger()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_balance bigint; v_held bigint;
begin
  update public.wallet_accounts
    set balance_coins = balance_coins + new.delta_coins, updated_at = now()
    where user_id = new.user_id returning balance_coins into v_balance;
  if not found then
    insert into public.wallet_accounts (user_id, balance_coins, updated_at)
      values (new.user_id, new.delta_coins, now()) returning balance_coins into v_balance;
  end if;
  if new.delta_coins < 0 then
    select coalesce(sum(price_coins), 0) into v_held from public.role_reservations
      where user_id = new.user_id and status = 'pending' and not charged;
    if v_balance < v_held then
      raise exception 'solde insuffisant' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

drop function public.resolve_role_reservations(text, text, uuid[]);
create or replace function public.resolve_role_reservations(
  p_game_slug text, p_room_code text, p_granted_user_ids uuid[],
  p_reservation_ids uuid[] default null
)
returns void language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  -- Verrouiller les portefeuilles avant les demandes, comme reserve_role.
  perform 1 from public.wallet_accounts w where w.user_id in (
    select user_id from public.role_reservations
    where game_slug = p_game_slug and room_code = p_room_code and status = 'pending'
      and (p_reservation_ids is null or id = any(p_reservation_ids))
  ) order by w.user_id for update;
  for r in select * from public.role_reservations
    where game_slug = p_game_slug and room_code = p_room_code and status = 'pending'
      and (p_reservation_ids is null or id = any(p_reservation_ids))
    order by user_id for update
  loop
    -- Même ordre de verrouillage que reserve_role / les autres achats.
    perform 1 from public.wallet_accounts where user_id = r.user_id for update;
    if r.user_id = any(coalesce(p_granted_user_ids, '{}'::uuid[])) then
      update public.role_reservations set status = 'granted', charged = true, resolved_at = now() where id = r.id;
      if not r.charged then
        insert into public.wallet_ledger (user_id, delta_coins, reason, reference)
          values (r.user_id, -r.price_coins, 'purchase', 'role:' || r.id::text);
      end if;
    else
      update public.role_reservations set status = 'cancelled', resolved_at = now() where id = r.id;
      if r.charged then
        insert into public.wallet_ledger (user_id, delta_coins, reason, reference)
          values (r.user_id, r.price_coins, 'refund', 'role-refund:' || r.id::text)
          on conflict (reference) do nothing;
      end if;
    end if;
  end loop;
end;
$$;

create or replace function public.cancel_role_reservations(p_game_slug text, p_room_code text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  perform public.resolve_role_reservations(p_game_slug, p_room_code, '{}'::uuid[]);
end;
$$;

-- Une réponse réseau après fermeture de la sélection annule seulement cette
-- demande : ne pas toucher aux demandes de la manche suivante du même salon.
create or replace function public.cancel_role_reservation(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare r record;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_reservation_id::text, 0));
  insert into public.cancelled_role_requests (id) values (p_reservation_id) on conflict do nothing;
  perform 1 from public.wallet_accounts where user_id = (
    select user_id from public.role_reservations where id = p_reservation_id
  ) for update;
  select * into r from public.role_reservations
    where id = p_reservation_id and status = 'pending' for update;
  if not found then return; end if;
  update public.role_reservations set status = 'cancelled', resolved_at = now() where id = r.id;
  if r.charged then
    insert into public.wallet_ledger (user_id, delta_coins, reason, reference)
      values (r.user_id, r.price_coins, 'refund', 'role-refund:' || r.id::text)
      on conflict (reference) do nothing;
  end if;
end;
$$;

revoke all on function public.reserve_role(text, text, uuid, text, bigint, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.resolve_role_reservations(text, text, uuid[], uuid[]) from public, anon, authenticated;
revoke all on function public.cancel_role_reservations(text, text) from public, anon, authenticated;
revoke all on function public.cancel_role_reservation(uuid) from public, anon, authenticated;
grant execute on function public.cancel_role_reservation(uuid) to service_role;

grant execute on function public.resolve_role_reservations(text, text, uuid[], uuid[]) to service_role;

grant execute on function public.reserve_role(text, text, uuid, text, bigint, uuid, timestamptz) to service_role;
