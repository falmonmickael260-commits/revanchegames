-- Codes promotionnels ponctuels : chaque compte peut utiliser chaque code une fois.
-- redeem_promo_code enregistre les rédemptions et crédite le portefeuille dans
-- une transaction atomique, sans changement de fonction ni d'accès client.
insert into public.promo_codes (code, reward_coins, active)
values
  ('DREAM10K', 10000, true),
  ('LEWIS10K', 10000, true)
on conflict (code) do update
set reward_coins = excluded.reward_coins,
    active = excluded.active;
