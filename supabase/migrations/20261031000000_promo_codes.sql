-- Revanche Game — codes promotionnels, pour tester le portefeuille de pièces
-- en attendant les paiements réels.
--
-- Réutilise le portefeuille déjà préparé (wallet_accounts / wallet_ledger,
-- voir 20261025000000_platform_core.sql, section 7) : une seule écriture
-- insère une ligne dans `wallet_ledger`, le trigger déjà en place recalcule
-- le solde — rien de neuf à construire côté portefeuille lui-même.

create table public.promo_codes (
  code text primary key,
  reward_coins bigint not null check (reward_coins > 0),
  active boolean not null default true,
  -- null = illimité / pas d'expiration.
  max_redemptions int,
  redemptions_count int not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.promo_codes (code),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Le vrai verrou anti-double-utilisation : même sous deux appels
  -- simultanés (double clic, deux onglets), un seul insert peut réussir.
  unique (code, user_id)
);

alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;

-- Pas de lecture directe de `promo_codes` : un code se vérifie en le
-- saisissant (via `redeem_promo_code`), pas en listant ceux qui existent.
create policy "promo_redemptions_select_own" on public.promo_redemptions
  for select using (auth.uid() = user_id);
-- Pas de policy insert pour authenticated/anon : uniquement via la fonction ci-dessous.

create or replace function public.redeem_promo_code(p_code text)
returns table (reward_coins bigint, new_balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  v_promo public.promo_codes;
  v_balance bigint;
begin
  if v_me is null then
    raise exception 'authentification requise' using errcode = '42501';
  end if;
  if v_code = '' then
    raise exception 'Ce code promotionnel est invalide ou expiré.' using errcode = '22023';
  end if;

  -- Verrouille la ligne : deux rédemptions du même code au même instant ne
  -- peuvent pas toutes les deux lire un `redemptions_count` périmé.
  select * into v_promo from public.promo_codes where code = v_code for update;

  if v_promo.code is null or not v_promo.active then
    raise exception 'Ce code promotionnel est invalide ou expiré.' using errcode = '22023';
  end if;
  if v_promo.expires_at is not null and v_promo.expires_at < now() then
    raise exception 'Ce code promotionnel est invalide ou expiré.' using errcode = '22023';
  end if;
  if v_promo.max_redemptions is not null and v_promo.redemptions_count >= v_promo.max_redemptions then
    raise exception 'Ce code promotionnel est invalide ou expiré.' using errcode = '22023';
  end if;

  begin
    insert into public.promo_redemptions (code, user_id) values (v_code, v_me);
  exception when unique_violation then
    -- Pas de code 23505 explicite : la façade cliente (src/lib/social/api.ts,
    -- `toMessage`) réécrirait ce message en "Action déjà effectuée." pour les
    -- vraies contraintes d'unicité ailleurs sur la plateforme — ici, un
    -- message spécifique est plus utile.
    raise exception 'Tu as déjà utilisé ce code promotionnel.';
  end;

  -- Une seule transaction : si l'une des deux écritures échoue, les deux
  -- sont annulées (transaction implicite de la fonction).
  insert into public.wallet_ledger (user_id, delta_coins, reason, reference)
  values (v_me, v_promo.reward_coins, 'reward', 'promo:' || v_code || ':' || v_me::text);

  update public.promo_codes set redemptions_count = redemptions_count + 1 where code = v_code;

  select balance_coins into v_balance from public.wallet_accounts where user_id = v_me;

  return query select v_promo.reward_coins, v_balance;
end;
$$;

grant execute on function public.redeem_promo_code(text) to authenticated;

-- Le code officiel : 1 500 pièces, une fois par compte, sans expiration,
-- usages illimités au global.
insert into public.promo_codes (code, reward_coins, active, max_redemptions, expires_at)
values ('REVANCHE1500', 1500, true, null, null)
on conflict (code) do nothing;

-- Le solde affiché dans l'en-tête se met à jour en direct.
alter publication supabase_realtime add table public.wallet_accounts;
