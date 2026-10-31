-- Revanche Game — préférences de rôle achetées avec des pièces, pour les
-- jeux qui le proposent (La Meute, pour commencer).
--
-- Appelée uniquement par le serveur de chaque jeu, avec sa clé service_role
-- (même modèle que record_game_result) — jamais par le navigateur. Le
-- serveur du jeu reste seul juge de qui obtient réellement le rôle demandé
-- (ça dépend de la composition de CETTE partie, qu'il est seul à connaître) :
-- ces fonctions ne font que débiter/créditer les pièces et garder une trace,
-- de façon atomique.

create table public.role_reservations (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null references public.game_catalog (slug),
  room_code text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_key text not null,
  price_coins bigint not null check (price_coins > 0),
  status text not null default 'pending' check (status in ('pending', 'granted', 'refunded', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Une seule réservation EN ATTENTE par (salon, joueur) — pas une contrainte
-- globale : une fois résolue (accordée/remboursée/annulée), la partie
-- suivante dans le même salon (La Meute garde le même code en rejouant) peut
-- en créer une nouvelle. Même principe que `game_invitations_one_pending`.
create unique index role_reservations_one_pending
  on public.role_reservations (game_slug, room_code, user_id)
  where status = 'pending';

create index role_reservations_room_idx
  on public.role_reservations (game_slug, room_code, status);

alter table public.role_reservations enable row level security;

create policy "role_reservations_select_own" on public.role_reservations
  for select using (auth.uid() = user_id);
-- Pas de policy insert/update : uniquement via les fonctions ci-dessous,
-- appelées par le serveur du jeu avec sa clé service_role.

-- Réserve un rôle : débite les pièces immédiatement (remboursées plus tard
-- si le rôle n'est finalement pas obtenu — voir resolve_role_reservations).
-- `p_user_id` vient du serveur appelant, jamais du navigateur : c'est lui qui
-- a déjà vérifié le jeton de la plateforme avant d'appeler cette fonction.
create or replace function public.reserve_role(
  p_game_slug text,
  p_room_code text,
  p_user_id uuid,
  p_role_key text,
  p_price_coins bigint
)
returns table (reservation_id uuid, new_balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_balance bigint;
begin
  if p_user_id is null or p_game_slug is null or p_room_code is null or p_role_key is null then
    raise exception 'paramètres invalides' using errcode = '22023';
  end if;
  if p_price_coins is null or p_price_coins <= 0 then
    raise exception 'prix invalide' using errcode = '22023';
  end if;

  select balance_coins into v_balance from public.wallet_accounts where user_id = p_user_id;
  if coalesce(v_balance, 0) < p_price_coins then
    raise exception 'solde insuffisant' using errcode = '55000';
  end if;

  begin
    insert into public.role_reservations (game_slug, room_code, user_id, role_key, price_coins)
    values (p_game_slug, p_room_code, p_user_id, p_role_key, p_price_coins)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'une préférence de rôle est déjà réservée pour cette partie';
  end;

  insert into public.wallet_ledger (user_id, delta_coins, reason, reference)
  values (p_user_id, -p_price_coins, 'purchase', 'role:' || v_id::text);

  select balance_coins into v_balance from public.wallet_accounts where user_id = p_user_id;

  return query select v_id, v_balance;
end;
$$;

-- Appelée une fois par le serveur du jeu au moment de la distribution des
-- rôles : `p_granted_user_ids` dit qui a réellement obtenu le rôle demandé
-- (décision qui dépend de la composition de cette partie précise, connue
-- seulement du serveur du jeu). Les autres réservations en attente de ce
-- salon sont remboursées.
create or replace function public.resolve_role_reservations(
  p_game_slug text,
  p_room_code text,
  p_granted_user_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select * from public.role_reservations
    where game_slug = p_game_slug and room_code = p_room_code and status = 'pending'
    for update
  loop
    if r.user_id = any (p_granted_user_ids) then
      update public.role_reservations set status = 'granted', resolved_at = now() where id = r.id;
    else
      update public.role_reservations set status = 'refunded', resolved_at = now() where id = r.id;
      -- `reference` est unique sur wallet_ledger : un remboursement ne peut
      -- donc jamais s'appliquer deux fois pour la même réservation, même si
      -- cette fonction était rejouée par erreur.
      insert into public.wallet_ledger (user_id, delta_coins, reason, reference)
      values (r.user_id, r.price_coins, 'refund', 'role-refund:' || r.id::text)
      on conflict (reference) do nothing;
    end if;
  end loop;
end;
$$;

-- Salon fermé/expiré avant la distribution des rôles (personne ne joue) :
-- rembourse tout ce qui restait en attente.
create or replace function public.cancel_role_reservations(p_game_slug text, p_room_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select * from public.role_reservations
    where game_slug = p_game_slug and room_code = p_room_code and status = 'pending'
    for update
  loop
    update public.role_reservations set status = 'cancelled', resolved_at = now() where id = r.id;
    insert into public.wallet_ledger (user_id, delta_coins, reason, reference)
    values (r.user_id, r.price_coins, 'refund', 'role-refund:' || r.id::text)
    on conflict (reference) do nothing;
  end loop;
end;
$$;

grant execute on function public.reserve_role(text, text, uuid, text, bigint) to service_role;
grant execute on function public.resolve_role_reservations(text, text, uuid[]) to service_role;
grant execute on function public.cancel_role_reservations(text, text) to service_role;
