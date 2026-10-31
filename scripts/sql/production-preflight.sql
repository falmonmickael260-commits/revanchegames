-- Lecture seule. Exécuter sur le projet CENTRAL avant les deux migrations.
begin read only;
do $$
declare object_name text;
begin
  foreach object_name in array array['profiles','game_catalog','wallet_accounts','wallet_ledger','role_reservations','promo_codes','promo_redemptions','game_results','game_result_players'] loop
    if to_regclass('public.' || object_name) is null then
      raise exception 'Dépendance absente : %. Vérifier les migrations précédentes, sans les rejouer aveuglément.', object_name;
    end if;
  end loop;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='role_reservations' and column_name='charged') then
    raise exception 'La migration de débit différé semble déjà appliquée : exécuter le postflight et contrôler l''historique. Ne pas la rejouer.';
  end if;
  foreach object_name in array array['reserve_role(text,text,uuid,text,bigint)','resolve_role_reservations(text,text,uuid[])','cancel_role_reservations(text,text)','apply_wallet_ledger()','redeem_promo_code(text)','record_game_result(text,text,text,jsonb,jsonb)'] loop
    if to_regprocedure('public.' || object_name) is null then raise exception 'Fonction préalable absente : %', object_name; end if;
  end loop;
  foreach object_name in array array['wallet_accounts','wallet_ledger','role_reservations','promo_codes','promo_redemptions','game_results','game_result_players'] loop
    if not (select relrowsecurity from pg_class where oid=to_regclass('public.' || object_name)) then raise exception 'RLS désactivée : %', object_name; end if;
  end loop;
  if not exists (select 1 from public.game_catalog where slug='la-meute') then raise exception 'La Meute absente du catalogue'; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.promo_redemptions'::regclass and contype='u' and pg_get_constraintdef(oid)='UNIQUE (code, user_id)') then raise exception 'Unicité des codes promo absente'; end if;
  if not exists (select 1 from pg_constraint where conrelid='public.wallet_ledger'::regclass and contype='u' and pg_get_constraintdef(oid)='UNIQUE (reference)') then raise exception 'Unicité du journal financier absente'; end if;
  if not exists (select 1 from pg_trigger where tgrelid='public.wallet_ledger'::regclass and tgname='trg_wallet_ledger_apply' and tgenabled in ('O','A')) then raise exception 'Trigger portefeuille absent ou désactivé'; end if;
  if pg_get_functiondef('public.apply_wallet_ledger()'::regprocedure) not ilike '%update public.wallet_accounts%' then raise exception 'Correctif 20261031030000_wallet_trigger_fix non détecté'; end if;
end;
$$;
-- Conserver ces comptes comme référence avant/après. Aucun solde n'est affiché.
select 'profiles' as table_name, count(*) as row_count from public.profiles
union all select 'wallet_accounts',count(*) from public.wallet_accounts
union all select 'wallet_ledger',count(*) from public.wallet_ledger
union all select 'role_reservations',count(*) from public.role_reservations
union all select 'promo_redemptions',count(*) from public.promo_redemptions;
select status,count(*) from public.role_reservations group by status;
commit;
