-- Corrige `apply_wallet_ledger` : `INSERT ... ON CONFLICT (user_id) DO
-- UPDATE SET balance_coins = wallet_accounts.balance_coins + new.delta_coins`
-- ne fusionnait PAS avec la ligne existante sur cette base — vérifié en
-- isolation (table jetable, hors de toute fonction) : la même requête,
-- rejouée telle quelle contre une ligne déjà existante, produit un
-- "Failing row contains (id, -50)" au lieu de "(id, 50)" — c'est-à-dire
-- qu'elle utilisait la valeur brute insérée plutôt que la somme avec
-- l'existant. Une seconde transaction sur le même portefeuille écrasait donc
-- le solde au lieu de l'additionner.
--
-- Remplacé par le schéma pré-9.5 (update, puis insert seulement si aucune
-- ligne n'a été touchée) — revérifié correct en isolation sur cette même
-- base avant d'être appliqué ici.
create or replace function public.apply_wallet_ledger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.wallet_accounts
  set balance_coins = balance_coins + new.delta_coins,
      updated_at = now()
  where user_id = new.user_id;

  if not found then
    insert into public.wallet_accounts (user_id, balance_coins, updated_at)
    values (new.user_id, new.delta_coins, now());
  end if;

  return new;
end;
$$;
