-- Préserve les utilisations historiques : ne pas réécrire une clé référencée.
-- La migration 20261031050000 accepte les deux noms avec un seul bonus.
insert into public.promo_codes (code, reward_coins, active, max_redemptions, expires_at)
values ('RG1500', 1500, true, null, null)
on conflict (code) do nothing;
update public.promo_codes set active = false where code = 'REVANCHE1500';
