-- Même bonus et même historique pour REVANCHE1500 et son ancien alias RG1500.
insert into public.promo_codes (code, reward_coins, active)
values ('RG1500', 1500, true) on conflict (code) do nothing;

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
  if v_code = 'REVANCHE1500' then v_code := 'RG1500'; end if;
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

  if v_code = 'RG1500' and exists (
    select 1 from public.promo_redemptions where user_id = v_me and code in ('RG1500', 'REVANCHE1500')
  ) then
    raise exception 'Tu as déjà utilisé ce code promotionnel.';
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


-- La Meute : une récompense de 50 pièces par gagnant authentifié et résultat.
-- Le trigger et record_game_result s'exécutent dans la même transaction.
create or replace function public.reward_la_meute_winner()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if new.user_id is not null and new.outcome = 'win'
    and exists (select 1 from public.game_results where id = new.result_id and game_slug = 'la-meute') then
    insert into public.wallet_ledger (user_id, delta_coins, reason, reference)
    values (new.user_id, 50, 'reward', 'la-meute-win:' || new.result_id::text || ':' || new.user_id::text)
    on conflict (reference) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.reward_la_meute_winner() from public, anon, authenticated;
create trigger reward_la_meute_winner after insert on public.game_result_players
  for each row execute function public.reward_la_meute_winner();
